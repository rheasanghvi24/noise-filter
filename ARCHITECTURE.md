# NoiseFilter — Complete Project Explainer

This document explains **every part** of NoiseFilter: what it does, why it exists, where it lives in the codebase, and the concepts/formulas behind the ML and NLP pieces. Use this to explain the project confidently in interviews.

---

## 1. The Core Idea (Why This Project Exists)

Indian retail investors are exposed to hundreds of financial headlines a day — RBI policy, FII flows, earnings, geopolitics, regulation, budget news. Most headlines **don't actually move markets**, but some genuinely do.

**The question NoiseFilter answers:** *Given a news category, what's the historical probability that it moved the Nifty 50 within 1-2 trading days?*

This reframes "read the news" into "know which news to actually read."

---

## 2. High-Level Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐     ┌──────────┐
│  Scrapers    │ --> │  PostgreSQL  │ --> │   FastAPI    │ --> │  React   │
│ (6 sources)  │     │  (3 tables)  │     │ (6 endpoints)│     │ Dashboard│
└─────────────┘     └──────────────┘     └─────────────┘     └──────────┘
       │                    ▲
       ▼                    │
┌─────────────┐     ┌──────────────┐
│   VADER      │ --> │   XGBoost    │
│  Sentiment   │     │   Training   │
└─────────────┘     └──────────────┘
```

Data flows in one direction: **scrape → store → score → correlate with prices → predict → serve → visualise.**

---

## 3. Folder-by-Folder, File-by-File Breakdown

### `backend/app/` — The API Layer

#### `database.py`
**What:** Sets up the connection to PostgreSQL using SQLAlchemy.
**Why:** Every other file that touches the database imports `SessionLocal` and `Base` from here — single source of truth for the DB connection, so credentials and connection logic live in exactly one place.
**How:** Reads `DATABASE_URL` from `.env`, creates a SQLAlchemy `engine`, and exposes a `get_db()` generator function that FastAPI uses to open/close a database session per request (this is the standard "dependency injection" pattern in FastAPI).

#### `models.py`
**What:** Defines the 3 database tables as Python classes (SQLAlchemy ORM models).
**Why:** Lets you write `Headline(title=..., category=...)` in Python instead of raw SQL `INSERT` statements — SQLAlchemy translates your Python objects into SQL automatically.

The 3 tables:
| Table | Purpose | Key columns |
|---|---|---|
| `headlines` | Every scraped headline | title, source, category, sentiment_score, noise_score |
| `stock_prices` | 3 years of daily OHLCV data | symbol, date, close_price, pct_change |
| `signal_scores` | Aggregated stats per category | category, avg_t1_move, avg_t2_move, accuracy |

#### `init_db.py`
**What:** A one-time script that creates the 3 tables inside PostgreSQL.
**Why:** SQLAlchemy models only exist in Python until you tell it to actually create the tables in the database — this script does that via `Base.metadata.create_all(engine)`.

#### `main.py`
**What:** The FastAPI application — defines every API endpoint.
**Why:** This is the bridge between your database/ML pipeline and the React frontend. The frontend never talks to PostgreSQL directly — it only talks to this API.

Endpoints:
| Endpoint | What it returns | Used by |
|---|---|---|
| `GET /headlines` | List of scored headlines, filterable by category | Dashboard table |
| `GET /categories` | Signal strength stats per category | Historical page |
| `GET /prices/{symbol}` | Price history for a stock/index | Dashboard Nifty chart |
| `GET /summary` | Aggregate KPI numbers | Dashboard KPI cards |
| `POST /analyse` | Scores any custom headline in real time | Analyser page |
| `GET /docs` | Auto-generated interactive API documentation | Demo/portfolio purposes |

---

### `backend/pipeline/` — The Data Collection Layer

#### `scraper.py`
**What:** Pulls real headlines from 6 different sources using 3 different techniques.
**Why 3 techniques, not just one?** Each technique has different strengths:
- **NewsAPI** (a REST API) — structured, reliable, but rate-limited on the free tier
- **RSS feeds** (`feedparser`) — free, no rate limits, but only as good as what each outlet publishes in their feed
- **Direct web scraping** (`BeautifulSoup`) — gets you content NOT in RSS/API, but is fragile (breaks if the site changes its HTML)

**How categorisation works:** A dictionary (`CATEGORY_RULES`) maps category names to keyword lists. Every headline is lowercased and checked against each keyword list — first match wins. This is a simple **rule-based classifier**, not ML — deliberately, because it's transparent and you can explain exactly why any headline got its label.

**Deduplication logic:** Before saving, every headline is checked against the database by both `url` and `title` — prevents the same story (re-published by RSS at a later time) from being counted twice.

#### `scorer.py`
**What:** Runs VADER sentiment analysis on every headline that doesn't have a score yet.
**Why VADER specifically (not a deep learning model)?**
- VADER (**V**alence **A**ware **D**ictionary and s**E**ntiment **R**easoner) is a **rule-based, lexicon-based** sentiment tool built specifically for short, informal text like headlines and social media.
- It doesn't need training data or GPU — it works instantly out of the box, which matters for a pipeline that scores hundreds of headlines automatically every few hours.
- It's explainable: every word has a pre-assigned sentiment weight, so you can always show *why* a headline got a particular score.

**The formula (conceptually):**
VADER looks up each word in a pre-built lexicon of ~7,500 words, each with a sentiment intensity score. It then:
1. Sums the valence scores of all sentiment-bearing words in the sentence
2. Applies rules for negation ("not good" flips the sign), intensifiers ("very good" amplifies it), and punctuation/capitalisation ("GOOD!!!" amplifies it further)
3. Normalises the sum into a **compound score** between **-1 (most negative)** and **+1 (most positive)** using:

```
compound = sum_of_valence_scores / sqrt(sum_of_valence_scores² + α)
```

where `α` is a constant (≈15) chosen so the score smoothly approaches ±1 without ever quite reaching it.

**Thresholds used in this project:**
- `compound >= 0.05` → labeled **positive**
- `compound <= -0.05` → labeled **negative**
- otherwise → labeled **neutral**

These are VADER's own recommended defaults, not something we invented.

#### `price_fetcher.py`
**What:** Downloads 3 years of historical daily price data for 6 symbols (Nifty 50, Sensex, HDFC Bank, Reliance, Infosys, TCS) using the `yfinance` library.
**Why these 6 symbols?** Nifty 50 and Sensex are the two main Indian market indices (the "is the market up or down today" answer). The 4 individual stocks represent different sectors (banking, energy/conglomerate, IT x2) so the project isn't only index-level.
**The `pct_change` calculation:**
```
pct_change = ((close_today - close_yesterday) / close_yesterday) × 100
```
This is the standard daily percentage return formula — it's what gets compared against headline sentiment to see if news "moved the market."

**A real bug we hit and fixed:** Newer versions of `yfinance` return columns as a `MultiIndex` (e.g. `('Open', '^NSEI')` instead of plain `'Open'`) when downloading a single ticker. The fix was to detect and "flatten" this multi-level column structure (`df.columns.droplevel(1)`) before using the data — a good example of why production data pipelines need defensive code, since third-party libraries change their output format between versions.

#### `archive_scraper.py`
**What:** Pulls *older* headlines from RSS feeds (going back further than the live scraper normally captures) specifically to backfill historical training data for the ML model.
**Why:** The XGBoost model needs headlines whose publish date has *already* been followed by enough trading days to compute a real T+1/T+2 price move. A live scraper run today only gives you "fresh" headlines with no future price data yet — this script intentionally goes backward in time to get headlines that already have an outcome attached.

#### `run_once.py`
**What:** Runs the entire pipeline — scrape → score → fetch prices → retrain — exactly once, then exits.
**Why this exists alongside a scheduler concept:** Not every environment can leave a process running 24/7 (e.g. a personal laptop that gets shut at night). This gives a clean, single command to bring the whole system up to date on demand, without needing a permanently running background process.

---

### `backend/ml/` — The Machine Learning Layer

#### `train.py`
**What:** Builds the training dataset, analyses signal strength per category, and trains an XGBoost classifier.

**Step-by-step logic:**

1. **Build a price lookup dictionary** — every (date → pct_change) pair from `stock_prices`, keyed by Python `date` objects so headline dates can be matched against it regardless of datetime/date type mismatches (another real bug fixed along the way).

2. **For every scored headline, find T+1 and T+2 price moves** — defined as the Nifty's percentage change on the *next* and *second-next* trading day after the headline was published (skipping weekends/holidays automatically, since the lookup just walks forward day-by-day until it finds an entry that exists in the price dictionary).

3. **Label each headline as "signal" or "noise":**
```
is_signal = 1   if |T+1 move| > threshold  OR  |T+2 move| > threshold
is_signal = 0   otherwise
```
The threshold started at 0.5% and was tuned down to 0.1% during development — a higher threshold during a high-volatility month meant almost every headline qualified as "signal," producing a useless model that had only ever seen one class. This is a real example of **class imbalance** in machine learning: if a dataset has e.g. 41 examples of one class and 1 of the other, a model can score 100% "accuracy" by always guessing the majority class while learning nothing. Recognising and diagnosing this (rather than reporting the misleading 100% number) is the single most important ML lesson baked into this project.

4. **Category-level aggregation (`analyse_categories`)** — for every category, compute:
- `signal_rate` = % of headlines in that category labeled "signal"
- `avg_t1_move`, `avg_t2_move` = average price move following that category
- `avg_sent` = average VADER sentiment for that category

This is **not** the ML model — it's a transparent, fully explainable statistical summary that powers the Historical Analysis dashboard page. It works even with a small dataset, which is why it was prioritised over relying solely on XGBoost early on.

5. **Encoding categorical features** — `category` and `source` are text, but XGBoost needs numbers. `LabelEncoder` assigns each unique category/source an integer ID (e.g. "RBI" → 3). This is simple **label encoding**, chosen over one-hot encoding here because XGBoost (being a tree-based model) can split on integer-encoded categoricals reasonably well, and it keeps the feature count small with this little data.

6. **Features fed into the model:**
```
sentiment_score   (-1 to +1, from VADER)
category_enc      (integer ID)
source_enc        (integer ID)
hour_published     (0-23)
day_of_week        (0-6)
```

7. **XGBoost classifier** — Extreme Gradient Boosting. Conceptually: it builds many small decision trees in sequence, where each new tree is trained specifically to correct the mistakes of the ones before it (this is "boosting"). It's a strong choice here because:
- Works well on small-to-medium tabular datasets (unlike deep learning, which needs much more data)
- Handles mixed feature types (numeric + encoded categorical) without much preprocessing
- Gives feature importance out of the box, which is useful for explaining *why* a headline was scored a certain way

8. **Train/test split** — 80% of rows used to train, 20% held out to test, via `train_test_split(..., test_size=0.2)`. This is standard practice so the reported accuracy reflects performance on data the model never saw during training.

#### `predict.py`
**What:** Loads the saved model (`model.pkl`) and encoders (`encoders.pkl`) to score a brand-new headline in real time, without retraining.
**Why a separate file from `train.py`:** Training is expensive (only needs to happen periodically); prediction needs to be instant (happens every time someone uses the live Analyser page or a new headline is scraped). Separating them is standard ML engineering practice — train offline, serve online.

---

### `frontend/src/` — The Dashboard Layer

#### `App.jsx`
**What:** The shell of the whole app — sidebar navigation, live API status indicator, and routing between the 3 pages.
**Why a sidebar layout:** Mimics real fintech product UI patterns (Bloomberg Terminal, brokerage apps) rather than a typical "student project" top-nav layout — this was a deliberate design choice for portfolio impact.

#### `pages/Dashboard.jsx`
**What:** The landing page — KPI cards, Nifty price line chart, sentiment donut chart, category bar chart, and a live filterable headlines table.
**Why these specific charts:**
- **Line chart** for price — time series data is always best shown as a line, since the *trend* matters more than individual points.
- **Donut chart** for sentiment split — good for showing proportions of a whole (positive/negative/neutral) when there are only 3 categories.
- **Bar chart** for headlines-by-category — bars are easier to compare across categories than a pie chart once you have more than ~5 categories.

#### `pages/Historical.jsx`
**What:** Deeper analysis page — market mood banner, category risk cards, sentiment-by-category bar, source breakdown, sentiment-over-time stacked bars, and a risk radar chart.
**Why this page exists separately from the Dashboard:** The Dashboard answers "what's happening right now"; Historical answers "what patterns exist across categories and sources over time." Splitting these avoids cramming too much onto one screen and mirrors how real BI tools separate "live monitoring" from "trend analysis."

**The "Market Mood" calculation:**
```
mood = "Bullish"  if total_positive > total_negative
mood = "Bearish"  if total_negative > total_positive
mood = "Neutral"  otherwise
```
A simple majority-vote across all currently scored headlines — intentionally simple and explainable rather than a black-box score.

**The Risk Radar chart** — plots each category's negative-sentiment percentage and positive-sentiment percentage on the same multi-axis radar, so you can visually spot which categories skew negative (potential risk) vs positive at a glance.

#### `pages/Analyser.jsx`
**What:** A text box where you paste any headline and instantly see its sentiment score, label, and a breakdown of positive/negative/neutral signal strength — calling the `POST /analyse` endpoint live.
**Why this page matters for a demo:** It's the most interactive, tangible proof that the NLP pipeline actually works — letting an interviewer type their own headline and see a live, sensible result is far more convincing than just showing static charts.

---

## 4. The Automated Pipeline (Why It's "Live," Not a One-Time Script)

```
Every 6 hours  →  scrape new headlines  →  score sentiment  →  save to DB
Every day 8am  →  fetch latest prices   →  retrain XGBoost  →  update signal_scores
```

**Why this design matters:** Most student ML projects train once on a static CSV and never touch it again. NoiseFilter is built to **continuously improve** — every day it runs, it accumulates more real headline-to-price matches, which means the model's class balance and accuracy should organically improve over weeks, without ever needing a fake/static dataset. This is closer to how real production financial ML systems are actually built and maintained.

---

## 5. Real Engineering Problems Solved Along the Way

These are worth mentioning in interviews — they show actual debugging skill, not just following a tutorial:

| Problem | Root Cause | Fix |
|---|---|---|
| `numpy`/`pandas` failed to install on Windows | No C compiler available to build from source | Forced pip to use pre-built wheels (`--only-binary=:all:`) |
| `feedparser` install conflict | Missing transitive dependency `sgmllib3k` | Installed it explicitly first |
| `ModuleNotFoundError: No module named 'app'` | Script run from wrong working directory | Added `sys.path.append()` to make imports location-independent |
| `'str' object has no attribute 'get'` | RSS sources return `source` as a plain string, NewsAPI returns it as a dict | Added an `isinstance()` check to handle both shapes |
| T+1/T+2 always showing 0.00% | Headline dates were *after* the latest available price data (a 1-day gap due to market holidays/weekends) | Re-ran the price fetcher once new trading days existed; understood this wasn't a bug but a timing/data-availability issue |
| XGBoost reporting 100% accuracy | Severe class imbalance — almost all matched rows were the same label | Diagnosed it as a misleading metric rather than reporting it as a real result; lowered the signal threshold to rebalance classes |
| `yfinance` returning `float() argument ... not 'Series'` | Newer `yfinance` version returns MultiIndex columns for single-ticker downloads | Detected and flattened the MultiIndex before extracting values |
| `scipy` DLL load blocked | Windows Application Control / antivirus policy blocking compiled binaries | Reinstalled with `--no-cache-dir` and confirmed via Windows diagnostic commands |

---

## 6. How to Explain This Project in One Minute (Interview-Ready)

> "NoiseFilter is a live system that scrapes Indian financial news every 6 hours from 6 sources, scores sentiment using VADER NLP, and correlates each news category with how the Nifty 50 actually moved 1-2 days later. I found that Geopolitics headlines move markets 68% of the time, while FII news — which dominates financial Twitter — only moves markets 27% of the time. I deliberately avoided training on a static historical dataset; instead, the system retrains daily as real data accumulates, which meant I had to actively diagnose and fix a class imbalance issue rather than just reporting a misleadingly perfect accuracy number. It's a full stack — PostgreSQL, FastAPI, XGBoost, React, and Power BI — all built and debugged end-to-end."

---

## 7. What Would Make It Even Stronger (Honest Next Steps)

- More historical headline volume (currently a few hundred — would benefit from weeks of continuous running)
- SHAP value integration for true model explainability (currently in requirements.txt but not yet wired into `train.py`)
- Docker Compose for one-command setup
- GitHub Actions CI/CD for automated testing on push

These are honest, **not yet built** — good to know the difference between what's done and what's planned if asked directly.
