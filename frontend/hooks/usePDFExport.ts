import { useState, useCallback } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { useTranslation } from '@/lib/i18n';

interface ExportConfig {
    elementId: string;
    filename?: string;
    onSuccess?: () => void;
    onError?: (error: unknown) => void;
}

export function usePDFExport() {
    const [isExporting, setIsExporting] = useState(false);
    const { t } = useTranslation();

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

            const canvas = await html2canvas(element, {
                scale: 2, // Higher quality
                useCORS: true,
                logging: false,
                backgroundColor: '#020617', // Match slate-950 background
            });

            // Restore original styles
            element.style.cssText = originalStyle;
            element.style.height = originalHeight;
            element.style.overflow = originalOverflow;

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
