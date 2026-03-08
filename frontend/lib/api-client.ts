export const API_BASE_URL = (
    process.env.NEXT_PUBLIC_NODE_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    ''
).trim().replace(/\/+$/, '');

export const apiClient = {
    async get(path: string) {
        const response = await fetch(`${API_BASE_URL}${path}`);
        if (!response.ok) {
            throw new Error(`API Error: ${response.statusText}`);
        }
        return response.json();
    },

    async post(path: string, data: any) {
        const response = await fetch(`${API_BASE_URL}${path}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });
        if (!response.ok) {
            throw new Error(`API Error: ${response.statusText}`);
        }
        return response.json();
    },
};

// Market Data API functions
export const marketDataApi = {
    getQuote: (ticker: string) => apiClient.get(`/api/market-data/quote/${ticker}`),

    getHistory: (ticker: string, start?: string, end?: string) => {
        const params = new URLSearchParams();
        if (start) params.append('start', start);
        if (end) params.append('end', end);
        return apiClient.get(`/api/market-data/history/${ticker}?${params}`);
    },

    getFundamentals: (ticker: string) => apiClient.get(`/api/market-data/fundamentals/${ticker}`),

    search: (query: string, assetType?: 'stock' | 'crypto') => {
        const params = new URLSearchParams({ q: query });
        if (assetType) params.append('assetType', assetType);
        return apiClient.get(`/api/market-data/search?${params}`);
    },
};
