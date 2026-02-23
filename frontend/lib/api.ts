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

    // Disable 401 redirect to keep app accessible without auth
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        return Promise.reject(error);
      }
    );
  }

  // Authentication
  async register(email: string, password: string, name?: string): Promise<any> {
    // Bypass authentication unconditionally
    return {
      access_token: 'mock-token',
      user: { id: 'mock-user-id', email: 'demo@capexcycle.io', name: 'Demo User' }
    };
  }

  async login(email: string, password: string): Promise<any> {
    // Bypass authentication unconditionally
    return {
      access_token: 'mock-token',
      user: { id: 'mock-user-id', email: 'demo@capexcycle.io', name: 'Demo User' }
    };
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

  // Admin
  async getDemoRequests() {
    const response = await this.client.get(`${NODE_API_URL}/api/admin/demo-requests`);
    return response.data;
  }

  async resetDemoData() {
    const response = await this.client.delete(`${NODE_API_URL}/api/admin/demo-data`);
    return response.data;
  }

  async getAdminStats() {
    const response = await this.client.get(`${NODE_API_URL}/api/admin/stats`);
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
    return {
      insights: [
        { id: '1', title: 'Tech Sector Valuation Premium', source: 'AI Macro Engine', summary: 'AI infrastructure spend continues to accelerate, sustaining high multiples for semiconductor firms despite rising real yields.', sentiment: 'bullish', confidence: 0.88, timestamp: new Date().toISOString() },
        { id: '2', title: 'Consumer Discretionary Weakness', source: 'Consumer Data Feed', summary: 'Excess savings depletion is leading to softer guidance in retail. Defensive rotation recommended.', sentiment: 'bearish', confidence: 0.75, timestamp: new Date(Date.now() - 3600000).toISOString() },
        { id: '3', title: 'Energy Market Contango', source: 'Commodities Desk', summary: 'Geopolitical risk premium is evaporating, putting downward pressure on near-term futures.', sentiment: 'neutral', confidence: 0.65, timestamp: new Date(Date.now() - 7200000).toISOString() }
      ]
    };
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
    return { id: `workspace-${Date.now()}`, name: data.name, company_name: data.company_name, status: 'active' };
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
    return [{
      id: 'demo-portfolio',
      name: 'AI Macro Starter',
      description: 'Seeded by onboarding for VaR, CVaR, and Monte Carlo workflows',
      benchmark: 'QQQ',
      initial_capital: 250000,
      initialCash: 250000,
      currency: 'USD',
      positions: [
        { symbol: 'NVDA', ticker: 'NVDA', quantity: 120, price: 860 },
        { symbol: 'MSFT', ticker: 'MSFT', quantity: 80, price: 415 },
        { symbol: 'AMZN', ticker: 'AMZN', quantity: 100, price: 180 },
        { symbol: 'TSM', ticker: 'TSM', quantity: 110, price: 145 },
      ]
    }];
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
    return {
      cvar: 15420.50,
      var_95: 12100.25,
      var_99: 18500.75,
      monte_carlo_paths: 1000,
      stress_test_loss: 28400.00,
      portfolio_beta: 1.25,
      sharpe_ratio: 1.8,
      positions_risk: [
        { symbol: 'NVDA', component_var: 6200, marginal_var: 5800, weight: 0.4 },
        { symbol: 'MSFT', component_var: 3100, marginal_var: 2900, weight: 0.25 },
        { symbol: 'AMZN', component_var: 2500, marginal_var: 2400, weight: 0.2 },
        { symbol: 'TSM', component_var: 3620, marginal_var: 3500, weight: 0.15 },
      ]
    };
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
    return Promise.resolve([{
      id: 'demo-bank-id',
      name: 'First Community Bank',
      type: 'community_bank',
      totalAssets: 1250,
      currency: 'USD',
      reportingDate: new Date().toISOString(),
    }]);
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
    return Promise.resolve({
      institution: {
        id: 'demo-bank-id',
        name: 'First Community Bank',
        type: 'community_bank',
        totalAssets: 1250,
        currency: 'USD',
        reportingDate: new Date().toISOString(),
      },
      durationGap: {
        assetDuration: 4.2,
        liabilityDuration: 2.1,
        durationGap: 2.1,
        riskProfile: 'asset-sensitive',
      },
      niiSensitivity: {
        scenarios: [
          { name: '+100 bps', shiftBps: 100, niImpact: 1.5, niImpactPct: 12.5, mveImpact: -1.8, mveImpactPct: -15.0 },
          { name: '-100 bps', shiftBps: -100, niImpact: -1.2, niImpactPct: -10.0, mveImpact: 1.4, mveImpactPct: 11.6 },
        ],
        baseNII: 12.0,
        riskRating: 'moderate',
      },
      liquidity: {
        lcr: 115.5,
        hqla: 250,
        netOutflows: 216.5,
        status: 'compliant',
        buffer: 15.5,
      },
      topRisks: ['Rising interest rates impacting NII', 'Deposit flight risk increasing', 'Commercial real estate concentration'],
      recommendations: ['Hedge 2.1yr duration gap using receive-fixed swaps', 'Increase HQLA buffer by $25M', 'Run severe deposit stress scenario'],
      riskScore: 68,
    });
  }

  async getNIISensitivity(institutionId: string) {
    return Promise.resolve({
      institutionId,
      baseNII: 12.0,
      riskRating: 'moderate',
      scenarios: [
        { name: '+200 bps', shiftBps: 200, niImpact: 3.1, niImpactPct: 25.8, mveImpact: -3.8, mveImpactPct: -31.6 },
        { name: '+100 bps', shiftBps: 100, niImpact: 1.5, niImpactPct: 12.5, mveImpact: -1.8, mveImpactPct: -15.0 },
        { name: 'Base', shiftBps: 0, niImpact: 0, niImpactPct: 0, mveImpact: 0, mveImpactPct: 0 },
        { name: '-100 bps', shiftBps: -100, niImpact: -1.2, niImpactPct: -10.0, mveImpact: 1.4, mveImpactPct: 11.6 },
        { name: '-200 bps', shiftBps: -200, niImpact: -2.5, niImpactPct: -20.8, mveImpact: 2.9, mveImpactPct: 24.1 },
      ],
    });
  }

  async getLiquidityPosition(institutionId: string) {
    return {
      institutionId,
      lcr: 115.5,
      nsfr: 108.2,
      hqla: 250,
      netOutflows: 216.5,
    };
  }

  async getDurationGap(institutionId: string) {
    return {
      institutionId,
      assetDuration: 4.2,
      liabilityDuration: 2.1,
      durationGap: 2.1,
    };
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
    return {
      status: 'success',
      results: {
        worstCaseLoss: -4.5,
        valueAtRisk: -2.8,
        confidenceLevel: 99,
      }
    };
  }

  getALMReportUrl(institutionId: string): string {
    return `${NODE_API_URL}/api/alm/${institutionId}/report`;
  }

  async seedDemoInstitution(workspaceId: string, type: 'bank' | 'credit_union' | 'family_office') {
    return Promise.resolve({
      success: true,
      institutionId: 'demo-bank-id',
      institution: {
        id: 'demo-bank-id',
        name: 'First Community Bank',
        type,
        totalAssets: 1250,
        currency: 'USD',
      }
    });
  }

  // --- Workspaces (ALM) ---

  async getMyWorkspaces() {
    return [{ id: 'demo-workspace-id', name: 'Demo Workspace' }];
  }

  async createMyWorkspace(name: string) {
    return { id: 'demo-workspace-id', name };
  }

  // Prospect CRM
  async getProspects(stage?: string) {
    return [];
  }

  async createProspect(data: { name: string; email?: string; company?: string; role?: string; stage?: string; source?: string; notes?: string }) {
    return { id: `prospect-${Date.now()}`, ...data };
  }

  async updateProspect(id: string, data: { stage?: string; notes?: string; name?: string; email?: string; company?: string; role?: string }) {
    const response = await this.client.patch(`${NODE_API_URL}/api/admin/prospects/${id}`, data);
    return response.data;
  }

  async deleteProspect(id: string) {
    const response = await this.client.delete(`${NODE_API_URL}/api/admin/prospects/${id}`);
    return response.data;
  }

  async seedProspects() {
    const response = await this.client.post(`${NODE_API_URL}/api/admin/seed-prospects`);
    return response.data;
  }
}

export const apiClient = new APIClient();
