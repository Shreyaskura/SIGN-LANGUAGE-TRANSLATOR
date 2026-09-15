from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Gesture, GestureSchema

router = APIRouter(prefix="/api/gestures", tags=["Sign Dictionary"])

@router.get("/", response_model=List[GestureSchema])
def get_all_gestures(category: str = None, db: Session = Depends(get_db)):
    query = db.query(Gesture)
    if category and category.lower() != "all":
        query = query.filter(Gesture.category.ilike(category))
    return query.all()

@router.post("/", response_model=GestureSchema, status_code=status.HTTP_201_CREATED)
def create_gesture(gesture_data: GestureSchema, db: Session = Depends(get_db)):
    existing = db.query(Gesture).filter(Gesture.sign_name == gesture_data.sign_name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Gesture already exists in dictionary.")

    new_gesture = Gesture(
        sign_name=gesture_data.sign_name,
        category=gesture_data.category,
        description=gesture_data.description,
        gesture_image_url=gesture_data.gesture_image_url
    )
    db.add(new_gesture)
    db.commit()
    db.refresh(new_gesture)
    return new_gesture
