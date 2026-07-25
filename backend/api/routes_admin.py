from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List

from backend.database.session import get_db
from backend.database.models import User, Property, Prediction, ChatHistory
from backend.auth.utils import require_role

router = APIRouter(prefix="/api/admin", tags=["Admin Operations"], dependencies=[Depends(require_role(["Admin"]))])

class UserUpdateSchema(BaseModel):
    role: str

class PropertyCreateSchema(BaseModel):
    city: str
    locality: str
    latitude: float
    longitude: float
    property_type: str
    area_sqft: int
    bedrooms: int
    bathrooms: int
    floor: int
    parking: str
    furnishing: str
    age: int
    investment_score: int
    risk_score: int
    price_inr: float

# Admin Users management
@router.get("/users")
def list_users(db: Session = Depends(get_db)):
    users = db.query(User).all()
    return [{"id": u.id, "username": u.username, "email": u.email, "role": u.role, "created_at": u.created_at} for u in users]

@router.put("/users/{user_id}")
def update_user_role(user_id: int, data: UserUpdateSchema, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if data.role not in ["Buyer", "Seller", "Admin"]:
        raise HTTPException(status_code=400, detail="Invalid role type")
    user.role = data.role
    db.commit()
    return {"message": "User role updated successfully", "username": user.username, "role": user.role}

@router.delete("/users/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(user)
    db.commit()
    return {"message": "User deleted successfully"}

# Admin Properties management
@router.post("/properties")
def create_property(data: PropertyCreateSchema, db: Session = Depends(get_db)):
    prop = Property(
        city=data.city,
        locality=data.locality,
        latitude=data.latitude,
        longitude=data.longitude,
        property_type=data.property_type,
        area_sqft=data.area_sqft,
        bedrooms=data.bedrooms,
        bathrooms=data.bathrooms,
        floor=data.floor,
        parking=data.parking,
        furnishing=data.furnishing,
        age=data.age,
        investment_score=data.investment_score,
        risk_score=data.risk_score,
        price_inr=data.price_inr,
        image_url="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=600&q=80"
    )
    db.add(prop)
    db.commit()
    db.refresh(prop)
    return prop

@router.put("/properties/{property_id}")
def update_property(property_id: int, data: PropertyCreateSchema, db: Session = Depends(get_db)):
    prop = db.query(Property).filter(Property.id == property_id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    
    prop.city = data.city
    prop.locality = data.locality
    prop.latitude = data.latitude
    prop.longitude = data.longitude
    prop.property_type = data.property_type
    prop.area_sqft = data.area_sqft
    prop.bedrooms = data.bedrooms
    prop.bathrooms = data.bathrooms
    prop.floor = data.floor
    prop.parking = data.parking
    prop.furnishing = data.furnishing
    prop.age = data.age
    prop.investment_score = data.investment_score
    prop.risk_score = data.risk_score
    prop.price_inr = data.price_inr
    
    db.commit()
    return prop

@router.delete("/properties/{property_id}")
def delete_property(property_id: int, db: Session = Depends(get_db)):
    prop = db.query(Property).filter(Property.id == property_id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    db.delete(prop)
    db.commit()
    return {"message": "Property deleted successfully"}

# Admin review of usage analytics
@router.get("/analytics")
def get_admin_analytics(db: Session = Depends(get_db)):
    user_count = db.query(User).count()
    property_count = db.query(Property).count()
    prediction_count = db.query(Prediction).count()
    chat_count = db.query(ChatHistory).count()

    recent_predictions = db.query(Prediction).order_by(Prediction.created_at.desc()).limit(10).all()
    predictions_list = [{
        "id": p.id,
        "property_type": p.property_type,
        "city": p.city,
        "locality": p.locality,
        "predicted_price": p.predicted_price,
        "confidence_score": p.confidence_score,
        "created_at": p.created_at
    } for p in recent_predictions]

    return {
        "user_count": user_count,
        "property_count": property_count,
        "prediction_count": prediction_count,
        "chat_count": chat_count,
        "recent_predictions": predictions_list
    }
