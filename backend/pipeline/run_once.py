import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import datetime

def log(msg):
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {msg}")

def run():
    log("=== Noise Filter — One-Time Pipeline Run ===")

    log("Step 1/4: Scraping headlines...")
    try:
        from pipeline.scraper import run as scrape
        scrape()
    except Exception as e:
        log(f"Scraper error: {e}")

    log("Step 2/4: Scoring sentiment...")
    try:
        from pipeline.scorer import score_headlines
        score_headlines()
    except Exception as e:
        log(f"Scorer error: {e}")

    log("Step 3/4: Fetching latest prices...")
    try:
        from pipeline.price_fetcher import fetch_and_save
        fetch_and_save(days_back=7)
    except Exception as e:
        log(f"Price fetcher error: {e}")

    log("Step 4/4: Retraining model...")
    try:
        from ml.train import train
        train()
    except Exception as e:
        log(f"Training error: {e}")

    log("=== Pipeline run complete! Exiting. ===")

if __name__ == "__main__":
    run()