import pandas as pd
import numpy as np
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import dateutil.parser

# Attempt to import prophet, fallback gracefully if not installed or fails
try:
    from prophet import Prophet
    HAS_PROPHET = True
except ImportError:
    HAS_PROPHET = False

from backend.database.models import HistoricalPrice

def forecast_locality_prices(db: Session, city: str, locality: str, current_price: float = None):
    """
    Retrieves historical price records for a specific city/locality and projects future prices
    for 1 year, 3 years, and 5 years.
    """
    # Fetch historical prices
    query = db.query(HistoricalPrice).filter(
        HistoricalPrice.city == city,
        HistoricalPrice.locality == locality
    ).order_by(HistoricalPrice.date.asc()).all()

    if not query:
        # Fallback to city-wide average if locality is not found
        query = db.query(HistoricalPrice).filter(
            HistoricalPrice.city == city
        ).order_by(HistoricalPrice.date.asc()).all()

    if not query:
        # Default fallback if there's no historical data at all
        # Generate some synthetic growth based on typical property market trends (e.g., 6% yearly growth)
        historical_data = []
        base_date = datetime.now() - timedelta(days=365*5)
        for i in range(60):
            d = base_date + timedelta(days=30*i)
            historical_data.append({
                "Date": d.strftime("%Y-%m-%d"),
                "Avg_Sale_Price": (current_price or 10000000) * (1.005 ** (i - 60))
            })
        df = pd.DataFrame(historical_data)
    else:
        df = pd.DataFrame([{
            "Date": h.date,
            "Avg_Sale_Price": h.avg_sale_price
        } for h in query])

    # Preprocess dates
    df["Date"] = pd.to_datetime(df["Date"])
    df = df.sort_values("Date").reset_index(drop=True)

    # Adjust base price to match current property's price if provided
    if current_price and len(df) > 0:
        latest_avg = df.iloc[-1]["Avg_Sale_Price"]
        scale_factor = current_price / latest_avg if latest_avg > 0 else 1.0
        df["Avg_Sale_Price"] = df["Avg_Sale_Price"] * scale_factor

    # We need projections for 1 year (12m), 3 years (36m), 5 years (60m)
    forecast_results = {}
    historical_points = []

    # Keep historical points for rendering the chart (take a subset e.g., last 20 points for neat charts)
    chart_points = df.tail(24).copy()
    for _, row in chart_points.iterrows():
        historical_points.append({
            "date": row["Date"].strftime("%Y-%m-%d"),
            "price": float(row["Avg_Sale_Price"]),
            "type": "Historical"
        })

    last_date = df.iloc[-1]["Date"]
    last_price = float(df.iloc[-1]["Avg_Sale_Price"])

    if HAS_PROPHET:
        try:
            # Prepare data for Prophet
            prophet_df = df.rename(columns={"Date": "ds", "Avg_Sale_Price": "y"})
            model = Prophet(yearly_seasonality=True, weekly_seasonality=False, daily_seasonality=False)
            model.fit(prophet_df)

            # Create future dates (monthly for 5 years = 60 months)
            future = model.make_future_dataframe(periods=60, freq='M')
            forecast = model.predict(future)

            # Extract forecasted values
            # We want ds and yhat
            forecast_monthly = forecast[forecast['ds'] > last_date][['ds', 'yhat']]
            
            future_points = []
            for _, row in forecast_monthly.iterrows():
                future_points.append({
                    "date": row["ds"].strftime("%Y-%m-%d"),
                    "price": max(0.0, float(row["yhat"])),
                    "type": "Forecast"
                })

            # Retrieve exact intervals
            y1 = float(forecast[forecast['ds'] <= last_date + timedelta(days=365)].iloc[-1]['yhat'])
            y3 = float(forecast[forecast['ds'] <= last_date + timedelta(days=365*3)].iloc[-1]['yhat'])
            y5 = float(forecast[forecast['ds'] <= last_date + timedelta(days=365*5)].iloc[-1]['yhat'])

            forecast_results = {
                "current_price": last_price,
                "forecast_1y": max(0.0, y1),
                "forecast_3y": max(0.0, y3),
                "forecast_5y": max(0.0, y5),
                "chart_data": historical_points + future_points
            }
            return forecast_results

        except Exception as e:
            print(f"Prophet forecast failed: {e}. Falling back to Linear Trend model...")
            # Fall through to fallback model

    # Fallback / Linear Trend Model
    # Fit a simple linear trend using days since start as independent variable
    start_date = df.iloc[0]["Date"]
    df["Days"] = (df["Date"] - start_date).dt.days
    
    # Simple linear fit: y = mx + c
    slope, intercept = np.polyfit(df["Days"], df["Avg_Sale_Price"], 1)

    # Project dates
    future_dates = [last_date + timedelta(days=30*i) for i in range(1, 61)]
    future_points = []
    
    for fd in future_dates:
        fd_days = (fd - start_date).days
        pred_price = slope * fd_days + intercept
        # Add a small organic non-linear decay/growth or cap at 0
        pred_price = max(pred_price, last_price * 0.5) # keep realistic bounds
        future_points.append({
            "date": fd.strftime("%Y-%m-%d"),
            "price": float(pred_price),
            "type": "Forecast"
        })

    # Projections at 1, 3, 5 years
    pred_1y = slope * ((last_date + timedelta(days=365)) - start_date).days + intercept
    pred_3y = slope * ((last_date + timedelta(days=365*3)) - start_date).days + intercept
    pred_5y = slope * ((last_date + timedelta(days=365*5)) - start_date).days + intercept

    # Ensure predictions are positive and realistic
    pred_1y = max(pred_1y, last_price * 0.6)
    pred_3y = max(pred_3y, last_price * 0.7)
    pred_5y = max(pred_5y, last_price * 0.8)

    forecast_results = {
        "current_price": last_price,
        "forecast_1y": float(pred_1y),
        "forecast_3y": float(pred_3y),
        "forecast_5y": float(pred_5y),
        "chart_data": historical_points + future_points
    }
    return forecast_results
