import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import requests
import feedparser
import time
from bs4 import BeautifulSoup
from datetime import datetime
from dotenv import load_dotenv
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models import Headline

load_dotenv()
NEWS_API_KEY = os.getenv("NEWS_API_KEY")

# ── Category rules ────────────────────────────────────────
CATEGORY_RULES = {
    "RBI":         ["rbi", "reserve bank", "repo rate", "monetary policy", "interest rate"],
    "FII":         ["fii", "fpi", "foreign investor", "foreign inflow", "foreign outflow"],
    "Earnings":    ["quarterly results", "q1 results", "q2 results", "q3 results",
                    "q4 results", "net profit", "revenue", "earnings"],
    "Geopolitics": ["war", "sanctions", "geopolitical", "crude oil", "opec"],
    "Regulation":  ["sebi", "regulatory", "ban", "penalty", "compliance"],
    "Budget":      ["budget", "fiscal", "government spending", "tax", "gst"],
    "IPO":         ["ipo", "initial public offering", "listing", "grey market"],
    "Crypto":      ["bitcoin", "crypto", "ethereum", "blockchain", "web3"],
}

def categorise(title: str) -> str:
    title_lower = title.lower()
    for category, keywords in CATEGORY_RULES.items():
        if any(kw in title_lower for kw in keywords):
            return category
    return "General"

# ── Source 1: NewsAPI ─────────────────────────────────────
def fetch_from_newsapi() -> list:
    if not NEWS_API_KEY or NEWS_API_KEY == "your_key_here":
        print("  NewsAPI: No key set, skipping")
        return []
    url = "https://newsapi.org/v2/everything"
    params = {
        "q":        "Nifty OR Sensex OR NSE OR BSE OR RBI OR SEBI OR Indian stock market",
        "language": "en",
        "sortBy":   "publishedAt",
        "pageSize": 100,
        "apiKey":   NEWS_API_KEY,
    }
    try:
        resp = requests.get(url, params=params, timeout=10)
        resp.raise_for_status()
        articles = resp.json().get("articles", [])
        print(f"  NewsAPI: {len(articles)} articles fetched")
        return articles
    except Exception as e:
        print(f"  NewsAPI error: {e}")
        return []

# ── Source 2: RSS Feeds ───────────────────────────────────
def fetch_from_rss() -> list:
    feeds = [
        ("Economic Times Markets",
         "https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms"),
        ("Moneycontrol Latest",
         "https://www.moneycontrol.com/rss/latestnews.xml"),
        ("Livemint Markets",
         "https://www.livemint.com/rss/markets"),
        ("Business Standard",
         "https://www.business-standard.com/rss/markets-106.rss"),
                 ("Mint Money",
         "https://www.livemint.com/rss/money"),
        ("Mint Companies",
         "https://www.livemint.com/rss/companies"),
        ("ET Industry",
         "https://economictimes.indiatimes.com/industry/rssfeeds/13352306.cms"),
        ("ET Economy",
         "https://economictimes.indiatimes.com/news/economy/rssfeeds/1373380119.cms"),
        ("Moneycontrol Business",
         "https://www.moneycontrol.com/rss/business.xml"),
        ("Moneycontrol IPO",
         "https://www.moneycontrol.com/rss/iponews.xml"),
        ("NDTV Business",
         "https://feeds.feedburner.com/ndtv/business"),
    ]
    articles = []
    for name, feed_url in feeds:
        try:
            feed = feedparser.parse(feed_url)
            count = 0
            for entry in feed.entries[:40]:
                title = entry.get("title", "").strip()
                if not title:
                    continue
                articles.append({
                    "title":       title,
                    "url":         entry.get("link", ""),
                    "source":      name,
                    "publishedAt": entry.get("published",
                                   str(datetime.utcnow())),
                })
                count += 1
            print(f"  RSS [{name}]: {count} entries")
        except Exception as e:
            print(f"  RSS [{name}] error: {e}")
    return articles

# ── Source 3: Web Scraping — Moneycontrol ─────────────────
def scrape_moneycontrol() -> list:
    url = "https://www.moneycontrol.com/news/business/markets/"
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        )
    }
    articles = []
    try:
        resp = requests.get(url, headers=headers, timeout=15)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")

        for tag in soup.find_all("li", class_="clearfix"):
            a = tag.find("a")
            if not a:
                continue
            title = a.get_text(strip=True)
            link  = a.get("href", "")
            if len(title) < 20:
                continue
            articles.append({
                "title":       title,
                "url":         link,
                "source":      "Moneycontrol",
                "publishedAt": str(datetime.utcnow()),
            })

        print(f"  Scraped Moneycontrol: {len(articles)} headlines")
    except Exception as e:
        print(f"  Moneycontrol scrape error: {e}")
    return articles

# ── Source 4: Web Scraping — Economic Times ───────────────
def scrape_economic_times() -> list:
    url = "https://economictimes.indiatimes.com/markets/stocks/news"
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        )
    }
    articles = []
    try:
        resp = requests.get(url, headers=headers, timeout=15)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")

        for story in soup.find_all("div", class_="eachStory"):
            a = story.find("a")
            h = story.find(["h3", "h4"])
            if not a or not h:
                continue
            title = h.get_text(strip=True)
            href  = a.get("href", "")
            link  = (
                "https://economictimes.indiatimes.com" + href
                if not href.startswith("http") else href
            )
            if len(title) < 20:
                continue
            articles.append({
                "title":       title,
                "url":         link,
                "source":      "Economic Times",
                "publishedAt": str(datetime.utcnow()),
            })

        print(f"  Scraped Economic Times: {len(articles)} headlines")
    except Exception as e:
        print(f"  Economic Times scrape error: {e}")
    return articles

# ── Source 5: Web Scraping — Livemint ────────────────────
def scrape_livemint() -> list:
    url = "https://www.livemint.com/market"
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        )
    }
    articles = []
    try:
        resp = requests.get(url, headers=headers, timeout=15)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")

        for tag in soup.find_all("h2"):
            a = tag.find("a")
            if not a:
                continue
            title = a.get_text(strip=True)
            href  = a.get("href", "")
            link  = (
                "https://www.livemint.com" + href
                if not href.startswith("http") else href
            )
            if len(title) < 20:
                continue
            articles.append({
                "title":       title,
                "url":         link,
                "source":      "Livemint",
                "publishedAt": str(datetime.utcnow()),
            })

        print(f"  Scraped Livemint: {len(articles)} headlines")
    except Exception as e:
        print(f"  Livemint scrape error: {e}")
    return articles

# ── Source 6: Web Scraping — Business Standard ────────────
def scrape_business_standard() -> list:
    url = "https://www.business-standard.com/markets"
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        )
    }
    articles = []
    try:
        resp = requests.get(url, headers=headers, timeout=15)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")

        for tag in soup.find_all("h2"):
            a = tag.find("a")
            if not a:
                continue
            title = a.get_text(strip=True)
            href  = a.get("href", "")
            link  = (
                "https://www.business-standard.com" + href
                if not href.startswith("http") else href
            )
            if len(title) < 20:
                continue
            articles.append({
                "title":       title,
                "url":         link,
                "source":      "Business Standard",
                "publishedAt": str(datetime.utcnow()),
            })

        print(f"  Scraped Business Standard: {len(articles)} headlines")
    except Exception as e:
        print(f"  Business Standard scrape error: {e}")
    return articles

# ── Save to database ──────────────────────────────────────
def save_headlines(articles: list, db: Session, source_label: str = ""):
    saved   = 0
    skipped = 0

    for art in articles:
        title = art.get("title", "").strip()
        if not title or title == "[Removed]" or len(title) < 15:
            continue

        # Skip duplicates by URL
        url = art.get("url", "")
        if url:
            exists = db.query(Headline).filter(
                Headline.url == url
            ).first()
            if exists:
                skipped += 1
                continue

        # Skip duplicate titles
        title_exists = db.query(Headline).filter(
            Headline.title == title
        ).first()
        if title_exists:
            skipped += 1
            continue

        # Parse date
        try:
            pub_str  = art.get("publishedAt", "")[:19]
            pub_date = datetime.strptime(pub_str, "%Y-%m-%dT%H:%M:%S")
        except Exception:
            try:
                from email.utils import parsedate_to_datetime
                pub_date = parsedate_to_datetime(
                    art.get("publishedAt", "")
                ).replace(tzinfo=None)
            except Exception:
                pub_date = datetime.utcnow()

        # Handle source as dict (NewsAPI) or string (scrapers)
        source_raw = art.get("source", "Unknown")
        source = (
            source_raw.get("name", "Unknown")
            if isinstance(source_raw, dict)
            else str(source_raw)
        )

        headline = Headline(
            title        = title,
            source       = source,
            url          = url,
            category     = categorise(title),
            published_at = pub_date,
        )
        db.add(headline)
        saved += 1

    db.commit()
    label = f"[{source_label}] " if source_label else ""
    print(f"  {label}Saved {saved} new | Skipped {skipped} duplicates")

# ── Main runner ───────────────────────────────────────────
def run():
    print("\n========================================")
    print("   NOISE FILTER — Data Collection Run")
    print(f"   {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("========================================\n")

    db = SessionLocal()
    try:
        # 1. RSS Feeds
        print("[ 1/4 ] RSS Feeds")
        rss = fetch_from_rss()
        save_headlines(rss, db, "RSS")

        # 2. NewsAPI
        print("\n[ 2/4 ] NewsAPI")
        newsapi = fetch_from_newsapi()
        save_headlines(newsapi, db, "NewsAPI")

        # 3. Web scraping
        print("\n[ 3/4 ] Web Scraping")
        mc = scrape_moneycontrol()
        save_headlines(mc, db, "Moneycontrol")
        time.sleep(2)

        et = scrape_economic_times()
        save_headlines(et, db, "Economic Times")
        time.sleep(2)

        lm = scrape_livemint()
        save_headlines(lm, db, "Livemint")
        time.sleep(2)

        bs = scrape_business_standard()
        save_headlines(bs, db, "Business Standard")

        # 4. Final count
        print("\n[ 4/4 ] Database Summary")
        total = db.query(Headline).count()
        print(f"  Total headlines in DB: {total}")

        from app.models import Headline as H
        from sqlalchemy import func
        cats = db.query(
            H.category,
            func.count(H.id).label("count")
        ).group_by(H.category).order_by(
            func.count(H.id).desc()
        ).all()

        print(f"\n  {'Category':<15} {'Count':>6}")
        print(f"  {'-'*22}")
        for cat, count in cats:
            print(f"  {cat:<15} {count:>6}")

    finally:
        db.close()

    print("\n========================================")
    print("   Run complete!")
    print("========================================\n")

if __name__ == "__main__":
    run()