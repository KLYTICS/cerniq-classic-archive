import { useEffect, useRef, useState } from 'react';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001/market-data';

export interface WebSocketMessage {
    type: string;
    data: any;
}

export function useWebSocket(onMessage: (message: WebSocketMessage) => void) {
    const [isConnected, setIsConnected] = useState(false);
    const ws = useRef<WebSocket | null>(null);
    const reconnectTimeout = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        function connect() {
            try {
                ws.current = new WebSocket(WS_URL);

                ws.current.onopen = () => {
                    console.log('WebSocket connected');
                    setIsConnected(true);
                };

                ws.current.onmessage = (event) => {
                    try {
                        const message = JSON.parse(event.data);
                        onMessage(message);
                    } catch (error) {
                        console.error('Failed to parse WebSocket message:', error);
                    }
                };

                ws.current.onerror = (error) => {
                    console.error('WebSocket error:', error);
                };

                ws.current.onclose = () => {
                    console.log('WebSocket disconnected');
                    setIsConnected(false);

                    // Attempt to reconnect after 3 seconds
                    reconnectTimeout.current = setTimeout(() => {
                        connect();
                    }, 3000);
                };
            } catch (error) {
                console.error('Failed to create WebSocket:', error);
            }
        }

        connect();

        return () => {
            if (reconnectTimeout.current) {
                clearTimeout(reconnectTimeout.current);
            }
            if (ws.current) {
                ws.current.close();
            }
        };
    }, []);

    const send = (message: any) => {
        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify(message));
        }
    };

    return { isConnected, send };
}
