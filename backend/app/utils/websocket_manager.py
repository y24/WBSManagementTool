from typing import List
from fastapi import WebSocket

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        # We use a copy of the list to avoid issues if a connection is removed during iteration
        for connection in list(self.active_connections):
            try:
                await connection.send_json(message)
            except Exception:
                # If sending fails, the connection might be closed
                self.disconnect(connection)

    def broadcast_sync(self, message: dict):
        """Synchronous wrapper for broadcasting messages."""
        import asyncio
        import threading

        def run_broadcast():
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            loop.run_until_complete(self.broadcast(message))
            loop.close()

        # Run in a separate thread to avoid blocking the main sync thread
        # Note: In a production environment with many connections, 
        # a better approach might be to use a background task queue.
        # But for this tool, a separate thread is sufficient.
        threading.Thread(target=run_broadcast, daemon=True).start()

manager = ConnectionManager()
