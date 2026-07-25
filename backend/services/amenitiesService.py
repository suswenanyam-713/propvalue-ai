import math
import requests
import datetime
from sqlalchemy.orm import Session
from backend.database.models import NearbyPlace

def calculate_haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Computes the great-circle distance between two points in kilometers.
    """
    R = 6371.0 # Earth's radius in km
    
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    
    a = math.sin(delta_phi / 2.0) ** 2 + \
        math.cos(phi1) * math.cos(phi2) * \
        math.sin(delta_lambda / 2.0) ** 2
        
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return round(R * c, 3)

def fetch_nearby_amenities(lat: float, lon: float, city: str, locality: str, db: Session) -> list[NearbyPlace]:
    """
    Queries amenities (schools, hospitals, transit, malls, parks) within 2km.
    First checks database cache. If not found, calls OSM Overpass API, saves to DB, and returns them.
    If the API fails, gracefully falls back to seeded database nearby places.
    """
    # 1. Check local cache in database (any records matching locality and city)
    cached_places = db.query(NearbyPlace).filter(
        NearbyPlace.city == city,
        NearbyPlace.locality == locality
    ).all()
    
    if len(cached_places) > 10: # If we have a decent number of cached amenities, return them
        print(f"Loading {len(cached_places)} amenities from cache for {locality}, {city}")
        return cached_places

    # 2. Query OSM Overpass API
    overpass_url = "https://overpass-api.de/api/interpreter"
    
    # Overpass QL query targeting key points in a 2km (2000m) radius
    query = f"""
    [out:json][timeout:15];
    (
      node["amenity"="hospital"](around:2000,{lat},{lon});
      node["amenity"="school"](around:2000,{lat},{lon});
      node["railway"="station"](around:2000,{lat},{lon});
      node["highway"="bus_stop"](around:2000,{lat},{lon});
      node["shop"="mall"](around:2000,{lat},{lon});
      node["leisure"="park"](around:2000,{lat},{lon});
    );
    out body 40;
    """
    
    new_places = []
    
    try:
        response = requests.post(overpass_url, data={"data": query}, timeout=10)
        if response.status_code == 200:
            elements = response.json().get("elements", [])
            
            # Map OSM tags to unified category names
            category_mapping = {
                "hospital": "Hospital",
                "school": "School",
                "mall": "Shopping Mall",
                "park": "Park",
            }
            
            for item in elements:
                tags = item.get("tags", {})
                lat_p = item.get("lat")
                lon_p = item.get("lon")
                if not lat_p or not lon_p:
                    continue
                    
                name = tags.get("name", tags.get("operator", "Public Amenity"))
                
                # Determine category
                category = "Transit Station"
                if tags.get("amenity") in category_mapping:
                    category = category_mapping[tags.get("amenity")]
                elif tags.get("highway") == "bus_stop":
                    category = "Bus Stop"
                elif tags.get("railway") == "station":
                    category = "Metro Station"
                elif tags.get("leisure") == "park":
                    category = "Park"
                elif tags.get("shop") == "mall":
                    category = "Shopping Mall"
                    
                dist = calculate_haversine_distance(lat, lon, lat_p, lon_p)
                
                # Assign static mock rating based on element ID hash for visual richness
                rating = round(3.8 + ((item.get("id", 0) % 13) / 10.0), 1)
                rating = min(5.0, rating)
                
                place = NearbyPlace(
                    place_id=item.get("id", 0),
                    category=category,
                    name=name,
                    city=city,
                    locality=locality,
                    latitude=lat_p,
                    longitude=lon_p,
                    distance_km=dist,
                    rating=rating,
                    retrieved_at=datetime.datetime.utcnow()
                )
                new_places.append(place)
                
            if len(new_places) > 0:
                print(f"Caching {len(new_places)} live amenities in DB for {locality}, {city}")
                # Clear empty or small cache records first
                db.query(NearbyPlace).filter(NearbyPlace.city == city, NearbyPlace.locality == locality).delete()
                db.add_all(new_places)
                db.commit()
                return new_places
                
    except Exception as e:
        print(f"Overpass API failed: {e}. Falling back to seeded local records.")

    # 3. Fallback: Retrieve whatever seeded/historical places exist in DB for this locality/city
    fallback_places = db.query(NearbyPlace).filter(
        NearbyPlace.city == city,
        NearbyPlace.locality == locality
    ).all()
    
    if len(fallback_places) > 0:
        return fallback_places
        
    # If absolutely nothing exists, fetch global records near this coordinate from our existing seeded DB
    # (calculate distance manually for all seeded nearby places and return closest 5)
    all_seeded = db.query(NearbyPlace).all()
    mapped_seeded = []
    for item in all_seeded[:200]: # Look through a subset to maintain responsiveness
        item.distance_km = calculate_haversine_distance(lat, lon, item.latitude, item.longitude)
        if item.distance_km <= 5.0:
            mapped_seeded.append(item)
            
    mapped_seeded.sort(key=lambda x: x.distance_km)
    return mapped_seeded[:15]
