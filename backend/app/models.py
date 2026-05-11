from sqlalchemy import Column, Integer, String, Float, DateTime, Text, Boolean
from sqlalchemy.sql import func
from app.database import Base

class Headline(Base):
    __tablename__ = "headlines"

    id          = Column(Integer, primary_key=True, index=True)
    title       = Column(Text, nullable=False)
    source      = Column(String(100))
    url         = Column(Text)
    category    = Column(String(50), index=True)   # RBI, FII, Earnings, etc.
    published_at= Column(DateTime, index=True)
    fetched_at  = Column(DateTime, server_default=func.now())

    # NLP outputs (filled by pipeline/scorer.py in Week 2)
    sentiment_score  = Column(Float)               # -1.0 to +1.0
    sentiment_label  = Column(String(20))          # positive / negative / neutral
    keywords         = Column(Text)                # JSON string of top 3 keywords
    entities         = Column(Text)                # JSON string: RBI, Infosys, etc.

    # ML output (filled after model training)
    noise_score      = Column(Float)               # 0 = pure noise, 1 = strong signal
    is_signal        = Column(Boolean)             # True if noise_score > 0.5

class StockPrice(Base):
    __tablename__ = "stock_prices"

    id          = Column(Integer, primary_key=True, index=True)
    symbol      = Column(String(20), index=True)   # ^NSEI, ^BSESN, HDFCBANK.NS etc.
    date        = Column(DateTime, index=True)
    open_price  = Column(Float)
    close_price = Column(Float)
    high_price  = Column(Float)
    low_price   = Column(Float)
    volume      = Column(Float)
    pct_change  = Column(Float)                    # daily % change — key feature

class SignalScore(Base):
    __tablename__ = "signal_scores"

    id              = Column(Integer, primary_key=True, index=True)
    category        = Column(String(50), unique=True, index=True)
    avg_t1_move     = Column(Float)    # avg Nifty % move 24hrs after this category
    avg_t2_move     = Column(Float)    # avg Nifty % move 48hrs after this category
    accuracy        = Column(Float)    # how often this category predicted direction
    sample_count    = Column(Integer)  # how many headlines used to calculate this
    updated_at      = Column(DateTime, server_default=func.now())