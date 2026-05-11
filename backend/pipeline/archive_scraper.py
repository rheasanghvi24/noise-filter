import sys, os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import requests
import feedparser
from datetime import datetime
from app.database import SessionLocal
from app.models import Headline

CATEGORY_RULES = {
    "RBI":         ["rbi", "reserve bank", "repo rate", "monetary policy", "interest rate"],
    "FII":         ["fii", "fpi", "foreign investor", "foreign inflow", "foreign outflow"],
    "Earnings":    ["quarterly", "profit", "revenue", "earnings", "results", "q1","q2","q3","q4"],
    "Geopolitics": ["war", "sanctions", "crude oil", "opec", "conflict", "geopolit"],
    "Regulation":  ["sebi", "regulatory", "ban", "penalty", "compliance"],
    "Budget":      ["budget", "fiscal", "tax", "gst"],
    "IPO":         ["ipo", "listing", "public offering", "grey market"],
    "Crypto":      ["bitcoin", "crypto", "ethereum", "blockchain"],
}

def categorise(title):
    t = title.lower()
    for cat, kws in CATEGORY_RULES.items():
        if any(k in t for k in kws):
            return cat
    return "General"

# These RSS feeds return older articles with proper timestamps
ARCHIVE_FEEDS = [
    "https://economictimes.indiatimes.com/markets/stocks/news/rssfeeds/2146842.cms",
    "https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms",
    "https://economictimes.indiatimes.com/opinion/et-commentary/rssfeeds/897228639.cms",
    "https://www.moneycontrol.com/rss/marketreports.xml",
    "https://www.moneycontrol.com/rss/economy.xml",
    "https://www.moneycontrol.com/rss/MCtopnews.xml",
    "https://www.business-standard.com/rss/markets-106.rss",
    "https://www.business-standard.com/rss/economy-policy-102.rss",
    "https://www.business-standard.com/rss/finance-103.rss",
    "https://feeds.feedburner.com/ndtvprofit-latest",
]

def scrape_archives():
    db = SessionLocal()
    saved = 0
    skipped = 0

    print("Scraping RSS archives for older headlines...")

    for feed_url in ARCHIVE_FEEDS:
        try:
            feed = feedparser.parse(feed_url)
            print(f"  {feed_url[:50]}... {len(feed.entries)} entries")

            for entry in feed.entries:
                title = entry.get("title", "").strip()
                if not title or len(title) < 15:
                    continue

                url = entry.get("link", "")

                # Check duplicate
                exists = db.query(Headline).filter(
                    Headline.title == title
                ).first()
                if exists:
                    skipped += 1
                    continue

                # Parse published date — RSS archives have real dates
                pub_date = None
                for date_field in ["published", "updated", "created"]:
                    date_str = entry.get(date_field)
                    if date_str:
                        try:
                            from email.utils import parsedate_to_datetime
                            pub_date = parsedate_to_datetime(
                                date_str
                            ).replace(tzinfo=None)
                            break
                        except Exception:
                            try:
                                pub_date = datetime.strptime(
                                    date_str[:19], "%Y-%m-%dT%H:%M:%S"
                                )
                                break
                            except Exception:
                                pass

                if not pub_date:
                    pub_date = datetime.utcnow()

                h = Headline(
                    title        = title,
                    source       = feed.feed.get("title", "RSS Archive"),
                    url          = url,
                    category     = categorise(title),
                    published_at = pub_date,
                )
                db.add(h)
                saved += 1

        except Exception as e:
            print(f"  Error: {e}")

    db.commit()
    print(f"\nArchive scrape done: {saved} saved | {skipped} skipped")
    db.close()
    return saved

if __name__ == "__main__":
    scrape_archives()