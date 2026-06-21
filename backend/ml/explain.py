import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
from app.database import SessionLocal
from app.models import SignalScore
import re

analyzer = SentimentIntensityAnalyzer()


def get_word_contributions(text: str):
    """
    Breaks a headline into words and shows which ones VADER
    treats as carrying positive/negative sentiment.
    Uses VADER's own lexicon so this is the real mechanism,
    not an approximation.
    """
    lexicon = analyzer.lexicon
    words = re.findall(r"[A-Za-z']+", text)

    contributions = []
    for word in words:
        lw = word.lower()
        if lw in lexicon:
            score = lexicon[lw]
            contributions.append({
                "word": word,
                "score": round(score, 2),
                "direction": "positive" if score > 0 else "negative",
            })

    # Sort by absolute impact
    contributions.sort(key=lambda x: abs(x["score"]), reverse=True)
    return contributions


def get_category_context(category: str):
    """
    Pulls the real historical signal stats for this category
    from the signal_scores table (built by ml/train.py).
    """
    db = SessionLocal()
    try:
        stat = db.query(SignalScore).filter(
            SignalScore.category == category
        ).first()
        if not stat:
            return None
        return {
            "category":     stat.category,
            "signal_rate":  round((stat.accuracy or 0) * 100, 1),
            "avg_t1_move":  round(stat.avg_t1_move or 0, 3),
            "avg_t2_move":  round(stat.avg_t2_move or 0, 3),
            "sample_count": stat.sample_count,
        }
    finally:
        db.close()


def explain_headline(title: str, category: str = "General"):
    scores = analyzer.polarity_scores(title)
    compound = scores["compound"]
    label = (
        "positive" if compound >= 0.05
        else "negative" if compound <= -0.05
        else "neutral"
    )

    word_contributions = get_word_contributions(title)
    category_context = get_category_context(category)

    # Build a plain-English explanation
    explanation_parts = []

    if word_contributions:
        top_words = word_contributions[:3]
        word_summary = ", ".join(
            f"'{w['word']}' ({w['direction']})" for w in top_words
        )
        explanation_parts.append(
            f"The sentiment is driven mainly by: {word_summary}."
        )
    else:
        explanation_parts.append(
            "No strong sentiment-carrying words were found — "
            "this is why it's labeled neutral."
        )

    if category_context:
        explanation_parts.append(
            f"Historically, '{category}' headlines have moved "
            f"the Nifty 50 by more than the signal threshold "
            f"{category_context['signal_rate']}% of the time "
            f"(based on {category_context['sample_count']} headlines), "
            f"with an average next-day move of "
            f"{category_context['avg_t1_move']:+.2f}%."
        )

    return {
        "title": title,
        "sentiment_score": round(compound, 3),
        "sentiment_label": label,
        "breakdown": {
            "positive": round(scores["pos"], 3),
            "negative": round(scores["neg"], 3),
            "neutral":  round(scores["neu"], 3),
        },
        "word_contributions": word_contributions,
        "category_context": category_context,
        "explanation": " ".join(explanation_parts),
    }


if __name__ == "__main__":
    import json
    out = explain_headline(
        title="RBI raises repo rate by 25 basis points amid inflation concerns",
        category="RBI",
    )
    print(json.dumps(out, indent=2))