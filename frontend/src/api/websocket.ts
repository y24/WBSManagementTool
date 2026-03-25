import { useEffect, useRef, useCallback } from 'react';

// Use environment variable or default to localhost:8000
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/api/ws';

export type WSMessage = {
  type: string;
  entity?: string;
  [key: string]: any;
};

export const useWebSocket = (onMessage: (msg: WSMessage) => void) => {
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const onMessageRef = useRef(onMessage);
  const isMountedRef = useRef(true);

  // Keep callback ref updated
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  const connect = useCallback(() => {
    if (!isMountedRef.current) return;

    // Clean up existing connection if any
    if (socketRef.current) {
      socketRef.current.onclose = null; // Prevent onclose from triggering reconnect
      socketRef.current.close();
      socketRef.current = null;
    }

    console.log('Connecting to WebSocket...');
    const socket = new WebSocket(WS_URL);

    socket.onopen = () => {
      console.log('WebSocket Connected');
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };

    socket.onmessage = (event) => {
      try {
        const data: WSMessage = JSON.parse(event.data);
        onMessageRef.current(data);
      } catch (err) {
        console.error('Failed to parse WebSocket message', err);
      }
    };

    socket.onclose = () => {
      if (!isMountedRef.current) return;
      console.log('WebSocket Disconnected, attempting to reconnect...');
      // Reconnect after 3 seconds
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = window.setTimeout(() => {
        connect();
      }, 3000);
    };

    socket.onerror = (err) => {
      // Just log it; socket.close() will be called by the browser or we can call it
      // but if we call it here, it triggers onclose.
      console.error('WebSocket error observed:', err);
    };

    socketRef.current = socket;
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    
    // Use a small delay to avoid StrictMode double-mounting issues in development
    const connectionTimer = setTimeout(() => {
      connect();
    }, 50);

    return () => {
      isMountedRef.current = false;
      clearTimeout(connectionTimer);
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      if (socketRef.current) {
        const socket = socketRef.current;
        // Detach all handlers to avoid state updates on unmounted component
        socket.onopen = null;
        socket.onmessage = null;
        socket.onclose = null;
        socket.onerror = null;

        // Carefully close or plan to close the socket
        if (socket.readyState === WebSocket.CONNECTING) {
          // If we close now, the browser logs a warning.
          // Instead, we wait for it to open (if it ever does) then close it.
          socket.onopen = () => socket.close();
        } else if (socket.readyState === WebSocket.OPEN) {
          socket.close();
        }
        socketRef.current = null;
      }
    };
  }, [connect]);

  return {
    socket: socketRef.current,
  };
};
