import os
import requests
import datetime
from sqlalchemy.orm import Session
from backend.database.models import NearbyPlace
from backend.services.amenitiesService import calculate_haversine_distance

# Mapping Google Places types to our UI categories
GOOGLE_TYPE_MAPPING = {
    "school": "School",
    "university": "School",
    "hospital": "Hospital",
    "doctor": "Clinic",
    "subway_station": "Metro Station",
    "transit_station": "Transit Station",
    "bus_station": "Bus Stop",
    "train_station": "Railway Station",
    "shopping_mall": "Shopping Mall",
    "supermarket": "Supermarket",
    "bank": "Bank",
    "restaurant": "Restaurant",
    "park": "Park",
    "gym": "Gym"
}

def google_fetch_nearby_places(
    lat: float,
    lon: float,
    city: str,
    locality: str,
    db: Session
) -> list[dict]:
    """
    Retrieves nearby places within 2km using Google Places Nearby Search API.
    First checks database cache (NearbyPlace). If not found, makes live API requests.
    If GOOGLE_MAPS_API_KEY is not defined or the API fails, falls back to local SQLite seeded records.
    """
    # 1. Check local database cache
    cached = db.query(NearbyPlace).filter(
        NearbyPlace.city.ilike(city.strip()),
        NearbyPlace.locality.ilike(locality.strip())
    ).all()
    
    # Filter by actual distance from coordinates (e.g. within 2.5 km) to avoid mapping scattered data
    filtered_cached = []
    for c in cached:
        dist = calculate_haversine_distance(lat, lon, c.latitude, c.longitude)
        if dist <= 2.5:
            c.distance_km = round(dist, 2)
            filtered_cached.append(c)
            
    filtered_cached.sort(key=lambda x: x.distance_km)
    
    # If we have populated cached places, return them
    if len(filtered_cached) >= 8:
        print(f"Loading {len(filtered_cached)} Google-derived amenities from database cache for {locality}, {city}")
        return [{
            "name": c.name,
            "category": c.category,
            "type": c.category,
            "distance_km": c.distance_km,
            "latitude": c.latitude,
            "longitude": c.longitude,
            "rating": c.rating,
            "userRatingCount": int(c.place_id % 200) + 12,
            "placeId": f"place_{c.place_id}",
            "open_now": True
        } for c in filtered_cached[:15]]

    api_key = os.getenv("GOOGLE_MAPS_API_KEY", "").strip()
    if not api_key:
        print("GOOGLE_MAPS_API_KEY is missing. Using cached/seeded SQLite landmarks.")
        return _get_fallback_amenities(lat, lon, city, locality, db)

    # 2. Call Google Places Nearby Search API
    # Since Nearby Search accepts one primary type or generic query, we'll query for a few representative types
    # or query for generic amenities inside a 2km radius.
    # To reduce API costs and stay inside bounds, we call NearbySearch for essential categories.
    url = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
    
    collected_places = {}
    
    # Categories to query in Google Places
    types_to_query = ["school", "hospital", "transit_station", "shopping_mall", "park", "gym", "restaurant"]
    
    for p_type in types_to_query:
        params = {
            "location": f"{lat},{lon}",
            "radius": 2000, # 2km radius
            "type": p_type,
            "key": api_key
        }
        
        try:
            # Strip Referer header so keys with HTTP referrer restrictions work server-side
            response = requests.get(url, params=params, headers={"Referer": ""}, timeout=5)
            if response.status_code == 200:
                results = response.json().get("results", [])
                for place in results:
                    place_id = place.get("place_id")
                    if place_id in collected_places:
                        continue
                        
                    geometry = place.get("geometry", {})
                    loc = geometry.get("location", {})
                    p_lat = loc.get("lat")
                    p_lon = loc.get("lng")
                    if not p_lat or not p_lon:
                        continue
                        
                    name = place.get("name", "Local Service")
                    rating = place.get("rating", 4.0)
                    ratings_count = place.get("user_ratings_total", 5)
                    
                    # Business status
                    open_now = True
                    opening_hours = place.get("opening_hours")
                    if opening_hours:
                        open_now = opening_hours.get("open_now", True)
                        
                    distance = calculate_haversine_distance(lat, lon, p_lat, p_lon)
                    
                    # Resolve category mapping
                    category = GOOGLE_TYPE_MAPPING.get(p_type, "Transit Station")
                    # Double-check specific subway or train tags
                    place_types = place.get("types", [])
                    if "subway_station" in place_types:
                        category = "Metro Station"
                    elif "train_station" in place_types:
                        category = "Railway Station"
                        
                    collected_places[place_id] = {
                        "name": name,
                        "category": category,
                        "type": category,
                        "distance_km": round(distance, 2),
                        "latitude": p_lat,
                        "longitude": p_lon,
                        "rating": rating,
                        "ratings_count": ratings_count,
                        "userRatingCount": ratings_count,
                        "placeId": place_id,
                        "open_now": open_now,
                        "place_id_hash": abs(hash(place_id)) % 1000000 # Save as integer ID
                    }
        except Exception as e:
            print(f"Places API failed for type {p_type}: {e}")
            
    # Save newly fetched Google Places results into the database lookups cache
    if len(collected_places) > 0:
        db_entries = []
        for pid, data in collected_places.items():
            np_entry = NearbyPlace(
                place_id=data["place_id_hash"],
                category=data["category"],
                name=data["name"],
                city=city,
                locality=locality,
                latitude=data["latitude"],
                longitude=data["longitude"],
                distance_km=data["distance_km"],
                rating=data["rating"],
                retrieved_at=datetime.datetime.utcnow()
            )
            db_entries.append(np_entry)
            
        try:
            # Clear previous cache entries
            db.query(NearbyPlace).filter(
                NearbyPlace.city.ilike(city.strip()),
                NearbyPlace.locality.ilike(locality.strip())
            ).delete()
            db.add_all(db_entries)
            db.commit()
        except Exception as e:
            print(f"Failed to cache Google Places in database: {e}")
            
        return list(collected_places.values())

    return _get_fallback_amenities(lat, lon, city, locality, db)

def _get_fallback_amenities(lat: float, lon: float, city: str, locality: str, db: Session) -> list[dict]:
    """Retrieves seeded local amenities as a database fallback, filtered by actual distance to coordinate"""
    cached = db.query(NearbyPlace).filter(
        NearbyPlace.city.ilike(city.strip()),
        NearbyPlace.locality.ilike(locality.strip())
    ).all()
    
    filtered_cached = []
    for c in cached:
        dist = calculate_haversine_distance(lat, lon, c.latitude, c.longitude)
        if dist <= 2.5:
            c.distance_km = round(dist, 2)
            filtered_cached.append(c)
            
    filtered_cached.sort(key=lambda x: x.distance_km)
    
    if len(filtered_cached) > 0:
        return [{
            "name": c.name,
            "category": c.category,
            "type": c.category,
            "distance_km": c.distance_km,
            "latitude": c.latitude,
            "longitude": c.longitude,
            "rating": c.rating,
            "ratings_count": 25,
            "userRatingCount": 25,
            "placeId": f"place_{c.place_id}",
            "open_now": True
        } for c in filtered_cached[:15]]

    # Pull global database records near these coordinates if locality cache empty
    all_places = db.query(NearbyPlace).all()
    fallback_list = []
    for item in all_places:
        dist = calculate_haversine_distance(lat, lon, item.latitude, item.longitude)
        if dist <= 2.5:
            fallback_list.append({
                "name": item.name,
                "category": item.category,
                "type": item.category,
                "distance_km": round(dist, 2),
                "latitude": item.latitude,
                "longitude": item.longitude,
                "rating": item.rating,
                "ratings_count": 15,
                "userRatingCount": 15,
                "placeId": f"place_{item.place_id}",
                "open_now": True
            })
    fallback_list.sort(key=lambda x: x["distance_km"])
    return fallback_list[:15]
