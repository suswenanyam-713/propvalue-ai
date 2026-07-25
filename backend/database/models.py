import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from backend.database.session import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(String, default="Buyer")  # Buyer, Seller, Admin
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    predictions = relationship("Prediction", back_populates="user")
    chats = relationship("ChatHistory", back_populates="user")
    properties = relationship("Property", back_populates="owner")

class Property(Base):
    __tablename__ = "properties"

    id = Column(Integer, primary_key=True, index=True)
    property_name = Column(String, index=True, nullable=True)
    real_project_name = Column(String, nullable=True)
    city = Column(String, index=True, nullable=False)
    locality = Column(String, index=True, nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    property_type = Column(String, nullable=False)  # Apartment, Independent House, Plot, Villa
    area_sqft = Column(Integer, nullable=False)
    bedrooms = Column(Integer, nullable=False)
    bathrooms = Column(Integer, nullable=False)
    floor = Column(Integer, nullable=True)
    parking = Column(String, nullable=False)  # Yes, No
    furnishing = Column(String, nullable=False)  # Unfurnished, Fully, Semi
    age = Column(Integer, nullable=False)
    investment_score = Column(Integer, nullable=False)
    risk_score = Column(Integer, nullable=False)
    price_inr = Column(Float, nullable=False)
    image_url = Column(String, nullable=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    data_source = Column(String, default="Seed List")
    last_updated = Column(DateTime, default=datetime.datetime.utcnow)

    owner = relationship("User", back_populates="properties")

    @property
    def display_name(self):
        return self.real_project_name if self.real_project_name else (self.property_name or f"{self.locality} Property #{self.id}")

class HistoricalPrice(Base):
    __tablename__ = "historical_prices"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(String, index=True, nullable=False)  # YYYY-MM-DD
    city = Column(String, index=True, nullable=False)
    locality = Column(String, index=True, nullable=False)
    avg_price_sqft = Column(Float, nullable=False)
    avg_sale_price = Column(Float, nullable=False)
    demand_index = Column(Integer, nullable=False)
    growth_percentage = Column(Float, nullable=False)
    data_source = Column(String, default="Seed List")
    last_updated = Column(DateTime, default=datetime.datetime.utcnow)

class NearbyPlace(Base):
    __tablename__ = "nearby_places"

    id = Column(Integer, primary_key=True, index=True)
    place_id = Column(Integer, nullable=False)
    category = Column(String, index=True, nullable=False)  # Hospital, School, Mall, etc.
    name = Column(String, nullable=False)
    city = Column(String, index=True, nullable=False)
    locality = Column(String, index=True, nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    distance_km = Column(Float, nullable=False)
    rating = Column(Float, nullable=False)
    retrieved_at = Column(DateTime, default=datetime.datetime.utcnow)

class MarketData(Base):
    __tablename__ = "market_data"

    id = Column(Integer, primary_key=True, index=True)
    listing_id = Column(Integer, nullable=False)
    city = Column(String, index=True, nullable=False)
    locality = Column(String, index=True, nullable=False)
    price_inr = Column(Float, nullable=False)
    area_sqft = Column(Integer, nullable=False)
    bhk = Column(Integer, nullable=False)
    posted_date = Column(String, nullable=False)  # YYYY-MM-DD
    status = Column(String, index=True, nullable=False)  # Available, Pending, Sold
    data_source = Column(String, default="Seed List")
    last_updated = Column(DateTime, default=datetime.datetime.utcnow)

class Prediction(Base):
    __tablename__ = "predictions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    property_type = Column(String, nullable=False)
    city = Column(String, nullable=False)
    locality = Column(String, nullable=False)
    area_sqft = Column(Integer, nullable=False)
    bedrooms = Column(Integer, nullable=False)
    bathrooms = Column(Integer, nullable=False)
    floor = Column(Integer, nullable=True)
    parking = Column(String, nullable=False)
    furnishing = Column(String, nullable=False)
    age = Column(Integer, nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    predicted_price = Column(Float, nullable=False)
    confidence_score = Column(Float, nullable=False)
    location_score = Column(Integer, default=70)
    nearest_school_dist = Column(Float, nullable=True)
    nearest_hospital_dist = Column(Float, nullable=True)
    nearest_transit_dist = Column(Float, nullable=True)
    nearest_mall_dist = Column(Float, nullable=True)
    nearby_school_count = Column(Integer, default=0)
    nearby_hospital_count = Column(Integer, default=0)
    nearby_transit_count = Column(Integer, default=0)
    nearby_shopping_count = Column(Integer, default=0)
    investment_score = Column(Integer, nullable=False)
    risk_score = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="predictions")

class ChatHistory(Base):
    __tablename__ = "chat_history"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    question = Column(String, nullable=False)
    answer = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="chats")

class Locality(Base):
    __tablename__ = "localities"

    id = Column(Integer, primary_key=True, index=True)
    city = Column(String, index=True, nullable=False)
    name = Column(String, index=True, nullable=False)
    avg_price_sqft = Column(Float, nullable=True)
    median_price = Column(Float, nullable=True)
    demand_indicator = Column(String, nullable=True)  # High, Medium, Low
    active_listings_count = Column(Integer, default=0)
    data_source = Column(String, default="Platform System")
    last_updated = Column(DateTime, default=datetime.datetime.utcnow)

class MarketSnapshot(Base):
    __tablename__ = "market_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    city = Column(String, index=True, nullable=False)
    locality = Column(String, index=True, nullable=False)
    listings_count = Column(Integer, nullable=False)
    available_listings = Column(Integer, nullable=False)
    sold_listings = Column(Integer, nullable=False)
    average_price = Column(Float, nullable=False)
    data_source = Column(String, nullable=False)
    last_updated = Column(DateTime, default=datetime.datetime.utcnow)

class ValuationComparable(Base):
    __tablename__ = "valuation_comparables"

    id = Column(Integer, primary_key=True, index=True)
    prediction_id = Column(Integer, ForeignKey("predictions.id"), nullable=False)
    property_id = Column(Integer, ForeignKey("properties.id"), nullable=False)
    distance_km = Column(Float, nullable=False)
    similarity_score = Column(Float, nullable=False)
