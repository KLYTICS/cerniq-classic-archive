import axios, { AxiosInstance } from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';
const NODE_API_URL = process.env.NEXT_PUBLIC_NODE_API_URL || 'http://localhost:3000';

class APIClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_URL,
      headers: {
        'Content-Type': 'application/json',
      },
      withCredentials: true,
    });

    // Handle 401 — redirect to login
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
            window.location.href = '/login';
          }
        }
        return Promise.reject(error);
      }
    );
  }

  // Authentication
  async register(email: string, password: string, name?: string) {
    const response = await this.client.post(`${NODE_API_URL}/api/auth/register`, { email, password, name });
    return response.data;
  }

  async login(email: string, password: string) {
    const response = await this.client.post(`${NODE_API_URL}/api/auth/login`, { email, password });
    return response.data;
  }

  async getCurrentUser() {
    const response = await this.client.get(`${NODE_API_URL}/api/auth/profile`);
    return response.data;
  }

  async logout() {
    try {
      await this.client.post(`${NODE_API_URL}/api/auth/logout`);
    } catch {
      // Best-effort server-side logout
    }
  }

  async refreshTokens() {
    const response = await this.client.post(`${NODE_API_URL}/api/auth/refresh`, {});
    return response.data;
  }

  async changePassword(currentPassword: string, newPassword: string) {
    const response = await this.client.put(`${NODE_API_URL}/api/auth/password`, { currentPassword, newPassword });
    return response.data;
  }

  // Demo Request (landing page)
  async submitDemoRequest(data: {
    email: string;
    name?: string;
    institutionName?: string;
    institutionType?: string;
    totalAssets?: string;
    message?: string;
  }) {
    const response = await this.client.post(`${NODE_API_URL}/api/demo-request`, data);
    return response.data;
  }

  // Risk Analysis
  async getRiskAnalysis(portfolioId: string) {
    const response = await this.client.get(`/risk/${portfolioId}`);
    return response.data;
  }

  // Market Data
  async getQuote(ticker: string) {
    const response = await this.client.get(`/market-data/quote/${ticker}`);
    return response.data;
  }

  async getFundamentals(ticker: string) {
    const response = await this.client.get(`/market-data/fundamentals/${ticker}`);
    return response.data;
  }

  async getVolatilityForecast(ticker: string, horizon: number = 30) {
    try {
      const response = await this.client.get(`/risk/forecast-volatility/${ticker}`, {
        params: { horizon }
      });
      return response.data;
    } catch (e) {
      console.error("Failed to fetch volatility forecast", e);
      return null;
    }
  }

  async getHistoricalPrices(ticker: string, startDate?: string, endDate?: string) {
    const params: any = {};
    if (startDate) params.start = startDate;
    if (endDate) params.end = endDate;

    const response = await this.client.get(`/market-data/history/${ticker}`, { params });
    return response.data;
  }

  async getTechnicalChart(ticker: string, timeframe: string, indicators: string) {
    try {
      const response = await this.client.get(`/charts/technical/${ticker}`, {
        params: { timeframe, indicators }
      });
      return response.data;
    } catch (e) {
      console.error("Failed to fetch technical chart", e);
      return null;
    }
  }

  async calculateCorrelation(tickers: string[]) {
    try {
      const response = await this.client.post('/risk/correlation', { tickers });
      return response.data;
    } catch (e) {
      console.error("Failed to calculate correlation", e);
      return null;
    }
  }

  async calculateComponentVaR(positions: any[], confidenceLevel: number = 0.95, horizon: number = 1) {
    try {
      const response = await this.client.post('/risk/component-var', {
        positions,
        confidenceLevel,
        horizon
      });
      return response.data;
    } catch (e) {
      console.error("Failed to calculate component VaR", e);
      return null;
    }
  }

  async getMarketData(tickers: string[], startDate?: string, endDate?: string) {
    const response = await this.client.post('/market-data', {
      tickers,
      startDate,
      endDate,
    });
    return response.data;
  }

  // AI Insights
  async getInsights(ticker?: string) {
    const response = await this.client.get('/market-data/insights', {
      params: { ticker },
    });
    return response.data;
  }

  // Waitlist
  async joinWaitlist(data: any) {
    try {
      const response = await this.client.post('/api/waitlist', data);
      return response.data;
    } catch {
      const response = await this.client.post('/waitlist', data);
      return response.data;
    }
  }

  async createWorkspace(userId: string, data: { name: string; company_name?: string }) {
    try {
      const response = await this.client.post(`${NODE_API_URL}/api/spendcheck/workspaces`, data);
      return response.data;
    } catch {
      const response = await this.client.post('/spendcheck/workspaces', data);
      return response.data;
    }
  }

  // File Upload & Analysis
  async uploadFile(formData: FormData) {
    const response = await this.client.post('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  async runAnalysis(data: any) {
    const response = await this.client.post('/analyze', data);
    return response.data;
  }

  async generateReport(data: any) {
    const response = await this.client.post('/reports/generate', data);
    return response.data;
  }

  // Cyclical Valuation
  async computeCyclicalValuation(ticker: string) {
    const response = await this.client.post(`/valuation/cyclical/${ticker.toUpperCase()}/compute`);
    return response.data;
  }

  async getCyclicalValuation(ticker: string) {
    const response = await this.client.get(`/valuation/cyclical/${ticker.toUpperCase()}`);
    return response.data;
  }

  // Tickers
  async getPopularTickers() {
    const response = await this.client.get('/tickers/popular');
    return response.data;
  }

  async searchTickers(query: string) {
    const response = await this.client.get('/tickers/search', {
      params: { q: query },
    });
    return response.data;
  }

  async getPortfolios() {
    try {
      const response = await this.client.get(`${NODE_API_URL}/api/portfolios`);
      return response.data;
    } catch (e) {
      try {
        const response = await this.client.get('/portfolios');
        return response.data;
      } catch (fallbackError) {
        console.error("Failed to fetch portfolios", fallbackError);
        return [];
      }
    }
  }

  async createPortfolio(userId: string, data: any) {
    try {
      const response = await this.client.post(`${NODE_API_URL}/api/portfolios`, data);
      return response.data;
    } catch (e) {
      try {
        const response = await this.client.post('/portfolios', data);
        return response.data;
      } catch (fallbackError) {
        console.error("Failed to create portfolio", fallbackError);
        return null;
      }
    }
  }

  async addPosition(portfolioId: string, userId: string, position: any) {
    try {
      const response = await this.client.post(`${NODE_API_URL}/api/portfolios/${portfolioId}/positions`, position);
      return response.data;
    } catch (e) {
      try {
        const response = await this.client.post(`/portfolios/${portfolioId}/positions`, position);
        return response.data;
      } catch (fallbackError) {
        console.error("Failed to add position", fallbackError);
        return null;
      }
    }
  }

  async getPortfolioAnalytics(portfolioId: string) {
    try {
      const response = await this.client.get(`${NODE_API_URL}/api/portfolios/${portfolioId}/analytics`);
      return response.data;
    } catch (e) {
      try {
        const response = await this.client.get(`/portfolios/${portfolioId}/analytics`);
        return response.data;
      } catch (fallbackError) {
        console.error("Failed to fetch analytics", fallbackError);
        return null;
      }
    }
  }

  // --- NestJS Market Data (port 3000) ---

  async getNodeQuote(ticker: string) {
    const response = await this.client.get(`${NODE_API_URL}/api/market-data/quote/${ticker}`);
    return response.data;
  }

  async getNodeHistory(ticker: string, start?: string, end?: string) {
    const params: Record<string, string> = {};
    if (start) params.start = start;
    if (end) params.end = end;
    const response = await this.client.get(`${NODE_API_URL}/api/market-data/history/${ticker}`, { params });
    return response.data;
  }

  async getNodeFundamentals(ticker: string) {
    const response = await this.client.get(`${NODE_API_URL}/api/market-data/fundamentals/${ticker}`);
    return response.data;
  }

  async searchNodeTickers(query: string, assetType?: string) {
    const params: Record<string, string> = { q: query };
    if (assetType) params.assetType = assetType;
    const response = await this.client.get(`${NODE_API_URL}/api/market-data/search`, { params });
    return response.data;
  }

  async getNodeInsights(ticker?: string) {
    const params: Record<string, string> = {};
    if (ticker) params.ticker = ticker;
    const response = await this.client.get(`${NODE_API_URL}/api/market-data/insights`, { params });
    return response.data;
  }

  async getNodeTechnicalChart(ticker: string, timeframe: string = '3M', indicators: string = 'sma20,rsi,macd') {
    const response = await this.client.get(`${NODE_API_URL}/api/charts/technical/${ticker}`, {
      params: { timeframe, indicators }
    });
    return response.data;
  }

  async getNodeOptionsChain(ticker: string, maturity?: string) {
    const params: Record<string, string> = {};
    if (maturity) params.maturity = maturity;
    const response = await this.client.get(`${NODE_API_URL}/api/options/chain/${ticker}`, { params });
    return response.data;
  }

  async calculateNodeGreeks(data: { underlying: number; strike: number; timeToExpiry: number; riskFreeRate: number; volatility: number; optionType: string }) {
    const response = await this.client.post(`${NODE_API_URL}/api/options/calculate`, data);
    return response.data;
  }

  async getNodeValuationScreener(params?: { sector?: string; minScore?: number }) {
    const response = await this.client.get(`${NODE_API_URL}/api/valuation/screener`, { params });
    return response.data;
  }

  async getNodeValuation(ticker: string, type: 'cyclical' | 'compounder' | 'frontier' = 'cyclical') {
    const response = await this.client.get(`${NODE_API_URL}/api/valuation/${type}/${ticker}`);
    return response.data;
  }

  async getNodeCorrelation(tickers: string[]) {
    const response = await this.client.post(`${NODE_API_URL}/risk/correlation`, { tickers });
    return response.data;
  }

  async getNodeComponentVaR(positions: any[], confidenceLevel: number = 0.95, horizon: number = 1) {
    const response = await this.client.post(`${NODE_API_URL}/risk/component-var`, {
      positions, confidenceLevel, horizon
    });
    return response.data;
  }

  async getNodeVolatilityForecast(ticker: string, horizon: number = 30) {
    const response = await this.client.get(`${NODE_API_URL}/risk/forecast-volatility/${ticker}`, {
      params: { horizon }
    });
    return response.data;
  }

  async getNodePortfolios() {
    const response = await this.client.get(`${NODE_API_URL}/api/portfolios`);
    return response.data;
  }

  async getNodePortfolioAnalytics(portfolioId: string) {
    const response = await this.client.get(`${NODE_API_URL}/api/portfolios/${portfolioId}/analytics`);
    return response.data;
  }

  // --- ALM (Asset Liability Management) ---

  async getAlmDemoAnalysis() {
    const response = await this.client.get(`${NODE_API_URL}/api/alm/demo-analysis`);
    return response.data;
  }

  async getAlmDemoBalanceSheet() {
    const response = await this.client.get(`${NODE_API_URL}/api/alm/demo-balance-sheet`);
    return response.data;
  }

  async postAlmFullAnalysis(balanceSheet: any, rateShocks?: number[], lcr?: any) {
    const response = await this.client.post(`${NODE_API_URL}/api/alm/full-analysis`, {
      balanceSheet,
      rateShocks,
      lcr,
    });
    return response.data;
  }

  // --- ALM Enterprise (DB-backed) ---

  async getInstitutions(workspaceId?: string) {
    const params = workspaceId ? { workspaceId } : {};
    const response = await this.client.get(`${NODE_API_URL}/api/alm/institutions`, { params });
    return response.data;
  }

  async createInstitution(data: {
    name: string;
    type: string;
    totalAssets: number;
    reportingDate: string;
    workspaceId: string;
    currency?: string;
  }) {
    const response = await this.client.post(`${NODE_API_URL}/api/alm/institutions`, data);
    return response.data;
  }

  async getInstitution(institutionId: string) {
    const response = await this.client.get(`${NODE_API_URL}/api/alm/institutions/${institutionId}`);
    return response.data;
  }

  async getALMSummary(institutionId: string) {
    const response = await this.client.get(`${NODE_API_URL}/api/alm/${institutionId}/summary`);
    return response.data;
  }

  async getNIISensitivity(institutionId: string) {
    const response = await this.client.get(`${NODE_API_URL}/api/alm/${institutionId}/nii-sensitivity`);
    return response.data;
  }

  async getLiquidityPosition(institutionId: string) {
    const response = await this.client.get(`${NODE_API_URL}/api/alm/${institutionId}/liquidity`);
    return response.data;
  }

  async getDurationGap(institutionId: string) {
    const response = await this.client.get(`${NODE_API_URL}/api/alm/${institutionId}/duration-gap`);
    return response.data;
  }

  async importBalanceSheetItems(institutionId: string, items: any[]) {
    const response = await this.client.post(
      `${NODE_API_URL}/api/alm/institutions/${institutionId}/balance-sheet-items`,
      { items },
    );
    return response.data;
  }

  async runStressTest(institutionId: string, params?: {
    paths?: number; horizon?: number; volatility?: number; meanReversion?: number;
  }) {
    const response = await this.client.post(
      `${NODE_API_URL}/api/alm/${institutionId}/stress-test`,
      params || {},
    );
    return response.data;
  }

  getALMReportUrl(institutionId: string): string {
    return `${NODE_API_URL}/api/alm/${institutionId}/report`;
  }

  async seedDemoInstitution(workspaceId: string, type: 'bank' | 'credit_union' | 'family_office') {
    const response = await this.client.post(`${NODE_API_URL}/api/alm/seed-demo`, {
      workspaceId,
      type,
    });
    return response.data;
  }
}

export const apiClient = new APIClient();
