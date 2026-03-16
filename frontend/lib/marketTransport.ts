function trimTrailingSlashes(value: string): string {
    return value.trim().replace(/\/+$/, '');
}

const NODE_API_URL = trimTrailingSlashes(process.env.NEXT_PUBLIC_NODE_API_URL || '');
const SOCKET_URL = trimTrailingSlashes(process.env.NEXT_PUBLIC_SOCKET_URL || '');

export function getMarketApiBase(): string {
    if (NODE_API_URL) {
        return `${NODE_API_URL}/api/market-data`;
    }

    return '/api/market-data';
}

export function getMarketSocketNamespaceUrl(): string {
    if (SOCKET_URL) {
        return `${SOCKET_URL}/market-data`;
    }

    if (NODE_API_URL) {
        return `${NODE_API_URL}/market-data`;
    }

    return '/market-data';
}
