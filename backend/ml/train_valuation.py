import os
import sys
import pandas as pd
import numpy as np
import joblib
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.ensemble import GradientBoostingRegressor

# Set directory path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

def train_models():
    csv_path = "Dataset/Property_Valuation_10000.csv"
    if not os.path.exists(csv_path):
        print(f"Error: {csv_path} not found. Cannot train models.")
        return

    print("Loading valuation dataset...")
    df = pd.read_csv(csv_path)

    # Preprocessing
    categorical_cols = ["City", "Locality", "Property_Type", "Parking", "Furnishing"]
    encoders = {}

    for col in categorical_cols:
        le = LabelEncoder()
        df[col] = df[col].astype(str)
        df[col] = le.fit_transform(df[col])
        encoders[col] = le

    # Features and Targets
    features = ["City", "Locality", "Latitude", "Longitude", "Property_Type", "Area_sqft", "Bedrooms", "Bathrooms", "Floor", "Age", "Parking", "Furnishing"]
    
    if "Floor" not in df.columns:
        df["Floor"] = 1
    
    X = df[features]
    y_price = df["Price_INR"]
    y_investment = df["Investment_Score"]
    y_risk = df["Risk_Score"]

    # Split dataset
    X_train, X_test, y_price_train, y_price_test = train_test_split(X, y_price, test_size=0.2, random_state=42)
    _, _, y_inv_train, y_inv_test = train_test_split(X, y_investment, test_size=0.2, random_state=42)
    _, _, y_risk_train, y_risk_test = train_test_split(X, y_risk, test_size=0.2, random_state=42)

    os.makedirs("backend/ml/saved_models", exist_ok=True)

    # 1. Price Model
    print("Training Property Price Valuation Gradient Boosting Model...")
    price_model = GradientBoostingRegressor(n_estimators=100, learning_rate=0.1, max_depth=6, random_state=42)
    price_model.fit(X_train, y_price_train)
    price_score = price_model.score(X_test, y_price_test)
    print(f"Price model R2 Score on test set: {price_score:.4f}")
    joblib.dump(price_model, "backend/ml/saved_models/price_model.joblib")

    # 2. Investment Score Model
    print("Training Investment Score Model...")
    inv_model = GradientBoostingRegressor(n_estimators=100, learning_rate=0.1, max_depth=5, random_state=42)
    inv_model.fit(X_train, y_inv_train)
    inv_score = inv_model.score(X_test, y_inv_test)
    print(f"Investment Score model R2 Score on test set: {inv_score:.4f}")
    joblib.dump(inv_model, "backend/ml/saved_models/investment_model.joblib")

    # 3. Risk Score Model
    print("Training Risk Score Model...")
    risk_model = GradientBoostingRegressor(n_estimators=100, learning_rate=0.1, max_depth=5, random_state=42)
    risk_model.fit(X_train, y_risk_train)
    risk_score = risk_model.score(X_test, y_risk_test)
    print(f"Risk Score model R2 Score on test set: {risk_score:.4f}")
    joblib.dump(risk_model, "backend/ml/saved_models/risk_model.joblib")

    # Save Encoders and Feature names
    joblib.dump(encoders, "backend/ml/saved_models/encoders.joblib")
    joblib.dump(features, "backend/ml/saved_models/features.joblib")
    print("All models and preprocessing objects saved successfully!")

if __name__ == "__main__":
    train_models()
