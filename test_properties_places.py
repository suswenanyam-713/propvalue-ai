import sqlite3
import requests
import json
from backend.services.locationResolutionService import resolve_property_location
from backend.services.googlePlacesService import fetch_google_nearby_places
from backend.services.locationScoringService import compute_location_score

test_cases = [
    ("Velachery, Chennai", 1, "Velachery", "Chennai"),
    ("Miyapur, Hyderabad", 2, "Miyapur", "Hyderabad"),
    ("Madhapur, Hyderabad", 8, "Madhapur", "Hyderabad"),
    ("Gachibowli, Hyderabad", 5, "Gachibowli", "Hyderabad"),
    ("Hinjewadi, Pune", 3, "Hinjewadi", "Pune"),
]

conn = sqlite3.connect('real_estate.db')
cursor = conn.cursor()

print("==========================================================================")
print("     EMPIRICAL MULTI-PROPERTY GOOGLE PLACES & LOCATION SCORE TEST        ")
print("==========================================================================")

for label, pid, locality, city in test_cases:
    row = cursor.execute("SELECT id, property_name, latitude, longitude FROM properties WHERE id=?", (pid,)).fetchone()
    if not row:
        print(f"Property #{pid} not found in DB")
        continue

    pid_db, pname, orig_lat, orig_lon = row
    res = resolve_property_location(orig_lat, orig_lon, city, locality, pid_db)
    places_res = fetch_google_nearby_places(res["resolvedLatitude"], res["resolvedLongitude"], 3000.0)
    places = places_res.get("places", [])
    score_res = compute_location_score(places)

    print(f"\n--- {label} (Property ID #{pid_db}: {pname}) ---")
    print(f"   Original Coords: ({orig_lat}, {orig_lon})")
    print(f"   Resolved Coords: ({res['resolvedLatitude']}, {res['resolvedLongitude']})")
    print(f"   Status: {res['resolutionSource']}")
    print(f"   Google Places Found (3km): {len(places)}")
    print(f"   Deterministic Location Score: {score_res['location_score']}/100")
    print("   Sample Live Google Places:")
    for pl in places[:3]:
        print(f"     - {pl['name']} ({pl['category']}) | {pl['distance_km']} km | Rating: {pl['rating']}")

conn.close()
