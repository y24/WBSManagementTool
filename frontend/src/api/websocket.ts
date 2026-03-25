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

  const connect = useCallback(() => {
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
        onMessage(data);
      } catch (err) {
        console.error('Failed to parse WebSocket message', err);
      }
    };

    socket.onclose = () => {
      console.log('WebSocket Disconnected, attempting to reconnect...');
      // Reconnect after 3 seconds
      reconnectTimeoutRef.current = window.setTimeout(() => {
        connect();
      }, 3000);
    };

    socket.onerror = (err) => {
      console.error('WebSocket Error', err);
      socket.close();
    };

    socketRef.current = socket;
  }, [onMessage]);

  useEffect(() => {
    connect();
    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connect]);

  return {
    socket: socketRef.current,
  };
};
