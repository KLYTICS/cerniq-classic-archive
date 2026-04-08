'use client';

import { useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';

import { useTranslation } from '@/lib/i18n';
import { AlmPage } from '@/components/alm/AlmPage';
import { MetricStrip, type MetricStripItem } from '@/components/density/MetricStrip';

interface LossPoint {
  readonly loss: number;
  readonly gaussian: number;
  readonly tCopula: number;
}

interface CopulaResult {
  readonly gaussianVaR: number;
  readonly tCopulaVaR: number;
  readonly tailDependence: number;
  readonly degreesOfFreedom: number;
  readonly portfolioCorrelation: number;
  readonly lossDistribution: readonly LossPoint[];
  readonly tailComparison: {
    readonly gaussianP99: number;
    readonly tCopulaP99: number;
    readonly excessRatio: number;
  };
}

function validateCopula(raw: unknown): CopulaResult {
  if (!raw || typeof raw !== 'object') throw new Error('Copula response must be an object');
  const r = raw as Record<string, unknown>;
  if (typeof r.gaussianVaR !== 'number') throw new Error('Copula: missing gaussianVaR');
  if (typeof r.tCopulaVaR !== 'number') throw new Error('Copula: missing tCopulaVaR');
  if (!Array.isArray(r.lossDistribution)) throw new Error('Copula: lossDistribution must be array');
  return r as unknown as CopulaResult;
}

function getDemo(): CopulaResult {
  const buckets = 30;
  return {
    gaussianVaR: 8.2,
    tCopulaVaR: 12.6,
    tailDependence: 0.342,
    degreesOfFreedom: 5,
    portfolioCorrelation: 0.28,
    lossDistribution: Array.from({ length: buckets }, (_, i) => {
      const loss = i * 0.8;
      const center = 6;
      const gauss = Math.exp(-0.5 * ((loss - center) / 2.5) ** 2) * 400;
      const tCop  = Math.exp(-0.5 * ((loss - center) / 2.8) ** 2) * 380 + (loss > 10 ? 40 * Math.exp(-0.2 * (loss - 10)) : 0);
      return { loss: +loss.toFixed(1), gaussian: Math.round(gauss), tCopula: Math.round(tCop) };
    }),
    tailComparison: { gaussianP99: 8.2, tCopulaP99: 12.6, excessRatio: 1.54 },
  };
}

function CopulaContent({ data }: { data: CopulaResult }) {
  const { locale } = useTranslation();
  const excessPct = ((data.tailComparison.excessRatio - 1) * 100).toFixed(0);

  const stripItems = useMemo<readonly MetricStripItem[]>(() => [
    { key: 'gaussian_var',    label: 'VaR Gaussian',    value: data.gaussianVaR, unit: 'USD_M' },
    { key: 't_copula_var',    label: 'VaR t-Copula',    value: data.tCopulaVaR,  unit: 'USD_M' },
    { key: 'tail_dependence', label: locale === 'es' ? 'Dep. Cola' : 'Tail Dep.', value: data.tailDependence, unit: 'ratio' },
    { key: 'df',              label: locale === 'es' ? 'ν (Grados)' : 'ν (DoF)',   value: data.degreesOfFreedom, unit: 'count' },
    { key: 'correlation',     label: locale === 'es' ? 'Correlación' : 'Correlation', value: data.portfolioCorrelation, unit: 'ratio' },
    { key: 'excess_ratio',    label: locale === 'es' ? 'Ratio Exceso' : 'Excess Ratio', value: data.tailComparison.excessRatio, unit: 'x' },
  ], [data, locale]);

  return (
    <>
      <MetricStrip items={stripItems} locale={locale} density="compact" />

      {/* Loss distribution chart */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          {locale === 'es' ? 'Distribución de Pérdidas — Gaussian vs t-Copula' : 'Loss Distribution — Gaussian vs t-Copula'}
        </p>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={data.lossDistribution as LossPoint[]}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="loss" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}M`} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="gaussian" name="Gaussian Copula"               stroke="#94a3b8" strokeWidth={2}   dot={false} />
            <Line type="monotone" dataKey="tCopula"  name={`t-Copula (ν=${data.degreesOfFreedom})`} stroke="#ec4899" strokeWidth={2.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </section>

      {/* Model risk commentary */}
      <section className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
        <p className="mb-1 text-xs font-bold text-amber-800">
          {locale === 'es' ? 'Riesgo de Modelo — Dependencia de Cola' : 'Model Risk — Tail Dependence'}
        </p>
        <p className="text-[11px] leading-relaxed text-amber-700">
          {locale === 'es'
            ? `La copula Gaussiana subestima las pérdidas conjuntas extremas en ${excessPct}%. La copula t-Student con ν=${data.degreesOfFreedom} captura la dependencia de cola (λ=${data.tailDependence.toFixed(3)}), crucial para evaluar riesgo sistémico de crédito en portafolios concentrados.`
            : `Gaussian copula underestimates joint extreme losses by ${excessPct}%. The t-copula with ν=${data.degreesOfFreedom} captures tail dependence (λ=${data.tailDependence.toFixed(3)}), crucial for assessing systemic credit risk in concentrated portfolios.`}
        </p>
      </section>
    </>
  );
}

export default function CopulaCreditPage() {
  return (
    <AlmPage<CopulaResult>
      slug="copula-credit"
      iconTint="rose"
      method="POST"
      body={{}}
      validate={validateCopula}
      getDemo={getDemo}
    >
      {(data) => <CopulaContent data={data} />}
    </AlmPage>
  );
}
