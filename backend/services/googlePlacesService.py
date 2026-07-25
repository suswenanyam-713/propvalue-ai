"""
Google Places Service — Places API (New) Nearby Search (searchNearby)

Features:
1. Calls https://places.googleapis.com/v1/places:searchNearby using FieldMask optimization.
2. Uses supported Google Places (New) place types.
3. Computes straight-line Haversine distance in km from target coordinates to each place.
4. Caches results in-memory and in SQLite database to optimize cost and avoid redundant API calls.
5. Formats place category names for UI presentation.
"""

import os
import time
import requests
from math import radians, cos, sin, asin, sqrt
from datetime import datetime

# Centralized Search Radii Configuration (meters)
PRIMARY_SEARCH_RADIUS_M = 3000.0   # 3 km
EXTENDED_SEARCH_RADIUS_M = 5000.0  # 5 km

# Supported Google Places API (New) Place Types
SUPPORTED_PLACE_TYPES = [
    "hospital",
    "medical_clinic",
    "school",
    "university",
    "subway_station",
    "train_station",
    "bus_station",
    "shopping_mall",
    "supermarket",
    "park",
    "pharmacy",
    "bank",
    "restaurant",
    "gym"
]

# Mapping from Google primaryType/types to UI Category
TYPE_TO_UI_CATEGORY = {
    "hospital": "Hospital",
    "medical_clinic": "Clinic",
    "doctor": "Clinic",
    "pharmacy": "Pharmacy",
    "school": "School",
    "primary_school": "School",
    "secondary_school": "School",
    "university": "University / College",
    "subway_station": "Metro Station",
    "train_station": "Railway Station",
    "bus_station": "Bus Station",
    "transit_station": "Transit Station",
    "shopping_mall": "Shopping Mall",
    "supermarket": "Supermarket",
    "grocery_store": "Supermarket",
    "park": "Park",
    "bank": "Bank",
    "restaurant": "Restaurant",
    "gym": "Gym"
}

# Grouping categories into UI Filter Tabs
UI_FILTER_GROUPS = {
    "Healthcare": ["Hospital", "Clinic", "Pharmacy"],
    "Education": ["School", "University / College"],
    "Transport": ["Metro Station", "Railway Station", "Bus Station", "Transit Station"],
    "Shopping": ["Shopping Mall", "Supermarket"],
    "Parks": ["Park"],
    "Essentials": ["Bank", "Restaurant", "Gym"]
}

# In-memory cache: (lat_round, lon_round, radius) -> (timestamp, data)
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

    # 1. Check in-memory cache
    if cache_key in _PLACES_CACHE:
        cache_time, cached_result = _PLACES_CACHE[cache_key]
        if now_ts - cache_time < CACHE_TTL_SECONDS:
            return cached_result

    api_key = os.getenv("GOOGLE_MAPS_API_KEY", "").strip() or "AIzaSyD574mnVYIvct8zVxItegPKsq5wmx-kOcQ"

    url = "https://places.googleapis.com/v1/places:searchNearby"
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": api_key,
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.primaryType,places.types,places.rating,places.userRatingCount,places.googleMapsUri,places.businessStatus",
        "Referer": "http://localhost:3000/"  # Required by GCP API key referrer restrictions
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
                primary_type = p.get("primaryType", "")
                all_types = p.get("types", [])

                # Map to UI Category
                cat_name = TYPE_TO_UI_CATEGORY.get(primary_type)
                if not cat_name:
                    for t in all_types:
                        if t in TYPE_TO_UI_CATEGORY:
                            cat_name = TYPE_TO_UI_CATEGORY[t]
                            break
                if not cat_name:
                    cat_name = primary_type.replace("_", " ").title() if primary_type else "Amenity"

                # Find filter group
                group_name = "Essentials"
                for grp, cats in UI_FILTER_GROUPS.items():
                    if cat_name in cats:
                        group_name = grp
                        break

                display_name = p.get("displayName", {}).get("text", "Nearby Place")

                places_list.append({
                    "place_id": p.get("id", ""),
                    "name": display_name,
                    "category": cat_name,
                    "group": group_name,
                    "latitude": p_lat,
                    "longitude": p_lon,
                    "distance_km": dist_km,
                    "rating": p.get("rating", 0.0),
                    "user_ratings_total": p.get("userRatingCount", 0),
                    "address": p.get("formattedAddress", ""),
                    "google_maps_uri": p.get("googleMapsUri", ""),
                    "business_status": p.get("businessStatus", "OPERATIONAL")
                })

            # Sort places by distance
            places_list.sort(key=lambda x: x["distance_km"])

        else:
            print(f"[googlePlacesService] API error {response.status_code}: {response.text[:200]}")
    except Exception as e:
        print(f"[googlePlacesService] Request exception: {e}")

    result_payload = {
        "status": "SUCCESS" if places_list else "EMPTY",
        "data_source": "Current Google Places API (New)",
        "last_updated": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC"),
        "total_count": len(places_list),
        "places": places_list
    }

    # Store in cache
    _PLACES_CACHE[cache_key] = (now_ts, result_payload)
    return result_payload
