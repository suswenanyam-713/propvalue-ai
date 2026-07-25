from sqlalchemy.orm import Session
from backend.database.models import Property

def get_recommendations(db: Session, budget: float, city: str, locality: str, bedrooms: int, property_type: str, limit: int = 10):
    """
    Computes a similarity and recommendation score for all properties in the database
    based on the user's preferences, and returns the top N properties.
    """
    properties = db.query(Property).all()
    if not properties:
        return []

    scored_properties = []

    for p in properties:
        # 1. City Match (Max 25 pts)
        city_score = 25 if p.city.lower() == city.lower() else 0

        # 2. Locality Match (Max 25 pts)
        locality_score = 25 if p.locality.lower() == locality.lower() else 0

        # 3. Property Type Match (Max 15 pts)
        type_score = 15 if p.property_type.lower() == property_type.lower() else 0

        # 4. BHK Match (Max 15 pts)
        bhk_diff = abs(p.bedrooms - bedrooms)
        bhk_score = max(0, 15 - bhk_diff * 5)

        # 5. Price / Budget Match (Max 20 pts)
        # Closer to budget yields higher score
        price_diff = abs(p.price_inr - budget)
        price_ratio = price_diff / budget if budget > 0 else 1.0
        price_score = max(0, 20 * (1 - price_ratio))

        # Raw Similarity Score (Weighted sum of features, max 100)
        similarity_score = city_score + locality_score + type_score + bhk_score + price_score

        # Recommendation Score: Combination of Similarity and Property's Investment Score
        # We give 70% weight to user similarity and 30% weight to investment score
        recommendation_score = (similarity_score * 0.7) + (p.investment_score * 0.3)

        scored_properties.append({
            "property": p,
            "similarity_score": round(similarity_score, 2),
            "recommendation_score": round(recommendation_score, 2),
            "investment_score": p.investment_score
        })

    # Sort descending by Recommendation Score
    scored_properties.sort(key=lambda x: x["recommendation_score"], reverse=True)

    # Convert to API response dictionaries
    results = []
    for item in scored_properties[:limit]:
        p = item["property"]
        results.append({
            "id": p.id,
            "property_name": p.display_name,
            "city": p.city,
            "locality": p.locality,
            "price_inr": p.price_inr,
            "area_sqft": p.area_sqft,
            "bedrooms": p.bedrooms,
            "bathrooms": p.bathrooms,
            "property_type": p.property_type,
            "age": p.age,
            "parking": p.parking,
            "furnishing": p.furnishing,
            "latitude": p.latitude,
            "longitude": p.longitude,
            "image_url": p.image_url,
            "investment_score": item["investment_score"],
            "risk_score": p.risk_score,
            "similarity_score": item["similarity_score"],
            "recommendation_score": item["recommendation_score"]
        })

    return results
