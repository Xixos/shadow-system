# main.py
from __future__ import annotations

from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, List, Dict
import os
import random

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic_settings import BaseSettings
from sqlmodel import SQLModel, Field, Session, create_engine, select

# -----------------------------------------------------------------------------
# Settings
# -----------------------------------------------------------------------------
class Settings(BaseSettings):
    WEBHOOK_URL: str | None = None
    class Config:
        env_file = ".env"

settings = Settings()

# -----------------------------------------------------------------------------
# Database (robust, Windows-safe)
# -----------------------------------------------------------------------------
# 1) Prefer explicit env overrides if provided
#    - SHADOW_DB_URL lets you point to any SQLAlchemy URL
#    - SHADOWSYSTEM_DATA_DIR lets you control where the sqlite file is written
env_db_url = os.getenv("SHADOW_DB_URL")
if env_db_url:
    DB_URL = env_db_url
    DATA_DIR = None
else:
    BASE_DIR = Path(__file__).resolve().parent
    # Default to a local, writable data dir unless user provides SHADOWSYSTEM_DATA_DIR
    DATA_DIR = Path(os.getenv("SHADOWSYSTEM_DATA_DIR", BASE_DIR / "data"))
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    DB_PATH = (DATA_DIR / "app.db").resolve()        # .../ShadowSystem/data/app.db
    # Use forward slashes so SQLite URL works on Windows
    DB_URL = "sqlite:///" + DB_PATH.as_posix()

# Create engine (SQLite + FastAPI-friendly setting)
engine = create_engine(DB_URL, echo=False, connect_args={"check_same_thread": False})

# Debug print so you can see exactly where the DB lives
print("\n--- ShadowSystem DB ---")
print("DB_URL      :", DB_URL)
if not env_db_url:
    print("DB_PATH     :", DB_PATH)
    print("FOLDER      :", DATA_DIR)
    print("Folder write:", os.access(DATA_DIR, os.W_OK))
print("-----------------------\n")

# -----------------------------------------------------------------------------
# FastAPI app
# -----------------------------------------------------------------------------
app = FastAPI(title="Shadow System API", version="0.1")

# CORS for Next.js on 3000
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------------------------------------------------------------
# Models
# -----------------------------------------------------------------------------
class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    email: str
    streak_days: int = 0
    last_seen: datetime = Field(default_factory=datetime.utcnow)
    current_rank: int = 1
    segments: str = "[]"
    activity_score: float = 0.0
    churn_risk: float = 0.0

class Event(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int
    type: str            # view | purchase | share | login
    payload: str = "{}"
    ts: datetime = Field(default_factory=datetime.utcnow)

def init_db():
    SQLModel.metadata.create_all(engine)

# -----------------------------------------------------------------------------
# Scoring / Rules
# -----------------------------------------------------------------------------
def compute_activity_score(events: List[Event]) -> float:
    w = {"login": 1.0, "view": 0.5, "share": 1.5, "purchase": 3.0}
    score = sum(w.get(e.type, 0.2) for e in events)
    score += sum(1 for e in events if (datetime.utcnow() - e.ts).days <= 7) * 0.5
    return round(score, 2)

def compute_churn_risk(user: User, events: List[Event]) -> float:
    days_since = (datetime.utcnow() - user.last_seen).days
    base = min(1.0, 0.05 * days_since)
    protected = min(0.6, compute_activity_score(events) * 0.03)
    return round(max(0.0, min(1.0, base + 0.3 - protected)), 2)

def should_promote(user: User) -> bool:
    return (user.streak_days >= 5 and user.activity_score >= 8 and user.churn_risk <= 0.4)

def predicted_unlock(user: User) -> Optional[str]:
    if user.streak_days >= 3 and user.churn_risk <= 0.5:
        return f"Challenge-R{user.current_rank+1}-OnRamp"
    return None

async def fire_webhook(message: str):
    url = settings.WEBHOOK_URL or ""
    if not url:
        return {"sent": False, "reason": "no WEBHOOK_URL set"}
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.post(url, json={"content": message})
            return {"sent": resp.status_code < 300, "status": resp.status_code}
    except Exception as e:
        return {"sent": False, "reason": str(e)}

# -----------------------------------------------------------------------------
# Routes
# -----------------------------------------------------------------------------
@app.on_event("startup")
def startup():
    init_db()

@app.get("/health")
def health():
    return {"ok": True}

@app.post("/seed")
def seed(n_users: int = 50, days: int = 21):
    SQLModel.metadata.drop_all(engine)
    SQLModel.metadata.create_all(engine)
    emails = [f"user{i}@example.com" for i in range(n_users)]
    with Session(engine) as s:
        users: List[User] = []
        for e in emails:
            u = User(email=e)
            s.add(u); s.commit(); s.refresh(u)
            users.append(u)
        types = ["login", "view", "share", "purchase"]
        for u in users:
            u.last_seen = datetime.utcnow() - timedelta(days=random.randint(0, 10))
            for d in range(days):
                date = datetime.utcnow() - timedelta(days=d)
                for _ in range(random.randint(0, 3)):
                    s.add(Event(user_id=u.id, type=random.choice(types), ts=date))
            s.commit()
            events = s.exec(select(Event).where(Event.user_id == u.id)).all()
            u.activity_score = compute_activity_score(events)
            u.streak_days = random.randint(0, 7)
            u.churn_risk = compute_churn_risk(u, events)
            s.add(u)
        s.commit()
    return {"seeded": n_users}

@app.get("/users")
def list_users():
    with Session(engine) as s:
        return s.exec(select(User)).all()

@app.get("/users/{user_id}")
def get_user(user_id: int):
    with Session(engine) as s:
        u = s.get(User, user_id)
        if not u:
            raise HTTPException(404)
        events = s.exec(select(Event).where(Event.user_id == user_id)).all()
        return {"user": u, "events": events, "predicted_unlock": predicted_unlock(u)}

@app.post("/score/{user_id}")
async def rescore(user_id: int):
    with Session(engine) as s:
        u = s.get(User, user_id)
        if not u:
            raise HTTPException(404)
        events = s.exec(select(Event).where(Event.user_id == user_id)).all()
        u.activity_score = compute_activity_score(events)
        u.churn_risk = compute_churn_risk(u, events)
        promo = False
        unlock = predicted_unlock(u)
        if should_promote(u):
            u.current_rank += 1
            u.streak_days = 0
            promo = True
        s.add(u); s.commit()
    note = f"User {u.email}: {'PROMOTED' if promo else 'rescored'}; unlock={unlock}"
    result = await fire_webhook(note)
    return {"user": u, "promoted": promo, "unlock": unlock, "webhook": result}

@app.get("/insights")
def insights():
    with Session(engine) as s:
        totals: Dict[str, int] = {}
        for t in ["login", "view", "share", "purchase"]:
            totals[t] = len(s.exec(select(Event).where(Event.type == t)).all())
        users = s.exec(select(User)).all()
        churn_top = sorted(users, key=lambda x: x.churn_risk, reverse=True)[:10]
        return {"events": totals, "churn_risk_top": churn_top}
