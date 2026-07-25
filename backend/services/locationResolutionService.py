"""
Location Resolution & Coordinate Validation Service

Validates property coordinates against verified locality centers.
If original coordinates in the dataset are invalid or discrepant (>10km away from city/locality centroid),
it resolves them to accurate locality coordinates with a small deterministic offset based on Property_ID.

Preserves original dataset coordinates separately as originalLatitude/originalLongitude.
"""

from math import radians, cos, sin, asin, sqrt

# Verified centroid coordinates for all 23 localities across the 5 major cities
LOCALITY_CENTROIDS = {
    # Chennai
    ("chennai", "velachery"): (12.9796, 80.2201),
    ("chennai", "omr"): (12.9600, 80.2450),
    ("chennai", "adyar"): (13.0067, 80.2570),
    ("chennai", "anna nagar"): (13.0850, 80.2100),
    # Hyderabad
    ("hyderabad", "miyapur"): (17.4965, 78.4014),
    ("hyderabad", "gachibowli"): (17.4401, 78.3489),
    ("hyderabad", "madhapur"): (17.4485, 78.3908),
    ("hyderabad", "banjara hills"): (17.4156, 78.4347),
    ("hyderabad", "jubilee hills"): (17.4319, 78.4071),
    ("hyderabad", "kondapur"): (17.4618, 78.3672),
    ("hyderabad", "kukatpally"): (17.4849, 78.4073),
    # Bengaluru
    ("bengaluru", "whitefield"): (12.9698, 77.7499),
    ("bengaluru", "electronic city"): (12.8399, 77.6770),
    ("bengaluru", "hsr layout"): (12.9121, 77.6446),
    ("bengaluru", "indiranagar"): (12.9784, 77.6408),
    # Mumbai
    ("mumbai", "bandra"): (19.0596, 72.8295),
    ("mumbai", "powai"): (19.1176, 72.9060),
    ("mumbai", "andheri"): (19.1136, 72.8697),
    ("mumbai", "thane"): (19.2183, 72.9781),
    # Pune
    ("pune", "hinjewadi"): (18.5912, 73.7389),
    ("pune", "kharadi"): (18.5515, 73.9348),
    ("pune", "wakad"): (18.5987, 73.7661),
    ("pune", "baner"): (18.5590, 73.7868),
}

# Default City Centroids
CITY_CENTROIDS = {
    "chennai": (13.0827, 80.2707),
    "hyderabad": (17.3850, 78.4867),
    "bengaluru": (12.9716, 77.5946),
    "mumbai": (19.0760, 72.8777),
    "pune": (18.5204, 73.8567),
}

def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculates straight-line geographic (Haversine) distance in kilometers."""
    try:
        R = 6371.0
        dlat, dlon = radians(lat2 - lat1), radians(lon2 - lon1)
        a = sin(dlat / 2.0)**2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2.0)**2
        return 2.0 * R * asin(sqrt(a))
    except Exception:
        return 0.0

def resolve_property_location(original_lat: float, original_lon: float, city: str, locality: str, property_id: int = 1) -> dict:
    """
    Validates original coordinates against verified locality center.
    Returns dictionary with:
    - resolvedLatitude, resolvedLongitude
    - originalLatitude, originalLongitude
    - isValid, resolutionSource
    """
    orig_lat = float(original_lat) if original_lat is not None else 0.0
    orig_lon = float(original_lon) if original_lon is not None else 0.0
    c_key = str(city).strip().lower() if city else "hyderabad"
    l_key = str(locality).strip().lower() if locality else "madhapur"

    # Retrieve expected locality centroid
    centroid = LOCALITY_CENTROIDS.get((c_key, l_key))
    if not centroid:
        # Fallback to city centroid
        centroid = CITY_CENTROIDS.get(c_key, (17.3850, 78.4867))

    base_lat, base_lon = centroid
    dist = haversine_km(orig_lat, orig_lon, base_lat, base_lon)

    # If original coordinates are within 10 km of expected centroid, consider valid
    if orig_lat != 0.0 and orig_lon != 0.0 and dist <= 10.0:
        return {
            "resolvedLatitude": round(orig_lat, 6),
            "resolvedLongitude": round(orig_lon, 6),
            "originalLatitude": round(orig_lat, 6),
            "originalLongitude": round(orig_lon, 6),
            "isValid": True,
            "resolutionSource": "Original Verified Coordinates",
            "distanceFromCentroidKm": round(dist, 2)
        }

    # Otherwise, resolve to locality centroid + deterministic small offset based on property_id
    # Offset spreads properties naturally within ~1.5 km of locality center
    pid = int(property_id) if property_id else 1
    lat_offset = (((pid * 37) % 200) - 100) / 10000.0  # +/- 0.0100 deg (~1.1 km)
    lon_offset = (((pid * 53) % 200) - 100) / 10000.0  # +/- 0.0100 deg (~1.1 km)

    resolved_lat = round(base_lat + lat_offset, 6)
    resolved_lon = round(base_lon + lon_offset, 6)

    return {
        "resolvedLatitude": resolved_lat,
        "resolvedLongitude": resolved_lon,
        "originalLatitude": round(orig_lat, 6),
        "originalLongitude": round(orig_lon, 6),
        "isValid": False,
        "resolutionSource": f"Resolved to {locality.title()}, {city.title()} Centroid",
        "distanceFromCentroidKm": round(dist, 2)
    }
