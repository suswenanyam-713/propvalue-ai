import os
import requests
import urllib.parse
from backend.services.locationService import LOCALITY_PRESETS, _geocode_cache

def google_geocode_address(address_str: str) -> dict:
    """
    Geocodes an address string using Google Maps Geocoding API.
    Returns parsed coordinates and address components.
    Falls back to pre-cached local presets if Google API key is missing or fails.
    """
    api_key = os.getenv("GOOGLE_MAPS_API_KEY", "").strip()
    
    # Cache lookup
    cache_key = address_str.strip().lower()
    if cache_key in _geocode_cache:
        lat, lon = _geocode_cache[cache_key]
        return {
            "latitude": lat,
            "longitude": lon,
            "formatted_address": address_str,
            "locality": "Unknown Locality",
            "city": "Unknown City",
            "state": "Unknown State",
            "postal_code": "000000",
            "place_id": "cached_stub_id",
            "status": "OK"
        }

    # Preset lookup fallback
    for name, coords in LOCALITY_PRESETS.items():
        if name in cache_key:
            _geocode_cache[cache_key] = coords
            return {
                "latitude": coords[0],
                "longitude": coords[1],
                "formatted_address": f"{name.title()}, India",
                "locality": name.title(),
                "city": "Hyderabad" if "hyderabad" in cache_key or name in ["miyapur", "madhapur", "gachibowli", "kondapur", "kukatpally"] else "Chennai",
                "state": "Telangana" if "hyderabad" in cache_key or name in ["miyapur", "madhapur", "gachibowli", "kondapur", "kukatpally"] else "Tamil Nadu",
                "postal_code": "500081",
                "place_id": f"preset_{name}_id",
                "status": "OK (Fallback Preset)"
            }

    if not api_key:
        print("GOOGLE_MAPS_API_KEY is not configured in .env. Using fallback location.")
        return {
            "latitude": 17.4485,
            "longitude": 78.3908,
            "formatted_address": "Madhapur, Hyderabad, Telangana, India",
            "locality": "Madhapur",
            "city": "Hyderabad",
            "state": "Telangana",
            "postal_code": "500081",
            "place_id": "google_api_key_missing_stub",
            "status": "Key Missing - Fallback Loaded"
        }

    # Make Google Geocoding API Request with Referer header matching allowed Vercel domain
    referer_header = os.getenv("APP_REFERER", "https://propvalue-ai-i2hd.vercel.app/").strip()
    url = f"https://maps.googleapis.com/maps/api/geocode/json?address={urllib.parse.quote(address_str)}&key={api_key}"
    try:
        response = requests.get(url, headers={"Referer": referer_header}, timeout=5)
        if response.status_code == 200:
            result = response.json()
            if result.get("status") == "OK" and len(result.get("results", [])) > 0:
                best_match = result["results"][0]
                geometry = best_match["geometry"]["location"]
                lat = geometry["lat"]
                lon = geometry["lng"]
                
                # Parse address components
                components = best_match.get("address_components", [])
                locality = ""
                city = ""
                state = ""
                postal_code = ""
                
                for comp in components:
                    types = comp.get("types", [])
                    if "sublocality" in types or "sublocality_level_1" in types:
                        locality = comp["long_name"]
                    elif "locality" in types and not locality:
                        locality = comp["long_name"]
                    elif "administrative_area_level_2" in types:
                        city = comp["long_name"]
                    elif "locality" in types:
                        city = comp["long_name"]
                    elif "administrative_area_level_1" in types:
                        state = comp["long_name"]
                    elif "postal_code" in types:
                        postal_code = comp["long_name"]

                # Cache coordinates
                _geocode_cache[cache_key] = (lat, lon)
                
                return {
                    "latitude": lat,
                    "longitude": lon,
                    "formatted_address": best_match.get("formatted_address"),
                    "locality": locality or "Unknown Locality",
                    "city": city or "Unknown City",
                    "state": state or "Unknown State",
                    "postal_code": postal_code or "000000",
                    "place_id": best_match.get("place_id"),
                    "status": "OK"
                }
            else:
                print(f"Google Geocoding API returned status: {result.get('status')}")
    except Exception as e:
        print(f"Google Geocoding API request failed: {e}")

    # Fallback default point
    return {
        "latitude": 17.4485,
        "longitude": 78.3908,
        "formatted_address": "Madhapur, Hyderabad, Telangana, India (Fallback)",
        "locality": "Madhapur",
        "city": "Hyderabad",
        "state": "Telangana",
        "postal_code": "500081",
        "place_id": "google_api_error_stub",
        "status": "API Error - Fallback Loaded"
    }
