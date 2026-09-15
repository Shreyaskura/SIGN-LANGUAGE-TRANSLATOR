from datetime import datetime
from typing import Optional, List
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Boolean, Text, Numeric
from sqlalchemy.orm import relationship
from pydantic import BaseModel, EmailStr

from app.database import Base

# ============================================================================
# SQLALCHEMY ORM MODELS (Relational 3NF Schema)
# ============================================================================

class User(Base):
    __tablename__ = "users"

    user_id = Column(Integer, primary_index=True, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(100), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), default="user")
    created_at = Column(DateTime, default=datetime.utcnow)

    translations = relationship("TranslationHistory", back_populates="user", cascade="all, delete-orphan")


class Gesture(Base):
    __tablename__ = "gestures"

    gesture_id = Column(Integer, primary_key=True, index=True)
    sign_name = Column(String(50), unique=True, nullable=False, index=True)
    category = Column(String(30), nullable=False, index=True)
    description = Column(Text, nullable=True)
    gesture_image_url = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    translations = relationship("TranslationHistory", back_populates="gesture")


class TranslationHistory(Base):
    __tablename__ = "translation_history"

    history_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False, index=True)
    gesture_id = Column(Integer, ForeignKey("gestures.gesture_id", ondelete="SET NULL"), nullable=True)
    recognized_text = Column(String(100), nullable=False)
    confidence_score = Column(Float, nullable=False)
    output_mode = Column(String(10), default="text")
    translated_at = Column(DateTime, default=datetime.utcnow, index=True)

    user = relationship("User", back_populates="translations")
    gesture = relationship("Gesture", back_populates="translations")
    feedback = relationship("TranslationFeedback", uselist=False, back_populates="translation")


class TranslationFeedback(Base):
    __tablename__ = "translation_feedback"

    feedback_id = Column(Integer, primary_key=True, index=True)
    history_id = Column(Integer, ForeignKey("translation_history.history_id", ondelete="CASCADE"), unique=True, nullable=False)
    actual_gesture_id = Column(Integer, ForeignKey("gestures.gesture_id"), nullable=True)
    is_correct = Column(Boolean, nullable=False)
    user_notes = Column(Text, nullable=True)
    submitted_at = Column(DateTime, default=datetime.utcnow)

    translation = relationship("TranslationHistory", back_populates="feedback")

# ============================================================================
# PYDANTIC VALIDATION SCHEMAS (API Request/Response Models)
# ============================================================================

class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    user_id: int
    username: str
    email: str
    role: str
    created_at: datetime

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str

class GestureSchema(BaseModel):
    gesture_id: Optional[int] = None
    sign_name: str
    category: str
    description: Optional[str] = None
    gesture_image_url: Optional[str] = None

    class Config:
        from_attributes = True

class TranslationCreate(BaseModel):
    gesture_name: str
    confidence_score: float
    output_mode: Optional[str] = "text"

class TranslationResponse(BaseModel):
    history_id: int
    user_id: int
    recognized_text: str
    confidence_score: float
    output_mode: str
    translated_at: datetime

    class Config:
        from_attributes = True

class KeypointSchema(BaseModel):
    id: int
    x: float
    y: float
    z: float

class LandmarkStreamSchema(BaseModel):
    session_id: str
    detected_gesture: str
    confidence: float
    keypoints: List[KeypointSchema]
