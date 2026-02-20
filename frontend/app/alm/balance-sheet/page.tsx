'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { apiClient } from '@/lib/api';
import { analytics, EVENTS } from '@/lib/analytics';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, RefreshCw, DollarSign, Upload, RotateCcw, Plus, Trash2, AlertTriangle, Check } from 'lucide-react';

interface BalanceSheetItem {
  id?: string;
  category: 'asset' | 'liability';
  subcategory: string;
  name: string;
  balance: number;
  rate: number;
  duration: number;
  repriceDate?: string;
  maturityDate?: string;
  rateType: 'fixed' | 'variable';
}

interface Institution {
  id: string;
  name: string;
  type: string;
  totalAssets: number;
  balanceSheetItems: BalanceSheetItem[];
}

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-slate-950 p-6 animate-pulse">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="h-8 bg-slate-800 rounded w-64" />
        <div className="h-96 bg-slate-800/50 rounded-xl" />
      </div>
    </div>
  );
}

const ASSET_SUBCATEGORIES = [
  'commercial_loans', 'residential_mortgages', 'consumer_loans',
  'investment_securities', 'cash_equivalents', 'other_assets',
];

const LIABILITY_SUBCATEGORIES = [
  'demand_deposits', 'savings_deposits', 'time_deposits',
  'borrowings', 'subordinated_debt', 'other_liabilities',
];

function getDurationColor(duration: number): string {
  if (duration <= 1) return 'bg-emerald-500/30 text-emerald-300';
  if (duration <= 3) return 'bg-blue-500/30 text-blue-300';
  if (duration <= 5) return 'bg-amber-500/30 text-amber-300';
  if (duration <= 10) return 'bg-orange-500/30 text-orange-300';
  return 'bg-red-500/30 text-red-300';
}

function emptyItem(category: 'asset' | 'liability'): BalanceSheetItem {
  return {
    category,
    subcategory: category === 'asset' ? 'commercial_loans' : 'demand_deposits',
    name: '',
    balance: 0,
    rate: 0,
    duration: 0,
    rateType: 'fixed',
  };
}

export default function BalanceSheetPage() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <BalanceSheetContent />
    </Suspense>
  );
}

function BalanceSheetContent() {
  const searchParams = useSearchParams();
  const institutionId = searchParams.get('id') || '';
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [institution, setInstitution] = useState<Institution | null>(null);
  const [items, setItems] = useState<BalanceSheetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const fetchData = useCallback(async () => {
    if (!institutionId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.getInstitution(institutionId);
      setInstitution(data);
      setItems(data.balanceSheetItems || []);
      setDirty(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load balance sheet';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [institutionId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleItemChange = (index: number, field: keyof BalanceSheetItem, value: string | number) => {
    setItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
    setDirty(true);
  };

  const addItem = (category: 'asset' | 'liability') => {
    setItems((prev) => [...prev, emptyItem(category)]);
    setDirty(true);
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
    setDirty(true);
  };

  const handleSave = async () => {
    if (!institutionId) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload = items.map((item) => ({
        category: item.category,
        subcategory: item.subcategory,
        name: item.name,
        balance: Number(item.balance),
        rate: Number(item.rate),
        duration: Number(item.duration),
        repriceDate: item.repriceDate || undefined,
        maturityDate: item.maturityDate || undefined,
        rateType: item.rateType,
      }));
      await apiClient.importBalanceSheetItems(institutionId, payload);
      setSuccess(`Saved ${payload.length} items. ALM calculations will reflect the updated balance sheet.`);
      setDirty(false);
      analytics.track(EVENTS.ALM_ANALYSIS_RUN, {
        institutionId,
        view: 'balance-sheet',
        action: 'save',
        itemCount: payload.length,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save balance sheet';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleCSVUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split('\n').filter((l) => l.trim());
        if (lines.length < 2) {
          setError('CSV must have at least a header row and one data row');
          return;
        }

        const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
        const requiredHeaders = ['category', 'subcategory', 'name', 'balance', 'rate', 'duration', 'ratetype'];
        const missing = requiredHeaders.filter((h) => !headers.includes(h));
        if (missing.length > 0) {
          setError(`CSV missing required columns: ${missing.join(', ')}`);
          return;
        }

        const parsed: BalanceSheetItem[] = [];
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map((v) => v.trim());
          if (values.length < headers.length) continue;

          const row: Record<string, string> = {};
          headers.forEach((h, idx) => { row[h] = values[idx]; });

          parsed.push({
            category: row.category as 'asset' | 'liability',
            subcategory: row.subcategory,
            name: row.name,
            balance: parseFloat(row.balance) || 0,
            rate: parseFloat(row.rate) || 0,
            duration: parseFloat(row.duration) || 0,
            repriceDate: row.repricedate || undefined,
            maturityDate: row.maturitydate || undefined,
            rateType: (row.ratetype || 'fixed') as 'fixed' | 'variable',
          });
        }

        setItems(parsed);
        setDirty(true);
        setSuccess(`Imported ${parsed.length} items from CSV. Review and save.`);
        analytics.track(EVENTS.ALM_ANALYSIS_RUN, {
          institutionId,
          view: 'balance-sheet',
          action: 'csv-upload',
          itemCount: parsed.length,
        });
      } catch {
        setError('Failed to parse CSV file');
      }
    };
    reader.readAsText(file);
    // Reset input so same file can be re-uploaded
    event.target.value = '';
  };

  const assets = items.filter((i) => i.category === 'asset');
  const liabilities = items.filter((i) => i.category === 'liability');
  const totalAssets = assets.reduce((s, a) => s + Number(a.balance), 0);
  const totalLiabilities = liabilities.reduce((s, l) => s + Number(l.balance), 0);
  const equity = totalAssets - totalLiabilities;

  if (!institutionId) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center space-y-4">
          <AlertTriangle className="h-12 w-12 text-amber-400 mx-auto" />
          <p className="text-slate-400">No institution selected. Go back to the ALM overview.</p>
          <Link href="/alm" className="inline-block bg-amber-500/20 text-amber-300 px-4 py-2 rounded-lg hover:bg-amber-500/30 transition">
            Back to ALM
          </Link>
        </div>
      </div>
    );
  }

  if (loading) return <LoadingSkeleton />;

  const renderTable = (category: 'asset' | 'liability', categoryItems: BalanceSheetItem[]) => {
    const subcategories = category === 'asset' ? ASSET_SUBCATEGORIES : LIABILITY_SUBCATEGORIES;
    const total = categoryItems.reduce((s, i) => s + Number(i.balance), 0);

    return (
      <div className="bg-slate-900/60 border border-white/10 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white capitalize">{category === 'asset' ? 'Assets' : 'Liabilities'}</h3>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-400">Total: <span className="text-white font-bold">${total.toFixed(1)}M</span></span>
            <button
              onClick={() => addItem(category)}
              className="flex items-center gap-1 text-sm bg-white/5 hover:bg-white/10 text-slate-300 px-3 py-1.5 rounded-lg transition"
            >
              <Plus className="h-3.5 w-3.5" /> Add Row
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left py-2 px-2 text-slate-400 font-medium w-36">Subcategory</th>
                <th className="text-left py-2 px-2 text-slate-400 font-medium">Name</th>
                <th className="text-right py-2 px-2 text-slate-400 font-medium w-28">Balance ($M)</th>
                <th className="text-right py-2 px-2 text-slate-400 font-medium w-24">Rate (%)</th>
                <th className="text-center py-2 px-2 text-slate-400 font-medium w-24">Duration</th>
                <th className="text-center py-2 px-2 text-slate-400 font-medium w-24">Rate Type</th>
                <th className="text-center py-2 px-2 text-slate-400 font-medium w-12"></th>
              </tr>
            </thead>
            <tbody>
              {categoryItems.map((item, idx) => {
                // Find the actual index in the full items array
                const globalIdx = items.indexOf(item);
                return (
                  <tr key={globalIdx} className="border-b border-white/5 hover:bg-white/5 transition">
                    <td className="py-2 px-2">
                      <select
                        value={item.subcategory}
                        onChange={(e) => handleItemChange(globalIdx, 'subcategory', e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-white text-xs focus:outline-none focus:ring-1 focus:ring-purple-500"
                      >
                        {subcategories.map((sc) => (
                          <option key={sc} value={sc}>{sc.replace(/_/g, ' ')}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 px-2">
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => handleItemChange(globalIdx, 'name', e.target.value)}
                        placeholder="e.g., Commercial Real Estate"
                        className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-white text-xs placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                      />
                    </td>
                    <td className="py-2 px-2">
                      <input
                        type="number"
                        value={item.balance}
                        onChange={(e) => handleItemChange(globalIdx, 'balance', parseFloat(e.target.value) || 0)}
                        className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-white text-right text-xs font-mono focus:outline-none focus:ring-1 focus:ring-purple-500"
                      />
                    </td>
                    <td className="py-2 px-2">
                      <input
                        type="number"
                        step="0.01"
                        value={item.rate}
                        onChange={(e) => handleItemChange(globalIdx, 'rate', parseFloat(e.target.value) || 0)}
                        className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-white text-right text-xs font-mono focus:outline-none focus:ring-1 focus:ring-purple-500"
                      />
                    </td>
                    <td className="py-2 px-2 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-mono ${getDurationColor(item.duration)}`}>
                        {item.duration}yr
                      </span>
                    </td>
                    <td className="py-2 px-2 text-center">
                      <select
                        value={item.rateType}
                        onChange={(e) => handleItemChange(globalIdx, 'rateType', e.target.value)}
                        className="bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-white text-xs focus:outline-none focus:ring-1 focus:ring-purple-500"
                      >
                        <option value="fixed">Fixed</option>
                        <option value="variable">Variable</option>
                      </select>
                    </td>
                    <td className="py-2 px-2 text-center">
                      <button
                        onClick={() => removeItem(globalIdx)}
                        className="text-slate-500 hover:text-red-400 transition"
                        title="Remove row"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {categoryItems.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No {category === 'asset' ? 'assets' : 'liabilities'} yet. Add rows or upload a CSV.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-purple-950/20 text-white">
      {/* Header */}
      <div className="border-b border-white/10 bg-slate-900/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href={`/alm`} className="text-slate-400 hover:text-white transition">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-purple-400" />
                Balance Sheet
              </h1>
              <p className="text-sm text-slate-400">
                {institution?.name || 'Institution'} &middot; Assets, Liabilities & Import
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleCSVUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-slate-300 px-4 py-2 rounded-lg transition"
            >
              <Upload className="h-4 w-4" /> Upload CSV
            </button>
            <button
              onClick={fetchData}
              disabled={loading}
              className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-slate-300 px-4 py-2 rounded-lg transition disabled:opacity-50"
            >
              <RotateCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Reset
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !dirty}
              className="flex items-center gap-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 px-4 py-2 rounded-lg transition disabled:opacity-50"
            >
              {saving ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              {saving ? 'Saving...' : 'Save & Recalculate'}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="max-w-7xl mx-auto px-6 mt-4">
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-300 text-sm">
            {error}
          </div>
        </div>
      )}

      {success && (
        <div className="max-w-7xl mx-auto px-6 mt-4">
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-4 py-3 text-emerald-300 text-sm flex items-center gap-2">
            <Check className="h-4 w-4" /> {success}
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-slate-900/60 border border-white/10 rounded-xl p-5">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Assets</p>
            <p className="text-2xl font-bold text-white mt-2">${totalAssets.toFixed(1)}M</p>
            <p className="text-sm text-slate-300 mt-1">{assets.length} line items</p>
          </div>
          <div className="bg-slate-900/60 border border-white/10 rounded-xl p-5">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Liabilities</p>
            <p className="text-2xl font-bold text-white mt-2">${totalLiabilities.toFixed(1)}M</p>
            <p className="text-sm text-slate-300 mt-1">{liabilities.length} line items</p>
          </div>
          <div className="bg-slate-900/60 border border-white/10 rounded-xl p-5">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Equity</p>
            <p className={`text-2xl font-bold mt-2 ${equity >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>${equity.toFixed(1)}M</p>
            <p className="text-sm text-slate-300 mt-1">Assets - Liabilities</p>
          </div>
          <div className="bg-slate-900/60 border border-white/10 rounded-xl p-5">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Equity / Assets</p>
            <p className="text-2xl font-bold text-white mt-2">
              {totalAssets > 0 ? ((equity / totalAssets) * 100).toFixed(1) : '0.0'}%
            </p>
            <p className="text-sm text-slate-300 mt-1">Capital ratio</p>
          </div>
        </div>

        {/* Duration Heatmap */}
        {items.length > 0 && (
          <div className="bg-slate-900/60 border border-white/10 rounded-xl p-6">
            <h3 className="text-sm font-medium text-slate-300 mb-3">Duration Heatmap</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {items.map((item, i) => (
                <div
                  key={i}
                  className={`rounded-lg p-3 ${getDurationColor(item.duration)} border border-white/5`}
                >
                  <p className="text-xs font-medium truncate">{item.name || item.subcategory.replace(/_/g, ' ')}</p>
                  <p className="text-lg font-bold mt-1">{item.duration}yr</p>
                  <p className="text-xs opacity-75">${Number(item.balance).toFixed(0)}M &middot; {item.rateType}</p>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-4 mt-4 text-xs text-slate-400">
              <span>Duration Scale:</span>
              <span className="px-2 py-0.5 rounded bg-emerald-500/30 text-emerald-300">0-1yr</span>
              <span className="px-2 py-0.5 rounded bg-blue-500/30 text-blue-300">1-3yr</span>
              <span className="px-2 py-0.5 rounded bg-amber-500/30 text-amber-300">3-5yr</span>
              <span className="px-2 py-0.5 rounded bg-orange-500/30 text-orange-300">5-10yr</span>
              <span className="px-2 py-0.5 rounded bg-red-500/30 text-red-300">10yr+</span>
            </div>
          </div>
        )}

        {/* Asset Table */}
        {renderTable('asset', assets)}

        {/* Liability Table */}
        {renderTable('liability', liabilities)}

        {/* CSV Format Help */}
        <div className="bg-slate-900/60 border border-white/10 rounded-xl p-6">
          <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-3">CSV Import Format</h3>
          <div className="bg-slate-800 rounded-lg p-4 font-mono text-xs text-slate-300 overflow-x-auto">
            <p>category,subcategory,name,balance,rate,duration,rateType</p>
            <p>asset,commercial_loans,Commercial Real Estate,350,5.25,4.5,fixed</p>
            <p>asset,residential_mortgages,30yr Fixed Mortgages,280,4.75,6.2,fixed</p>
            <p>liability,demand_deposits,Checking Accounts,200,0.5,0.1,variable</p>
            <p>liability,time_deposits,12-Month CDs,180,4.0,0.9,fixed</p>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Balance in millions ($M). Rate as percentage. Duration in years. rateType: fixed or variable.
          </p>
        </div>
      </div>
    </div>
  );
}
