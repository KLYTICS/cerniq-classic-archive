import axios, { AxiosInstance } from 'axios';
import { getMarketApiBase } from './marketTransport';

const API_URL = (
  process.env.NEXT_PUBLIC_API_URL || ''
).trim().replace(/\/+$/, '');
const NODE_API_URL = (
  process.env.NEXT_PUBLIC_NODE_API_URL || ''
).trim().replace(/\/+$/, '');
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const CAPEX_ACCESS_TOKEN_KEY = 'capex_access_token';
const MARKET_API_BASE = getMarketApiBase();

function getAccessToken(): string {
  if (typeof window === 'undefined') {
    return '';
  }

  const sessionToken = sessionStorage.getItem(CAPEX_ACCESS_TOKEN_KEY);
  if (sessionToken) {
    return sessionToken;
  }

  // Migrate any legacy persisted token to session scope.
  const legacyToken = localStorage.getItem(CAPEX_ACCESS_TOKEN_KEY) || '';
  if (legacyToken) {
    sessionStorage.setItem(CAPEX_ACCESS_TOKEN_KEY, legacyToken);
    localStorage.removeItem(CAPEX_ACCESS_TOKEN_KEY);
  }
  return legacyToken;
}

function setAccessToken(token: string): void {
  if (typeof window === 'undefined') {
    return;
  }
  sessionStorage.setItem(CAPEX_ACCESS_TOKEN_KEY, token);
  localStorage.removeItem(CAPEX_ACCESS_TOKEN_KEY);
}

function clearAccessToken(): void {
  if (typeof window === 'undefined') {
    return;
  }
  sessionStorage.removeItem(CAPEX_ACCESS_TOKEN_KEY);
  localStorage.removeItem(CAPEX_ACCESS_TOKEN_KEY);
}

export interface ManagedApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  createdAt: string;
  lastUsedAt?: string | null;
  revokedAt?: string | null;
  expiresAt?: string | null;
}

// SpendCheck AP Analysis types
export interface APFinding {
  id: string;
  type: string;
  vendor: string;
  explanation: string;
  explanationEs?: string;
  estimatedRecovery: number;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  invoiceIds?: string[];
  recommendedActions?: string[];
  status?: 'open' | 'reviewed' | 'dismissed';
}

export interface APVendorStat {
  name: string;
  quarterlySpend: number;
  percentOfTotal: number;
  invoiceCount: number;
  avgInvoice: number;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface APAnalysisResult {
  healthScore: number;
  totalSpendAnalyzed: number;
  totalFindings: number;
  potentialRecovery: number;
  recoveredAmount: number;
  findings: APFinding[];
  vendorStats: APVendorStat[];
  severityBreakdown: { high: number; medium: number; low: number };
  topVendor: { name: string; percentOfTotal: number };
  apRiskScore: number;
}

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

    this.client.interceptors.request.use((config) => {
      if (typeof window !== 'undefined') {
        const token = getAccessToken();
        if (token) {
          config.headers = config.headers || {};
          config.headers.Authorization = `Bearer ${token}`;
        }
      }
      return config;
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
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      const response = await this.client.post(`${NODE_API_URL}/api/auth/register`, {
        email,
        password,
        name,
      });
      return response.data;
    }

    const response = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password, data: { name } }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.msg || data?.error_description || data?.error || 'Registration failed');
    }

    const token = data.session?.access_token || '';
    if (token) {
      setAccessToken(token);
    }

    return {
      access_token: token,
      user: {
        id: data.user?.id || email,
        email: data.user?.email || email,
        name: data.user?.user_metadata?.name || name,
      },
    };
  }

  async login(email: string, password: string): Promise<any> {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      const response = await this.client.post(`${NODE_API_URL}/api/auth/login`, {
        email,
        password,
      });
      return response.data;
    }

    const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.msg || data?.error_description || data?.error || 'Login failed');
    }

    if (data.access_token) {
      setAccessToken(data.access_token);
    }

    return {
      access_token: data.access_token,
      user: {
        id: data.user?.id || email,
        email: data.user?.email || email,
        name: data.user?.user_metadata?.name,
      },
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
    clearAccessToken();
  }

  async refreshTokens() {
    const response = await this.client.post(`${NODE_API_URL}/api/auth/refresh`, {});
    return response.data;
  }

  async changePassword(currentPassword: string, newPassword: string) {
    const response = await this.client.put(`${NODE_API_URL}/api/auth/password`, { currentPassword, newPassword });
    return response.data;
  }

  async listApiKeys(): Promise<{ keys: ManagedApiKey[] }> {
    const response = await this.client.get(`${NODE_API_URL}/api/auth/api-keys`);
    return response.data;
  }

  async createApiKey(name: string, expiresInDays?: number): Promise<{ apiKey: string; record: ManagedApiKey }> {
    const response = await this.client.post(`${NODE_API_URL}/api/auth/api-keys`, { name, expiresInDays });
    return response.data;
  }

  async revokeApiKey(keyId: string): Promise<{ revoked: boolean }> {
    const response = await this.client.post(`${NODE_API_URL}/api/auth/api-keys/${keyId}/revoke`);
    return response.data;
  }

  async getPortalSettings() {
    const response = await this.client.get(`${NODE_API_URL}/api/portal/settings`);
    return response.data;
  }

  async invitePortalUser(data: { email: string; role: 'OWNER' | 'ANALYST' | 'VIEWER'; name?: string }) {
    const response = await this.client.post(`${NODE_API_URL}/api/portal/invite`, data);
    return response.data;
  }

  // Demo Request (landing page) — submits to both legacy endpoint and lead pipeline
  async submitDemoRequest(data: {
    email: string;
    name?: string;
    institutionName?: string;
    institutionType?: string;
    totalAssets?: string;
    message?: string;
    company?: string;
  }) {
    const rawInstitutionType = (data.institutionType || '').trim().toLowerCase();
    const institutionTypeAliases: Record<string, string> = {
      bank: 'community_bank',
      family_office: 'other',
    };
    const allowedInstitutionTypes = new Set([
      'cooperativa',
      'credit_union',
      'community_bank',
      'cpa_consultant',
      'other',
    ]);
    const mappedInstitutionType = institutionTypeAliases[rawInstitutionType] || rawInstitutionType;
    const normalizedInstitutionType = allowedInstitutionTypes.has(mappedInstitutionType)
      ? mappedInstitutionType
      : 'other';
    const normalizedInstitutionName = (data.institutionName || data.company || '').trim();

    // Submit to lead pipeline (primary)
    const leadPayload = {
      name: data.name || '',
      email: data.email,
      institutionName: normalizedInstitutionName,
      institutionType: normalizedInstitutionType,
      message: data.message,
      source: 'landing_page',
    };
    try {
      await this.client.post(`${NODE_API_URL}/api/v1/leads/submit`, leadPayload);
    } catch { /* fallback to legacy */ }

    // Also submit to legacy demo-request endpoint
    const legacyPayload = {
      ...data,
      institutionName: normalizedInstitutionName || undefined,
      institutionType: normalizedInstitutionType,
    };
    const response = await this.client.post(`${NODE_API_URL}/api/demo-request`, legacyPayload);
    return response.data;
  }

  // Admin (all admin endpoints require x-admin-key header)
  private adminHeaders() {
    const key = typeof window !== 'undefined' ? sessionStorage.getItem('capex_admin_key') || '' : '';
    return { 'x-admin-key': key };
  }

  async getDemoRequests() {
    const response = await this.client.get(`${NODE_API_URL}/api/admin/demo-requests`, { headers: this.adminHeaders() });
    return response.data;
  }

  async resetDemoData() {
    const response = await this.client.delete(`${NODE_API_URL}/api/admin/demo-data`, { headers: this.adminHeaders() });
    return response.data;
  }

  async getAdminStats() {
    const response = await this.client.get(`${NODE_API_URL}/api/admin/stats`, { headers: this.adminHeaders() });
    return response.data;
  }

  // Risk Analysis
  async getRiskAnalysis(portfolioId: string) {
    const response = await this.client.get(`/risk/${portfolioId}`);
    return response.data;
  }

  // Market Data
  async getQuote(ticker: string) {
    return this.getNodeQuote(ticker);
  }

  async getFundamentals(ticker: string) {
    return this.getNodeFundamentals(ticker);
  }

  async getVolatilityForecast(ticker: string, horizon: number = 30) {
    const baseVol = 0.15 + (ticker.charCodeAt(0) % 10) / 100; // e.g., 0.15 to 0.24
    const forecast = [];
    let currentVol = baseVol;

    for (let i = 1; i <= horizon; i++) {
      // Mean reversion towards slightly higher long-term vol
      const drift = (0.20 - currentVol) * 0.05;
      const shock = (Math.random() - 0.4) * 0.01;
      currentVol = Math.max(0.05, currentVol + drift + shock);

      forecast.push({
        day: i,
        volatility: currentVol,
        lower95: Math.max(0, currentVol * 0.8),
        upper95: currentVol * 1.25
      });
    }

    return Promise.resolve({
      ticker,
      currentVolatility: baseVol,
      forecast,
      model: 'GARCH(1,1) Mock'
    });
  }

  async getHistoricalPrices(ticker: string, startDate?: string, endDate?: string) {
    const params: Record<string, string> = {};
    if (startDate) params.start = startDate;
    if (endDate) params.end = endDate;

    const response = await this.client.get(`${MARKET_API_BASE}/history/${ticker}`, { params });
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
    // Generate a symmetric correlation matrix
    const n = tickers.length;
    const matrix = Array(n).fill(0).map(() => Array(n).fill(0));

    for (let i = 0; i < n; i++) {
      for (let j = 0; j <= i; j++) {
        if (i === j) {
          matrix[i][j] = 1.0;
        } else {
          // Pseudo-random correlation between -0.3 and 0.8
          const val = -0.3 + (Math.abs(Math.sin((i + 1) * (j + 1))) * 1.1);
          matrix[i][j] = val;
          matrix[j][i] = val; // symmetric
        }
      }
    }

    return Promise.resolve({
      tickers,
      matrix,
      computedAt: new Date().toISOString()
    });
  }

  async calculateComponentVaR(positions: any[], confidenceLevel: number = 0.95, horizon: number = 1) {
    let portfolioValue = 0;
    const components = positions.map(p => {
      const val = Number(p.quantity) * Number(p.price || p.currentPrice || 100);
      portfolioValue += val;
      return { ticker: p.ticker, value: val };
    });

    const portfolioVaR = portfolioValue * 0.05; // 5% total VaR roughly

    let totalRiskContrib = 0;
    const resultComponents = components.map(c => {
      const weight = c.value / portfolioValue;
      const compVaR = portfolioVaR * weight * (0.8 + Math.random() * 0.4); // Randomize risk a bit
      totalRiskContrib += compVaR;
      return {
        ticker: c.ticker,
        position: c.value,
        marginalVaR: compVaR / c.value,
        componentVaR: compVaR,
        riskContribution: 0 // Will normalize
      };
    });

    // Normalize risk contributions to 100%
    resultComponents.forEach(c => {
      c.riskContribution = (c.componentVaR / totalRiskContrib) * 100;
    });

    return Promise.resolve({
      portfolioVaR: totalRiskContrib,
      portfolioValue,
      confidenceLevel,
      horizon,
      components: resultComponents
    });
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
    const response = await this.client.post(`${NODE_API_URL}/api/workspaces`, {
      name: data.name,
      company_name: data.company_name,
      userId,
    });
    return response.data;
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
    return Promise.resolve({ status: 'computed' });
  }

  async getCyclicalValuation(ticker: string) {
    const basePrice = ticker.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % 500 + 50;
    return Promise.resolve({
      ticker: ticker.toUpperCase(),
      cycles_detected: 3,
      mid_cycle_revenue: basePrice * 10000000,
      mid_cycle_eps: basePrice / 20,
      mid_cycle_margin: 0.25,
      mid_cycle_pe: 22,
      fair_value_base: basePrice * 1.15,
      fair_value_low: basePrice * 0.9,
      fair_value_high: basePrice * 1.4,
      current_price: basePrice,
      upside_downside_pct: 15.0,
      current_cycle_position: 'Early Expansion'
    });
  }

  // Tickers
  async getPopularTickers() {
    return Promise.resolve(['NVDA', 'AAPL', 'MSFT', 'AMD', 'TSLA', 'GOOGL', 'META', 'AMZN']);
  }

  async searchTickers(query: string) {
    const pseudoResults = [
      { ticker: 'NVDA', name: 'NVIDIA Corporation', type: 'Stock' },
      { ticker: 'AMD', name: 'Advanced Micro Devices', type: 'Stock' },
      { ticker: 'TSX', name: 'Taiwan Semiconductor', type: 'Stock' },
      query.length > 0 ? { ticker: query.toUpperCase(), name: `${query.toUpperCase()} Corp`, type: 'Stock' } : { ticker: 'INTC', name: 'Intel Corp', type: 'Stock' }
    ];
    return Promise.resolve(pseudoResults);
  }

  async getPortfolios() {
    return Promise.resolve([{
      id: 'demo-portfolio',
      name: 'AI Macro Starter',
      description: 'Seeded by onboarding for VaR, CVaR, and Monte Carlo workflows',
      benchmark: 'QQQ',
      initial_capital: 250000,
      initialCash: 250000,
      currentCash: 5000,
      totalValue: 275000,
      totalPnL: 25000,
      totalPnLPercent: 10.0,
      currency: 'USD',
      positions: [
        { id: '1', symbol: 'NVDA', ticker: 'NVDA', quantity: 120, avgCost: 500, currentPrice: 880.50, marketValue: 105660, unrealizedPnL: 45660, unrealizedPnLPercent: 76.10, weight: 0.38 },
        { id: '2', symbol: 'MSFT', ticker: 'MSFT', quantity: 80, avgCost: 380, currentPrice: 420.15, marketValue: 33612, unrealizedPnL: 3212, unrealizedPnLPercent: 10.56, weight: 0.12 },
        { id: '3', symbol: 'AMZN', ticker: 'AMZN', quantity: 100, avgCost: 140, currentPrice: 185.40, marketValue: 18540, unrealizedPnL: 4540, unrealizedPnLPercent: 32.42, weight: 0.07 },
        { id: '4', symbol: 'TSM', ticker: 'TSM', quantity: 110, avgCost: 110, currentPrice: 145.20, marketValue: 15972, unrealizedPnL: 3872, unrealizedPnLPercent: 31.56, weight: 0.05 },
        { id: '5', symbol: 'BTC', ticker: 'BTC', quantity: 1.5, avgCost: 45000, currentPrice: 68500.00, marketValue: 102750, unrealizedPnL: 35250, unrealizedPnLPercent: 52.22, weight: 0.37 },
      ]
    }]);
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

  // --- NestJS Market Data (MOCKED FOR 24/7 DEMO) ---

  // Comprehensive map of realistic baseline prices for popular assets
  private getBasePrice(ticker: string): number {
    const symbol = ticker.toUpperCase();
    const REALISTIC_PRICES: Record<string, number> = {
      // Indices & ETFs
      'SPY': 510.45, 'QQQ': 440.12, 'DIA': 390.50, 'IWM': 205.80, 'VIX': 14.50,
      'TLT': 93.20, 'GLD': 210.30, 'USO': 78.40, 'XLK': 208.15, 'XLF': 41.20,
      'XLE': 88.50, 'XLV': 144.30, 'XLY': 180.10, 'XLI': 122.40, 'XLB': 89.20,
      'XLP': 74.50, 'XLU': 65.10, 'SMH': 225.40, 'ARKK': 50.20,

      // Mag 7 & Large Cap Tech
      'NVDA': 880.50, 'AAPL': 175.20, 'MSFT': 420.15, 'AMZN': 185.40,
      'META': 500.20, 'GOOGL': 155.30, 'TSLA': 175.80, 'AMD': 170.10,
      'TSM': 145.20, 'AVGO': 1320.50, 'ASML': 980.40, 'ADBE': 490.15,
      'CRM': 305.20, 'NFLX': 610.80,

      // Financials & Others
      'JPM': 195.40, 'BAC': 37.50, 'GS': 410.20, 'V': 285.40, 'MA': 475.10,
      'UNH': 480.30, 'JNJ': 155.20, 'LLY': 780.40, 'NVO': 130.20, 'WMT': 60.50,
      'PG': 160.10, 'KO': 60.20, 'PEP': 170.50, 'COST': 740.20, 'HD': 375.40,
      'XOM': 115.20, 'CVX': 155.40,

      // Crypto (Proxies)
      'BTC': 68500.00, 'ETH': 3550.00, 'SOL': 180.50, 'COIN': 260.40, 'MSTR': 1550.20
    };

    if (REALISTIC_PRICES[symbol]) {
      return REALISTIC_PRICES[symbol];
    }
    // Fallback pseudo-random for unknown tickers (e.g. 50 to 550)
    return ticker.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % 500 + 50;
  }

  async getNodeQuote(ticker: string) {
    const response = await this.client.get(`${MARKET_API_BASE}/quote/${ticker}`);
    const data = response.data;

    return {
      ...data,
      ticker: data.ticker || ticker.toUpperCase(),
      name: data.name || data.shortName || data.ticker || ticker.toUpperCase(),
      dayHigh: data.dayHigh ?? data.high ?? data.price ?? 0,
      dayLow: data.dayLow ?? data.low ?? data.price ?? 0,
    };
  }

  async getNodeHistory(ticker: string, start?: string, end?: string) {
    const params: Record<string, string> = {};
    if (start) params.start = start;
    if (end) params.end = end;

    const response = await this.client.get(`${MARKET_API_BASE}/history/${ticker}`, {
      params,
    });
    return response.data;
  }

  async getNodeFundamentals(ticker: string) {
    const response = await this.client.get(`${MARKET_API_BASE}/fundamentals/${ticker}`);
    return response.data;
  }

  async searchNodeTickers(query: string, assetType?: string) {
    const params: Record<string, string> = { q: query };
    if (assetType) params.assetType = assetType;
    const response = await this.client.get(`${MARKET_API_BASE}/search`, { params });
    return response.data;
  }

  async getNodeInstrument(ticker: string) {
    const response = await this.client.get(`${MARKET_API_BASE}/instrument/${ticker}`);
    return response.data;
  }

  async getNodeNews(ticker: string, limit: number = 8) {
    const response = await this.client.get(`${MARKET_API_BASE}/news/${ticker}`, {
      params: { limit },
    });
    return response.data;
  }

  async getNodeSnapshot(ticker: string, newsLimit: number = 8) {
    const response = await this.client.get(`${MARKET_API_BASE}/snapshot/${ticker}`, {
      params: { newsLimit },
    });
    return response.data;
  }

  async getNodeInsights(ticker?: string) {
    const params: Record<string, string> = {};
    if (ticker) params.ticker = ticker;
    const response = await this.client.get(`${MARKET_API_BASE}/insights`, { params });
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
    return Promise.resolve([
      { ticker: 'NVDA', score: 98, sector: 'Technology', fair_value_base: 145.00, current_price: 120.00, upside_downside_pct: 20.8 },
      { ticker: 'AMD', score: 85, sector: 'Technology', fair_value_base: 180.00, current_price: 155.00, upside_downside_pct: 16.1 },
      { ticker: 'TSM', score: 92, sector: 'Technology', fair_value_base: 195.00, current_price: 175.00, upside_downside_pct: 11.4 },
    ]);
  }

  async getNodeValuation(ticker: string, type: 'cyclical' | 'compounder' | 'frontier' = 'cyclical') {
    const basePrice = this.getBasePrice(ticker);
    return Promise.resolve({
      ticker: ticker.toUpperCase(),
      cycles_detected: 3,
      mid_cycle_revenue: basePrice * 10000000,
      mid_cycle_eps: basePrice / 20,
      mid_cycle_margin: 0.25,
      mid_cycle_pe: 22,
      fair_value_base: basePrice * 1.15,
      fair_value_low: basePrice * 0.9,
      fair_value_high: basePrice * 1.4,
      current_price: basePrice,
      upside_downside_pct: 15.0,
      current_cycle_position: 'Early Expansion'
    });
  }

  async getNodeCorrelation(tickers: string[]) {
    return this.calculateCorrelation(tickers);
  }

  async getNodeComponentVaR(positions: any[], confidenceLevel: number = 0.95, horizon: number = 1) {
    return this.calculateComponentVaR(positions, confidenceLevel, horizon);
  }

  async getNodeVolatilityForecast(ticker: string, horizon: number = 30) {
    return this.getVolatilityForecast(ticker, horizon);
  }

  async getNodePortfolios() {
    return this.getPortfolios();
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
    try {
      const params = workspaceId ? `?workspaceId=${workspaceId}` : '';
      const response = await this.client.get(`${NODE_API_URL}/api/alm/institutions${params}`);
      return response.data?.items ?? response.data ?? [];
    } catch {
      return [{
        id: 'demo-bank-id', name: 'First Community Bank', type: 'community_bank',
        totalAssets: 1250, currency: 'USD', reportingDate: new Date().toISOString(),
      }];
    }
  }

  async createInstitution(data: {
    name: string;
    type: string;
    totalAssets: number;
    reportingDate: string;
    workspaceId: string;
    currency?: string;
    primaryRegulator?: string;
  }) {
    const response = await this.client.post(`${NODE_API_URL}/api/alm/institutions`, data);
    return response.data;
  }

  async getInstitution(institutionId: string) {
    try {
      const response = await this.client.get(`${NODE_API_URL}/api/alm/institutions/${institutionId}`);
      return response.data;
    } catch {
      return {
        id: institutionId, name: 'First Community Bank', type: 'community_bank', totalAssets: 1250,
        balanceSheetItems: [
          { category: 'asset', subcategory: 'commercial_loans', name: 'Commercial Real Estate', balance: 350, rate: 5.25, duration: 4.5, rateType: 'fixed' },
          { category: 'asset', subcategory: 'residential_mortgages', name: '30yr Fixed Mortgages', balance: 280, rate: 4.75, duration: 6.2, rateType: 'fixed' },
          { category: 'asset', subcategory: 'investment_securities', name: 'Treasury Notes', balance: 120, rate: 4.10, duration: 2.8, rateType: 'fixed' },
          { category: 'asset', subcategory: 'cash_equivalents', name: 'Cash & Fed Funds', balance: 80, rate: 5.30, duration: 0.1, rateType: 'variable' },
          { category: 'liability', subcategory: 'demand_deposits', name: 'Checking Accounts', balance: 200, rate: 0.50, duration: 0.1, rateType: 'variable' },
          { category: 'liability', subcategory: 'savings_deposits', name: 'Money Market', balance: 150, rate: 3.80, duration: 0.3, rateType: 'variable' },
          { category: 'liability', subcategory: 'time_deposits', name: '12-Month CDs', balance: 180, rate: 4.00, duration: 0.9, rateType: 'fixed' },
          { category: 'liability', subcategory: 'borrowings', name: 'FHLB Advances', balance: 100, rate: 4.50, duration: 1.5, rateType: 'fixed' },
        ],
      };
    }
  }

  async getALMSummary(institutionId: string) {
    try {
      const response = await this.client.get(`${NODE_API_URL}/api/alm/${institutionId}/summary`);
      return response.data;
    } catch {
      // Graceful degradation: return demo data if backend unavailable
      return {
        institution: { id: institutionId, name: 'First Community Bank', type: 'community_bank', totalAssets: 1250, currency: 'USD', reportingDate: new Date().toISOString() },
        durationGap: { assetDuration: 4.2, liabilityDuration: 2.1, durationGap: 2.1, riskProfile: 'asset-sensitive' as const },
        niiSensitivity: {
          scenarios: [
            { name: '+200 bps', shiftBps: 200, niImpact: 3.1, niImpactPct: 25.8 },
            { name: '+100 bps', shiftBps: 100, niImpact: 1.5, niImpactPct: 12.5 },
            { name: 'Base', shiftBps: 0, niImpact: 0, niImpactPct: 0 },
            { name: '-100 bps', shiftBps: -100, niImpact: -1.2, niImpactPct: -10.0 },
            { name: '-200 bps', shiftBps: -200, niImpact: -2.5, niImpactPct: -20.8 },
          ],
          baseNII: 12.0, riskRating: 'moderate' as const,
        },
        liquidity: { lcr: 115.5, hqla: 250, netOutflows: 216.5, status: 'compliant' as const, buffer: 15.5 },
        topRisks: ['Rising interest rates impacting NII', 'Deposit flight risk increasing', 'Commercial real estate concentration'],
        recommendations: ['Hedge 2.1yr duration gap using receive-fixed swaps', 'Increase HQLA buffer by $25M', 'Run severe deposit stress scenario'],
        riskScore: 68,
      };
    }
  }

  async getNIISensitivity(institutionId: string) {
    try {
      const response = await this.client.get(`${NODE_API_URL}/api/alm/${institutionId}/nii-sensitivity`);
      return response.data;
    } catch {
      return {
        institutionId, baseNII: 12.0, riskRating: 'moderate' as const,
        scenarios: [
          { name: '+200 bps', shiftBps: 200, niImpact: 3.1, niImpactPct: 25.8, mveImpact: -3.8, mveImpactPct: -31.6 },
          { name: '+100 bps', shiftBps: 100, niImpact: 1.5, niImpactPct: 12.5, mveImpact: -1.8, mveImpactPct: -15.0 },
          { name: 'Base', shiftBps: 0, niImpact: 0, niImpactPct: 0, mveImpact: 0, mveImpactPct: 0 },
          { name: '-100 bps', shiftBps: -100, niImpact: -1.2, niImpactPct: -10.0, mveImpact: 1.4, mveImpactPct: 11.6 },
          { name: '-200 bps', shiftBps: -200, niImpact: -2.5, niImpactPct: -20.8, mveImpact: 2.9, mveImpactPct: 24.1 },
        ],
      };
    }
  }

  async getLiquidityPosition(institutionId: string) {
    try {
      const response = await this.client.get(`${NODE_API_URL}/api/alm/${institutionId}/liquidity`);
      return response.data;
    } catch {
      // Fallback demo data
    }
    return {
      institutionId,
      lcr: 115.5,
      nsfr: 108.2,
      hqla: 250,
      netOutflows: 216.5,
      status: 'compliant' as const,
      buffer: 15.5,
    };
  }

  async getDurationGap(institutionId: string) {
    try {
      const response = await this.client.get(`${NODE_API_URL}/api/alm/${institutionId}/duration-gap`);
      return response.data;
    } catch {
      return { institutionId, assetDuration: 4.2, liabilityDuration: 2.1, durationGap: 2.1, riskProfile: 'asset-sensitive' as const };
    }
  }

  async importBalanceSheetItems(institutionId: string, items: any[]) {
    const response = await this.client.post(
      `${NODE_API_URL}/api/alm/institutions/${institutionId}/balance-sheet-items`,
      { items },
    );
    return response.data;
  }

  async uploadBalanceSheetCSV(institutionId: string, file: File, dryRun = false) {
    const formData = new FormData();
    formData.append('file', file);
    const response = await this.client.post(
      `${NODE_API_URL}/api/alm/institutions/${institutionId}/upload-csv${dryRun ? '?dryRun=true' : ''}`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return response.data;
  }

  async runStressTest(institutionId: string, params?: {
    paths?: number; horizon?: number; volatility?: number; meanReversion?: number;
  }) {
    try {
      const response = await this.client.post(`${NODE_API_URL}/api/alm/${institutionId}/stress-test`, params ?? {});
      return response.data;
    } catch { /* fallback below */ }
    return ({
      monteCarlo: {
        paths: 1000,
        horizon: 12,
        ratePaths: [],
        niiDistribution: { p5: -5.2, p25: -2.1, median: 0.8, p75: 3.4, p95: 6.1 },
        monthlyNIIBands: [
          { month: 1, p5: -0.5, p25: -0.2, median: 0.1, p75: 0.3, p95: 0.6 },
          { month: 2, p5: -0.8, p25: -0.3, median: 0.2, p75: 0.5, p95: 0.9 },
          { month: 3, p5: -1.2, p25: -0.5, median: 0.3, p75: 0.8, p95: 1.4 },
          { month: 6, p5: -2.5, p25: -1.1, median: 0.5, p75: 1.6, p95: 2.8 },
          { month: 9, p5: -4.0, p25: -1.6, median: 0.7, p75: 2.4, p95: 4.5 },
          { month: 12, p5: -5.2, p25: -2.1, median: 0.8, p75: 3.4, p95: 6.1 },
        ],
        worstCaseNII: -5.8,
        expectedNII: 12.8,
        niiAtRisk: 5.2,
      },
      regulatory: {
        scenarios: [
          {
            name: 'Severe Baseline Rates',
            description: 'Assumes an immediate +300bps parallel shift across the curve.',
            rateShock: [300, 300, 300, 300],
            niImpact: 4.2,
            mveImpact: -8.5,
            lcrImpact: 108,
            capitalImpact: -0.2,
            passFailStatus: 'pass' as const,
          },
          {
            name: 'Liquidity Crisis Draft',
            description: 'Significant retail deposit flight forcing immediate wholesale funding utilization.',
            rateShock: [0, 0, 0, 0],
            niImpact: -2.1,
            mveImpact: -0.5,
            lcrImpact: 92,
            capitalImpact: -0.8,
            passFailStatus: 'warn' as const,
          },
          {
            name: 'Flattening Curve Shock',
            description: 'Short rates rise +200bps while long rates fall -100bps, compressing margins heavily.',
            rateShock: [200, 100, 0, -100],
            niImpact: -5.4,
            mveImpact: 1.2,
            lcrImpact: 112,
            capitalImpact: 0.1,
            passFailStatus: 'fail' as const,
          },
          {
            name: 'Stagflation Stress Event',
            description: 'High rates (+250bps) persist while credit losses multiply drastically.',
            rateShock: [250, 250, 250, 250],
            niImpact: 1.8,
            mveImpact: -12.4,
            lcrImpact: 104,
            capitalImpact: -1.5,
            passFailStatus: 'pass' as const,
          }
        ],
        overallRating: 'adequate' as const,
      }
    });
  }

  // --- Custom Stress Scenario Builder ---

  async runCustomStressTest(institutionId: string, params: {
    rateShockBps: number;
    depositRunoffPct: number;
    defaultRateIncreasePct: number;
    energyCostShockPct: number;
  }) {
    const response = await this.client.post(
      `${NODE_API_URL}/api/alm/${institutionId}/stress/custom`,
      params,
    );
    return response.data;
  }

  // --- Compliance Calendar ---

  async getComplianceCalendar(institutionId: string): Promise<{
    id: string;
    title: string;
    titleEs: string;
    deadlineDate: string;
    category: 'exam' | 'report' | 'meeting' | 'tax' | 'internal';
    urgency: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'OVERDUE';
    description: string;
    descriptionEs: string;
    relatedModule: string;
  }[]> {
    const response = await this.client.get(`${NODE_API_URL}/api/alm/${institutionId}/calendar`);
    return response.data;
  }

  getALMReportUrl(institutionId: string, lang: string = 'en'): string {
    return `${NODE_API_URL}/api/alm/${institutionId}/report?lang=${lang}`;
  }

  async downloadALMReport(institutionId: string, lang: string = 'en'): Promise<void> {
    const response = await this.client.get(
      `${NODE_API_URL}/api/alm/${institutionId}/report?lang=${lang}`,
      { responseType: 'blob' },
    );
    const blob = new Blob([response.data], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const disposition = response.headers['content-disposition'];
    const filenameMatch = disposition?.match(/filename="?([^"]+)"?/);
    a.download = filenameMatch?.[1] || `alm-report-${institutionId}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async seedDemoInstitution(workspaceId: string, type: 'bank' | 'credit_union' | 'family_office' | 'cooperativa') {
    try {
      const response = await this.client.post(`${NODE_API_URL}/api/alm/seed-demo`, { workspaceId, type });
      return response.data;
    } catch {
      return { success: true, institutionId: 'demo-bank-id', institution: { id: 'demo-bank-id', name: 'First Community Bank', type, totalAssets: 1250, currency: 'USD' } };
    }
  }

  // --- AI Advisor ---

  async askAdvisor(
    institutionId: string,
    message: string,
    conversationHistory: Array<{ role: string; content: string }> = [],
    language: string = 'es',
  ): Promise<{ response: string; tokensUsed: number }> {
    const response = await this.client.post(
      `${NODE_API_URL}/api/alm/${institutionId}/advisor`,
      { message, conversationHistory, language },
    );
    return response.data;
  }

  // --- Workspaces (ALM) ---

  async getMyWorkspaces() {
    const response = await this.client.get(`${NODE_API_URL}/api/workspaces`);
    return response.data;
  }

  async createMyWorkspace(name: string) {
    const response = await this.client.post(`${NODE_API_URL}/api/workspaces`, { name });
    return response.data;
  }

  // --- Expense / SpendCheck Analysis (POST /api/expenses/:orgId/analyze) ---

  async analyzeExpenses(orgId: string): Promise<APAnalysisResult> {
    const response = await this.client.post(`${NODE_API_URL}/api/expenses/${orgId}/analyze`);
    return response.data;
  }

  async uploadExpenseCSV(orgId: string, file: File): Promise<{
    ingested: number;
    orgId: string;
    errors: any[];
    warnings: string[];
    summary: {
      totalRows: number;
      validRows: number;
      errorRows: number;
      totalAmount: number;
      uniqueVendors: number;
      dateRange: { from: string; to: string } | null;
    };
    analysisTriggered: boolean;
  }> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await this.client.post(
      `${NODE_API_URL}/api/expenses/${orgId}/upload`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return response.data;
  }

  getExpenseTemplateUrl(): string {
    return `${NODE_API_URL}/api/expenses/template`;
  }

  async downloadAPReport(orgId: string, lang: string = 'en', institutionId?: string): Promise<void> {
    const params = new URLSearchParams({ lang });
    if (institutionId) params.set('institutionId', institutionId);
    const response = await this.client.post(
      `${NODE_API_URL}/api/expenses/${orgId}/report?${params.toString()}`,
      {},
      { responseType: 'blob' },
    );
    const blob = new Blob([response.data], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const dateStr = new Date().toISOString().slice(0, 10);
    a.download = `ap-intelligence-report-${dateStr}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Prospect CRM
  async getProspects(stage?: string) {
    const params = stage ? `?stage=${stage}` : '';
    const response = await this.client.get(`${NODE_API_URL}/api/admin/prospects${params}`, { headers: this.adminHeaders() });
    return response.data;
  }

  async createProspect(data: { name: string; email?: string; company?: string; role?: string; stage?: string; source?: string; notes?: string }) {
    const response = await this.client.post(`${NODE_API_URL}/api/admin/prospects`, data, { headers: this.adminHeaders() });
    return response.data;
  }

  async updateProspect(id: string, data: { stage?: string; notes?: string; name?: string; email?: string; company?: string; role?: string }) {
    const response = await this.client.patch(`${NODE_API_URL}/api/admin/prospects/${id}`, data, { headers: this.adminHeaders() });
    return response.data;
  }

  async deleteProspect(id: string) {
    const response = await this.client.delete(`${NODE_API_URL}/api/admin/prospects/${id}`, { headers: this.adminHeaders() });
    return response.data;
  }

  async seedProspects() {
    const response = await this.client.post(`${NODE_API_URL}/api/admin/seed-prospects`, {}, { headers: this.adminHeaders() });
    return response.data;
  }

  // --- Scenario Persistence ---

  async saveScenario(data: {
    institutionId: string;
    name: string;
    description?: string;
    scenarioType: string;
    parameters: Record<string, unknown>;
    results?: Record<string, unknown>;
    tags?: string[];
  }) {
    const response = await this.client.post(`${NODE_API_URL}/api/alm/scenarios/save`, data);
    return response.data;
  }

  async listScenarios(institutionId: string, opts?: { page?: number; tag?: string }) {
    const params = new URLSearchParams();
    if (opts?.page) params.set('page', String(opts.page));
    if (opts?.tag) params.set('tag', opts.tag);
    const qs = params.toString() ? `?${params.toString()}` : '';
    const response = await this.client.get(`${NODE_API_URL}/api/alm/${institutionId}/scenarios${qs}`);
    return response.data;
  }

  async getScenario(scenarioId: string) {
    const response = await this.client.get(`${NODE_API_URL}/api/alm/scenarios/${scenarioId}`);
    return response.data;
  }

  async compareScenarios(scenarioIds: string[]) {
    const response = await this.client.post(`${NODE_API_URL}/api/alm/scenarios/compare`, { scenarioIds });
    return response.data;
  }

  async duplicateScenario(scenarioId: string, name?: string) {
    const response = await this.client.post(`${NODE_API_URL}/api/alm/scenarios/${scenarioId}/duplicate`, { name });
    return response.data;
  }

  async deleteScenario(scenarioId: string) {
    const response = await this.client.post(`${NODE_API_URL}/api/alm/scenarios/${scenarioId}/delete`);
    return response.data;
  }

  // --- Yield Curve ---

  async getYieldCurveAnalysis(institutionId: string) {
    const response = await this.client.get(`${NODE_API_URL}/api/alm/${institutionId}/yield-curve-analysis`);
    return response.data;
  }

  async applyYieldCurveShocks(data: { curveId?: string; shockType: string; customShocks?: Record<string, number> }) {
    const response = await this.client.post(`${NODE_API_URL}/api/alm/yield-curve/shocks`, data);
    return response.data;
  }

  async saveCustomYieldCurve(data: {
    institutionId: string;
    name: string;
    tenors: Array<{ tenor: number; rate: number }>;
    source?: string;
  }) {
    const response = await this.client.post(`${NODE_API_URL}/api/alm/yield-curve/custom`, data);
    return response.data;
  }

  // --- CECL ---

  async getCECLAnalysis(institutionId: string) {
    const response = await this.client.get(`${NODE_API_URL}/api/alm/${institutionId}/cecl`);
    return response.data;
  }

  async importLoanSegments(institutionId: string, segments: any[]) {
    const response = await this.client.post(`${NODE_API_URL}/api/alm/${institutionId}/cecl/segments`, { segments });
    return response.data;
  }

  async getCECLForecast(institutionId: string) {
    const response = await this.client.get(`${NODE_API_URL}/api/alm/${institutionId}/cecl/forecast`);
    return response.data;
  }

  async runWARMCalculation(data: {
    segments: Array<{ segmentName: string; balance: number; weightedAvgMaturity: number; historicalLossRate: number; qualitativeAdj?: number }>;
    macroScenario?: string;
  }) {
    const response = await this.client.post(`${NODE_API_URL}/api/alm/cecl/warm`, data);
    return response.data;
  }

  // --- FTP ---

  async getFTPAnalysis(institutionId: string) {
    const response = await this.client.get(`${NODE_API_URL}/api/alm/${institutionId}/ftp`);
    return response.data;
  }

  async getFTPSegments(institutionId: string) {
    const response = await this.client.get(`${NODE_API_URL}/api/alm/${institutionId}/ftp/segments`);
    return response.data;
  }

  async runCustomFTP(institutionId: string, data: { curveId?: string; spreadAdjBps?: number }) {
    const response = await this.client.post(`${NODE_API_URL}/api/alm/${institutionId}/ftp/custom`, data);
    return response.data;
  }

  // --- Advanced Liquidity ---

  async getAdvancedLiquidity(institutionId: string) {
    const response = await this.client.get(`${NODE_API_URL}/api/alm/${institutionId}/liquidity-advanced`);
    return response.data;
  }

  // --- Concentration ---

  async getConcentrationAnalysis(institutionId: string) {
    const response = await this.client.get(`${NODE_API_URL}/api/alm/${institutionId}/concentration`);
    return response.data;
  }

  // --- NCUA Auto-Pull ---

  async pullNCUAData(charterNumber: string) {
    const response = await this.client.post(`${NODE_API_URL}/api/alm/ncua/pull`, { charterNumber });
    return response.data;
  }

  // --- Phase IV: AI Advisor v2 ---

  async getAdvisorNarrative(institutionId: string, lang: string = 'en') {
    const response = await this.client.get(`${NODE_API_URL}/api/alm/${institutionId}/advisor/narrative?lang=${lang}`);
    return response.data;
  }

  async getHealthScore(institutionId: string) {
    const response = await this.client.get(`${NODE_API_URL}/api/alm/${institutionId}/advisor/health-score`);
    return response.data;
  }

  // --- Phase IV: COSSEC Stress Pack ---

  async getStressPack(institutionId: string) {
    const response = await this.client.get(`${NODE_API_URL}/api/alm/${institutionId}/stress-pack`);
    return response.data;
  }

  // --- Phase IV: IRR Policy Engine ---

  async getIRRPolicyDashboard(institutionId: string) {
    const response = await this.client.get(`${NODE_API_URL}/api/alm/${institutionId}/irr-policy`);
    return response.data;
  }

  async getIRRPolicyLimits(institutionId: string) {
    const response = await this.client.get(`${NODE_API_URL}/api/alm/${institutionId}/irr-policy/limits`);
    return response.data;
  }

  async saveIRRPolicyLimits(institutionId: string, limits: any[]) {
    const response = await this.client.post(`${NODE_API_URL}/api/alm/${institutionId}/irr-policy/limits`, { limits });
    return response.data;
  }

  // --- Phase IV: Deposit Beta Benchmark ---

  async getDepositBetaBenchmark(institutionId: string) {
    const response = await this.client.get(`${NODE_API_URL}/api/alm/${institutionId}/deposit-beta/benchmark`);
    return response.data;
  }

  // --- Phase IV: Repricing Gap ---

  async getRepricingGap(institutionId: string) {
    const response = await this.client.get(`${NODE_API_URL}/api/alm/${institutionId}/repricing-gap`);
    return response.data;
  }

  // --- Phase IV: FTP Attribution ---

  async getFTPAttribution(institutionId: string) {
    const response = await this.client.get(`${NODE_API_URL}/api/alm/${institutionId}/ftp/attribution`);
    return response.data;
  }

  // --- Phase IV: Forward Simulation ---

  async runForwardSimulation(institutionId: string, config?: {
    horizon?: number;
    growthAssumptions?: Record<string, number>;
    ratePaths?: string[];
  }) {
    const response = await this.client.post(`${NODE_API_URL}/api/alm/${institutionId}/forward-simulation`, config ?? {});
    return response.data;
  }

  // --- Phase IV: Peer Analytics ---

  async getPeerAnalytics(institutionId: string) {
    const response = await this.client.get(`${NODE_API_URL}/api/alm/${institutionId}/peer-analytics`);
    return response.data;
  }

  // --- Phase V: OAS ---

  async getOASPortfolio(institutionId: string) {
    const response = await this.client.get(`${NODE_API_URL}/api/alm/${institutionId}/oas`);
    return response.data;
  }

  // --- Phase V: Credit Risk Quant ---

  async getCreditRisk(institutionId: string) {
    const response = await this.client.get(`${NODE_API_URL}/api/alm/${institutionId}/credit-risk`);
    return response.data;
  }

  // --- Phase V: VaR ---

  async getVaRSuite(institutionId: string, confidence: 95 | 99 = 95, horizon: 1 | 10 = 1) {
    const response = await this.client.get(`${NODE_API_URL}/api/alm/${institutionId}/var?confidence=${confidence}&horizon=${horizon}`);
    return response.data;
  }

  // --- Phase V: Capital Optimizer ---

  async optimizeCapital(institutionId: string, aggressiveness: 'conservative' | 'moderate' | 'aggressive' = 'moderate') {
    const response = await this.client.post(`${NODE_API_URL}/api/alm/${institutionId}/optimize`, { aggressiveness });
    return response.data;
  }

  // --- Phase V: Asset EWS ---

  async getAssetEWS(institutionId: string) {
    const response = await this.client.get(`${NODE_API_URL}/api/alm/${institutionId}/ews`);
    return response.data;
  }

  // --- Phase V: SOFR Exposure ---

  async getSOFRExposure(institutionId: string) {
    const response = await this.client.get(`${NODE_API_URL}/api/alm/${institutionId}/sofr-exposure`);
    return response.data;
  }

  // --- Phase V: Treasury Rates ---

  async getTreasuryRates() {
    const response = await this.client.get(`${NODE_API_URL}/api/alm/treasury/rates`);
    return response.data;
  }

  // --- V6+V7: Regulatory Alerts ---

  async getAlerts(institutionId: string, unreadOnly = false) {
    const qs = unreadOnly ? '?unreadOnly=true' : '';
    const response = await this.client.get(`${NODE_API_URL}/api/alm/${institutionId}/alerts${qs}`);
    return response.data;
  }

  // --- V6+V7: CAMEL Forecast ---

  async getCamelForecast(institutionId: string) {
    const response = await this.client.get(`${NODE_API_URL}/api/alm/${institutionId}/camel-forecast`);
    return response.data;
  }

  // --- V6+V7: Peer Synthesis ---

  async getPeerSynthesis() {
    const response = await this.client.get(`${NODE_API_URL}/api/alm/peer-synthesis/latest`);
    return response.data;
  }

  // --- V6+V7: DFAST Stress v2 ---

  async runStressV2(institutionId: string, scenarioId?: string) {
    const response = await this.client.post(`${NODE_API_URL}/api/alm/${institutionId}/stress-v2/run`, { scenarioId });
    return response.data;
  }

  async runAllStressV2(institutionId: string) {
    const response = await this.client.post(`${NODE_API_URL}/api/alm/${institutionId}/stress-v2/run-all`);
    return response.data;
  }

  // --- V6+V7: Robust Optimizer ---

  async robustOptimize(institutionId: string, aggressiveness?: string) {
    const response = await this.client.post(`${NODE_API_URL}/api/alm/${institutionId}/robust-optimize`, { aggressiveness });
    return response.data;
  }

  // --- V6+V7: Optionality Suite ---

  async getOptionality(institutionId: string) {
    const response = await this.client.get(`${NODE_API_URL}/api/alm/${institutionId}/optionality`);
    return response.data;
  }

  // --- V6+V7: Credit Concentration VaR ---

  async getConcentrationVaR(institutionId: string) {
    const response = await this.client.get(`${NODE_API_URL}/api/alm/${institutionId}/concentration-var`);
    return response.data;
  }

  // --- V6+V7: Demo Workspace ---

  async buildDemoWorkspace(charterNumber: string, demoLabel: string) {
    const response = await this.client.post(`${NODE_API_URL}/api/alm/demo/build`, { charterNumber, demoLabel });
    return response.data;
  }

  // --- V6+V7: Onboarding ---

  async getOnboardingStatus(institutionId: string) {
    const response = await this.client.get(`${NODE_API_URL}/api/alm/${institutionId}/onboarding`);
    return response.data;
  }

  // --- Sample Report Factory ---

  async generateSampleReport(charterNumber: string) {
    const response = await this.client.post(`${NODE_API_URL}/api/alm/sample-report`, { charterNumber }, { responseType: 'blob' });
    const blob = new Blob([response.data], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sample-alm-report-${charterNumber}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

export const apiClient = new APIClient();
