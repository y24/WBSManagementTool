from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = FastAPI(title="WBS Management Tool API")

# CORS considerations for local frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
def read_health():
    return {"status": "ok"}

from .routers import api
app.include_router(api.router, prefix="/api")

from .integrations.azure_devops.router import router as devops_router
app.include_router(devops_router, prefix="/api")
