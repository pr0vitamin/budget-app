'use client';

import { useMemo } from 'react';

interface CatPiggyBankProps {
    name: string;
    balance: number;
    target?: number;
    autoAllocationAmount?: number;
    reserved?: number;
    color?: string;
    size?: 'sm' | 'md' | 'lg';
    isOverspent?: boolean;
    onClick?: () => void;
}

const sizeClasses = {
    sm: 'w-20 h-20',
    md: 'w-24 h-24',
    lg: 'w-32 h-32',
};

// Organic squircle shape for the head
const headPath = "M 40 75 C 20 75 10 65 10 45 C 10 25 20 15 40 15 C 60 15 70 25 70 45 C 70 65 60 75 40 75 Z";

export function CatPiggyBank({
    name,
    balance,
    target,
    autoAllocationAmount = 0,
    reserved = 0,
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
        if (autoAllocationAmount > 0) {
            if (balance <= 0) return 0;
            return Math.min(100, (balance / autoAllocationAmount) * 100);
        }
        return balance > 0 ? 100 : 0;
    }, [balance, target, autoAllocationAmount]);

    // Determine cat expression
    const expression = useMemo(() => {
        if (isOverspent || balance < 0) return 'angry';
        if (fillPercent >= 100) return 'happy';
        if (fillPercent >= 50) return 'content';
        return 'neutral';
    }, [isOverspent, balance, fillPercent]);

    // Dynamic eyes based on expression
    const renderEyes = () => {
        const eyeColor = "#374151";

        if (expression === 'happy') {
            // Closed happy eyes
            return (
                <g fill="none" stroke={eyeColor} strokeWidth="2.5" strokeLinecap="round">
                    <path d="M 28 38 Q 32 34 36 38" />
                    <path d="M 44 38 Q 48 34 52 38" />
                </g>
            );
        }

        if (expression === 'angry') {
            // Angry eyes with sloping brows
            return (
                <g fill={eyeColor}>
                    <circle cx="32" cy="38" r="3.5" />
                    <circle cx="48" cy="38" r="3.5" />
                    <line x1="28" y1="34" x2="36" y2="37" stroke={eyeColor} strokeWidth="2.5" strokeLinecap="round" />
                    <line x1="52" y1="34" x2="44" y2="37" stroke={eyeColor} strokeWidth="2.5" strokeLinecap="round" />
                    {/* Shinies */}
                    <circle cx="33" cy="37" r="1.2" fill="white" />
                    <circle cx="49" cy="37" r="1.2" fill="white" />
                </g>
            );
        }

        // Neutral/Content: Big shiny eyes
        return (
            <g>
                <circle cx="30" cy="38" r="4.5" fill={eyeColor} />
                <circle cx="50" cy="38" r="4.5" fill={eyeColor} />
                {/* Highlights for extra cuteness */}
                <circle cx="28.5" cy="36.5" r="1.5" fill="white" />
                <circle cx="48.5" cy="36.5" r="1.5" fill="white" />
                <circle cx="31.5" cy="40" r="1" fill="white" opacity="0.7" />
                <circle cx="51.5" cy="40" r="1" fill="white" opacity="0.7" />
            </g>
        );
    };

    const renderMouth = () => {
        const stroke = "#374151";
        switch (expression) {
            case 'happy':
                return <path d="M 37 45 Q 40 48 43 45" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" />;
            case 'angry':
                return <path d="M 37 48 Q 40 45 43 48" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" />;
            case 'content':
                return <path d="M 38 46 Q 40 47 42 46" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" />;
            default: // neutral
                return <path d="M 38 46 L 42 46" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" />;
        }
    };

    const fillColor = isOverspent ? '#f87171' : color;
    const bgColor = isOverspent ? '#fecaca' : '#fff1f2'; // Very light pinkish-white default

    return (
        <button
            onClick={onClick}
            className={`flex flex-col items-center gap-1 transition-transform active:scale-95 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 rounded-2xl p-1`}
        >
            <div className={`relative ${sizeClasses[size]}`}>
                <svg viewBox="0 0 80 80" className="w-full h-full drop-shadow-sm">
                    <defs>
                        <clipPath id={`body-clip-${name}`}>
                            <path d={headPath} />
                        </clipPath>
                    </defs>

                    {/* Ears (behind body) - Rounded */}
                    <path d="M 15 30 C 10 20 12 10 30 20 Z" fill={fillColor} className="transition-colors duration-300" />
                    <path d="M 65 30 C 70 20 68 10 50 20 Z" fill={fillColor} className="transition-colors duration-300" />
                    {/* Inner ears - Rounded */}
                    <path d="M 16 28 Q 14 18 26 22 Z" fill="#fce7f3" opacity="0.6" />
                    <path d="M 64 28 Q 66 18 54 22 Z" fill="#fce7f3" opacity="0.6" />

                    {/* Body Background */}
                    <path d={headPath} fill={bgColor} stroke={fillColor} strokeWidth="2.5" className="transition-colors duration-300" />

                    {/* Liquid Fill Level */}
                    <g clipPath={`url(#body-clip-${name})`}>
                        <rect
                            x="0"
                            y={75 - (fillPercent * 0.6)} // Map 0-100% to approximate height within path
                            width="80"
                            height="80"
                            fill={fillColor}
                            opacity="0.25"
                            className="transition-all duration-700 ease-in-out"
                        />
                        {/* Wavy liquid top line could go here for extra polish */}
                    </g>

                    {/* Facial Features */}
                    {renderEyes()}

                    {/* Nose */}
                    <ellipse cx="40" cy="43" rx="2.5" ry="1.5" fill="#f472b6" />

                    {/* Mouth */}
                    {renderMouth()}

                    {/* Cheeks */}
                    <circle cx="22" cy="45" r="3.5" fill="#fbcfe8" opacity="0.6" />
                    <circle cx="58" cy="45" r="3.5" fill="#fbcfe8" opacity="0.6" />

                    {/* Whiskers - 3 per side */}
                    <g stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" opacity="0.5">
                        <line x1="16" y1="41" x2="23" y2="43" />
                        <line x1="15" y1="45" x2="23" y2="45" />
                        <line x1="16" y1="49" x2="23" y2="47" />

                        <line x1="64" y1="41" x2="57" y2="43" />
                        <line x1="65" y1="45" x2="57" y2="45" />
                        <line x1="64" y1="49" x2="57" y2="47" />
                    </g>
                </svg>
            </div>

            {/* Label & Balance */}
            <div className="flex flex-col items-center">
                <span className="text-xs font-semibold text-gray-700 truncate max-w-[80px]">{name}</span>

                {reserved > 0 ? (
                    <div className="flex flex-col items-center leading-none mt-1">
                        <span className={`text-sm font-bold ${isOverspent || balance < 0 ? 'text-red-500' : 'text-gray-900'}`}>
                            ${Math.abs(balance).toFixed(0)}
                        </span>
                        <span className="text-[9px] text-indigo-500 font-medium">
                            +${reserved}
                        </span>
                    </div>
                ) : (
                    <span className={`text-sm font-bold mt-1 ${isOverspent || balance < 0 ? 'text-red-500' : 'text-gray-900'}`}>
                        ${Math.abs(balance).toFixed(0)}
                    </span>
                )}
            </div>
        </button>
    );
}
