from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes import companies, users

app = FastAPI(title="VC Audit Valuation Tool", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(users.router)
app.include_router(companies.router)


@app.get("/api/v1/health")
def health_check():
    return {"status": "ok"}
