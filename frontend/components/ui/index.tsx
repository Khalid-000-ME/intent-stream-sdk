'use client';

import React from 'react';

// ============================================================================
// BUTTON COMPONENT
// ============================================================================

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'danger';
    children: React.ReactNode;
}

export function Button({
    variant = 'primary',
    children,
    className = '',
    ...props
}: ButtonProps) {
    const baseStyles = 'font-mono font-bold text-sm uppercase px-6 h-14 border-2 transition-all duration-150';

    const variantStyles = {
        primary: 'bg-yellow text-black border-black hover:bg-black hover:text-yellow hover:border-yellow',
        secondary: 'bg-white text-black border-black hover:bg-black hover:text-white',
        danger: 'bg-red text-white border-black hover:bg-black hover:text-red hover:border-red'
    };

    return (
        <button
            className={`${baseStyles} ${variantStyles[variant]} ${className}`}
            {...props}
        >
            {children}
        </button>
    );
}

// ============================================================================
// CARD COMPONENT
// ============================================================================

interface CardProps {
    children: React.ReactNode;
    className?: string;
    variant?: 'white' | 'black';
}

export function Card({ children, className = '', variant = 'white' }: CardProps) {
    const variantStyles = {
        white: 'bg-white border-black text-black',
        black: 'bg-black border-yellow text-white'
    };

    return (
        <div className={`border-2 p-6 ${variantStyles[variant]} ${className}`}>
            {children}
        </div>
    );
}

// ============================================================================
// TABLE COMPONENT
// ============================================================================

interface TableProps {
    headers: string[];
    rows: React.ReactNode[][];
}

export function Table({ headers, rows }: TableProps) {
    return (
        <div className="w-full border-2 border-black overflow-x-auto">
            <table className="w-full border-collapse">
                <thead>
                    <tr className="bg-black text-yellow">
                        {headers.map((header, i) => (
                            <th
                                key={i}
                                className="px-4 py-3 text-left text-xs font-mono uppercase border border-yellow"
                            >
                                {header}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, i) => (
                        <tr
                            key={i}
                            className={i % 2 === 0 ? 'bg-white' : 'bg-gray-900 text-white'}
                        >
                            {row.map((cell, j) => (
                                <td
                                    key={j}
                                    className="px-4 py-3 text-sm border border-black"
                                >
                                    {cell}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// ============================================================================
// INPUT COMPONENT
// ============================================================================

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
}

export function Input({ label, className = '', ...props }: InputProps) {
    return (
        <div className="w-full">
            {label && (
                <label className="block mb-2 text-xs font-mono font-bold uppercase">
                    {label}
                </label>
            )}
            <input
                className={`w-full h-14 px-4 border-2 border-black bg-white text-base focus:border-yellow focus:outline-none ${className}`}
                {...props}
            />
        </div>
    );
}

// ============================================================================
// PROGRESS BAR COMPONENT
// ============================================================================

interface ProgressBarProps {
    value: number; // 0-100
    label?: string;
}

export function ProgressBar({ value, label }: ProgressBarProps) {
    return (
        <div className="w-full">
            {label && (
                <div className="mb-2 text-sm font-mono">{label}</div>
            )}
            <div className="w-full h-8 border-2 border-black bg-white">
                <div
                    className="h-full bg-yellow transition-all duration-300"
                    style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
                />
            </div>
        </div>
    );
}

// ============================================================================
// STATUS BADGE COMPONENT
// ============================================================================

interface StatusBadgeProps {
    status: 'success' | 'pending' | 'error';
    children: React.ReactNode;
}

export function StatusBadge({ status, children }: StatusBadgeProps) {
    const statusStyles = {
        success: 'bg-green text-black',
        pending: 'bg-yellow text-black',
        error: 'bg-red text-white'
    };

    return (
        <span className={`inline-block px-3 py-1 text-xs font-mono font-bold uppercase border-2 border-black ${statusStyles[status]}`}>
            {children}
        </span>
    );
}

// ============================================================================
// MODAL COMPONENT
// ============================================================================

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
            <div className="bg-white border-4 border-black max-w-2xl w-full max-h-[90vh] overflow-auto">
                <div className="flex items-center justify-between p-6 border-b-2 border-black">
                    <h2 className="text-2xl font-mono font-bold uppercase">{title}</h2>
                    <button
                        onClick={onClose}
                        className="text-2xl font-bold hover:text-red transition-colors"
                    >
                        ✕
                    </button>
                </div>
                <div className="p-6">
                    {children}
                </div>
            </div>
        </div>
    );
}

// ============================================================================
// SPINNER COMPONENT
// ============================================================================

export function Spinner() {
    return (
        <div className="inline-block w-8 h-8 border-4 border-black border-t-yellow animate-spin" />
    );
}
