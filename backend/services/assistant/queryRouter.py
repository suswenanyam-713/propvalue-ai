import re

# Supported cities & localities in PropValue AI
CITIES = ["chennai", "hyderabad", "pune", "mumbai", "bengaluru", "bangalore"]
LOCALITIES = [
    "velachery", "omr", "adyar", "anna nagar",
    "miyapur", "gachibowli", "madhapur", "banjara hills", "jubilee hills", "kondapur", "kukatpally", "hitec city",
    "hinjewadi", "kharadi", "wakad", "baner", "kothrud",
    "bandra", "powai", "andheri", "thane",
    "indiranagar", "whitefield", "koramangala", "hsr layout", "electronic city"
]

PROPERTY_TYPES = ["apartment", "independent house", "house", "plot", "villa"]

def parse_price_value(text: str) -> float | None:
    """Extract price in INR from expressions like 'under 1.5 crore', 'below 80 lakhs', '1.2 cr'"""
    text_lower = text.lower()
    
    # Check for Crore: e.g. 1.5 crore, 2 cr, 1 cr
    cr_match = re.search(r'(\d+(?:\.\d+)?)\s*(?:crore|crores|cr)\b', text_lower)
    if cr_match:
        val = float(cr_match.group(1))
        return val * 10_000_000.0

    # Check for Lakhs: e.g. 80 lakhs, 50 lakh, 75 l
    lakh_match = re.search(r'(\d+(?:\.\d+)?)\s*(?:lakh|lakhs|lac|lacs|l)\b', text_lower)
    if lakh_match:
        val = float(lakh_match.group(1))
        return val * 100_000.0

    # Raw digits with rupees
    num_match = re.search(r'(?:₹|inr|rs\.?)\s*(\d[\d,.]*)', text_lower)
    if num_match:
        clean_str = num_match.group(1).replace(',', '')
        try:
            return float(clean_str)
        except ValueError:
            pass

    return None

def extract_entities(query: str, last_context: dict = None) -> dict:
    """Extracts structured entities from user prompt with conversational context fallback."""
    q_lower = query.lower()
    entities = {
        "property_id": None,
        "property_id_b": None,
        "city": None,
        "locality": None,
        "property_type": None,
        "bedrooms": None,
        "max_price": parse_price_value(query),
        "min_price": None,
        "risk_requirement": None,
        "investment_requirement": None,
    }

    # 1. Extract Property IDs
    # e.g. "property 42 and property 108", "compare 42 and 108", "property #42"
    id_matches = re.findall(r'\b(?:property|prop|id|#)\s*(\d+)\b', q_lower)
    if not id_matches:
        # Fallback to standalone numbers if comparison or lookup is implied
        if any(kw in q_lower for kw in ["compare", "property", "details", "worth", "buy", "risk"]):
            id_matches = re.findall(r'\b\d+\b', q_lower)

    if id_matches:
        if len(id_matches) >= 2:
            entities["property_id"] = int(id_matches[0])
            entities["property_id_b"] = int(id_matches[1])
        elif len(id_matches) == 1 and last_context and last_context.get("last_property_id") and any(kw in q_lower for kw in ["compare", "versus", " vs ", "with"]):
            entities["property_id"] = last_context["last_property_id"]
            entities["property_id_b"] = int(id_matches[0])
        else:
            entities["property_id"] = int(id_matches[0])

    # Fallback to last conversational context if user says "it", "this property", "its risk"
    if not entities["property_id"] and last_context and last_context.get("last_property_id"):
        if any(pron in q_lower for pron in ["it", "its", "this property", "the property", "this"]):
            entities["property_id"] = last_context["last_property_id"]

    # 2. Extract City
    for c in CITIES:
        if c in q_lower:
            entities["city"] = "Bengaluru" if c in ["bengaluru", "bangalore"] else c.capitalize()
            break

    # 3. Extract Locality
    for loc in LOCALITIES:
        if loc in q_lower:
            entities["locality"] = "Miyapur" if loc == "miyapur" else loc.title()
            break

    # Fallback to last locality if conversational follow-up
    if not entities["locality"] and last_context and last_context.get("last_locality"):
        if any(pron in q_lower for pron in ["there", "this market", "the area", "this locality", "its market"]):
            entities["locality"] = last_context["last_locality"]

    # 4. Extract Property Type
    for ptype in PROPERTY_TYPES:
        if ptype in q_lower:
            if ptype == "house":
                entities["property_type"] = "Independent House"
            else:
                entities["property_type"] = ptype.title()
            break

    # 5. Extract Bedrooms / BHK
    bhk_match = re.search(r'\b(\d)\s*(?:bhk|bedroom|bedrooms|bed)\b', q_lower)
    if bhk_match:
        entities["bedrooms"] = int(bhk_match.group(1))

    # 6. Extract Risk / Investment filters
    if any(word in q_lower for word in ["low risk", "safe", "minimal risk", "low-risk"]):
        entities["risk_requirement"] = "low"
    elif "high risk" in q_lower:
        entities["risk_requirement"] = "high"

    if any(word in q_lower for word in ["high investment", "best return", "top investment", "high yield"]):
        entities["investment_requirement"] = "high"

    return entities

def classify_intent(query: str, entities: dict) -> str:
    """Classifies user query into one of 12 distinct real estate intents."""
    q_lower = query.lower()

    # 1. Comparison Intent
    if entities["property_id_b"] or "compare" in q_lower or "versus" in q_lower or " vs " in q_lower:
        return "PROPERTY_COMPARISON"

    # 2. Specific Property Lookup / Analysis
    if entities["property_id"]:
        if any(kw in q_lower for kw in ["risk", "safe", "volatile"]):
            return "RISK_ANALYSIS"
        if any(kw in q_lower for kw in ["invest", "buy", "worth", "should i"]):
            return "INVESTMENT_ANALYSIS"
        if any(kw in q_lower for kw in ["amenity", "amenities", "hospital", "school", "metro", "near"]):
            return "AMENITY_ANALYSIS"
        return "PROPERTY_LOOKUP"

    # 3. Market Trend Intent
    if any(kw in q_lower for kw in ["trend", "market", "historical", "price history", "growing", "overview", "rate per sqft"]):
        if entities["locality"] or entities["city"]:
            return "MARKET_TREND"

    # 4. Property Recommendation / Search Intent
    if any(kw in q_lower for kw in ["recommend", "suggest", "find", "search", "show", "best properties", "good apartments", "under", "below"]):
        return "PROPERTY_RECOMMENDATION" if "recommend" in q_lower or "suggest" in q_lower else "PROPERTY_SEARCH"

    # 5. Amenity / Location Analysis
    if any(kw in q_lower for kw in ["amenity", "amenities", "hospital", "school", "metro", "nearby"]):
        return "AMENITY_ANALYSIS"

    if any(kw in q_lower for kw in ["how good", "location", "neighborhood", "area"]):
        return "LOCATION_ANALYSIS"

    # 6. General Valuation / Domain Questions
    return "GENERAL_REAL_ESTATE"
