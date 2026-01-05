'use client';

import { useMemo } from 'react';

interface CatPiggyBankProps {
    name: string;
    balance: number;
    target?: number; // For savings goals
    color?: string;
    size?: 'sm' | 'md' | 'lg';
    isOverspent?: boolean;
    onClick?: () => void;
}

const sizeClasses = {
    sm: 'w-16 h-16',
    md: 'w-20 h-20',
    lg: 'w-24 h-24',
};

export function CatPiggyBank({
    name,
    balance,
    target,
    color = '#6366f1',
    size = 'md',
    isOverspent = false,
    onClick,
}: CatPiggyBankProps) {
    // Calculate fill percentage (0-100)
    const fillPercent = useMemo(() => {
        if (target && target > 0) {
            return Math.min(100, Math.max(0, (balance / target) * 100));
        }
        // For spending buckets, we don't show fill based on target
        // Just show full if positive, empty if negative
        return balance > 0 ? 100 : 0;
    }, [balance, target]);

    // Determine cat expression based on state
    const expression = useMemo(() => {
        if (isOverspent || balance < 0) return 'angry';
        if (fillPercent >= 100) return 'happy';
        if (fillPercent >= 50) return 'content';
        return 'neutral';
    }, [isOverspent, balance, fillPercent]);

    const eyeStyle = {
        angry: { leftY: 28, rightY: 28, brow: true },
        happy: { leftY: 30, rightY: 30, curved: true },
        content: { leftY: 30, rightY: 30 },
        neutral: { leftY: 30, rightY: 30 },
    };

    const mouthStyle = {
        angry: 'M 35 42 Q 40 38 45 42', // Frown
        happy: 'M 35 40 Q 40 46 45 40', // Big smile
        content: 'M 36 41 Q 40 44 44 41', // Small smile
        neutral: 'M 36 42 L 44 42', // Neutral line
    };

    return (
        <button
            onClick={onClick}
            className={`flex flex-col items-center gap-1 transition-transform active:scale-95 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 rounded-full`}
        >
            <div className={`relative ${sizeClasses[size]}`}>
                <svg viewBox="0 0 80 80" className="w-full h-full drop-shadow-md">
                    {/* Ears */}
                    <path
                        d="M 15 25 L 8 8 L 28 18 Z"
                        fill={isOverspent ? '#ef4444' : color}
                        className="transition-colors duration-300"
                    />
                    <path
                        d="M 65 25 L 72 8 L 52 18 Z"
                        fill={isOverspent ? '#ef4444' : color}
                        className="transition-colors duration-300"
                    />
                    {/* Inner ears */}
                    <path d="M 16 22 L 12 12 L 24 19 Z" fill="#fce4ec" />
                    <path d="M 64 22 L 68 12 L 56 19 Z" fill="#fce4ec" />

                    {/* Face background */}
                    <circle
                        cx="40"
                        cy="40"
                        r="28"
                        fill={isOverspent ? '#fecaca' : '#fef3c7'}
                        className="transition-colors duration-300"
                    />

                    {/* Fill level (like liquid in a jar) */}
                    <defs>
                        <clipPath id={`fill-clip-${name}`}>
                            <circle cx="40" cy="40" r="26" />
                        </clipPath>
                    </defs>
                    <rect
                        x="14"
                        y={68 - (fillPercent * 52) / 100}
                        width="52"
                        height={(fillPercent * 52) / 100}
                        fill={isOverspent ? '#ef4444' : color}
                        opacity="0.3"
                        clipPath={`url(#fill-clip-${name})`}
                        className="transition-all duration-500 ease-out"
                    />

                    {/* Face outline */}
                    <circle
                        cx="40"
                        cy="40"
                        r="28"
                        fill="none"
                        stroke={isOverspent ? '#ef4444' : color}
                        strokeWidth="3"
                        className="transition-colors duration-300"
                    />

                    {/* Angry eyebrows */}
                    {expression === 'angry' && (
                        <>
                            <line x1="26" y1="24" x2="34" y2="28" stroke="#374151" strokeWidth="2" />
                            <line x1="54" y1="24" x2="46" y2="28" stroke="#374151" strokeWidth="2" />
                        </>
                    )}

                    {/* Eyes */}
                    {expression === 'happy' ? (
                        <>
                            {/* Happy closed eyes (curved lines) */}
                            <path d="M 28 30 Q 31 26 34 30" stroke="#374151" strokeWidth="2" fill="none" />
                            <path d="M 46 30 Q 49 26 52 30" stroke="#374151" strokeWidth="2" fill="none" />
                        </>
                    ) : (
                        <>
                            {/* Regular eyes */}
                            <circle cx="31" cy={eyeStyle[expression].leftY} r="4" fill="#374151" />
                            <circle cx="49" cy={eyeStyle[expression].rightY} r="4" fill="#374151" />
                            {/* Eye highlights */}
                            <circle cx="32" cy={eyeStyle[expression].leftY - 1} r="1.5" fill="white" />
                            <circle cx="50" cy={eyeStyle[expression].rightY - 1} r="1.5" fill="white" />
                        </>
                    )}

                    {/* Nose */}
                    <ellipse cx="40" cy="38" rx="3" ry="2" fill="#f472b6" />

                    {/* Mouth */}
                    <path d={mouthStyle[expression]} stroke="#374151" strokeWidth="2" fill="none" />

                    {/* Whiskers */}
                    <line x1="18" y1="36" x2="28" y2="38" stroke="#9ca3af" strokeWidth="1" />
                    <line x1="18" y1="40" x2="28" y2="40" stroke="#9ca3af" strokeWidth="1" />
                    <line x1="18" y1="44" x2="28" y2="42" stroke="#9ca3af" strokeWidth="1" />
                    <line x1="62" y1="36" x2="52" y2="38" stroke="#9ca3af" strokeWidth="1" />
                    <line x1="62" y1="40" x2="52" y2="40" stroke="#9ca3af" strokeWidth="1" />
                    <line x1="62" y1="44" x2="52" y2="42" stroke="#9ca3af" strokeWidth="1" />
                </svg>
            </div>

            {/* Label */}
            <span className="text-xs font-medium text-gray-600 truncate max-w-[80px]">{name}</span>

            {/* Balance */}
            <span
                className={`text-sm font-bold ${isOverspent || balance < 0 ? 'text-red-500' : 'text-gray-800'
                    }`}
            >
                ${Math.abs(balance).toFixed(2)}
                {balance < 0 && ' '}
            </span>
        </button>
    );
}
