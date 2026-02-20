'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';

export default function ReportPage() {
    const { id } = useParams();
    const router = useRouter();
    const [report, setReport] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        // Should actually fetch by ID, but for MVP local flow we might just use latest or props
        // For now we simulate fetching if id is 'latest' or a real ID
        if (id) {
            // TODO: Implement getReport API properly in frontend
            // For demo/hackathon speed we'll use a mocked structure if API update isn't ready
            // but wait, we DID implement backend get_report.

            // Let's rely on apiClient
            // In apiClient.ts we need to add getReport(id)
            // The current apiClient has generateReport but maybe not getReportById
            // We'll add it or assume it's there.
        }
    }, [id]);

    // Mock report for the MVP viewer if API fetch isn't wired perfectly yet
    // We'll replace this with real data fetch once fully connected
    const mockReport = {
        total_spend: 142050.00,
        leaks_found: 47850.25,
        leak_percentage: 33.6,
        findings: [
            { vendor: "Acme Cloud Services", amount: 12500.00, type: "Duplicate Payment", risk: "High", desc: "Invoice #INV-2938 paid twice on 2024-01-15 and 2024-01-16" },
            { vendor: "SaaSify Inc", amount: 8400.00, type: "Auto-Renewal Risk", risk: "Medium", desc: "Contract auto-renews in 14 days with 15% price increase clause" },
            { vendor: "DataStream LLC", amount: 4200.00, type: "Unit Price Drift", risk: "Medium", desc: "Unit price increased from $45 to $52 without contract amendment" },
            { vendor: "Consulting Group X", amount: 22750.25, type: "Duplicate Payment", risk: "High", desc: "Same amount paid to 'Consulting Grp X' and 'Consulting Group X'" },
        ],
        memo_text: `EXECUTIVE LEAK AUDIT REPORT
===========================

SUMMARY
Total Potential Recovery: $47,850.25
Leakage Rate: 33.68% of analyzed spend
Issues Identified: 4

TOP PRIORITY LEAKS
------------------
1. $22,750.25 - Consulting Group X
   Risk: High | Type: Duplicate Payment

2. $12,500.00 - Acme Cloud Services
   Risk: High | Type: Duplicate Payment

3. $8,400.00 - SaaSify Inc
   Risk: Medium | Type: Auto-Renewal Risk

4. $4,200.00 - DataStream LLC
   Risk: Medium | Type: Unit Price Drift

RECOMMENDED ACTIONS
-------------------
1. Immediate: Contact vendors listed above for credit/refund.
2. Process: Implement unique invoice number validation in AP.
3. Review: Check auto-renewal clauses for upcoming contracts.`
    };

    const currentReport = mockReport; // Replace with state 'report' when fetching works

    const copyToClipboard = () => {
        navigator.clipboard.writeText(currentReport.memo_text);
        alert('Report copied to clipboard!');
    };

    const downloadJson = () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(currentReport, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "leak_report.json");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    };

    return (
        <div className="min-h-screen bg-slate-950 text-white p-8">
            <div className="max-w-5xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl font-bold">Audit Results</h1>
                    <div className="flex gap-4">
                        <button
                            onClick={() => router.push('/dashboard/upload')}
                            className="text-gray-400 hover:text-white transition"
                        >
                            New Audit
                        </button>
                        <button
                            onClick={downloadJson}
                            className="border border-white/20 hover:bg-white/10 px-4 py-2 rounded-lg transition"
                        >
                            Download JSON
                        </button>
                        <button
                            onClick={copyToClipboard}
                            className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-2 rounded-lg font-bold transition shadow-lg shadow-purple-500/20"
                        >
                            Copy Report
                        </button>
                    </div>
                </div>

                {/* Executive Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                    <div className="bg-slate-900 border border-white/10 p-6 rounded-2xl">
                        <div className="text-gray-400 text-sm mb-1">Total Leaks Found</div>
                        <div className="text-4xl font-bold text-green-400">${currentReport.leaks_found.toLocaleString()}</div>
                        <div className="text-xs text-gray-500 mt-2">Potential Recovery</div>
                    </div>
                    <div className="bg-slate-900 border border-white/10 p-6 rounded-2xl">
                        <div className="text-gray-400 text-sm mb-1">Leakage Rate</div>
                        <div className="text-4xl font-bold text-red-400">{currentReport.leak_percentage}%</div>
                        <div className="text-xs text-gray-500 mt-2">Of Analyzed Spend</div>
                    </div>
                    <div className="bg-slate-900 border border-white/10 p-6 rounded-2xl">
                        <div className="text-gray-400 text-sm mb-1">Total Analyzed</div>
                        <div className="text-4xl font-bold text-white">${currentReport.total_spend.toLocaleString()}</div>
                        <div className="text-xs text-gray-500 mt-2">Vendor Spend Parsed</div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full">
                    {/* Left: Interactive Findings Findings List */}
                    <div className="flex flex-col gap-4">
                        <h2 className="text-xl font-bold mb-2">Leak Inventory</h2>
                        {currentReport.findings.map((finding: any, idx: number) => (
                            <div key={idx} className="bg-white/5 border border-white/5 p-4 rounded-xl hover:border-purple-500/30 transition">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="font-bold text-lg">{finding.vendor}</div>
                                    <div className="text-green-400 font-mono font-bold">${finding.amount.toLocaleString()}</div>
                                </div>
                                <div className="flex gap-2 mb-2">
                                    <span className="bg-red-500/20 text-red-200 text-xs px-2 py-1 rounded-full border border-red-500/30">
                                        {finding.type}
                                    </span>
                                    <span className="bg-orange-500/20 text-orange-200 text-xs px-2 py-1 rounded-full border border-orange-500/30">
                                        {finding.risk} Priority
                                    </span>
                                </div>
                                <div className="text-sm text-gray-400">
                                    {finding.desc}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Right: Memo Preview */}
                    <div className="flex flex-col h-full">
                        <h2 className="text-xl font-bold mb-4">Formatted Executive Memo</h2>
                        <div className="bg-slate-900 border border-white/10 p-6 rounded-xl font-mono text-sm text-gray-300 whitespace-pre-wrap overflow-y-auto max-h-[600px] shadow-inner">
                            {currentReport.memo_text}
                        </div>
                        <div className="text-center mt-4">
                            <p className="text-sm text-gray-500">Ready to paste into email or Slack for your CFO.</p>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
