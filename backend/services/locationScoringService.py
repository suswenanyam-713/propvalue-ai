"""
Location Scoring & Feature Extraction Service

Extracts location features from real Google Places data:
- Nearest distances to Hospitals, Clinics, Schools, Colleges, Metro, Railway, Bus, Malls, Supermarkets, Parks.
- Radius counts (counts within 3km and 5km).

Computes a deterministic, reproducible Location Score (0–100) and category breakdown.
"""

def extract_location_features(places: list) -> dict:
    """Extracts distance and density features from Google Places list."""
    min_dists = {
        "nearestHospitalDistance": 99.0,
        "nearestClinicDistance": 99.0,
        "nearestSchoolDistance": 99.0,
        "nearestCollegeDistance": 99.0,
        "nearestMetroDistance": 99.0,
        "nearestRailwayDistance": 99.0,
        "nearestBusDistance": 99.0,
        "nearestMallDistance": 99.0,
        "nearestSupermarketDistance": 99.0,
        "nearestParkDistance": 99.0,
    }

    counts = {
        "hospitalCount3km": 0,
        "schoolCount3km": 0,
        "collegeCount5km": 0,
        "transitCount5km": 0,
        "shoppingCount3km": 0,
        "parkCount3km": 0,
    }

    for p in places:
        cat = p.get("category", "")
        dist = p.get("distance_km", 99.0)

        if cat == "Hospital":
            min_dists["nearestHospitalDistance"] = min(min_dists["nearestHospitalDistance"], dist)
            if dist <= 3.0: counts["hospitalCount3km"] += 1
        elif cat == "Clinic":
            min_dists["nearestClinicDistance"] = min(min_dists["nearestClinicDistance"], dist)
            if dist <= 3.0: counts["hospitalCount3km"] += 1
        elif cat == "School":
            min_dists["nearestSchoolDistance"] = min(min_dists["nearestSchoolDistance"], dist)
            if dist <= 3.0: counts["schoolCount3km"] += 1
        elif cat in ["University / College", "University", "College"]:
            min_dists["nearestCollegeDistance"] = min(min_dists["nearestCollegeDistance"], dist)
            if dist <= 5.0: counts["collegeCount5km"] += 1
        elif cat == "Metro Station":
            min_dists["nearestMetroDistance"] = min(min_dists["nearestMetroDistance"], dist)
            if dist <= 5.0: counts["transitCount5km"] += 1
        elif cat == "Railway Station":
            min_dists["nearestRailwayDistance"] = min(min_dists["nearestRailwayDistance"], dist)
            if dist <= 5.0: counts["transitCount5km"] += 1
        elif cat == "Bus Station":
            min_dists["nearestBusDistance"] = min(min_dists["nearestBusDistance"], dist)
            if dist <= 5.0: counts["transitCount5km"] += 1
        elif cat == "Shopping Mall":
            min_dists["nearestMallDistance"] = min(min_dists["nearestMallDistance"], dist)
            if dist <= 3.0: counts["shoppingCount3km"] += 1
        elif cat == "Supermarket":
            min_dists["nearestSupermarketDistance"] = min(min_dists["nearestSupermarketDistance"], dist)
            if dist <= 3.0: counts["shoppingCount3km"] += 1
        elif cat == "Park":
            min_dists["nearestParkDistance"] = min(min_dists["nearestParkDistance"], dist)
            if dist <= 3.0: counts["parkCount3km"] += 1

    return {**min_dists, **counts}

def compute_location_score(places: list) -> dict:
    """
    Computes a deterministic Location Score (0-100) based on real Google Places data.
    Categories:
    - Healthcare Accessibility (max 20 pts)
    - Education Accessibility (max 20 pts)
    - Transport Accessibility (max 25 pts)
    - Shopping & Essentials (max 20 pts)
    - Recreation & Green Spaces (max 15 pts)
    """
    features = extract_location_features(places)

    # 1. Healthcare Score (Max 20)
    h_dist = min(features["nearestHospitalDistance"], features["nearestClinicDistance"])
    if h_dist <= 1.5: h_score = 20
    elif h_dist <= 3.0: h_score = 15
    elif h_dist <= 5.0: h_score = 10
    else: h_score = 5

    # 2. Education Score (Max 20)
    e_dist = min(features["nearestSchoolDistance"], features["nearestCollegeDistance"])
    if e_dist <= 1.5: e_score = 20
    elif e_dist <= 3.0: e_score = 15
    elif e_dist <= 5.0: e_score = 10
    else: e_score = 5

    # 3. Transport Score (Max 25)
    t_dist = min(features["nearestMetroDistance"], features["nearestRailwayDistance"], features["nearestBusDistance"])
    if t_dist <= 1.0: t_score = 25
    elif t_dist <= 2.5: t_score = 20
    elif t_dist <= 5.0: t_score = 14
    else: t_score = 7

    # 4. Shopping & Essentials Score (Max 20)
    s_dist = min(features["nearestMallDistance"], features["nearestSupermarketDistance"])
    if s_dist <= 1.5: s_score = 20
    elif s_dist <= 3.0: s_score = 15
    elif s_dist <= 5.0: s_score = 10
    else: s_score = 5

    # 5. Recreation & Green Spaces (Max 15)
    p_dist = features["nearestParkDistance"]
    if p_dist <= 1.5: p_score = 15
    elif p_dist <= 3.0: p_score = 11
    elif p_dist <= 5.0: p_score = 7
    else: p_score = 4

    total_score = min(100, max(30, h_score + e_score + t_score + s_score + p_score))

    return {
        "location_score": total_score,
        "total_score": total_score,
        "nearest_school_distance": features.get("nearestSchoolDistance", 99.0),
        "nearest_hospital_distance": features.get("nearestHospitalDistance", 99.0),
        "nearest_metro_distance": features.get("nearestMetroDistance", 99.0),
        "nearest_mall_distance": features.get("nearestMallDistance", 99.0),
        "nearby_school_count": features.get("schoolCount3km", 0),
        "nearby_hospital_count": features.get("hospitalCount3km", 0),
        "nearby_transit_count": features.get("transitCount5km", 0),
        "nearby_shopping_count": features.get("shoppingCount3km", 0),
        "breakdown": {
            "healthcare_score": h_score,
            "education_score": e_score,
            "transport_score": t_score,
            "shopping_score": s_score,
            "recreation_score": p_score,
        },
        "features": features
    }

def calculate_location_score(places: list) -> dict:
    """Alias for compute_location_score for backwards compatibility."""
    return compute_location_score(places)
