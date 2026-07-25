import os
import sys
import pandas as pd
from sqlalchemy.orm import Session
import bcrypt

# Adjust python path to be able to import backend
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from backend.database.session import Base, engine, SessionLocal
from backend.database.models import User, Property, HistoricalPrice, NearbyPlace, MarketData

def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


# Unsplash premium real estate images for realistic UI look
APARTMENT_IMAGES = [
    "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=600&q=80"
]

VILLA_IMAGES = [
    "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=600&q=80"
]

PLOT_IMAGES = [
    "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=600&q=80"
]

def get_image(prop_type, idx):
    if "apartment" in prop_type.lower():
        return APARTMENT_IMAGES[idx % len(APARTMENT_IMAGES)]
    elif "plot" in prop_type.lower():
        return PLOT_IMAGES[idx % len(PLOT_IMAGES)]
    else:
        return VILLA_IMAGES[idx % len(VILLA_IMAGES)]

def seed_db(db: Session):
    print("Creating tables if they do not exist...")
    Base.metadata.create_all(bind=engine)

    # 1. Seed Users
    if db.query(User).count() == 0:
        print("Seeding default users...")
        users = [
            User(username="admin", email="admin@platform.com", password_hash=hash_password("admin123"), role="Admin"),
            User(username="seller", email="seller@platform.com", password_hash=hash_password("seller123"), role="Seller"),
            User(username="buyer", email="buyer@platform.com", password_hash=hash_password("buyer123"), role="Buyer"),
        ]
        db.add_all(users)
        db.commit()
        print("Default users seeded.")
    else:
        print("Users table already seeded.")

    # 2. Seed Properties
    if db.query(Property).count() == 0:
        csv_path = "Dataset/Property_Valuation_10000.csv"
        if os.path.exists(csv_path):
            print(f"Seeding properties from {csv_path}...")
            df = pd.read_csv(csv_path)
            from backend.services.namingService import generate_dataset_property_names
            prop_names = generate_dataset_property_names(df)
            df["Property_Name"] = prop_names
            
            properties = []
            for i, row in df.iterrows():
                p = Property(
                    id=int(row["Property_ID"]),
                    property_name=str(row["Property_Name"]),
                    city=str(row["City"]),
                    locality=str(row["Locality"]),
                    latitude=float(row["Latitude"]),
                    longitude=float(row["Longitude"]),
                    property_type=str(row["Property_Type"]),
                    area_sqft=int(row["Area_sqft"]),
                    bedrooms=int(row["Bedrooms"]),
                    bathrooms=int(row["Bathrooms"]),
                    floor=int(row["Floor"]) if "Floor" in df.columns and pd.notna(row["Floor"]) else 1,
                    parking=str(row["Parking"]),
                    furnishing=str(row["Furnishing"]),
                    age=int(row["Age"]),
                    investment_score=int(row["Investment_Score"]),
                    risk_score=int(row["Risk_Score"]),
                    price_inr=float(row["Price_INR"]),
                    image_url=get_image(str(row["Property_Type"]), i),
                    owner_id=2 if i % 100 == 0 else None
                )
                properties.append(p)
                if len(properties) >= 1000:
                    db.bulk_save_objects(properties)
                    db.commit()
                    properties = []
            if properties:
                db.bulk_save_objects(properties)
                db.commit()
            print(f"Seeded {db.query(Property).count()} properties with deterministic display names.")
        else:
            print(f"Error: {csv_path} not found.")
    else:
        print("Properties table already seeded.")

    # 3. Seed Historical Prices
    if db.query(HistoricalPrice).count() == 0:
        csv_path = "Dataset/Historical_Prices_10000.csv"
        if os.path.exists(csv_path):
            print(f"Seeding historical prices from {csv_path}...")
            df = pd.read_csv(csv_path)
            historical = []
            for i, row in df.iterrows():
                h = HistoricalPrice(
                    date=str(row["Date"]),
                    city=str(row["City"]),
                    locality=str(row["Locality"]),
                    avg_price_sqft=float(row["Avg_Price_sqft"]),
                    avg_sale_price=float(row["Avg_Sale_Price"]),
                    demand_index=int(row["Demand_Index"]),
                    growth_percentage=float(row["Growth_%"])
                )
                historical.append(h)
                if len(historical) >= 1000:
                    db.bulk_save_objects(historical)
                    db.commit()
                    historical = []
            if historical:
                db.bulk_save_objects(historical)
                db.commit()
            print(f"Seeded {db.query(HistoricalPrice).count()} historical prices.")
        else:
            print(f"Error: {csv_path} not found.")
    else:
        print("HistoricalPrice table already seeded.")

    # 4. Seed Nearby Places
    if db.query(NearbyPlace).count() == 0:
        csv_path = "Dataset/Nearby_Places_10000.csv"
        if os.path.exists(csv_path):
            print(f"Seeding nearby places from {csv_path}...")
            df = pd.read_csv(csv_path)
            places = []
            for i, row in df.iterrows():
                n = NearbyPlace(
                    place_id=int(row["Place_ID"]),
                    category=str(row["Category"]),
                    name=str(row["Name"]),
                    city=str(row["City"]),
                    locality=str(row["Locality"]),
                    latitude=float(row["Latitude"]),
                    longitude=float(row["Longitude"]),
                    distance_km=float(row["Distance_km"]),
                    rating=float(row["Rating"])
                )
                places.append(n)
                if len(places) >= 1000:
                    db.bulk_save_objects(places)
                    db.commit()
                    places = []
            if places:
                db.bulk_save_objects(places)
                db.commit()
            print(f"Seeded {db.query(NearbyPlace).count()} nearby places.")
        else:
            print(f"Error: {csv_path} not found.")
    else:
        print("NearbyPlace table already seeded.")

    # 5. Seed Live Market Data
    if db.query(MarketData).count() == 0:
        csv_path = "Dataset/Live_Market_10000.csv"
        if os.path.exists(csv_path):
            print(f"Seeding live market listings from {csv_path}...")
            df = pd.read_csv(csv_path)
            market = []
            for i, row in df.iterrows():
                m = MarketData(
                    listing_id=int(row["Listing_ID"]),
                    city=str(row["City"]),
                    locality=str(row["Locality"]),
                    price_inr=float(row["Price_INR"]),
                    area_sqft=int(row["Area_sqft"]),
                    bhk=int(row["BHK"]),
                    posted_date=str(row["Posted_Date"]),
                    status=str(row["Status"])
                )
                market.append(m)
                if len(market) >= 1000:
                    db.bulk_save_objects(market)
                    db.commit()
                    market = []
            if market:
                db.bulk_save_objects(market)
                db.commit()
            print(f"Seeded {db.query(MarketData).count()} market data listings.")
        else:
            print(f"Error: {csv_path} not found.")
    else:
        print("MarketData table already seeded.")

    print("All seeding operations completed successfully.")

if __name__ == "__main__":
    db_file = "real_estate.db"
    if os.path.exists(db_file):
        print(f"Removing old database file '{db_file}' to update schema...")
        try:
            # Dispose engine connections
            engine.dispose()
            os.remove(db_file)
        except Exception as e:
            print(f"Could not remove database file: {e}")

    db_session = SessionLocal()
    try:
        seed_db(db_session)
    finally:
        db_session.close()
