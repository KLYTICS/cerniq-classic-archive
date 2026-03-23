import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://cerniq.io';
  const now = new Date().toISOString();

  const publicPages = [
    { url: base, lastModified: now, changeFrequency: 'weekly' as const, priority: 1.0 },
    { url: `${base}/pricing`, lastModified: now, changeFrequency: 'weekly' as const, priority: 0.9 },
    { url: `${base}/demo`, lastModified: now, changeFrequency: 'monthly' as const, priority: 0.9 },
    { url: `${base}/why-cerniq`, lastModified: now, changeFrequency: 'monthly' as const, priority: 0.8 },
    { url: `${base}/compliance`, lastModified: now, changeFrequency: 'monthly' as const, priority: 0.8 },
    { url: `${base}/case-studies`, lastModified: now, changeFrequency: 'monthly' as const, priority: 0.8 },
    { url: `${base}/roi`, lastModified: now, changeFrequency: 'monthly' as const, priority: 0.7 },
    { url: `${base}/developers`, lastModified: now, changeFrequency: 'monthly' as const, priority: 0.7 },
    { url: `${base}/changelog`, lastModified: now, changeFrequency: 'weekly' as const, priority: 0.6 },
    { url: `${base}/login`, lastModified: now, changeFrequency: 'yearly' as const, priority: 0.5 },
    { url: `${base}/status`, lastModified: now, changeFrequency: 'daily' as const, priority: 0.3 },
  ];

  const almModules = [
    '', 'modules', 'sensitivity', 'yield-curve', 'repricing-gap', 'liquidity',
    'cecl', 'concentration', 'monte-carlo', 'var', 'oas', 'ftp',
    'capital-optimizer', 'nim-attribution', 'forward-sim', 'exam-prep',
    'irr-policy', 'peer-analytics', 'climate-risk', 'stress-v2',
    'black-litterman', 'cvar-optimizer', 'hrp', 'credit-metrics',
    'kmv-merton', 'pca-yield-curve', 'frtb-ima', 'fed-futures',
    'copula-credit', 'wrong-way-risk', 'cap-floor', 'rbc2', 'macro-factors',
    'behavioral-duration', 'deposit-beta', 'board-report',
  ].map(slug => ({
    url: `${base}/alm${slug ? `/${slug}` : ''}`,
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: 0.6,
  }));

  return [...publicPages, ...almModules];
}
