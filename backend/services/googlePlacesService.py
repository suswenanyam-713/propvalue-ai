import os
import time
import requests
from math import radians, cos, sin, asin, sqrt

# Supported Google Places API (New) Place Types
SUPPORTED_PLACE_TYPES = [
    "hospital",
    "medical_clinic",
    "pharmacy",
    "school",
    "primary_school",
    "secondary_school",
    "university",
    "subway_station",
    "train_station",
    "bus_station",
    "transit_station",
    "shopping_mall",
    "supermarket",
    "park",
    "bank",
    "restaurant",
    "gym"
]

def resolve_ui_category_and_group(primary_type: str, types_list: list[str]) -> tuple[str, str]:
    """Pattern-matching category & filter group resolver for Google Places API (New)"""
    all_types_str = " ".join([primary_type] + (types_list or [])).lower()

    if any(k in all_types_str for k in ["hospital", "medical_clinic", "doctor"]):
        return "Hospital", "Healthcare"
    if any(k in all_types_str for k in ["pharmacy", "chemist", "drugstore"]):
        return "Pharmacy", "Healthcare"
    if any(k in all_types_str for k in ["school", "university", "college"]):
        return "School", "Education"
    if any(k in all_types_str for k in ["subway", "metro"]):
        return "Metro Station", "Transport"
    if any(k in all_types_str for k in ["train_station", "railway"]):
        return "Railway Station", "Transport"
    if any(k in all_types_str for k in ["bus_station", "transit"]):
        return "Bus Station", "Transport"
    if any(k in all_types_str for k in ["shopping_mall", "mall"]):
        return "Shopping Mall", "Shopping"
    if any(k in all_types_str for k in ["supermarket", "hypermarket", "grocery"]):
        return "Supermarket", "Shopping"
    if any(k in all_types_str for k in ["park", "garden"]):
        return "Park", "Parks"
    if any(k in all_types_str for k in ["bank", "atm"]):
        return "Bank", "Essentials"
    if any(k in all_types_str for k in ["restaurant", "food", "cafe", "bakery"]):
        return "Restaurant", "Essentials"
    if any(k in all_types_str for k in ["gym", "fitness", "sports"]):
        return "Gym", "Essentials"

    return "Amenity", "Essentials"

_PLACES_CACHE = {}
CACHE_TTL_SECONDS = 86400  # 24 Hours Cache TTL

def calculate_haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculates straight-line geographic distance in kilometers between two coordinate points."""
    try:
        R = 6371.0
        dlat, dlon = radians(lat2 - lat1), radians(lon2 - lon1)
        a = sin(dlat / 2.0)**2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2.0)**2
        return round(2.0 * R * asin(sqrt(a)), 2)
    except Exception:
        return 0.0

def fetch_google_nearby_places(lat: float, lon: float, radius_meters: float = 3000.0) -> dict:
    """
    Queries Google Places API (New) searchNearby around target coordinates.
    Returns normalized dictionary containing places list, timestamp, and data_source metadata.
    """
    target_lat = round(float(lat), 4)
    target_lon = round(float(lon), 4)
    radius = float(radius_meters)

    cache_key = (target_lat, target_lon, radius)
    now_ts = time.time()

    if cache_key in _PLACES_CACHE:
        cache_time, cached_result = _PLACES_CACHE[cache_key]
        if now_ts - cache_time < CACHE_TTL_SECONDS:
            return cached_result

    api_key = os.getenv("GOOGLE_MAPS_API_KEY", "").strip() or "AIzaSyD574mnVYIvct8zVxItegPKsq5wmx-kOcQ"
    referer_header = os.getenv("APP_REFERER", "https://propvalue-ai-i2hd.vercel.app/").strip()

    url = "https://places.googleapis.com/v1/places:searchNearby"
    # Set Referer matching Vercel domain to comply with Google Cloud Console HTTP Referrer Restrictions
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": api_key,
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.primaryType,places.types,places.rating,places.userRatingCount,places.googleMapsUri,places.businessStatus",
        "Referer": referer_header
    }

    payload = {
        "includedTypes": SUPPORTED_PLACE_TYPES,
        "maxResultCount": 20,
        "locationRestriction": {
            "circle": {
                "center": {
                    "latitude": target_lat,
                    "longitude": target_lon
                },
                "radius": radius
            }
        }
    }

    places_list = []

    try:
        response = requests.post(url, json=payload, headers=headers, timeout=8)
        if response.status_code == 200:
            data = response.json()
            raw_places = data.get("places", [])

            for p in raw_places:
                p_loc = p.get("location", {})
                p_lat = p_loc.get("latitude")
                p_lon = p_loc.get("longitude")

                if p_lat is None or p_lon is None:
                    continue

                dist_km = calculate_haversine_distance(target_lat, target_lon, p_lat, p_lon)
                name = p.get("displayName", {}).get("text") or "Nearby Place"
                primary_type = p.get("primaryType", "")
                types_list = p.get("types", [])

                category, group = resolve_ui_category_and_group(primary_type, types_list)

                places_list.append({
                    "place_id": p.get("id"),
                    "name": name,
                    "primary_type": primary_type,
                    "category": category,
                    "group": group,
                    "latitude": p_lat,
                    "longitude": p_lon,
                    "distance_km": dist_km,
                    "rating": float(p.get("rating", 0.0) or 0.0),
                    "user_ratings_total": int(p.get("userRatingCount", 0) or 0),
                    "address": p.get("formattedAddress", ""),
                    "google_maps_uri": p.get("googleMapsUri", "")
                })

            places_list.sort(key=lambda x: x["distance_km"])
        else:
            print(f"[GooglePlacesService] Response status: {response.status_code}, text: {response.text[:200]}")
    except Exception as e:
        print(f"[GooglePlacesService] Request failed: {e}")

    result = {
        "places": places_list,
        "data_source": "Google Places API (New)",
        "count": len(places_list)
    }

    _PLACES_CACHE[cache_key] = (now_ts, result)
    return result
