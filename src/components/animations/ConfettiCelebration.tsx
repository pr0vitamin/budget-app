'use client';

import { motion, AnimatePresence } from 'motion/react';
import { useEffect, useState } from 'react';

interface ConfettiPiece {
    id: number;
    x: number;
    delay: number;
    color: string;
    emoji: string;
    rotateDirection: number;
    duration: number;
}

interface ConfettiCelebrationProps {
    trigger: boolean;
    onComplete?: () => void;
}

const EMOJIS = ['🐟', '🐠', '🍣', '🍖', '🥩', '🐱', '🐾', '🥛', '🐭', '🦐'];
const COLORS = ['#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#22c55e', '#f97316'];

export function ConfettiCelebration({ trigger, onComplete }: ConfettiCelebrationProps) {
    const [pieces, setPieces] = useState<ConfettiPiece[]>([]);

     
    useEffect(() => {
        if (trigger) {
            // Generate confetti pieces
            const newPieces = Array.from({ length: 30 }, (_, i) => ({
                id: i,
                x: Math.random() * 100, // % from left
                delay: Math.random() * 0.3,
                color: COLORS[Math.floor(Math.random() * COLORS.length)],
                emoji: EMOJIS[Math.floor(Math.random() * EMOJIS.length)],
                rotateDirection: Math.random() > 0.5 ? 360 : -360,
                duration: 2 + Math.random(),
            }));
            setPieces(newPieces);

            // Clear after animation
            const timer = setTimeout(() => {
                setPieces([]);
                onComplete?.();
            }, 2500);

            return () => clearTimeout(timer);
        }
    }, [trigger, onComplete]);

    return (
        <AnimatePresence>
            {pieces.length > 0 && (
                <div className="fixed inset-0 pointer-events-none z-[100] overflow-hidden">
                    {pieces.map((piece) => (
                        <motion.div
                            key={piece.id}
                            className="absolute text-2xl"
                            style={{ left: `${piece.x}%` }}
                            initial={{ y: -50, opacity: 1, rotate: 0 }}
                            animate={{
                                y: window.innerHeight + 50,
                                opacity: [1, 1, 0],
                                rotate: piece.rotateDirection,
                            }}
                            transition={{
                                duration: piece.duration,
                                delay: piece.delay,
                                ease: 'easeIn',
                            }}
                        >
                            {piece.emoji}
                        </motion.div>
                    ))}
                </div>
            )}
        </AnimatePresence>
    );
}
