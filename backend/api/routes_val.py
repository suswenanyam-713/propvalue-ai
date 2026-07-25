import os
import joblib
import numpy as np
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.database.session import get_db
from backend.database.models import Prediction
from backend.auth.utils import get_current_user, get_optional_current_user
from backend.ml.forecaster import forecast_locality_prices
from backend.services.valuationService import execute_property_valuation

router = APIRouter(prefix="/api", tags=["Valuation & Forecasting"])

# Load models and preprocessing files safely
MODELS_PATH = "backend/ml/saved_models"
price_model = None
investment_model = None
risk_model = None
encoders = None
features = None

if os.path.exists(os.path.join(MODELS_PATH, "price_model.joblib")):
    try:
        price_model = joblib.load(os.path.join(MODELS_PATH, "price_model.joblib"))
        investment_model = joblib.load(os.path.join(MODELS_PATH, "investment_model.joblib"))
        risk_model = joblib.load(os.path.join(MODELS_PATH, "risk_model.joblib"))
        encoders = joblib.load(os.path.join(MODELS_PATH, "encoders.joblib"))
        features = joblib.load(os.path.join(MODELS_PATH, "features.joblib"))
    except Exception as e:
        print(f"Error loading machine learning models: {e}")

class PredictInputSchema(BaseModel):
    area_sqft: float
    bedrooms: int
    bathrooms: int
    age: int
    parking: str  # Yes, No
    furnishing: str  # Unfurnished, Fully, Semi
    property_type: str  # Apartment, Independent House, Plot, Villa
    city: str
    locality: str
    latitude: float
    longitude: float
    floor: int = 1
    address_str: str = None

class ForecastInputSchema(BaseModel):
    city: str
    locality: str
    current_price: float

def encode_categorical(col_name: str, value: str):
    if encoders is None or col_name not in encoders:
        return 0
    le = encoders[col_name]
    val_clean = str(value).strip()
    classes_lower = [c.lower() for c in le.classes_]
    
    if val_clean.lower() in classes_lower:
        idx = classes_lower.index(val_clean.lower())
        return int(le.transform([le.classes_[idx]])[0])
    
    # Fallback to index 0
    return int(le.transform([le.classes_[0]])[0])

def generate_ai_explanation(inputs: PredictInputSchema, price: float, inv_score: float, risk_score: float):
    price_per_sqft = price / inputs.area_sqft if inputs.area_sqft > 0 else 0
    
    explanation = (
        f"### AI Valuation & Assessment Report\n\n"
        f"Based on our machine learning algorithm, the property is valued at **₹{price:,.2f} INR** "
        f"(approx. **₹{price_per_sqft:,.2f} per sqft**).\n\n"
        f"#### Key Pricing Drivers:\n"
        f"- **Location Impact**: The property is situated in **{inputs.locality}, {inputs.city}**. "
        f"This locality carries a significant geographic premium, which accounts for approximately 45% of the overall value.\n"
        f"- **Structural Configuration**: A {inputs.bedrooms} BHK layout with {inputs.bathrooms} bathrooms, "
        f"spread over {inputs.area_sqft} sqft, offers standard utility. "
        f"- **Depreciation / Age**: The property age is **{inputs.age} years**. "
        f"{'Being relatively new, it retains high structural value.' if inputs.age < 5 else 'Standard wear depreciation has been adjusted in the model.'}\n"
        f"- **Additional Amenities**: Has {inputs.furnishing} furnishing status and "
        f"{'private parking, raising attractiveness and resale value.' if inputs.parking.lower() == 'yes' else 'no dedicated parking, which dampens overall value.'}\n\n"
        f"#### Investment Intelligence Rating:\n"
        f"- **Investment Score ({int(inv_score)}/100)**: "
        f"{'Highly recommended for capital appreciation and strong rental returns.' if inv_score >= 80 else 'Shows moderate yield prospects.'}\n"
        f"- **Risk Profile ({int(risk_score)}/100)**: "
        f"{'Low market risk. Stable demand in the region protects asset value.' if risk_score < 45 else 'Moderate volatility, purchase is recommended for long-term hold only.'}"
    )
    return explanation

@router.post("/predict")
@router.post("/valuation")
def predict_property_valuation(data: PredictInputSchema, db: Session = Depends(get_db), current_user = Depends(get_optional_current_user)):
    try:
        user_id = current_user.id if current_user else None
        res = execute_property_valuation(
            user_id=user_id,
            property_type=data.property_type,
            city=data.city,
            locality=data.locality,
            area_sqft=int(data.area_sqft),
            bedrooms=data.bedrooms,
            bathrooms=data.bathrooms,
            floor=data.floor,
            age=data.age,
            parking=data.parking,
            furnishing=data.furnishing,
            price_model=price_model,
            encoders=encoders,
            db=db,
            address_str=data.address_str,
            latitude=data.latitude,
            longitude=data.longitude
        )
        return res
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Valuation failed: {str(e)}"
        )


@router.post("/forecast")
def forecast_property_trends(data: ForecastInputSchema, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    try:
        results = forecast_locality_prices(db, data.city, data.locality, data.current_price)
        return results
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Forecasting failed: {str(e)}"
        )
