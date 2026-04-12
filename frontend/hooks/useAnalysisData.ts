'use client';

import { useCallback, useEffect, useState } from 'react';
import { getPublicApiUrl } from '@/lib/api-base';
import { unwrapApiData } from '@/lib/api-response';

export interface BalanceSheetBreakdown {
  subcategory: string;
  total: number;
  count: number;
}

export interface BalanceSheetItemData {
  category: string;
  subcategory: string;
  name: string;
  balance: number;
  rate: number;
  duration: number;
  rateType: string;
}

export interface RateScenario {
  name: string;
  shiftBps: number;
  niImpact: number;
  mveImpact: number;
}

export interface ComplianceRatio {
  id: string;
  nameEn: string;
  nameEs: string;
  value: number;
  threshold?: number;
  thresholdLow?: number;
  thresholdHigh?: number;
  sectorMedian: number;
  format: 'percent' | 'years';
  invertThreshold?: boolean;
}

export interface AnalysisData {
  institution: {
    name: string;
    type: string;
    totalAssets: number;
    currency: string;
    reportingDate: string | null;
    cossecNumber: string | null;
  } | null;
  balanceSheet: {
    totalAssets: number;
    totalLiabilities: number;
    totalEquity: number;
    items: BalanceSheetItemData[];
    assetBreakdown: BalanceSheetBreakdown[];
    liabilityBreakdown: BalanceSheetBreakdown[];
  } | null;
  interestRateRisk: {
    durationGap: number;
    assetDuration: number;
    liabilityDuration: number;
    nim: number;
    earningAssetYield: number;
    costOfFunds: number;
    scenarios: RateScenario[];
  } | null;
  liquidity: {
    lcr: number;
    nsfr: number;
    hqlaLevel1: number;
    hqlaLevel2: number;
    hqlaTotal: number;
    cashOutflows: number;
    cashInflows: number;
    loanToDeposit: number;
  } | null;
  compliance: {
    ratios: ComplianceRatio[];
  } | null;
  analysisRun: {
    resultSummary: unknown;
    completedAt: string | null;
    modelVersion: string;
  } | null;
  jobMeta: {
    status: string;
    analysisPeriod: string | null;
    triggeredBy: string;
    completedAt: string | null;
  } | null;
}

export function useAnalysisData(jobId: string | null | undefined) {
  const [data, setData] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(Boolean(jobId));
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!jobId) {
      setData(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        getPublicApiUrl(`/api/portal/jobs/${jobId}/analysis-data`),
        { credentials: 'include', cache: 'no-store' },
      );
      if (!res.ok) {
        throw new Error('Could not load analysis data.');
      }
      const payload = unwrapApiData<AnalysisData | null>(
        await res.json().catch(() => null),
      );
      setData(payload);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not load analysis data.',
      );
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, loading, error, reload: load };
}
