import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

from app.database import engine
from app import models

print("Connecting to:", os.getenv("DATABASE_URL"))

try:
    print("Creating tables...")
    models.Base.metadata.create_all(bind=engine)
    print("SUCCESS — tables created: headlines, stock_prices, signal_scores")
except Exception as e:
    print(f"ERROR: {e}")