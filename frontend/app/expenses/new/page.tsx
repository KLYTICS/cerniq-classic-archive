'use client';

import { useState } from 'react';
import { ReceiptUpload } from '@/components/receipts/ReceiptUpload';
import { Loader2, AlertCircle, CheckCircle } from 'lucide-react';

interface ParsedReceipt {
    merchantName: string;
    transactionDate: string;
    amount: number;
    currency: string;
    category: string;
    items?: Array<{
        description: string;
        price: number;
    }>;
    confidence: number;
}

interface ProcessReceiptResponse {
    expense: any;
    parsed: ParsedReceipt;
    warnings: {
        policyViolations: string[];
        isDuplicate: boolean;
    };
}

export default function NewExpensePage() {
    const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
    const [processing, setProcessing] = useState(false);
    const [result, setResult] = useState<ProcessReceiptResponse | null>(null);
    const [error, setError] = useState<string | null>(null);

    const organizationId = 'demo-org'; // Replace with actual org from context

    const handleUploadComplete = async (fileUrl: string) => {
        setReceiptUrl(fileUrl);
        setProcessing(true);
        setError(null);

        try {
            // Send to backend for AI processing
            const response = await fetch('/api/expenses/process-receipt', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-organization-id': organizationId,
                },
                body: JSON.stringify({ receiptUrl: fileUrl }),
            });

            if (!response.ok) {
                throw new Error('Failed to process receipt');
            }

            const data = await response.json();
            setResult(data);
        } catch (err) {
            console.error('Processing error:', err);
            setError(err instanceof Error ? err.message : 'Processing failed');
        } finally {
            setProcessing(false);
        }
    };

    const handleSubmit = async () => {
        if (!result) return;

        try {
            // Submit the expense
            const response = await fetch(`/api/expenses/${result.expense.id}/submit`, {
                method: 'POST',
                headers: {
                    'x-organization-id': organizationId,
                },
            });

            if (!response.ok) {
                throw new Error('Failed to submit expense');
            }

            // Redirect to expenses list
            window.location.href = '/expenses';
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Submission failed');
        }
    };

    return (
        <div className="max-w-4xl mx-auto p-6">
            <h1 className="text-3xl font-bold mb-8">New Expense</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Left: Upload */}
                <div>
                    <h2 className="text-lg font-semibold mb-4">Upload Receipt</h2>
                    <ReceiptUpload
                        organizationId={organizationId}
                        onUploadComplete={handleUploadComplete}
                    />

                    {processing && (
                        <div className="mt-6 flex items-center justify-center p-6 bg-blue-50 rounded-lg">
                            <Loader2 className="w-6 h-6 text-blue-600 animate-spin mr-3" />
                            <p className="text-blue-700">Processing receipt with AI...</p>
                        </div>
                    )}
                </div>

                {/* Right: Extracted Data */}
                <div>
                    <h2 className="text-lg font-semibold mb-4">Extracted Information</h2>

                    {!result && !processing && (
                        <div className="text-center text-gray-500 py-12">
                            Upload a receipt to extract expense details
                        </div>
                    )}

                    {result && (
                        <div className="space-y-4">
                            {/* Warnings */}
                            {result.warnings.isDuplicate && (
                                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start">
                                    <AlertCircle className="w-5 h-5 text-yellow-600 mr-2 mt-0.5" />
                                    <div className="text-sm text-yellow-800">
                                        <strong>Potential Duplicate:</strong> A similar expense was found
                                    </div>
                                </div>
                            )}

                            {result.warnings.policyViolations.length > 0 && (
                                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                                    <div className="flex items-start mb-2">
                                        <AlertCircle className="w-5 h-5 text-red-600 mr-2 mt-0.5" />
                                        <strong className="text-sm text-red-800">Policy Violations:</strong>
                                    </div>
                                    <ul className="list-disc list-inside text-sm text-red-700 ml-7">
                                        {result.warnings.policyViolations.map((violation, i) => (
                                            <li key={i}>{violation}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Extracted Fields */}
                            <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
                                <div>
                                    <label className="text-xs font-medium text-gray-500">Merchant</label>
                                    <input
                                        type="text"
                                        value={result.parsed.merchantName}
                                        className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"
                                        readOnly
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs font-medium text-gray-500">Amount</label>
                                        <input
                                            type="number"
                                            value={result.parsed.amount}
                                            className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"
                                            readOnly
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-gray-500">Currency</label>
                                        <input
                                            type="text"
                                            value={result.parsed.currency}
                                            className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"
                                            readOnly
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-medium text-gray-500">Date</label>
                                    <input
                                        type="date"
                                        value={result.parsed.transactionDate}
                                        className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"
                                        readOnly
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-medium text-gray-500">Category</label>
                                    <input
                                        type="text"
                                        value={result.parsed.category}
                                        className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"
                                        readOnly
                                    />
                                </div>

                                <div className="flex items-center pt-2">
                                    <CheckCircle className="w-4 h-4 text-green-600 mr-2" />
                                    <span className="text-sm text-gray-600">
                                        AI Confidence: {(result.parsed.confidence * 100).toFixed(0)}%
                                    </span>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={() => {
                                        setReceiptUrl(null);
                                        setResult(null);
                                    }}
                                    className="flex-1 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSubmit}
                                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                                >
                                    Submit Expense
                                </button>
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                            <p className="text-sm text-red-700">{error}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
