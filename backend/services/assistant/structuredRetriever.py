import numpy as np
import pandas as pd
import os
from sqlalchemy.orm import Session
from backend.database.models import Property, HistoricalPrice, MarketData
from backend.services.googlePlacesService import fetch_google_nearby_places
from backend.services.locationResolutionService import resolve_property_location

HISTORICAL_CSV = "Dataset/Historical_Prices_10000.csv"
LIVE_MARKET_CSV = "Dataset/Live_Market_10000.csv"

def get_property_by_id(prop_id: int, db: Session) -> dict | None:
    """Retrieve full property record by Property_ID"""
    prop = db.query(Property).filter(Property.id == prop_id).first()
    if not prop:
        return None

    price_sqft = prop.price_inr / prop.area_sqft if prop.area_sqft > 0 else 0
    return {
        "id": prop.id,
        "property_name": prop.property_name or f"{prop.locality} {prop.property_type}",
        "city": prop.city,
        "locality": prop.locality,
        "latitude": prop.latitude,
        "longitude": prop.longitude,
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
        "price_inr": prop.price_inr,
        "price_sqft": round(price_sqft, 2),
    }

def search_properties_structured(entities: dict, db: Session, limit: int = 5) -> list[dict]:
    """Filters structured property dataset using exact user criteria"""
    query = db.query(Property)

    if entities.get("city"):
        query = query.filter(Property.city.ilike(f"%{entities['city']}%"))
    if entities.get("locality"):
        query = query.filter(
            (Property.locality.ilike(f"%{entities['locality']}%")) |
            (Property.property_name.ilike(f"%{entities['locality']}%"))
        )
    if entities.get("property_type"):
        query = query.filter(Property.property_type.ilike(f"%{entities['property_type']}%"))
    if entities.get("bedrooms"):
        query = query.filter(Property.bedrooms == entities["bedrooms"])
    if entities.get("max_price"):
        query = query.filter(Property.price_inr <= entities["max_price"])
    if entities.get("risk_requirement") == "low":
        query = query.filter(Property.risk_score <= 45)
    elif entities.get("risk_requirement") == "high":
        query = query.filter(Property.risk_score > 60)

    if entities.get("investment_requirement") == "high":
        query = query.order_by(Property.investment_score.desc())
    else:
        query = query.order_by(Property.price_inr.asc())

    rows = query.limit(limit).all()
    results = []
    for r in rows:
        results.append({
            "id": r.id,
            "property_name": r.property_name or f"{r.locality} {r.property_type}",
            "city": r.city,
            "locality": r.locality,
            "property_type": r.property_type,
            "bedrooms": r.bedrooms,
            "bathrooms": r.bathrooms,
            "area_sqft": r.area_sqft,
            "price_inr": r.price_inr,
            "investment_score": r.investment_score,
            "risk_score": r.risk_score,
            "price_sqft": round(r.price_inr / r.area_sqft, 2) if r.area_sqft > 0 else 0
        })
    return results

def get_market_trend_data(locality: str = None, city: str = None, db: Session = None) -> dict:
    """Calculates factual market trend metrics from Historical & Live Market datasets."""
    stats = {
        "locality": locality,
        "city": city,
        "listings_count": 0,
        "avg_price_inr": 0,
        "avg_price_sqft": 0,
        "historical_growth_yoy": 0,
        "demand_index": 65,
        "trend_direction": "Stable Upward",
        "min_price": 0,
        "max_price": 0,
        "data_found": False
    }

    if not locality and not city:
        return stats

    # 1. Query DB Market Data or CSV
    if db:
        m_query = db.query(MarketData)
        if locality:
            m_query = m_query.filter(MarketData.locality.ilike(f"%{locality}%"))
        elif city:
            m_query = m_query.filter(MarketData.city.ilike(f"%{city}%"))

        m_rows = m_query.all()
        if m_rows:
            prices = [m.price_inr for m in m_rows]
            sqfts = [m.price_inr / m.area_sqft if m.area_sqft > 0 else 0 for m in m_rows]
            stats["listings_count"] = len(m_rows)
            stats["avg_price_inr"] = float(np.mean(prices))
            stats["avg_price_sqft"] = float(np.mean(sqfts))
            stats["min_price"] = float(np.min(prices))
            stats["max_price"] = float(np.max(prices))
            stats["data_found"] = True

    # 2. Query Historical Prices for Growth % and Demand Index
    if os.path.exists(HISTORICAL_CSV):
        try:
            df_h = pd.read_csv(HISTORICAL_CSV)
            if locality:
                filtered_h = df_h[df_h["Locality"].astype(str).str.contains(locality, case=False, na=False)]
            else:
                filtered_h = df_h[df_h["City"].astype(str).str.contains(city, case=False, na=False)]

            if not filtered_h.empty:
                stats["data_found"] = True
                if "Growth_%" in filtered_h.columns:
                    stats["historical_growth_yoy"] = float(filtered_h["Growth_%"].mean())
                if "Demand_Index" in filtered_h.columns:
                    stats["demand_index"] = float(filtered_h["Demand_Index"].mean())
                if "Avg_Price_sqft" in filtered_h.columns and stats["avg_price_sqft"] == 0:
                    stats["avg_price_sqft"] = float(filtered_h["Avg_Price_sqft"].mean())
                
                if stats["historical_growth_yoy"] > 8:
                    stats["trend_direction"] = "Strong Bullish Growth"
                elif stats["historical_growth_yoy"] > 3:
                    stats["trend_direction"] = "Steady Appreciation"
                else:
                    stats["trend_direction"] = "Consolidating / Neutral"
        except Exception as e:
            print(f"Error reading Historical Prices CSV: {e}")

    return stats

def compare_two_properties(prop_a_id: int, prop_b_id: int, db: Session) -> dict | None:
    """Performs programmatic comparison between two properties."""
    pa = get_property_by_id(prop_a_id, db)
    pb = get_property_by_id(prop_b_id, db)

    if not pa or not pb:
        return None

    better_property = "A" if pa["investment_score"] >= pb["investment_score"] else "B"
    winner = pa if better_property == "A" else pb

    return {
        "property_a": pa,
        "property_b": pb,
        "better_property": better_property,
        "winner_name": winner["property_name"],
        "reason": f"{winner['property_name']} has a higher Investment Score ({winner['investment_score']}/100) and lower relative risk profile ({winner['risk_score']}/100)."
    }

def get_google_amenities_for_property(prop_id: int, db: Session) -> list[dict]:
    """Retrieves live Google Places amenities for a given property ID."""
    prop = get_property_by_id(prop_id, db)
    if not prop:
        return []

    # Resolve coordinates
    loc_res = resolve_property_location(prop["latitude"], prop["longitude"], prop["city"], prop["locality"], prop_id)
    lat = loc_res["resolvedLatitude"]
    lon = loc_res["resolvedLongitude"]

    places_res = fetch_google_nearby_places(lat, lon, radius_meters=3000.0)
    return places_res.get("places", [])
