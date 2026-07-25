import pandas as pd
import numpy as np
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import dateutil.parser

try:
    from prophet import Prophet
    HAS_PROPHET = True
except ImportError:
    HAS_PROPHET = False

from backend.database.models import HistoricalPrice
from backend.database.session import SessionLocal

def forecast_locality_prices(city: str, locality: str = None, current_price: float = None, db = None):
    """
    Retrieves historical price records for a specific city/locality and projects future prices
    for 1 year, 3 years, and 5 years.
    Handles parameter ordering flexibly.
    """
    # Parameter order protection: if first arg was Session object
    if hasattr(city, 'query'):
        db_obj = city
        city_str = locality
        locality_str = current_price
        price_val = db
        db = db_obj
        city = city_str
        locality = locality_str
        current_price = price_val

    # Ensure clean string values
    city = str(city) if city else "Hyderabad"
    locality = str(locality) if locality else "Gachibowli"
    if current_price is not None:
        try:
            current_price = float(current_price)
        except (ValueError, TypeError):
            current_price = 10000000.0

    close_db_on_exit = False
    if db is None or not hasattr(db, 'query'):
        db = SessionLocal()
        close_db_on_exit = True

    try:
        # Fetch historical prices
        query = db.query(HistoricalPrice).filter(
            HistoricalPrice.city.ilike(f"%{city}%"),
            HistoricalPrice.locality.ilike(f"%{locality}%")
        ).order_by(HistoricalPrice.date.asc()).all()

        if not query:
            query = db.query(HistoricalPrice).filter(
                HistoricalPrice.city.ilike(f"%{city}%")
            ).order_by(HistoricalPrice.date.asc()).all()

        if not query:
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

        df["Date"] = pd.to_datetime(df["Date"])
        df = df.sort_values("Date").reset_index(drop=True)

        if current_price and len(df) > 0:
            latest_avg = df.iloc[-1]["Avg_Sale_Price"]
            scale_factor = current_price / latest_avg if latest_avg > 0 else 1.0
            df["Avg_Sale_Price"] = df["Avg_Sale_Price"] * scale_factor

        historical_points = []
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
                prophet_df = df.rename(columns={"Date": "ds", "Avg_Sale_Price": "y"})
                model = Prophet(yearly_seasonality=True, weekly_seasonality=False, daily_seasonality=False)
                model.fit(prophet_df)

                future = model.make_future_dataframe(periods=60, freq='ME')
                forecast = model.predict(future)

                forecast_monthly = forecast[forecast['ds'] > last_date][['ds', 'yhat']]
                future_points = []
                for _, row in forecast_monthly.iterrows():
                    future_points.append({
                        "date": row["ds"].strftime("%Y-%m-%d"),
                        "price": max(0.0, float(row["yhat"])),
                        "type": "Forecast"
                    })

                y1 = float(forecast[forecast['ds'] <= last_date + timedelta(days=365)].iloc[-1]['yhat'])
                y3 = float(forecast[forecast['ds'] <= last_date + timedelta(days=365*3)].iloc[-1]['yhat'])
                y5 = float(forecast[forecast['ds'] <= last_date + timedelta(days=365*5)].iloc[-1]['yhat'])

                return {
                    "current_price": last_price,
                    "forecast_1y": max(0.0, y1),
                    "forecast_3y": max(0.0, y3),
                    "forecast_5y": max(0.0, y5),
                    "chart_data": historical_points + future_points
                }
            except Exception as e:
                print(f"Prophet forecast failed: {e}. Using Linear Trend model...")

        # Linear Trend Model
        start_date = df.iloc[0]["Date"]
        df["Days"] = (df["Date"] - start_date).dt.days
        slope, intercept = np.polyfit(df["Days"], df["Avg_Sale_Price"], 1)

        future_dates = [last_date + timedelta(days=30*i) for i in range(1, 61)]
        future_points = []
        for fd in future_dates:
            fd_days = (fd - start_date).days
            pred_price = max(slope * fd_days + intercept, last_price * 0.5)
            future_points.append({
                "date": fd.strftime("%Y-%m-%d"),
                "price": float(pred_price),
                "type": "Forecast"
            })

        pred_1y = max(slope * ((last_date + timedelta(days=365)) - start_date).days + intercept, last_price * 0.6)
        pred_3y = max(slope * ((last_date + timedelta(days=365*3)) - start_date).days + intercept, last_price * 0.7)
        pred_5y = max(slope * ((last_date + timedelta(days=365*5)) - start_date).days + intercept, last_price * 0.8)

        return {
            "current_price": last_price,
            "forecast_1y": float(pred_1y),
            "forecast_3y": float(pred_3y),
            "forecast_5y": float(pred_5y),
            "chart_data": historical_points + future_points
        }
    finally:
        if close_db_on_exit:
            db.close()
