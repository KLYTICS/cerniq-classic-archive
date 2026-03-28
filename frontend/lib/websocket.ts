import { useEffect, useRef, useState } from 'react';

function resolveWebSocketUrl(): string {
    const explicitWsUrl = (process.env.NEXT_PUBLIC_WS_URL || '').trim();
    if (explicitWsUrl) {
        return explicitWsUrl;
    }

    const nodeApiUrl = (process.env.NEXT_PUBLIC_NODE_API_URL || process.env.NEXT_PUBLIC_API_URL || '').trim();
    if (!nodeApiUrl) {
        return '/market-data';
    }

    try {
        const parsed = new URL(nodeApiUrl);
        const protocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
        return `${protocol}//${parsed.host}/market-data`;
    } catch {
        return '/market-data';
    }
}

const WS_URL = resolveWebSocketUrl();

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
