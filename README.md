# AI-Powered Property Valuation & Investment Intelligence Platform

## 🏠 Overview

A production-ready, full-stack AI-powered real estate platform that combines:
- **XGBoost ML** for instant property price predictions
- **Linear Trend / Prophet** for 1, 3, and 5-year price forecasting
- **RAG AI Chatbot** (local database + knowledge base, no external API key required)
- **React + Vite + Tailwind CSS** premium dark UI
- **SQLite** database seeded with 40,000+ records from 7 CSV datasets
- **FastAPI** backend with JWT authentication and role-based access
- **Leaflet.js** interactive maps with nearby amenities (hospitals, schools, malls, etc.)
- **Recharts** interactive analytics dashboard

---

## 🚀 Quick Start

### 1. Install Backend Dependencies
```bash
pip install -r requirements.txt
```

### 2. Train Machine Learning Models
```bash
python backend/ml/train_valuation.py
```

### 3. Seed the Database
```bash
python backend/database/seed.py
```

### 4. Start the Backend API
```bash
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

### 5. Install Frontend Dependencies
```bash
cd frontend
npm install
```

### 6. Start the Frontend Dev Server
```bash
npm run dev
```

The app will be available at **http://localhost:3000**

The API docs (Swagger UI) will be at **http://localhost:8000/docs**

---

## 🔐 Default Accounts

| Role   | Username | Password    |
|--------|----------|-------------|
| Admin  | admin    | admin123    |
| Seller | seller   | seller123   |
| Buyer  | buyer    | buyer123    |

---

## 📁 Project Structure

```
├── backend/
│   ├── api/              # FastAPI route handlers
│   │   ├── routes_auth.py    # JWT authentication
│   │   ├── routes_val.py     # ML valuation & forecasting
│   │   ├── routes_prop.py    # Properties, comparison, recommendations
│   │   ├── routes_chat.py    # RAG AI chatbot
│   │   └── routes_admin.py   # Admin CRUD operations
│   ├── auth/             # JWT helpers and bcrypt hashing
│   ├── database/         # SQLAlchemy models, session, seeder
│   ├── ml/               # XGBoost models + forecasting + recommendation
│   │   └── saved_models/ # Trained .joblib model files
│   └── rag/              # RAG chatbot with knowledge base indexing
├── frontend/
│   └── src/
│       ├── components/   # Navbar, Footer
│       ├── context/      # AuthContext (JWT session management)
│       └── pages/        # LandingPage, Properties, Valuation, Compare, etc.
├── Dataset/              # 7 CSV source files (10,000 rows each)
├── requirements.txt
├── real_estate.db        # SQLite database (auto-generated on seed)
└── README.md
```

---

## 🧠 AI Features

| Feature               | Technology           |
|-----------------------|----------------------|
| Price Valuation       | XGBoost Regressor    |
| Investment Score      | XGBoost Regressor    |
| Risk Score            | XGBoost Regressor    |
| Price Forecasting     | Prophet / Linear Trend |
| Property Recommendations | Multi-attribute similarity scoring |
| AI Chat Assistant     | Local RAG + SQL DB queries |

---

## 🌐 API Endpoints

| Method | Endpoint              | Description                    | Auth Required |
|--------|-----------------------|--------------------------------|---------------|
| POST   | /api/auth/register    | Create new account             | No            |
| POST   | /api/auth/login       | Get JWT token                  | No            |
| GET    | /api/auth/me          | Get current user profile       | Yes           |
| GET    | /api/properties       | Search properties with filters | No            |
| GET    | /api/properties/{id}  | Get property details + nearby  | No            |
| POST   | /api/predict          | XGBoost ML price prediction    | Yes           |
| POST   | /api/forecast         | Price forecast for 1/3/5 years | Yes           |
| POST   | /api/recommend        | Similarity-based recommendations | Yes          |
| POST   | /api/compare          | Side-by-side comparison        | Yes           |
| POST   | /api/chat             | RAG AI chatbot query           | Yes           |
| GET    | /api/market           | Market analytics dashboard data| No            |
| GET    | /api/nearby           | Nearby places by city/locality | No            |
| GET    | /api/admin/users      | List all users (Admin only)    | Admin         |
| GET    | /api/admin/analytics  | Platform analytics (Admin only)| Admin         |

---

## 🐳 Docker (Optional)

```bash
docker-compose up --build
```

---

## 📊 Datasets Used

| File                          | Records | Description                        |
|-------------------------------|---------|-------------------------------------|
| Property_Valuation_10000.csv  | 10,000  | Property features + prices (ML training) |
| Historical_Prices_10000.csv   | 10,000  | Date-based locality price trends    |
| Live_Market_10000.csv         | 10,000  | Real-time listing statuses          |
| Nearby_Places_10000.csv       | 10,000  | Schools, hospitals, malls, etc.     |
| RAG_Knowledge_5000.csv        | 5,000   | Q&A knowledge base for chatbot      |
| property_comparison_dataset.csv| 10,000 | Pairwise comparison benchmarks      |
| property_recommendation_dataset.csv| 10,000| User preference matching data    |
