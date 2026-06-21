import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import yfinance as yf
from datetime import datetime, timedelta
from app.database import SessionLocal
from app.models import StockPrice

SYMBOLS = [
    "^NSEI",        # Nifty 50
    "^BSESN",       # Sensex
    "HDFCBANK.NS",  # HDFC Bank
    "RELIANCE.NS",  # Reliance
    "INFY.NS",      # Infosys
    "TCS.NS",       # TCS
]


def safe_float(val):
    if hasattr(val, 'iloc'):
        val = val.iloc[0]
    return float(val)


def fetch_and_save(days_back: int = 365 * 3):
    db = SessionLocal()
    try:
        start = (datetime.today() - timedelta(days=days_back)).strftime("%Y-%m-%d")
        end   = datetime.today().strftime("%Y-%m-%d")
        print(f"Fetching data from {start} to {end}")

        for symbol in SYMBOLS:
            print(f"  Fetching {symbol}...")
            try:
                df = yf.download(symbol, start=start, end=end, progress=False)

                if df.empty:
                    print(f"    No data returned for {symbol}")
                    continue

                # Flatten MultiIndex columns — newer yfinance returns
                # columns like ('Open', '^NSEI') instead of 'Open'
                if isinstance(df.columns, type(df.columns)) and hasattr(df.columns, 'droplevel'):
                    if df.columns.nlevels > 1:
                        df.columns = df.columns.droplevel(1)

                df["pct_change"] = df["Close"].pct_change() * 100
                df = df.dropna()

                saved = 0
                for date, row in df.iterrows():
                    exists = db.query(StockPrice).filter(
                        StockPrice.symbol == symbol,
                        StockPrice.date   == date
                    ).first()
                    if exists:
                        continue

                    price = StockPrice(
                        symbol      = symbol,
                        date        = date,
                        open_price  = safe_float(row["Open"]),
                        close_price = safe_float(row["Close"]),
                        high_price  = safe_float(row["High"]),
                        low_price   = safe_float(row["Low"]),
                        volume      = safe_float(row["Volume"]),
                        pct_change  = safe_float(row["pct_change"]),
                    )
                    db.add(price)
                    saved += 1

                db.commit()
                print(f"    Saved {saved} rows for {symbol}")

            except Exception as e:
                print(f"    Error fetching {symbol}: {e}")
                continue
    finally:
        db.close()


if __name__ == "__main__":
    print("=== Price Fetcher Starting ===")
    fetch_and_save()
    print("=== Done ===")