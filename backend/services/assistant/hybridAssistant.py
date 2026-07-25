import datetime
from sqlalchemy.orm import Session
from backend.services.assistant.queryRouter import classify_intent, extract_entities
from backend.services.assistant.structuredRetriever import (
    get_property_by_id, search_properties_structured, get_market_trend_data,
    compare_two_properties, get_google_amenities_for_property
)
from backend.services.assistant.vectorRetriever import vector_retriever

# Session memory map keyed by conversation_id
CONVERSATION_MEMORY = {}

def get_session_context(conversation_id: str) -> dict:
    if not conversation_id:
        return {}
    return CONVERSATION_MEMORY.get(conversation_id, {})

def update_session_context(conversation_id: str, entities: dict):
    if not conversation_id:
        return
    ctx = CONVERSATION_MEMORY.get(conversation_id, {})
    if entities.get("property_id"):
        ctx["last_property_id"] = entities["property_id"]
    if entities.get("locality"):
        ctx["last_locality"] = entities["locality"]
    if entities.get("city"):
        ctx["last_city"] = entities["city"]
    CONVERSATION_MEMORY[conversation_id] = ctx

def process_hybrid_rag_query(query: str, conversation_id: str = None, db: Session = None) -> dict:
    """
    Advanced Hybrid RAG Pipeline:
    Intent Detection -> Entity Extraction -> Multi-retriever Dispatch -> Grounded Answer Synthesis -> Sources & Confidence
    """
    # 1. Fetch Session Memory
    session_ctx = get_session_context(conversation_id)

    # 2. Extract Entities & Classify Intent
    entities = extract_entities(query, last_context=session_ctx)
    intent = classify_intent(query, entities)

    # Update session memory
    update_session_context(conversation_id, entities)

    sources = []
    confidence = "High Confidence"
    recommended_properties = []
    answer = ""

    # ── INTENT 1: PROPERTY LOOKUP ─────────────────────────────────────────────
    if intent in ["PROPERTY_LOOKUP", "RISK_ANALYSIS", "INVESTMENT_ANALYSIS"]:
        prop_id = entities.get("property_id")
        if prop_id:
            prop = get_property_by_id(prop_id, db)
            if prop:
                sources.append("Property Valuation Dataset")
                recommended_properties.append(prop)
                
                # Fetch Market Trend Context for the locality
                m_stats = get_market_trend_data(locality=prop["locality"], city=prop["city"], db=db)
                if m_stats["data_found"]:
                    sources.append("Historical Prices Dataset")

                # Answer Synthesis
                if intent == "RISK_ANALYSIS":
                    answer = (
                        f"### Risk Assessment Report for **{prop['property_name']}** (ID #{prop['id']})\n\n"
                        f"- **Risk Score**: **{prop['risk_score']}/100** ({"Low / Conservative" if prop['risk_score'] < 45 else "Moderate Volatility" if prop['risk_score'] < 70 else "High Risk"})\n"
                        f"- **Location**: {prop['locality']}, {prop['city']}\n"
                        f"- **Age & Construction**: {prop['age']} years old ({prop['furnishing']} furnishing)\n"
                        f"- **Locality Market Demand**: {m_stats.get('demand_index', 65)}/100 ({m_stats.get('trend_direction', 'Stable')})\n\n"
                        f"**Risk Analysis**: "
                        f"{'This property carries a very low risk profile due to strong locality liquidity and robust buyer demand.' if prop['risk_score'] < 45 else 'Moderate market risk due to standard age depreciation and area market shifts. Recommend long-term hold.'}\n\n"
                        f"**Property Specifications**: {prop['bedrooms']} BHK {prop['property_type']} | {prop['area_sqft']} sqft | ₹{prop['price_inr']:,.2f} INR (₹{prop['price_sqft']}/sqft)"
                    )
                elif intent == "INVESTMENT_ANALYSIS":
                    answer = (
                        f"### Investment Analysis for **{prop['property_name']}** (ID #{prop['id']})\n\n"
                        f"- **Investment Intelligence Rating**: **{prop['investment_score']}/100**\n"
                        f"- **Price**: ₹{prop['price_inr']:,.2f} INR (₹{prop['price_sqft']}/sqft)\n"
                        f"- **Risk Rating**: {prop['risk_score']}/100\n"
                        f"- **Locality Historical YoY Growth**: {m_stats.get('historical_growth_yoy', 5.0):.2f}%\n"
                        f"- **Average Locality Price / sqft**: ₹{m_stats.get('avg_price_sqft', prop['price_sqft']):,.2f}\n\n"
                        f"**Investment Verdict**: "
                        f"{'Highly recommended. Outstanding appreciation potential with strong rental demand.' if prop['investment_score'] >= 80 else 'Solid steady investment with balanced capital appreciation potential.'}\n\n"
                        f"**Key Fact**: Situated in **{prop['locality']}, {prop['city']}**, this {prop['bedrooms']} BHK {prop['property_type']} ({prop['area_sqft']} sqft) offers strong fundamental resale value."
                    )
                else:
                    answer = (
                        f"### Property Overview: **{prop['property_name']}** (ID #{prop['id']})\n\n"
                        f"- **Location**: {prop['locality']}, {prop['city']}\n"
                        f"- **Price**: ₹{prop['price_inr']:,.2f} INR (₹{prop['price_sqft']}/sqft)\n"
                        f"- **Configuration**: {prop['bedrooms']} BHK {prop['property_type']} ({prop['area_sqft']} sqft)\n"
                        f"- **Floor & Age**: Floor {prop['floor']} | {prop['age']} yrs old | Furnishing: {prop['furnishing']}\n"
                        f"- **Parking**: {prop['parking']}\n"
                        f"- **Investment Score**: **{prop['investment_score']}/100** | **Risk Score**: **{prop['risk_score']}/100**\n\n"
                        f"*Note: Property display name is a deterministic system-generated identifier.*"
                    )
            else:
                confidence = "Limited Data"
                answer = f"I couldn't find Property ID #{prop_id} in our database. Please double-check the Property ID."
        else:
            confidence = "Limited Data"
            answer = "Please specify a Property ID (e.g., 'Tell me about property 42')."

    # ── INTENT 2: MARKET TREND ────────────────────────────────────────────────
    elif intent == "MARKET_TREND":
        loc = entities.get("locality")
        city = entities.get("city")
        m_stats = get_market_trend_data(locality=loc, city=city, db=db)

        if m_stats["data_found"]:
            sources.extend(["Historical Prices Dataset", "Live Market Dataset"])
            loc_name = loc or city
            answer = (
                f"### Market Overview for **{loc_name}**\n\n"
                f"#### Current Market Status:\n"
                f"- **Active Listings**: {m_stats['listings_count']} properties in database\n"
                f"- **Average Listing Price**: ₹{m_stats['avg_price_inr']:,.2f} INR\n"
                f"- **Average Price / sqft**: ₹{m_stats['avg_price_sqft']:,.2f} per sqft\n"
                f"- **Price Range**: ₹{m_stats['min_price']:,.2f} to ₹{m_stats['max_price']:,.2f}\n\n"
                f"#### Historical Price Trends:\n"
                f"- **Year-on-Year Growth**: **{m_stats['historical_growth_yoy']:.2f}%**\n"
                f"- **Demand Index**: **{m_stats['demand_index']:.0f}/100** ({'High Demand' if m_stats['demand_index'] > 70 else 'Moderate Demand'})\n"
                f"- **Trend Direction**: **{m_stats['trend_direction']}**\n\n"
                f"#### Investment Perspective:\n"
                f"{loc_name} continues to show robust fundamental real estate activity. Commercial infrastructure and connectivity development in this corridor support long-term capital value retention."
            )
            # Recommend top 2 properties in this locality
            recs = search_properties_structured({"locality": loc, "city": city}, db, limit=2)
            recommended_properties.extend(recs)
        else:
            confidence = "Limited Data"
            answer = f"I couldn't find specific market statistics for '{loc or city}'. You can search for locations like Miyapur, Gachibowli, Madhapur, Velachery, or Hinjewadi."

    # ── INTENT 3: PROPERTY COMPARISON ─────────────────────────────────────────
    elif intent == "PROPERTY_COMPARISON":
        id_a = entities.get("property_id")
        id_b = entities.get("property_id_b")
        if id_a and id_b:
            comp = compare_two_properties(id_a, id_b, db)
            if comp:
                sources.extend(["Property Valuation Dataset", "Property Comparison Dataset"])
                pa = comp["property_a"]
                pb = comp["property_b"]
                recommended_properties.extend([pa, pb])

                answer = (
                    f"### Side-by-Side Property Comparison: ID #{id_a} vs ID #{id_b}\n\n"
                    f"| Attribute | Property A (#{id_a}) | Property B (#{id_b}) |\n"
                    f"| --- | --- | --- |\n"
                    f"| **Property Name** | {pa['property_name']} | {pb['property_name']} |\n"
                    f"| **Location** | {pa['locality']}, {pa['city']} | {pb['locality']}, {pb['city']} |\n"
                    f"| **Price** | ₹{pa['price_inr']:,.2f} | ₹{pb['price_inr']:,.2f} |\n"
                    f"| **Price / sqft** | ₹{pa['price_sqft']}/sqft | ₹{pb['price_sqft']}/sqft |\n"
                    f"| **Configuration** | {pa['bedrooms']} BHK {pa['property_type']} ({pa['area_sqft']} sqft) | {pb['bedrooms']} BHK {pb['property_type']} ({pb['area_sqft']} sqft) |\n"
                    f"| **Investment Score** | **{pa['investment_score']}/100** | **{pb['investment_score']}/100** |\n"
                    f"| **Risk Score** | **{pa['risk_score']}/100** | **{pb['risk_score']}/100** |\n\n"
                    f"#### AI Comparison Recommendation:\n"
                    f"**Property {comp['better_property']} ({comp['winner_name']})** is the preferred choice {comp['reason']}"
                )
            else:
                confidence = "Limited Data"
                answer = f"Could not find both properties (ID #{id_a} and ID #{id_b}) in our database. Please verify both Property IDs."
        else:
            confidence = "Limited Data"
            answer = "Please specify two Property IDs to compare (e.g., 'Compare property 42 and property 108')."

    # ── INTENT 4: PROPERTY RECOMMENDATION & SEARCH ────────────────────────────
    elif intent in ["PROPERTY_RECOMMENDATION", "PROPERTY_SEARCH"]:
        recs = search_properties_structured(entities, db, limit=4)
        if recs:
            sources.append("Property Valuation Dataset")
            recommended_properties.extend(recs)
            price_text = f" under ₹{entities['max_price']/1e7:.2f} Cr" if entities.get("max_price") else ""
            loc_text = f" in {entities.get('locality') or entities.get('city')}" if entities.get('locality') or entities.get('city') else ""
            bhk_text = f" {entities.get('bedrooms')} BHK" if entities.get('bedrooms') else ""

            answer = (
                f"### Matching Property Recommendations{bhk_text}{loc_text}{price_text}\n\n"
                f"I found **{len(recs)} matching properties** based on your criteria:\n\n"
            )
            for r in recs:
                answer += f"- **{r['property_name']}** (ID #{r['id']}): ₹{r['price_inr']:,.2f} INR | {r['bedrooms']} BHK {r['property_type']} ({r['area_sqft']} sqft) | Investment: {r['investment_score']}/100\n"

            answer += "\nClick **View Property** below to inspect detailed valuation, price history, and Google Places amenities."
        else:
            confidence = "Limited Data"
            answer = "I couldn't find any properties matching your exact search filters. Try widening your price range or searching in another locality."

    # ── INTENT 5: AMENITY ANALYSIS ────────────────────────────────────────────
    elif intent == "AMENITY_ANALYSIS":
        prop_id = entities.get("property_id")
        if prop_id:
            amenities = get_google_amenities_for_property(prop_id, db)
            prop = get_property_by_id(prop_id, db)
            if prop and amenities:
                sources.extend(["Property Valuation Dataset", "Google Places API"])
                recommended_properties.append(prop)
                
                answer = f"### Nearby Amenities for **{prop['property_name']}** ({prop['locality']}, {prop['city']})\n\n"
                cat_map = {}
                for a in amenities:
                    c = a.get("category", "Amenity")
                    cat_map.setdefault(c, []).append(a)

                for cat_name, places in cat_map.items():
                    answer += f"#### {cat_name} ({len(places)})\n"
                    for p in places[:3]:
                        rating_str = f" ⭐ {p['rating']}" if p.get('rating') else ""
                        answer += f"- **{p['name']}** ({p['distance_km']} km away){rating_str}\n"
                    answer += "\n"
            else:
                confidence = "Limited Data"
                answer = f"Google Places amenities data is currently unavailable for Property #{prop_id}."
        else:
            confidence = "Limited Data"
            answer = "Please specify a Property ID to inspect its surrounding Google Places amenities (e.g., 'What amenities are near property 42?')."

    # ── INTENT 6: GENERAL REAL ESTATE / VECTOR RAG SEARCH ──────────────────────
    else:
        # Perform Vector RAG search over 5,000 document knowledge base
        rag_hits = vector_retriever.search(query, top_k=3, min_similarity=0.10)
        if rag_hits:
            sources.append("PropValue Knowledge Base")
            top_hit = rag_hits[0]
            answer = (
                f"### {top_hit['category']}\n\n"
                f"{top_hit['answer']}\n\n"
            )
            if len(rag_hits) > 1:
                answer += f"**Related Context**: {rag_hits[1]['answer']}"
        else:
            confidence = "Limited Data"
            answer = (
                "I don't have enough data in the current PropValue AI data sources to answer that reliably.\n\n"
                "You can ask me about:\n"
                "- Market trends (e.g. 'Tell me about Miyapur market trends')\n"
                "- Property details (e.g. 'Tell me about property 42')\n"
                "- Property comparisons (e.g. 'Compare property 42 and property 108')\n"
                "- Property recommendations (e.g. 'Recommend 3 BHK in Hyderabad under ₹1.5 crore')"
            )

    return {
        "answer": answer,
        "intent": intent,
        "entities": entities,
        "sources": list(set(sources)) if sources else ["PropValue Intelligence Engine"],
        "confidence": confidence,
        "properties": recommended_properties
    }
