import {
  IntelligenceSourceFetchPolicy,
  IntelligenceSourceTrustLevel,
  IntelligenceSourceType,
} from './dto/intelligence.dto';

export interface AdapterSourceInput {
  id?: string;
  label?: string | null;
  url: string;
  sourceType: IntelligenceSourceType;
  fetchPolicy?: IntelligenceSourceFetchPolicy;
  trustLevel?: IntelligenceSourceTrustLevel;
  metadata?: Record<string, unknown> | null;
}

export interface AdapterAccountInput {
  id: string;
  kind: 'COMPETITOR' | 'BUYER';
  name: string;
  domain?: string | null;
  websiteUrl?: string | null;
  currentSummary?: string | null;
  institutionalType?: string | null;
}

export interface AdapterResult {
  summary: string;
  facts: Record<string, unknown>;
  rawMetadata: Record<string, unknown>;
  insights: Array<{
    type:
      | 'PRICING_CHANGE'
      | 'HIRING_SIGNAL'
      | 'REGULATORY_SIGNAL'
      | 'PRODUCT_SIGNAL'
      | 'URGENCY_SIGNAL'
      | 'THREAT_SIGNAL'
      | 'CONTACT_SIGNAL'
      | 'REFRESH_NOTE';
    severity: 'HIGH' | 'MEDIUM' | 'LOW';
    title: string;
    description: string;
    confidence: number;
  }>;
}

export interface IntelligenceSourceAdapter {
  supports(sourceType: IntelligenceSourceType): boolean;
  collect(
    account: AdapterAccountInput,
    source: AdapterSourceInput,
  ): Promise<AdapterResult>;
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function extractTag(html: string, pattern: RegExp): string | null {
  const match = html.match(pattern);
  return match?.[1] ? collapseWhitespace(match[1]) : null;
}

export function extractHtmlMetadata(html: string) {
  return {
    title: extractTag(html, /<title[^>]*>([^<]+)<\/title>/i),
    description:
      extractTag(
        html,
        /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i,
      ) ||
      extractTag(
        html,
        /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i,
      ),
    h1: extractTag(html, /<h1[^>]*>([^<]+)<\/h1>/i),
  };
}

export class ManualUploadAdapter implements IntelligenceSourceAdapter {
  supports(sourceType: IntelligenceSourceType): boolean {
    return (
      sourceType === 'MANUAL_UPLOAD' ||
      sourceType === 'INTERNAL_NOTE' ||
      sourceType === 'ENRICHMENT_API'
    );
  }

  async collect(
    account: AdapterAccountInput,
    source: AdapterSourceInput,
  ): Promise<AdapterResult> {
    const summary =
      typeof source.metadata?.summary === 'string'
        ? source.metadata.summary
        : `Manual intelligence update captured for ${account.name}.`;

    return {
      summary,
      facts: {
        sourceLabel: source.label || source.sourceType,
        domain: account.domain || null,
        websiteUrl: account.websiteUrl || source.url,
        ...source.metadata,
      },
      rawMetadata: {
        adapter: 'manual',
        sourceType: source.sourceType,
        metadata: source.metadata || {},
      },
      insights: [
        {
          type: 'REFRESH_NOTE',
          severity: 'LOW',
          title: `${account.name} manual note updated`,
          description: summary,
          confidence: 0.9,
        },
      ],
    };
  }
}

export class PublicWebAdapter implements IntelligenceSourceAdapter {
  supports(sourceType: IntelligenceSourceType): boolean {
    return (
      sourceType === 'PUBLIC_WEBSITE' ||
      sourceType === 'OFFICIAL_REGISTRY' ||
      sourceType === 'PRICING_PAGE' ||
      sourceType === 'DOCUMENT'
    );
  }

  async collect(
    account: AdapterAccountInput,
    source: AdapterSourceInput,
  ): Promise<AdapterResult> {
    const response = await fetch(source.url, {
      headers: {
        'user-agent': 'CERNIQ Intelligence Bot/1.0 (+https://cerniq.io)',
      },
    });
    const html = await response.text();
    const metadata = extractHtmlMetadata(html);
    const textSnippet = collapseWhitespace(
      html
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .slice(0, 1200),
    );

    const summaryParts = [
      metadata.title || account.name,
      metadata.description || metadata.h1 || textSnippet.slice(0, 180),
    ].filter(Boolean);

    const summary = summaryParts.join(' — ').slice(0, 400);
    const insights: AdapterResult['insights'] = [
      {
        type:
          account.kind === 'COMPETITOR' && source.sourceType === 'PRICING_PAGE'
            ? 'PRICING_CHANGE'
            : account.kind === 'COMPETITOR'
              ? 'THREAT_SIGNAL'
              : 'URGENCY_SIGNAL',
        severity:
          account.kind === 'COMPETITOR' && source.sourceType === 'PRICING_PAGE'
            ? 'HIGH'
            : 'MEDIUM',
        title: `${account.name} source refreshed`,
        description: summary,
        confidence: 0.72,
      },
    ];

    if (source.sourceType === 'OFFICIAL_REGISTRY') {
      insights.push({
        type: 'REGULATORY_SIGNAL',
        severity: 'MEDIUM',
        title: `${account.name} registry information updated`,
        description: `Official registry source refreshed from ${source.url}.`,
        confidence: 0.78,
      });
    }

    return {
      summary,
      facts: {
        pageTitle: metadata.title,
        pageDescription: metadata.description,
        heading: metadata.h1,
        snippet: textSnippet.slice(0, 500),
        url: source.url,
        httpStatus: response.status,
      },
      rawMetadata: {
        adapter: 'public-web',
        sourceType: source.sourceType,
        status: response.status,
      },
      insights,
    };
  }
}

export const intelligenceAdapters: IntelligenceSourceAdapter[] = [
  new ManualUploadAdapter(),
  new PublicWebAdapter(),
];
