#  NoiseFilter — Indian Market Intelligence System

> Helping retail investors separate signal from noise in Indian financial news

![Python](https://img.shields.io/badge/Python-3.13-blue?style=flat-square)
![FastAPI](https://img.shields.io/badge/FastAPI-0.136-green?style=flat-square)
![React](https://img.shields.io/badge/React-Vite-purple?style=flat-square)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue?style=flat-square)
![XGBoost](https://img.shields.io/badge/ML-XGBoost-orange?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)

---

## The Problem

Every day Indian retail investors are bombarded with hundreds of financial headlines.
Most of it is noise — but some of it genuinely moves markets.
**NoiseFilter** automatically classifies every headline by its historical
market-moving power, so investors can focus on what actually matters.

---

## What It Does

- Scrapes **6 Indian financial news sources** every 6 hours automatically
- Scores every headline with **VADER NLP sentiment analysis**
- Classifies headlines into **9 categories** (RBI, FII, Earnings, Geopolitics, etc.)
- Correlates news categories with **Nifty 50 price movements** (T+1, T+2)
- Trains an **XGBoost classifier** daily to predict market-moving headlines
- Serves everything through a **FastAPI REST backend**
- Displays live insights on a **React fintech dashboard**
- Exports executive reports via **Power BI**

---

## Key Insights Discovered

| Category | Signal Rate | Avg Sentiment |
|----------|------------|---------------|
| Geopolitics | 68% | -0.181 (Bearish) |
| General | 64% | +0.151 (Bullish) |
| RBI | 60% | +0.210 (Bullish) |
| IPO | 50% | +0.094 (Neutral) |
| Earnings | 48% | +0.178 (Bullish) |
| Crypto | 45% | +0.236 (Bullish) |
| Regulation | 44% | +0.017 (Neutral) |
| FII | 27% | -0.086 (Bearish) |

> **Finding:** Geopolitics headlines move Nifty 68% of the time within 48 hours —
> yet most retail investors dismiss them as background noise.
> FII news dominates financial Twitter but has the lowest signal rate at 27%.

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Scraping** | BeautifulSoup, feedparser, Requests | Extract headlines from 6 sources |
| **Database** | PostgreSQL, SQLAlchemy ORM | Store headlines, prices, scores |
| **NLP** | VADER Sentiment Analysis | Score headline sentiment -1 to +1 |
| **ML** | XGBoost, Scikit-learn, SHAP | Predict market-moving headlines |
| **Prices** | yfinance | 3 years of Nifty/stock price data |
| **Backend** | FastAPI, Uvicorn, Pydantic | REST API with auto docs |
| **Scheduling** | Python schedule, Celery | Automated 6-hourly pipeline |
| **Frontend** | React, Vite, Recharts, Tailwind | Live fintech dashboard |
| **Analytics** | Power BI | Executive reporting layer |
| **Cache** | Redis | API response caching |

---

## Project Structure
noise-filter/
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI app — 5 endpoints
│   │   ├── models.py        # SQLAlchemy DB models
│   │   ├── database.py      # DB connection & session
│   │   └── init_db.py       # Create tables
│   ├── pipeline/
│   │   ├── scraper.py       # Multi-source scraper (6 sources)
│   │   ├── scorer.py        # VADER sentiment scoring
│   │   ├── price_fetcher.py # yfinance price data
│   │   ├── archive_scraper.py # Historical RSS scraping
│   │   └── scheduler.py     # Automated pipeline runner
│   ├── ml/
│   │   ├── train.py         # XGBoost training pipeline
│   │   └── predict.py       # Real-time prediction
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── pages/
│       │   ├── Dashboard.jsx   # Main dashboard
│       │   ├── Historical.jsx  # Signal analysis
│       │   └── Analyser.jsx    # Real-time analyser
│       └── App.jsx
├── powerbi/
│   └── NoiseFilter_Report.pbix
├── run.bat                  # One-click startup
└── README.md

## API Endpoints

| Method | Endpoint | Description |
|--------|---------|-------------|
| GET | `/` | Health check |
| GET | `/headlines` | Live scored headlines (filterable by category) |
| GET | `/categories` | Signal strength by news category |
| GET | `/prices/{symbol}` | Price history for any NSE symbol |
| GET | `/summary` | Dashboard KPI summary |
| POST | `/analyse` | Score any custom headline in real-time |
| GET | `/docs` | Auto-generated API documentation |

---

## Setup & Run

### Prerequisites
- Python 3.13+
- Node.js 18+
- PostgreSQL 16
- Power BI Desktop (optional)

### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
venv\Scripts\activate        # Windows
source venv/bin/activate     # Mac/Linux

# Install dependencies
pip install -r requirements.txt
python -m spacy download en_core_web_sm

# Setup database
# Create 'noisefilter' database in PostgreSQL first
# Then update .env with your credentials

# Initialise tables
python -m app.init_db

# Run data pipeline
python pipeline/price_fetcher.py    # 3 years of price data
python pipeline/scraper.py          # First batch of headlines
python pipeline/scorer.py           # Score sentiment
python ml/train.py                  # Train XGBoost

# Start API
uvicorn app.main:app --reload --port 8000
```

### Environment Variables

Create `backend/.env`:

```env
DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/noisefilter
NEWS_API_KEY=your_newsapi_key
REDIS_URL=redis://localhost:6379/0
SECRET_KEY=your-secret-key
```

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

### One-click Start (Windows)

```bash
# Just double-click run.bat
# Starts backend, scheduler, and frontend automatically
```

---

## Dashboard Features

### Dashboard Page
- Live KPI cards — total headlines, positive/negative signals, price rows
- Nifty 50 60-day price chart
- Sentiment donut chart
- Headlines by category bar chart
- Live filterable headlines table with sentiment scores

### Historical Analysis Page
- Market mood banner (Bullish/Bearish/Neutral)
- Category risk cards with sentiment bars
- Avg sentiment by category (horizontal bar)
- Headlines by source breakdown
- Stacked sentiment volume over time
- Category risk radar chart
- Top risk headlines ranked by negativity

### Real-time Analyser Page
- Paste any headline and get instant sentiment score
- Signal strength breakdown (positive/negative/neutral %)
- Example headlines to try
- Interpretation: Signal vs Noise verdict

---

## Automated Pipeline
Every 6 hours:
→ Scrape 6 news sources (400+ headlines/day)
→ Score sentiment with VADER NLP
→ Save to PostgreSQL with deduplication
Every day at 8am:
→ Fetch latest 7 days of Nifty price data
→ Match headlines to T+1, T+2 price moves
→ Retrain XGBoost model automatically
→ Update signal scores per category

## Screenshots

> Dashboard, Historical Analysis, and Real-time Analyser
> ![DASHBOARD](image.png)
> ![HISTORICAL ANALYSIS](image-1.png)
> ![REAL TIME ANALYSER](image-2.png)

---

## Author

**Rhea Sanghvi** — Data Analyst & Business Analyst

- GitHub: [@rheasanghvi24](https://github.com/rheasanghvi24)
- Project: [NoiseFilter](https://github.com/rheasanghvi24/noise-filter)

---

## License

MIT License — free to use and modify