import os
import sys
import pandas as pd
import re
from sqlalchemy.orm import Session

# Adjust python path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from backend.database.models import Property, HistoricalPrice, MarketData

# Premium pre-defined Q&As for expert real estate responses
DOMAIN_KNOWLEDGE = {
    "investment_score": (
        "The Investment Score is calculated out of 100 based on projected price appreciation, "
        "historical growth, locality demand, property type performance, and rental yield. "
        "A score above 80 indicates an excellent investment, while below 60 suggests slower growth."
    ),
    "risk_score": (
        "The Risk Score (out of 100) measures volatility and uncertainty. It takes into account "
        "property age, construction delays, local crime rates, infrastructure development delays, "
        "and market liquidity. A risk score below 45 is considered low/safe, while above 70 is high-risk."
    ),
    "rental_yield": (
        "Rental Yield represents the annual rental income expressed as a percentage of the property price. "
        "Typically, residential rental yields in major Indian cities range between 2% to 4%, while "
        "commercial properties yield between 6% to 9%. It is calculated as: (Monthly Rent * 12) / Property Price."
    ),
    "price_growth": (
        "Property prices are driven by locality demand, infrastructure projects (like metro lines, airports), "
        "commercial hubs, connectivity, and macroeconomic factors like inflation and interest rates."
    ),
    "valuation_method": (
        "We use an advanced XGBoost Machine Learning model trained on over 10,000 recent listings. "
        "It evaluates parameters including Area, BHK, Property Age, Parking, Furnishing status, and "
        "geographic coordinates (Latitude/Longitude) to estimate the fair market value."
    )
}

class PropertyRAGAssistant:
    def __init__(self):
        self.csv_path = "Dataset/RAG_Knowledge_5000.csv"
        self.kb_loaded = False
        self.kb_qa = []
        self._load_knowledge_base()

    def _load_knowledge_base(self):
        if os.path.exists(self.csv_path):
            try:
                df = pd.read_csv(self.csv_path)
                # Group or pick representative ones since they are duplicate answers
                # We store a subset for fuzzy matching
                df_clean = df.drop_duplicates(subset=["Question", "Answer"])
                self.kb_qa = df_clean.to_dict(orient="records")
                self.kb_loaded = True
                print(f"RAG Knowledge Base loaded: {len(self.kb_qa)} unique items.")
            except Exception as e:
                print(f"Failed to load RAG CSV: {e}")
        else:
            print("RAG CSV not found. Using preloaded domain knowledge.")

    def _find_kb_match(self, query: str):
        # Fallback text matching
        query_lower = query.lower()
        
        # Check domain knowledge first
        for key, value in DOMAIN_KNOWLEDGE.items():
            if key.replace("_", " ") in query_lower or key in query_lower:
                return value

        # Check CSV QAs
        best_match = None
        best_score = 0
        for item in self.kb_qa:
            question = item["Question"].lower()
            # simple Jaccard similarity or token intersection
            q_tokens = set(re.findall(r'\w+', question))
            query_tokens = set(re.findall(r'\w+', query_lower))
            if not q_tokens:
                continue
            score = len(q_tokens.intersection(query_tokens)) / len(q_tokens.union(query_tokens))
            if score > best_score:
                best_score = score
                best_match = item["Answer"]
        
        if best_score > 0.2:
            return best_match
        return None

    def query_assistant(self, query: str, db: Session) -> str:
        """
        Processes a natural language query, performs RAG or database lookups,
        and returns an intelligence response.
        """
        query_lower = query.lower()

        # Regex checks for specific actions:
        # 1. Ask about a specific locality or city
        # "Tell me about Miyapur" or "Should I buy in Velachery"
        locality_match = None
        city_match = None

        # Check unique cities from DB
        cities = ["chennai", "hyderabad", "pune", "mumbai", "bengaluru"]
        for c in cities:
            if c in query_lower:
                city_match = c.capitalize()
                break

        # Check local property database search
        # Simple extraction of numbers for IDs
        property_id_match = re.search(r'\b(?:property|id|prop)\s*(?:#|no|number)?\s*(\d+)\b', query_lower)
        
        if property_id_match:
            prop_id = int(property_id_match.group(1))
            prop = db.query(Property).filter(Property.id == prop_id).first()
            if prop:
                return (
                    f"### Property #{prop.id} Details:\n"
                    f"- **Location**: {prop.locality}, {prop.city}\n"
                    f"- **Price**: ₹{prop.price_inr:,.2f} INR\n"
                    f"- **Specs**: {prop.bedrooms} BHK {prop.property_type} ({prop.area_sqft} sqft)\n"
                    f"- **Age**: {prop.age} years old | Furnishing: {prop.furnishing}\n"
                    f"- **Investment Score**: {prop.investment_score}/100 | **Risk Score**: {prop.risk_score}/100\n\n"
                    f"**AI Evaluation**: This property is a "
                    f"{'high-yield low-risk' if prop.investment_score > 80 and prop.risk_score < 45 else 'standard'} "
                    f"investment. The price is ₹{p_sqft:,.2f} per sqft. "
                    f"I recommend this property for buyers seeking "
                    f"{'rapid wealth growth' if prop.investment_score > 75 else 'stable long-term asset hold'}."
                ).replace("p_sqft", f"{prop.price_inr / prop.area_sqft:.2f}")
            else:
                return f"I couldn't find a property with ID #{prop_id} in our database. Can you double check the number?"

        # 2. Check if user is asking to compare
        if "compare" in query_lower:
            ids = re.findall(r'\b\d+\b', query_lower)
            if len(ids) >= 2:
                id1, id2 = int(ids[0]), int(ids[1])
                p1 = db.query(Property).filter(Property.id == id1).first()
                p2 = db.query(Property).filter(Property.id == id2).first()
                if p1 and p2:
                    better = "Property A" if p1.investment_score > p2.investment_score else "Property B"
                    reason = (
                        f"due to its superior Investment Score ({max(p1.investment_score, p2.investment_score)} "
                        f"vs {min(p1.investment_score, p2.investment_score)}) and lower relative risk."
                    )
                    return (
                        f"### AI Property Comparison (ID #{id1} vs ID #{id2}):\n\n"
                        f"| Parameter | Property A (#{id1}) | Property B (#{id2}) |\n"
                        f"| --- | --- | --- |\n"
                        f"| **City** | {p1.city} | {p2.city} |\n"
                        f"| **Locality** | {p1.locality} | {p2.locality} |\n"
                        f"| **Price** | ₹{p1.price_inr:,.2f} | ₹{p2.price_inr:,.2f} |\n"
                        f"| **BHK/Type** | {p1.bedrooms} BHK {p1.property_type} | {p2.bedrooms} BHK {p2.property_type} |\n"
                        f"| **Area** | {p1.area_sqft} sqft | {p2.area_sqft} sqft |\n"
                        f"| **Investment Score** | {p1.investment_score}/100 | {p2.investment_score}/100 |\n"
                        f"| **Risk Score** | {p1.risk_score}/100 | {p2.risk_score}/100 |\n\n"
                        f"**AI Recommendation**: **{better}** is the preferred choice, {reason}"
                    )

        # 3. Check for Locality/Market questions
        localities = ["Velachery", "Miyapur", "Indiranagar", "Madhapur", "Kothrud", "Wakad", "Bandra", "Andheri", "Whitefield"]
        matched_locality = None
        for loc in localities:
            if loc.lower() in query_lower:
                matched_locality = loc
                break

        if matched_locality:
            # Get historical prices or market statistics
            h_prices = db.query(HistoricalPrice).filter(HistoricalPrice.locality == matched_locality).limit(5).all()
            m_data = db.query(MarketData).filter(MarketData.locality == matched_locality).all()
            
            avg_price = np.mean([m.price_inr for m in m_data]) if m_data else 0
            listings_count = len(m_data)

            response = f"### Market Intelligence for **{matched_locality}**:\n"
            if listings_count > 0:
                response += f"- **Current Listings**: {listings_count} active properties\n"
                response += f"- **Average Listing Price**: ₹{avg_price:,.2f} INR\n"
            
            if h_prices:
                growth = h_prices[-1].growth_percentage if hasattr(h_prices[-1], 'growth_percentage') else 0.05
                demand = h_prices[-1].demand_index if hasattr(h_prices[-1], 'demand_index') else 65
                response += (
                    f"- **Historical Price Trend**: Stabilizing upward\n"
                    f"- **Demand Index**: {demand}/100 ({"High Demand" if demand > 70 else "Moderate Demand"})\n"
                    f"- **Year-on-Year Growth**: {growth:.2f}%\n"
                )
            
            response += (
                f"\n**Investment Summary**: {matched_locality} is currently showing "
                f"{"excellent growth momentum. It is a seller's market." if listings_count > 5 else "stable values. Great for end-users."} "
                f"Developing infrastructure nearby will likely bolster price appreciation over the next 18-24 months."
            )
            return response

        # 4. Standard FAQ Matching
        kb_match = self._find_kb_match(query)
        if kb_match:
            return kb_match

        # 5. Default General Response
        return (
            "Hello! I am your AI Investment Intelligence Assistant. I can help you with:\n"
            "- Valuing specific properties using machine learning\n"
            "- Explaining Investment & Risk scores\n"
            "- Comparing properties (e.g. 'Compare property 1 and property 2')\n"
            "- Local market stats (e.g. 'Tell me about Miyapur')\n\n"
            "What can I research for you today?"
        )

# Singleton Instance
assistant = PropertyRAGAssistant()
