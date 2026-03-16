'use client';

import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';

interface UploadZoneProps {
    onFileSelect: (file: File) => void;
    isUploading: boolean;
}

export default function UploadZone({ onFileSelect, isUploading }: UploadZoneProps) {
    const onDrop = useCallback((acceptedFiles: File[]) => {
        if (acceptedFiles.length > 0) {
            onFileSelect(acceptedFiles[0]);
        }
    }, [onFileSelect]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'text/csv': ['.csv'],
            'application/vnd.ms-excel': ['.csv'],
        },
        maxFiles: 1,
        disabled: isUploading,
    });

    return (
        <div
            {...getRootProps()}
            className={`cursor-pointer rounded-[1.4rem] border-2 border-dashed p-12 text-center transition
        ${isDragActive ? 'border-cyan-400 bg-cyan-50' : 'border-slate-200 bg-white/80 hover:border-cyan-300 hover:bg-slate-50'}
        ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}
      `}
        >
            <input {...getInputProps()} />
            <div className="flex flex-col items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-cyan-50 text-3xl">
                    {isUploading ? '⏳' : '📤'}
                </div>
                <div>
                    <h3 className="mb-2 text-xl font-semibold text-slate-950">
                        {isDragActive ? 'Drop file here' : 'Drag & drop your AP Export'}
                    </h3>
                    <p className="mx-auto max-w-sm text-sm text-slate-500">
                        Supported formats: CSV (standard columns: Vendor, Invoice Number, Date, Amount, Description)
                    </p>
                </div>
                {!isUploading && (
                    <button className="cerniq-button-secondary px-4 py-2 text-sm">
                        Browse Files
                    </button>
                )}
            </div>
        </div>
    );
}
