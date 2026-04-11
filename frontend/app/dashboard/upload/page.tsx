'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';

interface UploadResponse {
    file_id?: string;
}

interface AnalysisResult {
    invoices_parsed?: number;
    findings_found?: number;
}

function getUploadErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message) {
        return error.message;
    }
    return 'Upload failed. Please try a valid CSV export.';
}

export default function FileUploadPage() {
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<'idle' | 'uploading' | 'analyzing' | 'complete'>('idle');
    const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
    const [error, setError] = useState('');
    const router = useRouter();

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            setFile(e.dataTransfer.files[0]);
        }
    };

    const handleUpload = async () => {
        if (!file) return;

        setLoading(true);
        setError('');
        setStatus('uploading');

        try {
            // 1. Upload File
            const formData = new FormData();
            formData.append('file', file);

            // We need to implement file upload in api.ts properly later, using axios directly for now
            // Assuming apiClient has a method or we'll add it
            const uploadRes = (await apiClient.uploadFile(formData)) as UploadResponse;
            if (!uploadRes.file_id) {
                throw new Error('Upload did not return a file id');
            }

            // 2. Trigger Analysis
            setStatus('analyzing');
            const analysisRes = (await apiClient.runAnalysis({
                upload_id: uploadRes.file_id,
                workspace_id: '00000000-0000-0000-0000-000000000000', // Placeholder
            })) as AnalysisResult;

            setAnalysisResult(analysisRes);
            setStatus('complete');

            // 3. Generate Report
            await apiClient.generateReport({
                workspace_id: '00000000-0000-0000-0000-000000000000',
            });

        } catch (err: unknown) {
            console.error(err);
            setError(getUploadErrorMessage(err));
            setStatus('idle');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-transparent px-8 py-10 text-[var(--dashboard-text-primary)]">
            <div className="max-w-3xl mx-auto">
                <h1 className="text-3xl font-bold mb-2">Upload Financial Data</h1>
                <p className="mb-8 text-[var(--dashboard-text-secondary)]">Upload your AP export (CSV) or vendor contracts (PDF) to start the audit.</p>

                {status === 'complete' ? (
                    <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-8 text-center animate-in fade-in zoom-in duration-300">
                        <div className="text-5xl mb-4">🎉</div>
                        <h2 className="text-2xl font-bold text-green-200 mb-2">Analysis Complete!</h2>
                        <p className="mb-6 text-[var(--dashboard-text-secondary)]">We found potential leaks in your data.</p>

                        <div className="grid grid-cols-2 gap-4 max-w-md mx-auto mb-8">
                            <div className="cerniq-dashboard-surface rounded-xl p-4">
                                <div className="text-2xl font-bold text-[var(--dashboard-text-primary)]">{analysisResult?.invoices_parsed}</div>
                                <div className="text-xs text-[var(--dashboard-text-muted)]">Invoices Parsed</div>
                            </div>
                            <div className="cerniq-dashboard-surface rounded-xl p-4">
                                <div className="text-2xl font-bold text-amber-400">{analysisResult?.findings_found}</div>
                                <div className="text-xs text-[var(--dashboard-text-muted)]">Potential Leaks</div>
                            </div>
                        </div>

                        <button
                            onClick={() => router.push('/dashboard/report/latest')}
                            className="bg-green-600 hover:bg-green-500 text-white px-8 py-3 rounded-lg font-bold transition shadow-lg shadow-green-500/20"
                        >
                            View Leak Report
                        </button>
                    </div>
                ) : (
                    <div
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                        className={`rounded-2xl border-2 border-dashed p-12 text-center transition ${file ? 'border-amber-500 bg-amber-500/10' : 'border-[var(--dashboard-border)] bg-[rgba(255,251,239,0.75)] hover:border-amber-500/50 hover:bg-[rgba(255,246,230,0.92)]'
                            }`}
                    >
                        {file ? (
                            <div>
                                <div className="text-4xl mb-4">📄</div>
                                <div className="font-bold text-lg mb-1">{file.name}</div>
                                <div className="mb-6 text-sm text-[var(--dashboard-text-muted)]">{(file.size / 1024).toFixed(2)} KB</div>

                                {loading ? (
                                    <div className="flex flex-col items-center">
                                        <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                                        <div className="text-amber-300 font-medium animate-pulse">
                                            {status === 'uploading' ? 'Uploading...' : 'Analyzing for Leaks...'}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex justify-center gap-4">
                                        <button
                                            onClick={() => setFile(null)}
                                            className="rounded-lg px-6 py-2 text-[var(--dashboard-text-secondary)] transition hover:bg-[rgba(247,228,188,0.48)] hover:text-[var(--dashboard-text-primary)]"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleUpload}
                                            className="bg-amber-600 hover:bg-amber-500 text-white px-6 py-2 rounded-lg font-bold transition shadow-lg shadow-amber-500/20"
                                        >
                                            Run Audit
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div>
                                <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[rgba(247,228,188,0.52)] text-3xl">
                                    📂
                                </div>
                                <h3 className="text-xl font-bold mb-2">Drag & Drop File Here</h3>
                                <p className="mb-6 text-[var(--dashboard-text-secondary)]">or click to browse from your computer</p>
                                <input
                                    type="file"
                                    className="hidden"
                                    id="file-upload"
                                    accept=".csv,.pdf"
                                    onChange={(e) => e.target.files && setFile(e.target.files[0])}
                                />
                                <label
                                    htmlFor="file-upload"
                                    className="inline-block cursor-pointer rounded-lg bg-[var(--dashboard-surface-elevated)] px-6 py-3 font-bold text-[var(--dashboard-text-primary)] transition hover:bg-white"
                                >
                                    Browse Files
                                </label>
                                <div className="mt-8 text-xs text-[var(--dashboard-text-muted)]">
                                    Supported: AP Exports (CSV), Contracts (PDF)
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {error && (
                    <div className="mt-6 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-center text-red-700">
                        {error}
                    </div>
                )}
            </div>
        </div>
    );
}
