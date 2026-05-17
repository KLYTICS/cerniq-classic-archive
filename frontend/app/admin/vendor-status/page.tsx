'use client';

/**
 * /admin/vendor-status — KLYTICS vendor registry, rendered.
 *
 * Single-page operator/engineering tool for seeing every financial vendor
 * cerniq integrates with or plans to integrate with: name, category,
 * status (planned / scaffold / beta / production), compliance posture,
 * integration cost, and what's blocking forward progress for each.
 *
 * Backed by /api/vendors/by-category — pure metadata, no secrets. The
 * registry source-of-truth lives in backend-node/src/vendor/registry.ts.
 *
 * Why this page exists:
 *   - Engineering: at-a-glance map of "what's actually wired" vs "what we
 *     said we'd wire" vs "what we haven't even started."
 *   - Operator: when a card on the ALM market-rates page returns a
 *     DataGap, this page explains why (which env vars are missing,
 *     which contract is pending).
 *   - Future Claude sessions: a chip-away surface — promote a vendor
 *     from 'scaffold' to 'beta' to 'production' as integrations land.
 */

import { useEffect, useState } from 'react';

import { getConfiguredApiOrigin } from '@/lib/api-base';

type VendorStatus = 'planned' | 'scaffold' | 'beta' | 'production';
type VendorCompliancePosture =
  | 'public'
  | 'free-tier'
  | 'paid-self'
  | 'paid-enterprise'
  | 'regulator'
  | 'core-banking';
type VendorCategory =
  | 'market-data'
  | 'macro-rates'
  | 'filings'
  | 'core-banking'
  | 'regulator-filing'
  | 'aml-kyc'
  | 'identity'
  | 'payments'
  | 'esg'
  | 'peer-data';

interface VendorEntry {
  id: string;
  name: string;
  description: string;
  category: VendorCategory;
  status: VendorStatus;
  compliancePosture: VendorCompliancePosture;
  integrationCostDays: number;
  url: string;
  providerPath?: string;
  envVars: string[];
  blockedBy?: string;
  prCooperativaRelevance: string;
}

interface ByCategoryResponse {
  count: number;
  statusCounts: Record<VendorStatus, number>;
  byCategory: Record<VendorCategory, VendorEntry[]>;
}

const CATEGORY_LABELS: Record<VendorCategory, string> = {
  'market-data': 'Market Data',
  'macro-rates': 'Macro Rates',
  filings: 'Filings',
  'core-banking': 'Core Banking',
  'regulator-filing': 'Regulator Filing',
  'aml-kyc': 'AML / KYC',
  identity: 'Identity',
  payments: 'Payments',
  esg: 'ESG',
  'peer-data': 'Peer Data',
};

const STATUS_STYLES: Record<VendorStatus, string> = {
  production: 'border-emerald-500 bg-emerald-950/40 text-emerald-300',
  beta: 'border-sky-500 bg-sky-950/40 text-sky-300',
  scaffold: 'border-amber-500 bg-amber-950/40 text-amber-300',
  planned: 'border-zinc-700 bg-zinc-950 text-zinc-500',
};

export default function VendorStatusPage(): JSX.Element {
  const [data, setData] = useState<ByCategoryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const base = getConfiguredApiOrigin();
        const url = base
          ? `${base}/api/vendors/by-category`
          : '/api/vendors/by-category';
        const response = await fetch(url, {
          signal: controller.signal,
          credentials: 'include',
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const body = (await response.json()) as ByCategoryResponse;
        if (!controller.signal.aborted) {
          setData(body);
          setLoading(false);
        }
      } catch (err: unknown) {
        // type-rationale: fetch error shape is unknown by spec; we narrow defensively
        if ((err as { name?: string } | null)?.name === 'AbortError') return;
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : String(err));
          setLoading(false);
        }
      }
    })();
    return () => controller.abort();
  }, []);

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 font-mono text-sm text-zinc-100">
      <header className="mb-6 border-b border-zinc-800 pb-4">
        <h1 className="text-lg font-semibold text-zinc-100">
          KLYTICS Vendor Registry
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-zinc-400">
          Every financial vendor cerniq integrates with or plans to integrate
          with. Status, compliance posture, integration cost, and blockers
          for each. Source of truth:{' '}
          <code className="text-zinc-200">
            backend-node/src/vendor/registry.ts
          </code>
          .
        </p>
      </header>

      {loading && (
        <div className="h-32 animate-pulse rounded bg-zinc-900" aria-label="loading" />
      )}
      {error && (
        <p className="text-rose-300" role="alert">
          error loading vendor registry: {error}
        </p>
      )}
      {data && (
        <>
          <StatusSummary
            statusCounts={data.statusCounts}
            total={data.count}
          />
          <div className="mt-6 space-y-6">
            {Object.entries(data.byCategory).map(([cat, vendors]) => (
              <CategorySection
                key={cat}
                category={cat as VendorCategory}
                vendors={vendors}
              />
            ))}
          </div>
        </>
      )}
    </main>
  );
}

function StatusSummary({
  statusCounts,
  total,
}: {
  statusCounts: Record<VendorStatus, number>;
  total: number;
}): JSX.Element {
  return (
    <section
      aria-label="vendor status summary"
      className="grid grid-cols-2 gap-2 sm:grid-cols-4"
    >
      {(['production', 'beta', 'scaffold', 'planned'] as const).map((s) => (
        <div
          key={s}
          className={`rounded border ${STATUS_STYLES[s]} p-3`}
        >
          <p className="text-[10px] uppercase tracking-wider">{s}</p>
          <p className="mt-1 text-2xl">{statusCounts[s]}</p>
          <p className="text-[10px] text-zinc-500">
            of {total}
          </p>
        </div>
      ))}
    </section>
  );
}

function CategorySection({
  category,
  vendors,
}: {
  category: VendorCategory;
  vendors: VendorEntry[];
}): JSX.Element {
  return (
    <section aria-label={`${category} vendors`}>
      <h2 className="mb-2 text-xs uppercase tracking-wider text-zinc-500">
        {CATEGORY_LABELS[category]} ({vendors.length})
      </h2>
      <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
        {vendors.map((v) => (
          <VendorCard key={v.id} vendor={v} />
        ))}
      </div>
    </section>
  );
}

function VendorCard({ vendor }: { vendor: VendorEntry }): JSX.Element {
  return (
    <article
      className="rounded border border-zinc-800 bg-zinc-950 p-3"
      aria-label={vendor.name}
    >
      <header className="flex items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold text-zinc-100">{vendor.name}</h3>
          <p className="mt-0.5 text-[10px] text-zinc-600">{vendor.id}</p>
        </div>
        <span
          className={`rounded border px-2 py-0.5 text-[10px] uppercase tracking-wider ${STATUS_STYLES[vendor.status]}`}
        >
          {vendor.status}
        </span>
      </header>
      <p className="mt-2 text-xs text-zinc-300">{vendor.description}</p>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-[10px]">
        <dt className="text-zinc-500">posture</dt>
        <dd className="text-zinc-300">{vendor.compliancePosture}</dd>
        <dt className="text-zinc-500">cost</dt>
        <dd className="text-zinc-300">{vendor.integrationCostDays}d</dd>
        {vendor.envVars.length > 0 && (
          <>
            <dt className="text-zinc-500">env</dt>
            <dd className="font-mono text-zinc-400">
              {vendor.envVars.join(', ')}
            </dd>
          </>
        )}
        {vendor.providerPath && (
          <>
            <dt className="text-zinc-500">path</dt>
            <dd className="font-mono text-zinc-400">
              {vendor.providerPath}
            </dd>
          </>
        )}
      </dl>
      {vendor.blockedBy && (
        <p className="mt-2 border-l-2 border-amber-500 pl-2 text-[11px] text-amber-200">
          blocked: {vendor.blockedBy}
        </p>
      )}
      <p className="mt-2 text-[11px] italic text-zinc-400">
        {vendor.prCooperativaRelevance}
      </p>
      <a
        href={vendor.url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-block text-[10px] uppercase tracking-wider text-zinc-500 hover:text-zinc-200"
      >
        vendor →
      </a>
    </article>
  );
}
