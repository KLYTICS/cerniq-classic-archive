'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { spendcheckApi, Workspace, AnalysisResult, AnalysisStatus } from '@/lib/spendcheck-api';
import UploadZone from '@/components/spendcheck/UploadZone';

function UploadContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const workspaceId = searchParams.get('workspace');

    const [workspace, setWorkspace] = useState<Workspace | null>(null);
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [analyzing, setAnalyzing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (workspaceId) {
            loadWorkspace(workspaceId);
        }
    }, [workspaceId]);

    async function loadWorkspace(id: string) {
        try {
            const data = await spendcheckApi.getWorkspace(id);
            setWorkspace(data);
        } catch (err) {
            console.error('Failed to load workspace:', err);
            setError('Workspace not found');
        }
    }

    async function handleFileSelect(selectedFile: File) {
        setFile(selectedFile);
        setError(null);
    }

    async function handleUploadAndAnalyze() {
        if (!file || !workspaceId) return;

        setUploading(true);
        setProgress(10);

        try {
            // 1. Upload File
            setProgress(30);
            const uploadRes = await spendcheckApi.uploadFile(workspaceId, file);

            // 2. Run Analysis
            setUploading(false);
            setAnalyzing(true);
            setProgress(60);

            const result = await spendcheckApi.runAnalysis(uploadRes.id, workspaceId);
            setProgress(100);
            setAnalysisResult(result);

        } catch (err) {
            console.error('Process failed:', err);
            setError('Failed to process file. Please try again.');
        } finally {
            setUploading(false);
            setAnalyzing(false);
        }
    }

    if (!workspaceId) {
        return (
            <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white">
                <div className="text-center">
                    <h2 className="text-xl font-bold mb-4">No Workspace Selected</h2>
                    <Link href="/spendcheck" className="text-emerald-400 hover:text-emerald-300">
                        Return to Dashboard
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-950 text-white">
            {/* Header */}
            <div className="border-b border-gray-800 bg-gray-900/50 backdrop-blur">
                <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/spendcheck" className="text-gray-400 hover:text-white transition">
                            ← Back
                        </Link>
                        <h1 className="text-2xl font-bold">Upload Invoices</h1>
                    </div>
                    {workspace && (
                        <div className="text-sm text-gray-400">
                            Workspace: <span className="text-emerald-400">{workspace.name}</span>
                        </div>
                    )}
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-6 py-12">
                {!analysisResult ? (
                    <div className="space-y-8">
                        {/* Steps Indicator */}
                        <div className="flex items-center justify-center gap-4 text-sm font-medium mb-12">
                            <div className={`flex items-center gap-2 ${file ? 'text-emerald-400' : 'text-white'}`}>
                                <span className="w-8 h-8 rounded-full bg-gray-800 border-2 border-current flex items-center justify-center">1</span>
                                Select File
                            </div>
                            <div className={`w-16 h-0.5 ${analyzing || analysisResult ? 'bg-emerald-500' : 'bg-gray-800'}`} />
                            <div className={`flex items-center gap-2 ${analyzing ? 'text-emerald-400' : 'text-gray-500'}`}>
                                <span className="w-8 h-8 rounded-full bg-gray-800 border-2 border-current flex items-center justify-center">2</span>
                                Analyze
                            </div>
                            <div className="w-16 h-0.5 bg-gray-800" />
                            <div className="flex items-center gap-2 text-gray-500">
                                <span className="w-8 h-8 rounded-full bg-gray-800 border-2 border-current flex items-center justify-center">3</span>
                                Results
                            </div>
                        </div>

                        {/* Error Message */}
                        {error && (
                            <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-4 rounded-lg">
                                ❌ {error}
                            </div>
                        )}

                        {/* Upload Zone */}
                        {!file ? (
                            <UploadZone onFileSelect={handleFileSelect} isUploading={uploading} />
                        ) : (
                            <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
                                <div className="text-5xl mb-4">📄</div>
                                <h3 className="text-xl font-bold mb-2">{file.name}</h3>
                                <p className="text-gray-400 mb-6">{(file.size / 1024).toFixed(1)} KB • CSV</p>

                                {!uploading && !analyzing && (
                                    <div className="flex justify-center gap-4">
                                        <button
                                            onClick={() => setFile(null)}
                                            className="px-6 py-2 text-gray-400 hover:text-white transition"
                                        >
                                            Change File
                                        </button>
                                        <button
                                            onClick={handleUploadAndAnalyze}
                                            className="bg-emerald-600 hover:bg-emerald-500 px-8 py-2 rounded-lg font-bold shadow-lg shadow-emerald-500/20 transition hover:scale-105"
                                        >
                                            Run Analysis 🚀
                                        </button>
                                    </div>
                                )}

                                {/* Progress Bar */}
                                {(uploading || analyzing) && (
                                    <div className="max-w-md mx-auto mt-8">
                                        <div className="flex justify-between text-sm mb-2">
                                            <span className="text-emerald-400">
                                                {uploading ? 'Uploading...' : 'Detecting Leaks...'}
                                            </span>
                                            <span className="text-gray-400">{progress}%</span>
                                        </div>
                                        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-emerald-500 transition-all duration-500 ease-out"
                                                style={{ width: `${progress}%` }}
                                            />
                                        </div>
                                        <p className="text-xs text-gray-500 mt-4 animate-pulse">
                                            Analyzing supplier patterns, price drift, and duplicate charges...
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ) : (
                    /* Analysis Results View */
                    <div className="animate-in fade-in slide-in-from-bottom-8 duration-500">
                        <div className="bg-gradient-to-br from-emerald-900/20 to-gray-900 border border-emerald-500/30 rounded-2xl p-8 mb-8 text-center">
                            <div className="text-6xl mb-4">🎉</div>
                            <h2 className="text-3xl font-bold mb-2">Analysis Complete!</h2>
                            <p className="text-gray-400 text-lg mb-8">
                                We processed <span className="text-white font-bold">{analysisResult.invoices_parsed}</span> invoices
                                and found <span className="text-white font-bold">{analysisResult.findings_found}</span> potential leaks.
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto mb-8">
                                <div className="bg-gray-900/50 p-6 rounded-xl border border-gray-800">
                                    <div className="text-gray-400 text-sm mb-1">Potential Savings</div>
                                    <div className="text-3xl font-bold text-emerald-400">
                                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(analysisResult.total_potential_savings)}
                                    </div>
                                </div>
                                <div className="bg-gray-900/50 p-6 rounded-xl border border-gray-800 text-left">
                                    <div className="text-gray-400 text-sm mb-3">Breakdown</div>
                                    {Object.entries(analysisResult.findings_by_type).map(([type, count]) => (
                                        <div key={type} className="flex justify-between text-sm mb-1">
                                            <span className="capitalize">{type.replace(/_/g, ' ')}</span>
                                            <span className="font-bold text-white">{count}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="flex justify-center gap-4">
                                <Link
                                    href={`/spendcheck/upload?workspace=${workspaceId}`}
                                    onClick={() => {
                                        setFile(null);
                                        setAnalysisResult(null);
                                    }}
                                    className="px-6 py-3 text-gray-400 hover:text-white transition"
                                >
                                    Upload Another
                                </Link>
                                <Link
                                    href={`/spendcheck/findings?workspace=${workspaceId}`}
                                    className="bg-emerald-600 hover:bg-emerald-500 px-8 py-3 rounded-lg font-bold shadow-lg shadow-emerald-500/20 transition hover:scale-105"
                                >
                                    View Findings →
                                </Link>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function UploadPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-gray-950 flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div></div>}>
            <UploadContent />
        </Suspense>
    );
}
