import requests
import urllib.parse
import time

# In-memory geocoding cache to prevent duplicate external calls
_geocode_cache = {}

# Fallback presets for known localities in case Nominatim is slow or rate-limited
LOCALITY_PRESETS = {
    "miyapur": (17.4965, 78.4014),
    "madhapur": (17.4485, 78.3908),
    "gachibowli": (17.4401, 78.3489),
    "kondapur": (17.4619, 78.3662),
    "kukatpally": (17.4947, 78.4062),
    "velachery": (12.9801, 80.2227),
    "adyar": (13.0067, 80.2506),
    "t nagar": (13.0418, 80.2341),
    "porur": (13.0382, 80.1565),
    "kharadi": (18.5521, 73.9431),
    "wakad": (18.5987, 73.7499),
    "baner": (18.5596, 73.7799),
    "bandra": (19.0596, 72.8295),
    "andheri": (19.1136, 72.8697),
    "whitefield": (12.9698, 77.7499),
    "koramangala": (12.9352, 77.6244),
}

def geocode_address(locality: str, city: str) -> tuple[float, float]:
    """
    Converts locality and city into (latitude, longitude) coordinates.
    Uses Nominatim API with in-memory caching and hardcoded presets as a fallback.
    """
    query_str = f"{locality}, {city}, India".strip().lower()
    
    # Check cache first
    if query_str in _geocode_cache:
        return _geocode_cache[query_str]
        
    # Check presets
    loc_clean = locality.strip().lower()
    if loc_clean in LOCALITY_PRESETS:
        coords = LOCALITY_PRESETS[loc_clean]
        _geocode_cache[query_str] = coords
        return coords

    # Call Nominatim Geocoding API
    url = f"https://nominatim.openstreetmap.org/search?q={urllib.parse.quote(query_str)}&format=json&limit=1"
    headers = {
        "User-Agent": "PropValueAI-Valuation-Engine/1.0 (suswe@platform.com)"
    }
    
    try:
        response = requests.get(url, headers=headers, timeout=5)
        if response.status_code == 200:
            data = response.json()
            if data and len(data) > 0:
                lat = float(data[0]["lat"])
                lon = float(data[0]["lon"])
                _geocode_cache[query_str] = (lat, lon)
                # Respect Nominatim 1 req/sec guidelines
                time.sleep(1)
                return lat, lon
    except Exception as e:
        print(f"Geocoding API error: {e}")
        
    # Final default fallback to city center or a default point
    city_clean = city.strip().lower()
    if "hyderabad" in city_clean:
        return (17.3850, 78.4867)
    elif "chennai" in city_clean:
        return (13.0827, 80.2707)
    elif "pune" in city_clean:
        return (18.5204, 73.8567)
    elif "mumbai" in city_clean:
        return (19.0760, 72.8777)
    elif "bengaluru" in city_clean or "bangalore" in city_clean:
        return (12.9716, 77.5946)
        
    return (17.3850, 78.4867)  # Universal default
