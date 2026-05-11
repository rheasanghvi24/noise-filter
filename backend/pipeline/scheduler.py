import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import schedule
import time
from datetime import datetime

def log(msg):
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {msg}")

def scrape_and_score():
    """Runs every 6 hours — scrape + score only"""
    log("Starting scrape + score...")
    try:
        from pipeline.scraper import run as scrape
        scrape()
    except Exception as e:
        log(f"Scraper error: {e}")

    try:
        from pipeline.scorer import score_headlines
        score_headlines()
    except Exception as e:
        log(f"Scorer error: {e}")

    log("Scrape + score complete.")

def fetch_prices_and_train():
    """Runs once daily at 8am — prices + retrain"""
    log("Starting daily price fetch + model retrain...")
    try:
        from pipeline.price_fetcher import fetch_and_save
        fetch_and_save(days_back=7)  # only last 7 days
    except Exception as e:
        log(f"Price fetcher error: {e}")

    try:
        from ml.train import train
        train()
    except Exception as e:
        log(f"Training error: {e}")

    log("Daily retrain complete.")

def run_all():
    """Full pipeline — used on first run only"""
    scrape_and_score()
    fetch_prices_and_train()

if __name__ == "__main__":
    log("=== Noise Filter Scheduler Started ===")
    log("Schedule:")
    log("  Every 6 hours → scrape + score new headlines")
    log("  Every day 8am → fetch prices + retrain model")
    log("")

    # Run everything once immediately on startup
    log("Running full pipeline on startup...")
    run_all()

    # Schedule scraping every 6 hours
    schedule.every(6).hours.do(scrape_and_score)

    # Schedule daily retrain at 8am
    schedule.every().day.at("08:00").do(fetch_prices_and_train)

    log("Scheduler running. Press Ctrl+C to stop.")
    log("")

    while True:
        schedule.run_pending()
        time.sleep(60)  # check every minute