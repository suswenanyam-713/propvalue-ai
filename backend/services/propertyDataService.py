import os
from abc import ABC, abstractmethod
from sqlalchemy.orm import Session
from backend.database.models import Property

class BasePropertyProvider(ABC):
    @abstractmethod
    def fetch_listings(self, city: str, locality: str, db: Session) -> list[Property]:
        pass

class DatabaseListingProvider(BasePropertyProvider):
    """
    Default provider that loads properties from the seeded local SQLite database.
    Serves as a high-performance local cache snaps layer.
    """
    def fetch_listings(self, city: str, locality: str, db: Session) -> list[Property]:
        # Filter matching records, ignoring casing
        query = db.query(Property).filter(
            Property.city.ilike(city.strip()),
            Property.locality.ilike(locality.strip())
        )
        return query.all()

class MagicBricksListingProvider(BasePropertyProvider):
    """
    MagicBricks API Provider stub.
    Loads credentials and pulls from MagicBricks endpoint when available.
    """
    def __init__(self, api_key: str):
        self.api_key = api_key

    def fetch_listings(self, city: str, locality: str, db: Session) -> list[Property]:
        # Credentials check
        if not self.api_key:
            print("MagicBricks API key is missing. Falling back to local cache.")
            return DatabaseListingProvider().fetch_listings(city, locality, db)
            
        print(f"Calling MagicBricks listings API for {locality}, {city}...")
        # Stuffed request block for future integration
        # response = requests.get(f"https://api.magicbricks.com/v1/properties?city={city}&locality={locality}", headers={"Authorization": self.api_key})
        return DatabaseListingProvider().fetch_listings(city, locality, db)

class HousingListingProvider(BasePropertyProvider):
    """
    Housing.com API Provider stub.
    Loads credentials and pulls from Housing.com endpoint when available.
    """
    def __init__(self, api_key: str):
        self.api_key = api_key

    def fetch_listings(self, city: str, locality: str, db: Session) -> list[Property]:
        if not self.api_key:
            print("Housing.com API key is missing. Falling back to local cache.")
            return DatabaseListingProvider().fetch_listings(city, locality, db)
            
        print(f"Calling Housing.com listings API for {locality}, {city}...")
        return DatabaseListingProvider().fetch_listings(city, locality, db)

class PropertyDataService:
    def __init__(self):
        provider_type = os.getenv("PROPERTY_DATA_API_PROVIDER", "local_db").lower()
        api_key = os.getenv("PROPERTY_DATA_API_KEY", "")
        
        if provider_type == "magicbricks":
            self.provider = MagicBricksListingProvider(api_key)
        elif provider_type == "housing":
            self.provider = HousingListingProvider(api_key)
        else:
            self.provider = DatabaseListingProvider()

    def get_active_listings(self, city: str, locality: str, db: Session) -> list[Property]:
        """
        Gets list of properties for the requested city and locality.
        Falls back to database cache snapshot if external APIs fail or are unauthorized.
        """
        try:
            return self.provider.fetch_listings(city, locality, db)
        except Exception as e:
            print(f"Listing provider failed: {e}. Falling back to SQLite cache.")
            return DatabaseListingProvider().fetch_listings(city, locality, db)
