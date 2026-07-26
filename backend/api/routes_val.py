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

# Absolute path resolution for model loading
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MODELS_PATH = os.path.join(BASE_DIR, "backend", "ml", "saved_models")

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
        print(f"Warning: Failed to load models from {MODELS_PATH}: {e}")

class ValuationInputSchema(BaseModel):
    property_type: str
    city: str
    locality: str
    area_sqft: float
    bedrooms: int | None = 0
    bathrooms: int | None = 0
    floor: int | None = 0
    age: int | None = 0
    parking: str | None = "No"
    furnishing: str | None = "Unfurnished"
    latitude: float | None = None
    longitude: float | None = None
    address_str: str | None = None

class ForecastInputSchema(BaseModel):
    city: str
    locality: str
    current_price: float

@router.post("/predict")
def predict_property_valuation(
    data: ValuationInputSchema,
    db: Session = Depends(get_db),
    current_user = Depends(get_optional_current_user)
):
    try:
        user_id = current_user.id if current_user else None
        res = execute_property_valuation(
            user_id=user_id,
            property_type=data.property_type,
            city=data.city,
            locality=data.locality,
            area_sqft=data.area_sqft,
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
        print(f"[Valuation API Error]: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Valuation failed: {str(e)}"
        )

@router.post("/forecast")
def forecast_price(data: ForecastInputSchema):
    try:
        res = forecast_locality_prices(data.city, data.locality, data.current_price)
        return res
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Forecast failed: {str(e)}"
        )
