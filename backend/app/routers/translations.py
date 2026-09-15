from datetime import datetime
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db, mongo_db
from app.models import TranslationHistory, TranslationCreate, TranslationResponse, LandmarkStreamSchema, Gesture, User
from app.gesture_classifier import classify_landmarks

router = APIRouter(prefix="/api/translations", tags=["Translation Logs & NoSQL Streams"])

# Fallback in-memory MongoDB buffer if MongoDB server is offline locally
in_memory_mongo_buffer = []

@router.get("/", response_model=List[TranslationResponse])
def get_translation_history(limit: int = 20, db: Session = Depends(get_db)):
    return db.query(TranslationHistory).order_by(TranslationHistory.translated_at.desc()).limit(limit).all()

@router.post("/", response_model=TranslationResponse, status_code=status.HTTP_201_CREATED)
def create_translation_log(data: TranslationCreate, db: Session = Depends(get_db)):
    # Default system user_id 1
    user = db.query(User).first()
    user_id = user.user_id if user else 1

    # Find matching gesture in dictionary
    gesture = db.query(Gesture).filter(Gesture.sign_name == data.gesture_name).first()
    gesture_id = gesture.gesture_id if gesture else None

    new_log = TranslationHistory(
        user_id=user_id,
        gesture_id=gesture_id,
        recognized_text=data.gesture_name,
        confidence_score=data.confidence_score,
        output_mode=data.output_mode or "text",
        translated_at=datetime.utcnow()
    )
    db.add(new_log)
    db.commit()
    db.refresh(new_log)
    return new_log

@router.post("/landmarks", status_code=status.HTTP_201_CREATED)
def stream_landmark_keypoints(data: LandmarkStreamSchema):
    """
    Stores high-frequency 3D hand keypoints into MongoDB NoSQL document store.
    """
    document = {
        "session_id": data.session_id,
        "detected_gesture": data.detected_gesture,
        "confidence": data.confidence,
        "keypoints": [kp.model_dump() for kp in data.keypoints],
        "created_at": datetime.utcnow()
    }

    if mongo_db is not None:
        try:
            result = mongo_db["landmark_streams"].insert_one(document)
            return {"status": "success", "db": "MongoDB", "inserted_id": str(result.inserted_id)}
        except Exception as e:
            pass

    # Fallback to buffer
    in_memory_mongo_buffer.append(document)
    return {"status": "success", "db": "In-Memory NoSQL Buffer", "total_buffered": len(in_memory_mongo_buffer)}
