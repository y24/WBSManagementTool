from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from .utils.websocket_manager import manager

app = FastAPI(title="WBS Management Tool API")

# CORS considerations for local frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # For WebSocket connectivity, sometimes needed to be broader during dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
def read_health():
    return {"status": "ok"}

@app.websocket("/api/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Keep the connection open and wait for messages (though we mostly broadcast)
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception:
        manager.disconnect(websocket)

from .routers import api
app.include_router(api.router, prefix="/api")
