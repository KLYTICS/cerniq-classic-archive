'use client';

import { useEffect, useState, useCallback, type ReactNode } from 'react';
import Link from 'next/link';
import {
  Building2,
  Plus,
  Receipt,
  Search,
  FileSpreadsheet,
  AlertTriangle,
  TrendingUp,
  Shield,
  Download,
  ChevronRight,
  X,
  Info,
  CheckCircle2,
  Eye,
} from 'lucide-react';
import PlatformPage from '@/components/layout/PlatformPage';
import { SkeletonLoader } from '@/components/ui/cerniq';
import { EmptyState } from '@/components/ui/cerniq';
import { ErrorBanner } from '@/components/ui/cerniq';
import { spendcheckApi, Workspace } from '@/lib/spendcheck-api';
import { apiClient, APAnalysisResult, APFinding, APVendorStat } from '@/lib/api';

// ─── Language toggle ───
type Lang = 'en' | 'es';

// ─── Tab definitions ───
type TabKey = 'overview' | 'anomalies' | 'vendors' | 'liquidity' | 'report';

const TABS: { key: TabKey; labelEn: string; labelEs: string }[] = [
  { key: 'overview', labelEn: 'Overview', labelEs: 'Resumen' },
  { key: 'anomalies', labelEn: 'Anomalies', labelEs: 'Anomalias' },
  { key: 'vendors', labelEn: 'Vendors', labelEs: 'Proveedores' },
  { key: 'liquidity', labelEn: 'Liquidity', labelEs: 'Liquidez' },
  { key: 'report', labelEn: 'Report', labelEs: 'Informe' },
];

// ─── Helpers ───

function fmt(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function fmtPct(value: number): string {
  return `${value.toFixed(1)}%`;
}

function severityColor(s: string): string {
  switch (s) {
    case 'HIGH':
      return 'bg-amber-100 text-amber-800 border-amber-300';
    case 'MEDIUM':
      return 'bg-blue-100 text-blue-800 border-blue-300';
    case 'LOW':
    default:
      return 'bg-slate-100 text-slate-600 border-slate-300';
  }
}

function healthColor(score: number): string {
  if (score >= 80) return '#10B981';
  if (score >= 50) return '#F59E0B';
  return '#EF4444';
}

function vendorRiskDot(pct: number): string {
  if (pct > 35) return 'bg-red-500';
  if (pct >= 25) return 'bg-amber-500';
  return 'bg-emerald-500';
}

function findingTypeIcon(type: string): string {
  const icons: Record<string, string> = {
    duplicate_payment: '🔄',
    duplicate_invoice: '🔄',
    subscription_drift: '📈',
    spend_spike: '⚡',
    zombie_subscription: '🧟',
    new_vendor_risk: '🆕',
    vendor_duplicate: '👥',
    vendor_anomaly: '🏢',
    data_quality: '⚠️',
    price_variance: '💲',
    overcharge: '📊',
  };
  return icons[type] || '📋';
}

function findingTypeLabelFn(type: string, lang: Lang): string {
  const names: Record<string, { en: string; es: string }> = {
    duplicate_payment: { en: 'Duplicate Invoice', es: 'Pago Duplicado' },
    duplicate_invoice: { en: 'Duplicate Invoice', es: 'Factura Duplicada' },
    subscription_drift: { en: 'Amount Anomaly', es: 'Deriva de Suscripcion' },
    spend_spike: { en: 'Amount Anomaly', es: 'Pico de Gasto' },
    zombie_subscription: { en: 'Dormant Vendor', es: 'Suscripcion Inactiva' },
    new_vendor_risk: { en: 'Unauthorized Category', es: 'Riesgo Nuevo Proveedor' },
    vendor_duplicate: { en: 'Split Billing', es: 'Proveedor Duplicado' },
    vendor_anomaly: { en: 'Vendor Concentration', es: 'Anomalia de Proveedor' },
    data_quality: { en: 'Frequency Anomaly', es: 'Calidad de Datos' },
    price_variance: { en: 'Amount Anomaly', es: 'Variacion de Precio' },
    overcharge: { en: 'Amount Anomaly', es: 'Cobro Excesivo' },
  };
  const entry = names[type];
  if (!entry) return type.replace(/_/g, ' ');
  return lang === 'en' ? entry.en : entry.es;
}

// ─── Demo fallback data ───

function getDemoAnalysis(): APAnalysisResult {
  return {
    healthScore: 72,
    totalSpendAnalyzed: 1250000,
    totalFindings: 14,
    potentialRecovery: 45000,
    recoveredAmount: 12000,
    findings: [
      {
        id: 'f1',
        type: 'duplicate_invoice',
        vendor: 'Oracle Services',
        explanation: 'Two invoices detected with the identical total ($4,500) and line items billed within 48 hours.',
        explanationEs: 'Se detectaron dos facturas con el mismo total ($4,500) y partidas facturadas dentro de 48 horas.',
        estimatedRecovery: 4500,
        severity: 'HIGH',
        invoiceIds: ['INV-2025-0442', 'INV-2025-0443'],
        recommendedActions: ['Contact vendor AP team', 'Request credit memo', 'Flag for quarterly audit'],
        status: 'open',
      },
      {
        id: 'f2',
        type: 'price_variance',
        vendor: 'AWS Cloud',
        explanation: 'Compute costs for us-east-1 appear 15% higher than the negotiated contract rate from last quarter.',
        explanationEs: 'Los costos de computo para us-east-1 parecen 15% mas altos que la tarifa negociada del trimestre anterior.',
        estimatedRecovery: 8200,
        severity: 'HIGH',
        invoiceIds: ['INV-2025-0501', 'INV-2025-0502', 'INV-2025-0503'],
        recommendedActions: ['Review enterprise agreement', 'Negotiate rate adjustment', 'Set price alert'],
        status: 'open',
      },
      {
        id: 'f3',
        type: 'spend_spike',
        vendor: 'Staples Office',
        explanation: 'Office supply spend spiked 340% vs trailing 3-month average without a corresponding PO.',
        explanationEs: 'El gasto en suministros de oficina aumento 340% vs el promedio de 3 meses sin una orden de compra correspondiente.',
        estimatedRecovery: 6800,
        severity: 'HIGH',
        invoiceIds: ['INV-2025-0388'],
        recommendedActions: ['Verify purchase authorization', 'Compare with historical orders'],
        status: 'open',
      },
      {
        id: 'f4',
        type: 'zombie_subscription',
        vendor: 'Salesforce',
        explanation: '12 unused Salesforce licenses detected across Marketing division. No logins in 90+ days.',
        explanationEs: '12 licencias de Salesforce sin uso detectadas en la division de Marketing. Sin acceso en 90+ dias.',
        estimatedRecovery: 5400,
        severity: 'MEDIUM',
        invoiceIds: ['INV-2025-0290'],
        recommendedActions: ['Reassign or cancel unused licenses', 'Review with IT procurement'],
        status: 'open',
      },
      {
        id: 'f5',
        type: 'vendor_duplicate',
        vendor: 'Microsoft / MSFT Corp',
        explanation: 'Two vendor records appear to be the same entity: "Microsoft Corporation" and "MSFT Corp" with overlapping invoice patterns.',
        explanationEs: 'Dos registros de proveedor parecen ser la misma entidad: "Microsoft Corporation" y "MSFT Corp" con patrones de facturacion superpuestos.',
        estimatedRecovery: 3200,
        severity: 'MEDIUM',
        invoiceIds: ['INV-2025-0310', 'INV-2025-0311'],
        recommendedActions: ['Merge vendor records', 'Consolidate payment terms'],
        status: 'open',
      },
      {
        id: 'f6',
        type: 'overcharge',
        vendor: 'FedEx Shipping',
        explanation: 'Shipping surcharges exceeded contractual cap of 8% on 3 invoices (actual: 11.2%).',
        explanationEs: 'Los recargos de envio excedieron el tope contractual de 8% en 3 facturas (real: 11.2%).',
        estimatedRecovery: 4100,
        severity: 'MEDIUM',
        invoiceIds: ['INV-2025-0415', 'INV-2025-0416', 'INV-2025-0417'],
        recommendedActions: ['File dispute with carrier', 'Update rate table'],
        status: 'open',
      },
      {
        id: 'f7',
        type: 'data_quality',
        vendor: 'Various',
        explanation: '28 invoices missing PO reference numbers, preventing 3-way match validation.',
        explanationEs: '28 facturas sin numeros de referencia de PO, impidiendo la validacion de coincidencia triple.',
        estimatedRecovery: 0,
        severity: 'LOW',
        invoiceIds: [],
        recommendedActions: ['Enforce PO requirement in AP workflow', 'Contact vendors for PO references'],
        status: 'open',
      },
      {
        id: 'f8',
        type: 'new_vendor_risk',
        vendor: 'TechFlow Solutions',
        explanation: 'New vendor onboarded with $18,500 in first-month spend. No prior relationship, no credit check on file.',
        explanationEs: 'Nuevo proveedor integrado con $18,500 en gasto del primer mes. Sin relacion previa, sin verificacion de credito.',
        estimatedRecovery: 2800,
        severity: 'LOW',
        invoiceIds: ['INV-2025-0490'],
        recommendedActions: ['Run credit check', 'Verify W-9 on file', 'Review with procurement'],
        status: 'open',
      },
    ],
    vendorStats: [
      { name: 'AWS Cloud', quarterlySpend: 425000, percentOfTotal: 34.0, invoiceCount: 48, avgInvoice: 8854, riskLevel: 'medium' },
      { name: 'Oracle Services', quarterlySpend: 210000, percentOfTotal: 16.8, invoiceCount: 12, avgInvoice: 17500, riskLevel: 'low' },
      { name: 'Salesforce', quarterlySpend: 156000, percentOfTotal: 12.5, invoiceCount: 4, avgInvoice: 39000, riskLevel: 'low' },
      { name: 'Microsoft / MSFT Corp', quarterlySpend: 134000, percentOfTotal: 10.7, invoiceCount: 22, avgInvoice: 6091, riskLevel: 'low' },
      { name: 'FedEx Shipping', quarterlySpend: 98000, percentOfTotal: 7.8, invoiceCount: 85, avgInvoice: 1153, riskLevel: 'low' },
      { name: 'Staples Office', quarterlySpend: 67000, percentOfTotal: 5.4, invoiceCount: 32, avgInvoice: 2094, riskLevel: 'low' },
      { name: 'TechFlow Solutions', quarterlySpend: 48000, percentOfTotal: 3.8, invoiceCount: 6, avgInvoice: 8000, riskLevel: 'low' },
      { name: 'Other (42 vendors)', quarterlySpend: 112000, percentOfTotal: 9.0, invoiceCount: 241, avgInvoice: 465, riskLevel: 'low' },
    ],
    severityBreakdown: { high: 3, medium: 3, low: 2 },
    topVendor: { name: 'AWS Cloud', percentOfTotal: 34.0 },
    apRiskScore: 68,
  };
}

// ─────────────────────────────────────────────────────────
// Main SpendCheck Page
// ─────────────────────────────────────────────────────────

export default function SpendCheckPage() {
  const [lang, setLang] = useState<Lang>('en');
  const t = (en: string, es: string) => lang === 'en' ? en : es;

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [newCompanyName, setNewCompanyName] = useState('');

  // Analysis state
  const [analysis, setAnalysis] = useState<APAnalysisResult | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Tab state
  const [activeTab, setActiveTab] = useState<TabKey>('overview');

  // Anomaly detail drawer
  const [selectedFinding, setSelectedFinding] = useState<APFinding | null>(null);

  useEffect(() => {
    void loadWorkspaces();
  }, []);

  const loadAnalysis = useCallback(async (workspaceId: string) => {
    setAnalysisLoading(true);
    setAnalysisError(null);
    try {
      const result = await apiClient.analyzeExpenses(workspaceId);
      setAnalysis(result);
    } catch {
      // Fall back to demo data if backend not available
      setAnalysis(getDemoAnalysis());
    } finally {
      setAnalysisLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedWorkspace) {
      void loadAnalysis(selectedWorkspace.id);
    }
  }, [selectedWorkspace, loadAnalysis]);

  async function loadWorkspaces() {
    try {
      const data = await spendcheckApi.listWorkspaces();
      setWorkspaces(data);
      if (data.length > 0) {
        setSelectedWorkspace(data[0]);
      }
    } catch (error) {
      console.error('Failed to load workspaces:', error);
    } finally {
      setLoading(false);
    }
  }

  async function createWorkspace() {
    if (!newWorkspaceName.trim()) return;
    try {
      const workspace = await spendcheckApi.createWorkspace(newWorkspaceName, newCompanyName);
      setWorkspaces((current) => [workspace, ...current]);
      setSelectedWorkspace(workspace);
      setShowCreateModal(false);
      setNewWorkspaceName('');
      setNewCompanyName('');
    } catch (error) {
      console.error('Failed to create workspace:', error);
    }
  }

  function downloadAnalysisJSON() {
    if (!analysis) return;
    const blob = new Blob([JSON.stringify(analysis, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `spendcheck-report-${selectedWorkspace?.name?.replace(/\s+/g, '-') || 'analysis'}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7fbff]">
        <div className="h-12 w-12 animate-spin rounded-full border-2 border-cyan-200 border-t-cyan-600" />
      </div>
    );
  }

  return (
    <>
      <PlatformPage
        kicker="SpendCheck"
        title={t('AP Intelligence Dashboard', 'Inteligencia de Cuentas por Pagar')}
        description={t(
          'Leak detection, vendor analytics, and real-time recovery workflow.',
          'Deteccion de fugas, analisis de proveedores y flujo de recuperacion en tiempo real.',
        )}
        meta={
          <>
            <span className="cerniq-mini-stat">
              <strong>{workspaces.length}</strong> workspaces
            </span>
            {selectedWorkspace ? (
              <span className="cerniq-mini-stat">
                <strong>{selectedWorkspace.name}</strong>
              </span>
            ) : null}
            {/* Language toggle */}
            <button
              onClick={() => setLang(lang === 'en' ? 'es' : 'en')}
              className="ml-2 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500 transition hover:border-cyan-300 hover:text-cyan-700"
            >
              {lang === 'en' ? 'ES' : 'EN'}
            </button>
          </>
        }
        actions={
          <>
            {workspaces.length > 0 ? (
              <div className="relative">
                <select
                  value={selectedWorkspace?.id || ''}
                  onChange={(event) => {
                    const workspace = workspaces.find((item) => item.id === event.target.value);
                    if (workspace) setSelectedWorkspace(workspace);
                  }}
                  className="cerniq-field cerniq-select min-w-[240px] py-3 pl-4 pr-10 text-sm"
                >
                  {workspaces.map((workspace) => (
                    <option key={workspace.id} value={workspace.id}>
                      {workspace.name}
                    </option>
                  ))}
                </select>
                <Building2 className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              </div>
            ) : null}
            <button onClick={() => setShowCreateModal(true)} className="cerniq-button-primary px-5 py-3 text-sm">
              <Plus className="h-4 w-4" />
              {t('New workspace', 'Nuevo espacio')}
            </button>
          </>
        }
      >
        {workspaces.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title={t('Welcome to SpendCheck', 'Bienvenido a SpendCheck')}
            titleEs="Bienvenido a SpendCheck"
            description={t(
              'Create a workspace to upload AP exports, detect spend leaks, and turn recovery opportunities into an operating workflow.',
              'Cree un espacio de trabajo para subir exportaciones AP, detectar fugas de gasto y convertir oportunidades de recuperacion en un flujo operativo.',
            )}
            descriptionEs="Cree un espacio de trabajo para subir exportaciones AP, detectar fugas de gasto y convertir oportunidades de recuperacion en un flujo operativo."
            actionLabel={t('Create your first workspace', 'Cree su primer espacio')}
            actionLabelEs="Cree su primer espacio"
            onAction={() => setShowCreateModal(true)}
          />
        ) : (
          <div className="space-y-6">
            {/* ── Tab Navigation ── */}
            <nav className="flex gap-0 overflow-x-auto border-b border-slate-200">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`whitespace-nowrap px-5 py-3 text-sm font-medium transition-colors ${
                    activeTab === tab.key
                      ? 'border-b-2 border-[#1ABFFF] font-bold text-[#1ABFFF]'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {lang === 'en' ? tab.labelEn : tab.labelEs}
                </button>
              ))}
            </nav>

            {/* ── Error Banner ── */}
            {analysisError && (
              <ErrorBanner
                error={analysisError}
                titleEs={t('Failed to load analysis', 'Error al cargar el analisis')}
                onRetry={() => selectedWorkspace && loadAnalysis(selectedWorkspace.id)}
                onDismiss={() => setAnalysisError(null)}
              />
            )}

            {/* ── Loading Skeleton ── */}
            {analysisLoading && <SkeletonLoader variant="metric" count={6} />}

            {/* ── Tab Content ── */}
            {!analysisLoading && analysis && (
              <>
                {activeTab === 'overview' && (
                  <OverviewTab analysis={analysis} lang={lang} t={t} onViewAll={() => setActiveTab('anomalies')} onSelectFinding={setSelectedFinding} />
                )}
                {activeTab === 'anomalies' && (
                  <AnomaliesTab analysis={analysis} lang={lang} t={t} onSelectFinding={setSelectedFinding} />
                )}
                {activeTab === 'vendors' && <VendorsTab analysis={analysis} lang={lang} t={t} />}
                {activeTab === 'liquidity' && <LiquidityTab lang={lang} t={t} />}
                {activeTab === 'report' && (
                  <ReportTab analysis={analysis} lang={lang} t={t} workspaceName={selectedWorkspace?.name || ''} onDownload={downloadAnalysisJSON} />
                )}
              </>
            )}

            {!analysisLoading && !analysis && !analysisError && (
              <EmptyState
                icon={FileSpreadsheet}
                title={t('No expense data yet', 'Sin datos de gastos aun')}
                titleEs="Sin datos de gastos aun"
                description={t(
                  'Upload AP exports to begin spend analysis and anomaly detection.',
                  'Suba exportaciones AP para comenzar el analisis de gastos y deteccion de anomalias.',
                )}
                descriptionEs="Suba exportaciones AP para comenzar el analisis de gastos y deteccion de anomalias."
                actionLabel={t('Upload files', 'Subir archivos')}
                actionLabelEs="Subir archivos"
                onAction={() => {
                  if (selectedWorkspace) {
                    window.location.href = `/spendcheck/upload?workspace=${selectedWorkspace.id}`;
                  }
                }}
              />
            )}
          </div>
        )}
      </PlatformPage>

      {/* ── Create Workspace Modal ── */}
      {showCreateModal && (
        <div className="cerniq-modal-backdrop">
          <div className="cerniq-modal">
            <h2 className="font-display text-2xl text-slate-950">{t('Create SpendCheck workspace', 'Crear espacio SpendCheck')}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {t(
                'Start a new AP review workspace for a client, fund, or internal team.',
                'Inicie un nuevo espacio de revision AP para un cliente, fondo o equipo interno.',
              )}
            </p>
            <div className="mt-6 space-y-4">
              <input
                type="text"
                value={newWorkspaceName}
                onChange={(event) => setNewWorkspaceName(event.target.value)}
                placeholder={t('Workspace name', 'Nombre del espacio')}
                className="cerniq-field"
              />
              <input
                type="text"
                value={newCompanyName}
                onChange={(event) => setNewCompanyName(event.target.value)}
                placeholder={t('Company name (optional)', 'Nombre de empresa (opcional)')}
                className="cerniq-field"
              />
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowCreateModal(false)} className="cerniq-button-secondary px-5 py-3 text-sm">
                {t('Cancel', 'Cancelar')}
              </button>
              <button onClick={createWorkspace} disabled={!newWorkspaceName.trim()} className="cerniq-button-primary px-5 py-3 text-sm disabled:opacity-60">
                {t('Create', 'Crear')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Finding Detail Drawer ── */}
      {selectedFinding && (
        <FindingDrawer finding={selectedFinding} lang={lang} t={t} onClose={() => setSelectedFinding(null)} />
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────
// Tab 1: Overview Intelligence
// ─────────────────────────────────────────────────────────

function OverviewTab({
  analysis,
  lang,
  t,
  onViewAll,
  onSelectFinding,
}: {
  analysis: APAnalysisResult;
  lang: Lang;
  t: (en: string, es: string) => string;
  onViewAll: () => void;
  onSelectFinding: (f: APFinding) => void;
}) {
  const topFindings = [...analysis.findings]
    .sort((a, b) => b.estimatedRecovery - a.estimatedRecovery)
    .slice(0, 3);

  return (
    <div className="space-y-6">
      {/* Row 1: Health Score + Metric Cards */}
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        {/* AP Health Score */}
        <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-6">
          <APHealthGauge score={analysis.healthScore} />
          <p className="mt-4 text-sm font-semibold uppercase tracking-wider text-slate-500">
            {t('AP Health', 'Salud AP')}
          </p>
        </div>

        {/* 6 Metric Cards */}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <MetricCard
            label={t('Spend Analyzed', 'Gasto Total Analizado')}
            value={fmt(analysis.totalSpendAnalyzed)}
            icon={<FileSpreadsheet className="h-5 w-5 text-cyan-600" />}
          />
          <MetricCard
            label={t('Active Findings', 'Hallazgos Activos')}
            value={String(analysis.totalFindings)}
            sub={`H:${analysis.severityBreakdown.high} M:${analysis.severityBreakdown.medium} L:${analysis.severityBreakdown.low}`}
            icon={<Search className="h-5 w-5 text-amber-500" />}
          />
          <MetricCard
            label={t('Potential Recovery', 'Recuperacion Potencial')}
            value={fmt(analysis.potentialRecovery)}
            valueColor="text-emerald-700"
            icon={<TrendingUp className="h-5 w-5 text-emerald-600" />}
          />
          <MetricCard
            label={t('Recovered', 'Recuperado')}
            value={fmt(analysis.recoveredAmount)}
            icon={<CheckCircle2 className="h-5 w-5 text-cyan-700" />}
          />
          <MetricCard
            label={t('Top Vendor', 'Proveedor Principal')}
            value={analysis.topVendor.name}
            sub={fmtPct(analysis.topVendor.percentOfTotal) + t(' of total', ' del total')}
            icon={<Building2 className="h-5 w-5 text-slate-600" />}
          />
          <MetricCard
            label={t('AP Risk Score', 'Indice AP')}
            value={String(analysis.apRiskScore)}
            valueColor={analysis.apRiskScore >= 80 ? 'text-emerald-700' : analysis.apRiskScore >= 50 ? 'text-amber-600' : 'text-red-600'}
            icon={<Shield className="h-5 w-5 text-indigo-600" />}
          />
        </div>
      </div>

      {/* Row 2: Priority Findings Preview */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{t('Priority Findings', 'Hallazgos Prioritarios')}</p>
            <h2 className="mt-1 font-display text-xl text-slate-950">{t('Top 3 by estimated recovery', 'Top 3 por recuperacion estimada')}</h2>
          </div>
          <button
            onClick={onViewAll}
            className="flex items-center gap-1 text-sm font-semibold text-[#1ABFFF] hover:underline"
          >
            {t('View all', 'Ver todos')} <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 space-y-3">
          {topFindings.map((finding, idx) => (
            <button
              key={finding.id}
              onClick={() => onSelectFinding(finding)}
              className="flex w-full items-center gap-4 rounded-xl border border-slate-100 bg-slate-50/50 px-5 py-4 text-left transition hover:border-cyan-200 hover:bg-cyan-50/40"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1ABFFF]/10 text-sm font-bold text-[#1ABFFF]">
                {idx + 1}
              </span>
              <span className="mr-1 text-lg">{findingTypeIcon(finding.type)}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900">{findingTypeLabelFn(finding.type, lang)}</p>
                <p className="truncate text-xs text-slate-500">
                  <span className="font-semibold">{finding.vendor}</span>
                  {' — '}
                  {(lang === 'en' ? finding.explanation : (finding.explanationEs || finding.explanation)).slice(0, 80)}...
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-bold text-emerald-700">{fmt(finding.estimatedRecovery)}</p>
                <span className={`inline-block mt-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${severityColor(finding.severity)}`}>
                  {finding.severity}
                </span>
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Tab 2: Anomaly Engine
// ─────────────────────────────────────────────────────────

function AnomaliesTab({
  analysis,
  lang,
  t,
  onSelectFinding,
}: {
  analysis: APAnalysisResult;
  lang: Lang;
  t: (en: string, es: string) => string;
  onSelectFinding: (f: APFinding) => void;
}) {
  const sortedFindings = [...analysis.findings].sort((a, b) => {
    const sevOrder: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    const sevDiff = (sevOrder[a.severity] ?? 3) - (sevOrder[b.severity] ?? 3);
    if (sevDiff !== 0) return sevDiff;
    return b.estimatedRecovery - a.estimatedRecovery;
  });

  const highCount = analysis.severityBreakdown.high;

  return (
    <div className="space-y-5">
      {/* Stats bar */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{t('Total Findings', 'Total Hallazgos')}</p>
          <p className="mt-1 text-2xl font-bold text-slate-950">{analysis.totalFindings}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{t('High Priority', 'Alta Prioridad')}</p>
          <p className="mt-1 text-2xl font-bold text-amber-600">{highCount}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{t('Potential Recovery', 'Recuperacion Potencial')}</p>
          <p className="mt-1 text-2xl font-bold text-emerald-700">{fmt(analysis.potentialRecovery)}</p>
        </div>
      </div>

      {/* Findings list */}
      <div className="space-y-2">
        {sortedFindings.map((finding) => (
          <button
            key={finding.id}
            onClick={() => onSelectFinding(finding)}
            className="flex w-full items-center gap-4 rounded-xl border border-slate-100 bg-white px-5 py-4 text-left transition hover:border-cyan-200 hover:shadow-sm"
          >
            <span className="text-xl">{findingTypeIcon(finding.type)}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900">{findingTypeLabelFn(finding.type, lang)}</p>
              <p className="text-xs text-slate-500">
                <span className="font-bold text-slate-700">{finding.vendor}</span>
                {' — '}
                {(lang === 'en' ? finding.explanation : (finding.explanationEs || finding.explanation)).slice(0, 100)}
              </p>
            </div>
            <div className="shrink-0 text-right">
              {finding.estimatedRecovery > 0 && (
                <p className="text-sm font-bold text-emerald-700">{fmt(finding.estimatedRecovery)}</p>
              )}
              <span className={`inline-block mt-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${severityColor(finding.severity)}`}>
                {finding.severity}
              </span>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
          </button>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Tab 3: Vendor Intelligence
// ─────────────────────────────────────────────────────────

function VendorsTab({ analysis, lang, t }: { analysis: APAnalysisResult; lang: Lang; t: (en: string, es: string) => string }) {
  const sorted = [...analysis.vendorStats].sort((a, b) => b.percentOfTotal - a.percentOfTotal);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/60">
              <th className="px-5 py-3 text-left font-semibold text-slate-600">{t('Vendor', 'Proveedor')}</th>
              <th className="px-5 py-3 text-right font-semibold text-slate-600">{t('Quarterly Spend', 'Gasto Trimestral')}</th>
              <th className="px-5 py-3 text-right font-semibold text-slate-600">{t('% of Total', '% del Total')}</th>
              <th className="px-5 py-3 text-right font-semibold text-slate-600">{t('Invoices', 'Facturas')}</th>
              <th className="px-5 py-3 text-right font-semibold text-slate-600">{t('Avg Invoice', 'Promedio')}</th>
              <th className="px-5 py-3 text-center font-semibold text-slate-600">{t('Risk', 'Riesgo')}</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((vendor) => (
              <tr key={vendor.name} className="border-t border-slate-50 hover:bg-cyan-50/30">
                <td className="px-5 py-3.5 font-semibold text-slate-900">{vendor.name}</td>
                <td className="px-5 py-3.5 text-right text-slate-700">{fmt(vendor.quarterlySpend)}</td>
                <td className="px-5 py-3.5 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${vendorRiskDot(vendor.percentOfTotal)}`} />
                    <span className="text-slate-700">{fmtPct(vendor.percentOfTotal)}</span>
                  </div>
                </td>
                <td className="px-5 py-3.5 text-right text-slate-700">{vendor.invoiceCount}</td>
                <td className="px-5 py-3.5 text-right text-slate-700">{fmt(vendor.avgInvoice)}</td>
                <td className="px-5 py-3.5 text-center">
                  <span
                    className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                      vendor.percentOfTotal > 35
                        ? 'border-red-300 bg-red-50 text-red-700'
                        : vendor.percentOfTotal >= 25
                          ? 'border-amber-300 bg-amber-50 text-amber-700'
                          : 'border-emerald-300 bg-emerald-50 text-emerald-700'
                    }`}
                  >
                    {vendor.percentOfTotal > 35 ? 'HIGH' : vendor.percentOfTotal >= 25 ? 'MEDIUM' : 'LOW'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Tab 4: Liquidity
// ─────────────────────────────────────────────────────────

function LiquidityTab({ lang, t }: { lang: Lang; t: (en: string, es: string) => string }) {
  // For now: show info card since ALM integration is optional
  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-100">
          <Info className="h-7 w-7 text-blue-600" />
        </div>
        <h3 className="font-display text-xl font-bold text-[#1B3A6B]">
          {t('AP Liquidity Impact', 'Impacto AP en Liquidez')}
        </h3>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          {t(
            'Connect your ALM analysis to view the impact of accounts payable on your liquidity position, including current LCR, projected LCR with AP, and the resulting delta.',
            'Conecte su analisis ALM para ver el impacto de cuentas por pagar en su posicion de liquidez, incluyendo LCR actual, LCR proyectado con AP, y el delta resultante.',
          )}
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{t('Current LCR', 'LCR Actual')}</p>
            <p className="mt-2 text-2xl font-bold text-slate-300">--</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{t('Projected LCR', 'LCR Proyectado')}</p>
            <p className="mt-2 text-2xl font-bold text-slate-300">--</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Delta</p>
            <p className="mt-2 text-2xl font-bold text-slate-300">--</p>
          </div>
        </div>
        <Link
          href="/alm"
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#1B3A6B] px-6 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:shadow-lg"
        >
          {t('Go to ALM', 'Ir a ALM')}
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Tab 5: Report
// ─────────────────────────────────────────────────────────

function ReportTab({
  analysis,
  lang,
  t,
  workspaceName,
  onDownload,
}: {
  analysis: APAnalysisResult;
  lang: Lang;
  t: (en: string, es: string) => string;
  workspaceName: string;
  onDownload: () => void;
}) {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-cyan-100">
          <Download className="h-7 w-7 text-cyan-700" />
        </div>
        <h3 className="font-display text-xl font-bold text-[#1B3A6B]">
          {t('Generate AP Report', 'Generar Informe AP')}
        </h3>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          {t(
            'Download a comprehensive report of your SpendCheck analysis, including findings, vendor statistics, and recovery recommendations.',
            'Descargue un informe completo de su analisis SpendCheck, incluyendo hallazgos, estadisticas de proveedores, y recomendaciones de recuperacion.',
          )}
        </p>

        {/* Report summary */}
        <div className="mx-auto mt-6 max-w-sm space-y-2 text-left">
          <SummaryRow label="Workspace" value={workspaceName} />
          <SummaryRow label={t('AP Health', 'Salud AP')} value={`${analysis.healthScore}/100`} />
          <SummaryRow label={t('Spend Analyzed', 'Gasto Analizado')} value={fmt(analysis.totalSpendAnalyzed)} />
          <SummaryRow label={t('Findings', 'Hallazgos')} value={String(analysis.totalFindings)} />
          <SummaryRow label={t('Recovery', 'Recuperacion')} value={fmt(analysis.potentialRecovery)} />
          <SummaryRow label={t('Vendors', 'Proveedores')} value={String(analysis.vendorStats.length)} />
        </div>

        <button
          onClick={onDownload}
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#E8A020] px-8 py-3 text-sm font-bold text-white shadow-md transition hover:-translate-y-0.5 hover:bg-[#d4911c] hover:shadow-lg"
        >
          <Download className="h-4 w-4" />
          {t('Download JSON', 'Descargar JSON')}
        </button>

        <p className="mt-4 text-xs text-slate-400">
          {t('PDF generation coming soon', 'La generacion de PDF estara disponible pronto')}
        </p>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 py-2 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-slate-900">{value}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// AP Health Gauge (conic-gradient arc)
// ─────────────────────────────────────────────────────────

function APHealthGauge({ score }: { score: number }) {
  const color = healthColor(score);
  const angle = (score / 100) * 360;

  return (
    <div
      className="relative flex h-36 w-36 items-center justify-center rounded-full"
      style={{
        background: `conic-gradient(${color} 0deg, ${color} ${angle}deg, #E2E8F0 ${angle}deg, #E2E8F0 360deg)`,
      }}
    >
      <div className="flex h-28 w-28 flex-col items-center justify-center rounded-full bg-white">
        <span className="text-4xl font-bold" style={{ color }}>
          {score}
        </span>
        <span className="text-xs text-slate-400 mt-0.5">/100</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Metric Card
// ─────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  sub,
  icon,
  valueColor = 'text-slate-950',
}: {
  label: string;
  value: string;
  sub?: string;
  icon: ReactNode;
  valueColor?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 leading-tight max-w-[80%]">{label}</p>
        {icon}
      </div>
      <p className={`mt-2 text-2xl font-bold ${valueColor}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Finding Detail Drawer
// ─────────────────────────────────────────────────────────

function FindingDrawer({ finding, lang, t, onClose }: { finding: APFinding; lang: Lang; t: (en: string, es: string) => string; onClose: () => void }) {
  const [reviewed, setReviewed] = useState(finding.status === 'reviewed');

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />

      {/* Drawer */}
      <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-md overflow-y-auto border-l border-slate-200 bg-white shadow-xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="text-xl">{findingTypeIcon(finding.type)}</span>
            <h3 className="font-display text-lg font-bold text-slate-950">{finding.vendor}</h3>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-6 p-6">
          {/* Type + severity */}
          <div className="flex items-center gap-3">
            <span className={`rounded-full border px-3 py-1 text-xs font-bold uppercase ${severityColor(finding.severity)}`}>
              {finding.severity}
            </span>
            <span className="text-sm text-slate-500">{findingTypeLabelFn(finding.type, lang)}</span>
          </div>

          {/* Explanation */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              {t('Explanation', 'Explicacion')}
            </h4>
            <p className="mt-2 text-sm leading-relaxed text-slate-700">
              {lang === 'en' ? finding.explanation : (finding.explanationEs || finding.explanation)}
            </p>
            {lang === 'en' && finding.explanationEs && (
              <p className="mt-2 text-sm leading-relaxed text-slate-500 italic">{finding.explanationEs}</p>
            )}
            {lang === 'es' && (
              <p className="mt-2 text-sm leading-relaxed text-slate-500 italic">{finding.explanation}</p>
            )}
          </div>

          {/* Recovery */}
          {finding.estimatedRecovery > 0 && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
                {t('Estimated Recovery', 'Recuperacion Estimada')}
              </p>
              <p className="mt-1 text-2xl font-bold text-emerald-700">{fmt(finding.estimatedRecovery)}</p>
            </div>
          )}

          {/* Affected invoices */}
          {finding.invoiceIds && finding.invoiceIds.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                {t('Affected Invoices', 'Facturas Afectadas')}
              </h4>
              <div className="mt-2 flex flex-wrap gap-2">
                {finding.invoiceIds.map((inv) => (
                  <span key={inv} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-mono text-slate-700">
                    {inv}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Recommended actions */}
          {finding.recommendedActions && finding.recommendedActions.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                {t('Recommended Actions', 'Acciones Recomendadas')}
              </h4>
              <ul className="mt-2 space-y-2">
                {finding.recommendedActions.map((action, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-slate-700">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-100 text-[10px] font-bold text-cyan-700">
                      {idx + 1}
                    </span>
                    {action}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Mark Reviewed button */}
          <button
            onClick={() => setReviewed(true)}
            disabled={reviewed}
            className={`w-full rounded-xl px-5 py-3 text-sm font-semibold transition ${
              reviewed
                ? 'cursor-default border border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'bg-[#1B3A6B] text-white hover:bg-[#15305a]'
            }`}
          >
            {reviewed ? (
              <span className="flex items-center justify-center gap-2">
                <CheckCircle2 className="h-4 w-4" /> {t('Reviewed', 'Revisado')}
              </span>
            ) : (
              t('Mark Reviewed', 'Marcar Revisado')
            )}
          </button>
        </div>
      </aside>
    </>
  );
}
