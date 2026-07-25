from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from backend.database.session import get_db
from backend.database.models import User
from backend.auth.utils import hash_password, verify_password, get_current_user
from backend.auth.jwt import create_access_token

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

class RegisterSchema(BaseModel):
    username: str
    email: EmailStr
    password: str
    role: str = "Buyer"  # Buyer, Seller, Admin

class LoginSchema(BaseModel):
    username: str
    password: str

class ForgotPasswordSchema(BaseModel):
    email: EmailStr

class UserOutSchema(BaseModel):
    id: int
    username: str
    email: str
    role: str

    class Config:
        from_attributes = True

@router.post("/register", response_model=UserOutSchema)
def register(data: RegisterSchema, db: Session = Depends(get_db)):
    # Check if user already exists
    existing_user = db.query(User).filter(
        (User.username == data.username) | (User.email == data.email)
    ).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username or email already registered"
        )
    
    # Validate role
    if data.role not in ["Buyer", "Seller", "Admin"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user role selected"
        )

    hashed = hash_password(data.password)
    user = User(
        username=data.username,
        email=data.email,
        password_hash=hashed,
        role=data.role
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

@router.post("/login")
def login(data: LoginSchema, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == data.username).first()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password"
        )

    token = create_access_token({"sub": user.username})
    return {
        "access_token": token,
        "token_type": "bearer",
        "username": user.username,
        "role": user.role
    }

@router.post("/forgot-password")
def forgot_password(data: ForgotPasswordSchema, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found with this email"
        )
    # Simple simulated password recovery
    return {
        "message": f"Password reset instructions successfully sent to {data.email}."
    }

@router.get("/me", response_model=UserOutSchema)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user
