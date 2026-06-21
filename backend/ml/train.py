import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pandas as pd
import numpy as np
from datetime import timedelta, date
from app.database import SessionLocal
from app.models import Headline, StockPrice, SignalScore
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report
from sklearn.preprocessing import LabelEncoder
import xgboost as xgb
import pickle


def build_training_data():
    db = SessionLocal()
    try:
        headlines = db.query(Headline).filter(
            Headline.sentiment_score != None
        ).all()

        prices_raw = db.query(StockPrice).filter(
            StockPrice.symbol == "^NSEI"
        ).all()

        print(f"Headlines with scores : {len(headlines)}")
        print(f"Nifty price rows      : {len(prices_raw)}")

        price_dict = {}
        for p in prices_raw:
            try:
                if hasattr(p.date, 'date'):
                    key = p.date.date()
                elif isinstance(p.date, date):
                    key = p.date
                else:
                    key = pd.to_datetime(p.date).date()
                price_dict[key] = p.pct_change
            except Exception:
                pass

        sample_keys = sorted(price_dict.keys())[-5:]
        print(f"Latest price dates    : {sample_keys}")
        print(f"Price dict size       : {len(price_dict)} trading days")

        def get_next_trading_move(from_date, skip=0):
            found = 0
            for offset in range(1, 15):
                d = from_date + timedelta(days=offset)
                key = d.date() if hasattr(d, 'date') else d
                move = price_dict.get(key)
                if move is not None:
                    if found == skip:
                        return move, key
                    found += 1
            return None, None

        rows = []
        matched = 0
        unmatched = 0

        for h in headlines:
            if not h.published_at:
                continue
            try:
                pub_date = (
                    h.published_at.date()
                    if hasattr(h.published_at, 'date')
                    else pd.to_datetime(h.published_at).date()
                )
            except Exception:
                continue

            t1_move, t1_date = get_next_trading_move(pub_date, skip=0)
            t2_move, t2_date = get_next_trading_move(pub_date, skip=1)

            if t1_move is None:
                unmatched += 1
                t1_move = 0.0
                t2_move = 0.0
            if t2_move is None:
                t2_move = t1_move

            matched += 1
            is_signal = 1 if (abs(t1_move) > 0.1 or abs(t2_move) > 0.1) else 0

            rows.append({
                "headline_id":     h.id,
                "title":           h.title[:60],
                "sentiment_score": h.sentiment_score or 0.0,
                "sentiment_label": h.sentiment_label or "neutral",
                "category":        h.category or "General",
                "source":          h.source or "Unknown",
                "hour_published":  h.published_at.hour if h.published_at else 12,
                "day_of_week":     h.published_at.weekday() if h.published_at else 0,
                "t1_move":         t1_move,
                "t2_move":         t2_move,
                "is_signal":       is_signal,
            })

        df = pd.DataFrame(rows)
        print(f"Matched headlines     : {matched}")
        print(f"Unmatched headlines   : {unmatched}")
        print(f"Training rows built   : {len(df)}")

        if len(df) > 0:
            sample = df[df["t1_move"] != 0].head(5)
            if not sample.empty:
                print(f"\nSample T+1 moves:")
                for _, row in sample.iterrows():
                    print(f"  {row['category']:<12} "
                          f"T+1={row['t1_move']:+.2f}% "
                          f"T+2={row['t2_move']:+.2f}% "
                          f"| {row['title'][:45]}")

        return df

    finally:
        db.close()


def analyse_categories(df):
    db = SessionLocal()
    try:
        print("\n--- Category Signal Analysis ---")

        grp = df.groupby("category").agg(
            count       = ("is_signal",       "count"),
            signal_rate = ("is_signal",        "mean"),
            avg_t1      = ("t1_move",          "mean"),
            avg_t2      = ("t2_move",          "mean"),
            avg_sent    = ("sentiment_score",  "mean"),
        ).reset_index().sort_values("count", ascending=False)

        print(f"\n{'Category':<14} {'Count':>6} "
              f"{'Signal%':>8} {'Avg T+1':>8} "
              f"{'Avg T+2':>8} {'Avg Sent':>9}")
        print("-" * 58)

        for _, row in grp.iterrows():
            print(
                f"{row['category']:<14} "
                f"{int(row['count']):>6} "
                f"{row['signal_rate']:>7.0%} "
                f"{row['avg_t1']:>+7.2f}% "
                f"{row['avg_t2']:>+7.2f}% "
                f"{row['avg_sent']:>+8.3f}"
            )

        for _, row in grp.iterrows():
            existing = db.query(SignalScore).filter(
                SignalScore.category == row["category"]
            ).first()
            if existing:
                existing.avg_t1_move  = float(row["avg_t1"])
                existing.avg_t2_move  = float(row["avg_t2"])
                existing.accuracy     = float(row["signal_rate"])
                existing.sample_count = int(row["count"])
            else:
                db.add(SignalScore(
                    category     = row["category"],
                    avg_t1_move  = float(row["avg_t1"]),
                    avg_t2_move  = float(row["avg_t2"]),
                    accuracy     = float(row["signal_rate"]),
                    sample_count = int(row["count"]),
                ))
        db.commit()
        print("\nSignal scores saved to database!")

    finally:
        db.close()


def train():
    print("=" * 50)
    print(" NOISE FILTER — ML Training")
    print("=" * 50)

    df = build_training_data()

    if df.empty:
        print("\nNo data to train on.")
        return

    analyse_categories(df)

    le_cat = LabelEncoder()
    le_src = LabelEncoder()
    df["category_enc"] = le_cat.fit_transform(df["category"])
    df["source_enc"]   = le_src.fit_transform(df["source"])

    matched_df = df[df["t1_move"] != 0].copy()
    print(f"\nRows with price matches: {len(matched_df)}")

    if len(matched_df) >= 20:
        train_df = matched_df
        print("Training on price-matched rows only.")
    elif len(df) >= 20:
        train_df = df.copy()
        print("Not enough price matches — training on all rows.")
    else:
        print("Not enough data yet. Keep running scheduler daily.")
        print("Sentiment analysis is fully functional in the meantime.")
        return

    features = [
        "sentiment_score",
        "category_enc",
        "source_enc",
        "hour_published",
        "day_of_week",
    ]

    X = train_df[features]
    y = train_df["is_signal"]

    unique_classes = y.unique()
    if len(unique_classes) < 2:
        print(f"\nOnly 1 class ({unique_classes[0]}) in training data.")
        print("This means all headlines so far are either all signal or all noise.")
        print("Model will train once price matches create both classes.")
        print("\nCurrent system status:")
        print(f"  Sentiment scoring    : FULLY WORKING ({len(df)} headlines scored)")
        print(f"  Category analysis    : FULLY WORKING ({len(df)} categorised)")
        print(f"  Price correlation    : BUILDING ({len(matched_df)} matches so far)")
        print(f"  XGBoost model        : PENDING (needs both signal and noise examples)")
        print(f"\nRun the scraper + price fetcher daily — model trains automatically")
        print(f"once both classes are present in the matched data.")
        return

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )

    print("\n--- Training XGBoost Model ---")
    model = xgb.XGBClassifier(
        n_estimators=100,
        max_depth=4,
        learning_rate=0.1,
        random_state=42,
        eval_metric="logloss",
        verbosity=0,
    )
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    acc    = accuracy_score(y_test, y_pred)
    print(f"Model accuracy: {acc:.1%}")

    if len(set(y_test)) > 1:
        print(classification_report(
            y_test, y_pred,
            target_names=["Noise", "Signal"]
        ))
    else:
        print("Note: Only 1 class in test set — need more data for full report.")

    os.makedirs("ml/saved", exist_ok=True)
    with open("ml/saved/model.pkl", "wb") as f:
        pickle.dump(model, f)
    with open("ml/saved/encoders.pkl", "wb") as f:
        pickle.dump({"category": le_cat, "source": le_src}, f)
    print("Model saved to ml/saved/")


if __name__ == "__main__":
    train()