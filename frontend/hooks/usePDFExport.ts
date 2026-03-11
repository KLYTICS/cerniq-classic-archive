import { useState, useCallback } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

interface ExportConfig {
    elementId: string;
    filename?: string;
    onSuccess?: () => void;
    onError?: (error: unknown) => void;
}

export function usePDFExport() {
    const [isExporting, setIsExporting] = useState(false);

    const exportToPDF = useCallback(async ({
        elementId,
        filename = 'export.pdf',
        onSuccess,
        onError
    }: ExportConfig) => {
        setIsExporting(true);

        try {
            const element = document.getElementById(elementId);
            if (!element) {
                throw new Error(`Element with ID ${elementId} not found`);
            }

            // Briefly adjust element styles for better capture if needed
            // (e.g. expanding scrollable areas)
            const originalStyle = element.style.cssText;
            const originalHeight = element.style.height;
            const originalOverflow = element.style.overflow;

            element.style.height = 'auto';
            element.style.overflow = 'visible';

            let canvas: HTMLCanvasElement;
            try {
                canvas = await html2canvas(element, {
                    scale: 2, // Higher quality
                    useCORS: true,
                    logging: false,
                    backgroundColor: '#020617', // Match slate-950 background
                    foreignObjectRendering: true,
                    onclone: (doc) => {
                        // html2canvas cannot parse Tailwind v4 oklch/oklab values reliably.
                        // Override the key variables in the cloned document with hex fallbacks.
                        const style = doc.createElement('style');
                        style.textContent = `
                          :root {
                            --color-slate-950: #020617;
                            --color-slate-900: #0f172a;
                            --color-slate-800: #1e293b;
                            --color-slate-700: #334155;
                            --color-slate-600: #475569;
                            --color-slate-500: #64748b;
                            --color-slate-400: #94a3b8;
                            --color-amber-500: #f59e0b;
                            --color-amber-400: #fbbf24;
                            --color-orange-500: #f97316;
                            --color-blue-500: #3b82f6;
                            --color-emerald-500: #10b981;
                            --color-red-500: #ef4444;
                            --color-white: #ffffff;
                            --color-black: #000000;
                          }
                        `;
                        doc.head.appendChild(style);
                    },
                });
            } finally {
                // Always restore styles even if export fails.
                element.style.cssText = originalStyle;
                element.style.height = originalHeight;
                element.style.overflow = originalOverflow;
            }

            const imgWidth = 210; // A4 width in mm
            const pageHeight = 295; // A4 height in mm
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            let heightLeft = imgHeight;

            const pdf = new jsPDF('p', 'mm', 'a4');
            let position = 0;

            // Add first page
            pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;

            // Add subsequent pages if content is taller than one A4 page
            while (heightLeft >= 0) {
                position = heightLeft - imgHeight;
                pdf.addPage();
                pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight);
                heightLeft -= pageHeight;
            }

            pdf.save(filename);
            onSuccess?.();

        } catch (err) {
            console.error('PDF Export failed:', err);
            onError?.(err);
        } finally {
            setIsExporting(false);
        }
    }, []);

    return {
        exportToPDF,
        isExporting,
    };
}
