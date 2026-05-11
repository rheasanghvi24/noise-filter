import sys, os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
from app.database import SessionLocal
from app.models import Headline
import json

analyzer = SentimentIntensityAnalyzer()

def score_headlines():
    db = SessionLocal()
    try:
        # Get all headlines that haven't been scored yet
        unscored = db.query(Headline).filter(
            Headline.sentiment_score == None
        ).all()

        print(f"Scoring {len(unscored)} headlines...")

        for h in unscored:
            scores = analyzer.polarity_scores(h.title)
            compound = scores["compound"]

            h.sentiment_score = compound
            h.sentiment_label = (
                "positive" if compound >= 0.05
                else "negative" if compound <= -0.05
                else "neutral"
            )

        db.commit()
        print(f"Done! Scored {len(unscored)} headlines")

        # Print a sample
        sample = db.query(Headline).limit(10).all()
        print("\nSample scores:")
        for h in sample:
            print(f"  [{h.sentiment_label:8}] {h.sentiment_score:+.2f} | {h.title[:55]}")

    finally:
        db.close()

if __name__ == "__main__":
    score_headlines()