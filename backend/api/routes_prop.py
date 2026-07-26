from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime
import numpy as np
import math

from backend.database.session import get_db
from backend.database.models import Property, HistoricalPrice, MarketData, NearbyPlace
from backend.auth.utils import get_current_user, require_role
from backend.ml.recommendation import get_recommendations

router = APIRouter(prefix="/api", tags=["Properties & Market Analytics"])

class RecommendInputSchema(BaseModel):
    budget: float
    city: str
    locality: str
    bedrooms: int
    property_type: str

class CompareInputSchema(BaseModel):
    property_a_id: int
    property_b_id: int

@router.get("/properties")
def search_properties(
    q: str = None,
    city: str = None,
    locality: str = None,
    property_type: str = None,
    bedrooms: int = None,
    bathrooms: int = None,
    min_price: float = None,
    max_price: float = None,
    min_area: int = None,
    max_area: int = None,
    db: Session = Depends(get_db)
):
    query = db.query(Property)

    if q and q.strip():
        q_term = f"%{q.strip()}%"
        query = query.filter(
            (Property.property_name.ilike(q_term)) |
            (Property.city.ilike(q_term)) |
            (Property.locality.ilike(q_term)) |
            (Property.property_type.ilike(q_term))
        )
    if city and city.strip():
        query = query.filter(Property.city.ilike(f"%{city.strip()}%"))
    if locality and locality.strip():
        query = query.filter(
            (Property.locality.ilike(f"%{locality.strip()}%")) |
            (Property.property_name.ilike(f"%{locality.strip()}%"))
        )
    if property_type and property_type.strip():
        query = query.filter(Property.property_type.ilike(f"%{property_type.strip()}%"))
    if bedrooms:
        query = query.filter(Property.bedrooms == int(bedrooms))
    if bathrooms:
        query = query.filter(Property.bathrooms == int(bathrooms))
    if min_price:
        query = query.filter(Property.price_inr >= float(min_price))
    if max_price:
        query = query.filter(Property.price_inr <= float(max_price))
    if min_area:
        query = query.filter(Property.area_sqft >= int(min_area))
    if max_area:
        query = query.filter(Property.area_sqft <= int(max_area))

    properties = query.limit(100).all()
    return properties

@router.get("/properties/{property_id}")
def get_property_details(property_id: int, db: Session = Depends(get_db)):
    prop = db.query(Property).filter(Property.id == property_id).first()
    if not prop:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Property not found"
        )

    from backend.services.locationResolutionService import resolve_property_location
    from backend.services.googlePlacesService import fetch_google_nearby_places
    from backend.services.locationScoringService import compute_location_score

    # 1. Validate & Resolve Coordinates
    loc_res = resolve_property_location(
        prop.latitude, prop.longitude, prop.city, prop.locality, prop.id
    )

    # 2. Fetch live/cached Google Places API (New) Nearby Search results
    places_res = fetch_google_nearby_places(
        loc_res["resolvedLatitude"], loc_res["resolvedLongitude"], radius_meters=3000.0
    )

    # 3. Compute location score & features
    score_res = compute_location_score(places_res.get("places", []))

    # Get local price history for charts
    history = db.query(HistoricalPrice).filter(
        HistoricalPrice.city == prop.city,
        HistoricalPrice.locality == prop.locality
    ).order_by(HistoricalPrice.date.asc()).all()

    # Estimate rental yield
    rental_yield = round(2.0 + (prop.investment_score * 0.04), 2)  # yield between 2.0% and 6.0%

    # Build property dict with resolved coordinate fields
    prop_dict = {
        "id": prop.id,
        "property_name": prop.display_name,
        "real_project_name": prop.real_project_name,
        "city": prop.city,
        "locality": prop.locality,
        "originalLatitude": loc_res["originalLatitude"],
        "originalLongitude": loc_res["originalLongitude"],
        "resolvedLatitude": loc_res["resolvedLatitude"],
        "resolvedLongitude": loc_res["resolvedLongitude"],
        "latitude": loc_res["resolvedLatitude"],   # For map display
        "longitude": loc_res["resolvedLongitude"], # For map display
        "coordinate_status": loc_res["resolutionSource"],
        "property_type": prop.property_type,
        "area_sqft": prop.area_sqft,
        "bedrooms": prop.bedrooms,
        "bathrooms": prop.bathrooms,
        "floor": prop.floor,
        "parking": prop.parking,
        "furnishing": prop.furnishing,
        "age": prop.age,
        "investment_score": prop.investment_score,
        "risk_score": prop.risk_score,
        "location_score": score_res["location_score"],
        "location_score_breakdown": score_res["breakdown"],
        "price_inr": prop.price_inr,
        "image_url": prop.image_url,
    }

    return {
        "property": prop_dict,
        "location": loc_res,
        "nearby_google_places": places_res["places"],
        "places_metadata": {
            "data_source": places_res.get("data_source", "Google Places API (New)"),
            "last_updated": places_res.get("last_updated", datetime.now().strftime("%Y-%m-%d %H:%M:%S")),
            "total_count": places_res.get("count", len(places_res.get("places", [])))
        },
        "location_score_breakdown": score_res["breakdown"],
        "historical_prices": [{
            "date": h.date,
            "avg_price_sqft": h.avg_price_sqft,
            "avg_sale_price": h.avg_sale_price
        } for h in history[-24:]],
        "rental_yield": rental_yield,
        "image_gallery": [
            prop.image_url,
            "https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=600&q=80",
            "https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=600&q=80"
        ]
    }

@router.post("/recommend")
def recommend_properties(data: RecommendInputSchema, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    try:
        recommendations = get_recommendations(
            db=db,
            budget=data.budget,
            city=data.city,
            locality=data.locality,
            bedrooms=data.bedrooms,
            property_type=data.property_type
        )
        return recommendations
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

class CompareCoordsInputSchema(BaseModel):
    lat_a: float
    lon_a: float
    lat_b: float
    lon_b: float

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0  # Earth's radius in kilometers
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

def find_closest_property(db: Session, lat: float, lon: float):
    properties = db.query(Property).all()
    if not properties:
        return None, 0.0
    closest = None
    min_dist = float('inf')
    for p in properties:
        dist = haversine_distance(lat, lon, p.latitude, p.longitude)
        if dist < min_dist:
            min_dist = dist
            closest = p
    return closest, min_dist

def perform_comparison(p1: Property, p2: Property, db: Session):
    # Estimate yields
    y1 = round(2.0 + (p1.investment_score * 0.04), 2)
    y2 = round(2.0 + (p2.investment_score * 0.04), 2)

    # Fetch growth percentage for localities
    g1_query = db.query(HistoricalPrice).filter(HistoricalPrice.locality == p1.locality).order_by(HistoricalPrice.date.desc()).first()
    g2_query = db.query(HistoricalPrice).filter(HistoricalPrice.locality == p2.locality).order_by(HistoricalPrice.date.desc()).first()
    g1 = g1_query.growth_percentage if g1_query else 5.5
    g2 = g2_query.growth_percentage if g2_query else 5.5

    # Determine better property
    score_a = p1.investment_score - p1.risk_score
    score_b = p2.investment_score - p2.risk_score
    better = "A" if score_a >= score_b else "B"

    winning_reasons = []
    if better == "A":
        if p1.price_inr < p2.price_inr: winning_reasons.append("more budget-friendly")
        if p1.investment_score > p2.investment_score: winning_reasons.append("superior investment intelligence rating")
        if p1.risk_score < p2.risk_score: winning_reasons.append("safer risk profile")
        if y1 > y2: winning_reasons.append("higher rental yield")
    else:
        if p2.price_inr < p1.price_inr: winning_reasons.append("more budget-friendly")
        if p2.investment_score > p1.investment_score: winning_reasons.append("superior investment intelligence rating")
        if p2.risk_score < p1.risk_score: winning_reasons.append("safer risk profile")
        if y2 > y1: winning_reasons.append("higher rental yield")

    winning_name = p1.display_name if better == "A" else p2.display_name
    ai_reco = (
        f"We recommend **{winning_name}** because it is "
        f"{', '.join(winning_reasons) if winning_reasons else 'overall a better value match'}."
    )

    return {
        "property_a": {
            "id": p1.id,
            "property_name": p1.display_name,
            "city": p1.city,
            "locality": p1.locality,
            "price": p1.price_inr,
            "area": p1.area_sqft,
            "bedrooms": p1.bedrooms,
            "bathrooms": p1.bathrooms,
            "investment_score": p1.investment_score,
            "risk_score": p1.risk_score,
            "rental_yield": y1,
            "growth": g1,
            "image_url": p1.image_url,
            "latitude": p1.latitude,
            "longitude": p1.longitude
        },
        "property_b": {
            "id": p2.id,
            "property_name": p2.display_name,
            "city": p2.city,
            "locality": p2.locality,
            "price": p2.price_inr,
            "area": p2.area_sqft,
            "bedrooms": p2.bedrooms,
            "bathrooms": p2.bathrooms,
            "investment_score": p2.investment_score,
            "risk_score": p2.risk_score,
            "rental_yield": y2,
            "growth": g2,
            "image_url": p2.image_url,
            "latitude": p2.latitude,
            "longitude": p2.longitude
        },
        "better_property": better,
        "ai_recommendation": ai_reco
    }

@router.post("/compare")
def compare_properties(data: CompareInputSchema, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    p1 = db.query(Property).filter(Property.id == data.property_a_id).first()
    p2 = db.query(Property).filter(Property.id == data.property_b_id).first()

    if not p1 or not p2:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="One or both properties not found"
        )
    return perform_comparison(p1, p2, db)

@router.post("/compare/coordinates")
def compare_properties_by_coordinates(data: CompareCoordsInputSchema, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    p1, dist1 = find_closest_property(db, data.lat_a, data.lon_a)
    p2, dist2 = find_closest_property(db, data.lat_b, data.lon_b)

    if not p1 or not p2:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No properties found in database to compare"
        )
    
    comp_result = perform_comparison(p1, p2, db)
    comp_result["distance_a_km"] = round(dist1, 2)
    comp_result["distance_b_km"] = round(dist2, 2)
    return comp_result

@router.get("/market")
def get_market_intelligence(db: Session = Depends(get_db)):
    # Retrieve listings count
    listings_count = db.query(MarketData).count()
    
    # Counts by status
    status_counts = db.query(MarketData.status, func.count(MarketData.id)).group_by(MarketData.status).all()
    status_dict = {status: count for status, count in status_counts}

    # Avg listing price
    avg_price_query = db.query(func.avg(MarketData.price_inr)).first()
    avg_price = float(avg_price_query[0]) if avg_price_query[0] else 0.0

    # Top growing areas (localities sorted by highest growth in HistoricalPrice)
    top_growing = db.query(
        HistoricalPrice.city,
        HistoricalPrice.locality,
        func.avg(HistoricalPrice.growth_percentage).label("avg_growth"),
        func.avg(HistoricalPrice.demand_index).label("avg_demand")
    ).group_by(HistoricalPrice.city, HistoricalPrice.locality).order_by(func.avg(HistoricalPrice.growth_percentage).desc()).limit(5).all()

    growing_areas = [{
        "city": g.city,
        "locality": g.locality,
        "growth": round(float(g.avg_growth), 2),
        "demand_index": int(g.avg_demand)
    } for g in top_growing]

    # Chart data: Avg historical sale price across all dates
    date_trends = db.query(
        HistoricalPrice.date,
        func.avg(HistoricalPrice.avg_sale_price).label("avg_price"),
        func.avg(HistoricalPrice.demand_index).label("avg_demand")
    ).group_by(HistoricalPrice.date).order_by(HistoricalPrice.date.asc()).all()

    chart_data = [{
        "date": d.date,
        "price": float(d.avg_price),
        "demand": int(d.avg_demand)
    } for d in date_trends[-30:]]  # last 30 historical entries

    return {
        "listings_count": listings_count,
        "available_listings": status_dict.get("Available", 0),
        "pending_listings": status_dict.get("Pending", 0),
        "sold_listings": status_dict.get("Sold", 0),
        "average_price": avg_price,
        "top_growing_areas": growing_areas,
        "price_trend_chart": chart_data
    }

@router.get("/nearby")
def get_nearby_amenities(city: str, locality: str, db: Session = Depends(get_db)):
    places = db.query(NearbyPlace).filter(
        NearbyPlace.city == city,
        NearbyPlace.locality == locality
    ).all()
    return places

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
    price_inr: float

import os
import joblib

MODELS_PATH = "backend/ml/saved_models"
inv_model = None
risk_model = None
encoders = None

def get_ml_scores(data: PropertyCreateSchema):
    global inv_model, risk_model, encoders
    
    # Try to load models if not already loaded
    if inv_model is None:
        try:
            if os.path.exists(os.path.join(MODELS_PATH, "encoders.joblib")):
                inv_model = joblib.load(os.path.join(MODELS_PATH, "investment_model.joblib"))
                risk_model = joblib.load(os.path.join(MODELS_PATH, "risk_model.joblib"))
                encoders = joblib.load(os.path.join(MODELS_PATH, "encoders.joblib"))
        except Exception as e:
            print(f"Error loading models in routes_prop: {e}")

    # Fallbacks if models aren't trained or fail to load
    inv_score = 75
    risk_score = 45

    if inv_model is not None and risk_model is not None and encoders is not None:
        try:
            # Helper to encode categoricals
            def encode_val(col, val):
                le = encoders[col]
                val_clean = str(val).strip()
                classes_lower = [c.lower() for c in le.classes_]
                if val_clean.lower() in classes_lower:
                    idx = classes_lower.index(val_clean.lower())
                    return int(le.transform([le.classes_[idx]])[0])
                return int(le.transform([le.classes_[0]])[0])

            city_encoded = encode_val("City", data.city)
            locality_encoded = encode_val("Locality", data.locality)
            type_encoded = encode_val("Property_Type", data.property_type)
            parking_encoded = encode_val("Parking", data.parking)
            furnishing_encoded = encode_val("Furnishing", data.furnishing)

            features_vector = np.array([[
                city_encoded,
                locality_encoded,
                data.latitude,
                data.longitude,
                type_encoded,
                data.area_sqft,
                data.bedrooms,
                data.bathrooms,
                data.floor,
                data.age,
                parking_encoded,
                furnishing_encoded
            ]])

            inv_score = int(inv_model.predict(features_vector)[0])
            inv_score = min(100, max(0, inv_score))

            risk_score = int(risk_model.predict(features_vector)[0])
            risk_score = min(100, max(0, risk_score))
        except Exception as e:
            print(f"Prediction failed in routes_prop: {e}")

    return inv_score, risk_score

@router.get("/seller/properties")
def get_seller_properties(db: Session = Depends(get_db), current_user = Depends(require_role(["Seller", "Admin"]))):
    if current_user.role == "Admin":
        return db.query(Property).all()
    return db.query(Property).filter(Property.owner_id == current_user.id).all()

@router.post("/properties")
def create_property_listing(data: PropertyCreateSchema, db: Session = Depends(get_db), current_user = Depends(require_role(["Seller", "Admin"]))):
    inv_score, risk_score = get_ml_scores(data)

    # Rotate unsplash images based on property type
    from backend.database.seed import get_image
    image_url = get_image(data.property_type, np.random.randint(100))

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
        investment_score=inv_score,
        risk_score=risk_score,
        price_inr=data.price_inr,
        image_url=image_url,
        owner_id=current_user.id
    )

    db.add(prop)
    db.commit()
    db.refresh(prop)
    return prop

@router.put("/properties/{property_id}")
def update_property_listing(property_id: int, data: PropertyCreateSchema, db: Session = Depends(get_db), current_user = Depends(require_role(["Seller", "Admin"]))):
    prop = db.query(Property).filter(Property.id == property_id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    
    # Check ownership
    if current_user.role != "Admin" and prop.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="You do not own this property listing")

    inv_score, risk_score = get_ml_scores(data)

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
    prop.investment_score = inv_score
    prop.risk_score = risk_score
    prop.price_inr = data.price_inr

    db.commit()
    db.refresh(prop)
    return prop

@router.delete("/properties/{property_id}")
def delete_property_listing(property_id: int, db: Session = Depends(get_db), current_user = Depends(require_role(["Seller", "Admin"]))):
    prop = db.query(Property).filter(Property.id == property_id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")

    # Check ownership
    if current_user.role != "Admin" and prop.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="You do not own this property listing")

    db.delete(prop)
    db.commit()
    return {"message": "Listing deleted successfully", "property_id": property_id}

@router.get("/properties/search")
def search_properties_advanced(
    city: str = None,
    locality: str = None,
    property_type: str = None,
    bedrooms: int = None,
    bathrooms: int = None,
    min_price: float = None,
    max_price: float = None,
    min_area: int = None,
    max_area: int = None,
    db: Session = Depends(get_db)
):
    return search_properties(city, locality, property_type, bedrooms, bathrooms, min_price, max_price, min_area, max_area, db)

@router.get("/localities/{name}")
def get_locality_details(name: str, city: str = "Hyderabad", db: Session = Depends(get_db)):
    from backend.services.marketTrendService import get_locality_market_trends
    trends = get_locality_market_trends(city, name, db)
    return {
        "city": city,
        "locality": name,
        "active_listings_count": trends["listings_count"],
        "avg_price_sqft": trends["avg_price_sqft"],
        "demand_indicator": trends["demand_indicator"],
        "data_source": trends["data_source"],
        "last_updated": trends["last_updated"]
    }

@router.get("/localities/{name}/trends")
def get_locality_trends(name: str, city: str = "Hyderabad", db: Session = Depends(get_db)):
    from backend.services.marketTrendService import get_locality_market_trends
    trends = get_locality_market_trends(city, name, db)
    return trends

@router.get("/amenities")
def get_nearby_amenities_endpoint(lat: float, lon: float, city: str = "Hyderabad", locality: str = "Madhapur", db: Session = Depends(get_db)):
    from backend.services.placesService import google_fetch_nearby_places
    return google_fetch_nearby_places(lat, lon, city, locality, db)

@router.get("/comparables")
def get_comparable_properties_endpoint(
    city: str,
    locality: str,
    lat: float,
    lon: float,
    property_type: str,
    area_sqft: int,
    bedrooms: int,
    db: Session = Depends(get_db)
):
    from backend.services.comparablePropertyService import find_comparable_properties
    comps = find_comparable_properties(city, locality, lat, lon, property_type, area_sqft, bedrooms, db)
    return comps

@router.get("/location/search")
def autocomplete_address_proxy(input: str, db: Session = Depends(get_db)):
    import os
    import urllib.parse
    import requests
    api_key = os.getenv("GOOGLE_MAPS_API_KEY", "").strip()
    if not api_key:
        return {"predictions": [], "status": "ZERO_RESULTS"}
    referer_header = os.getenv("APP_REFERER", "https://propvalue-ai-i2hd.vercel.app/").strip()
    headers = {"Referer": referer_header}
    url = f"https://maps.googleapis.com/maps/api/place/autocomplete/json?input={urllib.parse.quote(input)}&key={api_key}&components=country:in"
    try:
        res = requests.get(url, headers=headers, timeout=5)
        data = res.json()
        if data.get("status") == "REQUEST_DENIED":
            print(f"[Places Autocomplete] REQUEST_DENIED: {data.get('error_message', '')} — Key has referrer restrictions blocking server calls.")
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/location/geocode")
def geocode_address_endpoint(address: str, db: Session = Depends(get_db)):
    from backend.services.geocodingService import google_geocode_address
    return google_geocode_address(address)

@router.get("/places/nearby")
def get_nearby_google_places_endpoint(
    lat: float,
    lon: float,
    city: str = "Hyderabad",
    locality: str = "Madhapur",
    property_id: int = 1,
    radius: float = 3000.0,
    db: Session = Depends(get_db)
):
    from backend.services.locationResolutionService import resolve_property_location
    from backend.services.googlePlacesService import fetch_google_nearby_places
    from backend.services.locationScoringService import compute_location_score

    # 1. Resolve coordinates
    loc_res = resolve_property_location(lat, lon, city, locality, property_id)

    # 2. Query Google Places (New) searchNearby
    places_data = fetch_google_nearby_places(
        loc_res["resolvedLatitude"],
        loc_res["resolvedLongitude"],
        radius_meters=radius
    )

    # 3. Compute deterministic location score and features
    score_data = compute_location_score(places_data.get("places", []))

    return {
        "location": loc_res,
        "location_score": score_data["location_score"],
        "location_score_breakdown": score_data["breakdown"],
        "location_features": score_data["features"],
        "places_metadata": {
            "data_source": places_data["data_source"],
            "last_updated": places_data["last_updated"],
            "total_count": places_data["total_count"]
        },
        "places": places_data["places"]
    }



