"""
Property Naming Service

Generates deterministic display names for property records based on:
Property_ID, Locality, Property_Type, and Bedrooms.

Rules:
1. No Math.random() or non-deterministic logic.
2. Identical names after application/server restart.
3. No fake/unauthorized builder names (Prestige, Godrej, DLF, etc.).
4. Uses deterministic suffix array:
   ['Heights', 'Residency', 'Homes', 'Enclave', 'Residence', 'Gardens', 'Towers', 'Vista', 'Haven', 'Court']
   suffixIndex = (Property_ID - 1) % len(suffixList)
5. Pattern rules:
   - APARTMENT: [Locality] [Suffix] – [Bedrooms] BHK Apartment
   - INDEPENDENT HOUSE: [Locality] [Suffix] – [Bedrooms] BHK Independent House
   - VILLA: [Locality] [Suffix] – [Bedrooms] BHK Villa
   - PLOT: [Locality] [Suffix] – Residential Plot
   - Other: [Locality] [Suffix] – [Property_Type]
6. Uniqueness:
   If generated names collide across the dataset, append '#[Property_ID]' for stable identity.
"""

SUFFIXES = [
    "Heights", "Residency", "Homes", "Enclave", "Residence",
    "Gardens", "Towers", "Vista", "Haven", "Court"
]

def generate_base_property_name(property_id: int, locality: str, property_type: str, bedrooms: int) -> str:
    pid = int(property_id)
    loc = str(locality).strip() if locality else "Central"
    ptype = str(property_type).strip() if property_type else "Property"
    bhk = int(bedrooms) if bedrooms is not None else 1

    suffix = SUFFIXES[(pid - 1) % len(SUFFIXES)]
    ptype_upper = ptype.upper()

    if ptype_upper == "APARTMENT":
        return f"{loc} {suffix} – {bhk} BHK Apartment"
    elif ptype_upper == "INDEPENDENT HOUSE":
        return f"{loc} {suffix} – {bhk} BHK Independent House"
    elif ptype_upper == "VILLA":
        return f"{loc} {suffix} – {bhk} BHK Villa"
    elif ptype_upper == "PLOT":
        return f"{loc} {suffix} – Residential Plot"
    else:
        return f"{loc} {suffix} – {ptype}"

def generate_dataset_property_names(dataframe) -> list:
    """
    Given a pandas DataFrame of properties containing Property_ID, Locality, Property_Type, Bedrooms,
    returns a list of unique, deterministic Property_Names.
    """
    base_names = [
        generate_base_property_name(
            row["Property_ID"],
            row["Locality"],
            row["Property_Type"],
            row["Bedrooms"]
        )
        for _, row in dataframe.iterrows()
    ]

    from collections import Counter
    counts = Counter(base_names)

    final_names = []
    for pid, base in zip(dataframe["Property_ID"], base_names):
        if counts[base] > 1:
            final_names.append(f"{base} #{pid}")
        else:
            final_names.append(base)

    return final_names

def generate_single_property_name(property_id: int, locality: str, property_type: str, bedrooms: int) -> str:
    """
    Generates a deterministic display name for a single property instance.
    """
    base = generate_base_property_name(property_id, locality, property_type, bedrooms)
    return f"{base} #{property_id}"
