import datetime
from sqlalchemy.orm import Session
from backend.database.models import Property, HistoricalPrice, Locality

def get_locality_market_trends(city: str, locality_name: str, db: Session) -> dict:
    """
    Computes locality market metrics dynamically using database listings:
    - Average price per sq.ft
    - Median property price
    - Active listing inventory
    - Property type distribution
    - Historical price trends (average price per sq.ft index)
    - Demand Indicator
    """
    locality_clean = locality_name.strip().lower()
    city_clean = city.strip().lower()
    
    # 1. Fetch matching properties
    properties = db.query(Property).filter(
        Property.city.ilike(city_clean),
        Property.locality.ilike(locality_clean)
    ).all()
    
    total_listings = len(properties)
    
    # Defaults in case locality is empty
    if total_listings == 0:
        # Fallback: Query matching city properties to avoid empty screens
        properties = db.query(Property).filter(Property.city.ilike(city_clean)).all()
        total_listings = len(properties)
        
    if total_listings == 0:
        return {
            "city": city,
            "locality": locality_name,
            "avg_price_sqft": 6500.0,
            "median_price": 8500000.0,
            "listings_count": 0,
            "demand_indicator": "Medium",
            "property_types_distribution": {},
            "price_history": [],
            "data_source": "Platform Internal Estimate",
            "last_updated": datetime.datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
        }

    prices = [p.price_inr for p in properties]
    areas = [p.area_sqft for p in properties]
    price_per_sqft_list = [p.price_inr / p.area_sqft for p in properties]
    
    avg_price_sqft = sum(price_per_sqft_list) / len(price_per_sqft_list)
    
    # Calculate median
    prices.sort()
    mid = len(prices) // 2
    median_price = prices[mid] if len(prices) % 2 != 0 else (prices[mid-1] + prices[mid]) / 2.0
    
    # Type distribution
    type_counts = {}
    for p in properties:
        type_counts[p.property_type] = type_counts.get(p.property_type, 0) + 1
        
    # Percentages
    type_distribution = {k: round((v / total_listings) * 100, 1) for k, v in type_counts.items()}
    
    # 2. Historical price trends from HistoricalPrice table
    hist_prices = db.query(HistoricalPrice).filter(
        HistoricalPrice.city.ilike(city_clean),
        HistoricalPrice.locality.ilike(locality_clean)
    ).order_by(HistoricalPrice.date.asc()).all()
    
    # Calculate demand indicator based on historical price movement
    demand_level = "Medium"
    if len(hist_prices) > 0:
        last_trend = hist_prices[-1]
        if last_trend.demand_index >= 75:
            demand_level = "High"
        elif last_trend.demand_index < 45:
            demand_level = "Low"
    else:
        # Generate default historical sequence if none found
        hist_prices = db.query(HistoricalPrice).filter(
            HistoricalPrice.city.ilike(city_clean)
        ).order_by(HistoricalPrice.date.asc()).all()[:12] # Limit to 12 data points
        
    price_history = []
    for hp in hist_prices:
        price_history.append({
            "date": hp.date,
            "avg_price_sqft": hp.avg_price_sqft,
            "avg_sale_price": hp.avg_sale_price,
            "growth_percentage": hp.growth_percentage,
            "demand": hp.demand_index
        })
        
    # Check if there is an existing Locality cache entry; update or insert it
    locality_cache = db.query(Locality).filter(
        Locality.city.ilike(city_clean),
        Locality.name.ilike(locality_clean)
    ).first()
    
    if not locality_cache:
        locality_cache = Locality(
            city=city,
            name=locality_name,
            avg_price_sqft=avg_price_sqft,
            median_price=median_price,
            demand_indicator=demand_level,
            active_listings_count=total_listings,
            data_source="Platform Analytics Engine",
            last_updated=datetime.datetime.utcnow()
        )
        db.add(locality_cache)
    else:
        locality_cache.avg_price_sqft = avg_price_sqft
        locality_cache.median_price = median_price
        locality_cache.demand_indicator = demand_level
        locality_cache.active_listings_count = total_listings
        locality_cache.last_updated = datetime.datetime.utcnow()
    db.commit()

    return {
        "city": city,
        "locality": locality_name,
        "avg_price_sqft": round(avg_price_sqft, 2),
        "median_price": round(median_price, 2),
        "listings_count": total_listings,
        "demand_indicator": demand_level,
        "property_types_distribution": type_distribution,
        "price_history": price_history,
        "data_source": "PropValue AI Analytics Service",
        "last_updated": datetime.datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
    }
