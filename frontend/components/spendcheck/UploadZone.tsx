'use client';

import { useState, useCallback } from 'react';
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
            className={`border-2 border-dashed rounded-xl p-12 text-center transition cursor-pointer
        ${isDragActive ? 'border-emerald-500 bg-emerald-500/10' : 'border-gray-700 hover:border-gray-500 hover:bg-gray-800/50'}
        ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}
      `}
        >
            <input {...getInputProps()} />
            <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center text-3xl">
                    {isUploading ? '⏳' : '📤'}
                </div>
                <div>
                    <h3 className="text-xl font-semibold mb-2">
                        {isDragActive ? 'Drop file here' : 'Drag & drop your AP Export'}
                    </h3>
                    <p className="text-gray-400 text-sm max-w-sm mx-auto">
                        Supported formats: CSV (standard columns: Vendor, Invoice Number, Date, Amount, Description)
                    </p>
                </div>
                {!isUploading && (
                    <button className="bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition">
                        Browse Files
                    </button>
                )}
            </div>
        </div>
    );
}
