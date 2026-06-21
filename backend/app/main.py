import sys, os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Headline, StockPrice, SignalScore
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
from typing import Optional
import json

app = FastAPI(title="Noise Filter API", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

analyzer = SentimentIntensityAnalyzer()

# ── Health check ──────────────────────────────────────────
@app.get("/")
def root():
    return {"status": "Noise Filter API is live"}

# ── Get today's headlines with scores ─────────────────────
@app.get("/headlines")
def get_headlines(
    category: Optional[str] = None,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    query = db.query(Headline).filter(
        Headline.sentiment_score != None
    )
    if category:
        query = query.filter(Headline.category == category)

    headlines = query.order_by(
        Headline.published_at.desc()
    ).limit(limit).all()

    return [
        {
            "id":              h.id,
            "title":           h.title,
            "source":          h.source,
            "category":        h.category,
            "published_at":    str(h.published_at),
            "sentiment_score": round(h.sentiment_score, 3),
            "sentiment_label": h.sentiment_label,
            "noise_score":     round(h.noise_score, 3) if h.noise_score else None,
            "is_signal":       h.is_signal,
            "url":             h.url,
        }
        for h in headlines
    ]

# ── Get category signal strengths ─────────────────────────
@app.get("/categories")
def get_categories(db: Session = Depends(get_db)):
    scores = db.query(SignalScore).all()
    return [
        {
            "category":     s.category,
            "avg_t1_move":  round(s.avg_t1_move, 3) if s.avg_t1_move else 0,
            "avg_t2_move":  round(s.avg_t2_move, 3) if s.avg_t2_move else 0,
            "accuracy":     round(s.accuracy, 3) if s.accuracy else 0,
            "sample_count": s.sample_count,
        }
        for s in scores
    ]

# ── Get price history for a symbol ────────────────────────
@app.get("/prices/{symbol}")
def get_prices(
    symbol: str,
    days: int = 90,
    db: Session = Depends(get_db)
):
    from datetime import datetime, timedelta
    since = datetime.today() - timedelta(days=days)
    prices = db.query(StockPrice).filter(
        StockPrice.symbol == symbol,
        StockPrice.date >= since
    ).order_by(StockPrice.date).all()

    return [
        {
            "date":        str(p.date),
            "close_price": round(p.close_price, 2),
            "pct_change":  round(p.pct_change, 3),
        }
        for p in prices
    ]

# ── Score a custom headline in real time ──────────────────
@app.post("/analyse")
def analyse_headline(payload: dict):
    title = payload.get("title", "")
    if not title:
        return {"error": "No title provided"}

    scores = analyzer.polarity_scores(title)
    compound = scores["compound"]

    label = (
        "positive" if compound >= 0.05
        else "negative" if compound <= -0.05
        else "neutral"
    )

    return {
        "title":           title,
        "sentiment_score": round(compound, 3),
        "sentiment_label": label,
        "breakdown": {
            "positive": round(scores["pos"], 3),
            "negative": round(scores["neg"], 3),
            "neutral":  round(scores["neu"], 3),
        },
        "interpretation": (
            "Strong market signal — watch this category"
            if abs(compound) > 0.5
            else "Moderate signal — context matters"
            if abs(compound) > 0.2
            else "Low signal — likely noise"
        )
    }

# ── Summary stats ─────────────────────────────────────────
@app.get("/summary")
def get_summary(db: Session = Depends(get_db)):
    from sqlalchemy import func
    
    total      = db.query(Headline).count()
    scored     = db.query(Headline).filter(
                     Headline.sentiment_score != None).count()
    positive   = db.query(Headline).filter(
                     Headline.sentiment_label == "positive").count()
    negative   = db.query(Headline).filter(
                     Headline.sentiment_label == "negative").count()
    neutral    = db.query(Headline).filter(
                     Headline.sentiment_label == "neutral").count()
    price_rows = db.query(StockPrice).count()
    categories = db.query(SignalScore).count()

    return {
        "total_headlines":  total,
        "scored_headlines": scored,
        "positive":         positive,
        "negative":         negative,
        "neutral":          neutral,
        "price_rows":       price_rows,
        "categories":       categories,
    }

from ml.explain import explain_headline as explain_headline_fn

@app.get("/explain/{headline_id}")
def explain_headline_endpoint(headline_id: int, db: Session = Depends(get_db)):
    headline = db.query(Headline).filter(Headline.id == headline_id).first()
    if not headline:
        return {"error": "Headline not found"}

    result = explain_headline_fn(
        title=headline.title,
        category=headline.category or "General",
    )
    return result