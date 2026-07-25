from sqlalchemy.orm import Session
from backend.database.models import Property
from backend.services.amenitiesService import calculate_haversine_distance

def find_comparable_properties(
    city: str,
    locality: str,
    lat: float,
    lon: float,
    prop_type: str,
    area_sqft: int,
    bedrooms: int,
    db: Session,
    max_comparables: int = 5
) -> list[dict]:
    """
    Finds the most relevant comparable properties based on:
    - Same city (and matching locality first)
    - Same property type
    - Geographic proximity (within 3.0 km)
    - Close Bedroom/BHK profile (bedrooms difference <= 1)
    - Close Area range (area difference <= 30%)
    
    Computes a similarity score from 0.0 to 1.0.
    """
    # Query properties in the same city and property type
    candidates = db.query(Property).filter(
        Property.city.ilike(city.strip()),
        Property.property_type.ilike(prop_type.strip())
    ).all()
    
    matched = []
    
    for p in candidates:
        # 1. Skip if it is the target property (based on duplicate cords or ID if matching exactly)
        # 2. Check geographic distance
        dist = calculate_haversine_distance(lat, lon, p.latitude, p.longitude)
        if dist > 3.0: # Skip if further than 3km
            continue
            
        # 3. Check Bedroom match
        bed_diff = abs(bedrooms - p.bedrooms)
        if bed_diff > 1: # Skip if BHK difference is more than 1
            continue
            
        # 4. Check Area match
        area_ratio = p.area_sqft / area_sqft
        if area_ratio < 0.7 or area_ratio > 1.3: # Skip if size is outside 30% bounds
            continue
            
        # Compute similarity score (higher is better)
        # Max distance penalty: dist / 3.0 (ranges 0 to 1)
        # Max area penalty: abs(p.area_sqft - area_sqft) / area_sqft (ranges 0 to 0.3)
        # BHK penalty: bed_diff * 0.2
        dist_score = 1.0 - (dist / 3.0)
        area_score = 1.0 - (abs(p.area_sqft - area_sqft) / area_sqft)
        bhk_score = 1.0 - (bed_diff * 0.2)
        
        # Locality match bonus
        locality_bonus = 0.2 if p.locality.lower() == locality.lower() else 0.0
        
        sim_score = (dist_score * 0.4) + (area_score * 0.3) + (bhk_score * 0.1) + locality_bonus
        sim_score = min(1.0, max(0.0, sim_score))
        
        matched.append({
            "id": p.id,
            "property_name": p.display_name,
            "city": p.city,
            "locality": p.locality,
            "latitude": p.latitude,
            "longitude": p.longitude,
            "property_type": p.property_type,
            "area_sqft": p.area_sqft,
            "bedrooms": p.bedrooms,
            "bathrooms": p.bathrooms,
            "parking": p.parking,
            "furnishing": p.furnishing,
            "age": p.age,
            "price_inr": p.price_inr,
            "investment_score": p.investment_score,
            "risk_score": p.risk_score,
            "distance_km": round(dist, 2),
            "similarity_score": round(sim_score, 2),
            "image_url": p.image_url
        })
        
    # Sort by similarity score descending, then distance ascending
    matched.sort(key=lambda x: (-x["similarity_score"], x["distance_km"]))
    return matched[:max_comparables]
