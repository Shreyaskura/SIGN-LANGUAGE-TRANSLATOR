from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base
from app.routers import auth, gestures, translations, analytics

# Create all SQL tables on startup if they don't exist
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Sign AI - Sign Language Translator Backend API",
    description="FastAPI Backend for Sign Language Translator App with Hybrid PostgreSQL/SQLite & MongoDB NoSQL databases.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Enable CORS for Web Frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(auth.router)
app.include_router(gestures.router)
app.include_router(translations.router)
app.include_router(analytics.router)

@app.get("/")
def root():
    return {
        "status": "online",
        "app": "Sign AI Translator API",
        "dbs_dbe_project": True,
        "docs": "/docs"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
