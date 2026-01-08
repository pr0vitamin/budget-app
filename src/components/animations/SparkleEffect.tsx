'use client';

import { motion, AnimatePresence } from 'motion/react';
import { useEffect, useState, useRef } from 'react';

interface SparkleEffectProps {
    trigger: boolean;
    onComplete?: () => void;
    color?: string;
}

const EMOJIS = ['✨', '⭐', '🌟', '💫'];

export function SparkleEffect({ trigger, onComplete, color = '#fbbf24' }: SparkleEffectProps) {
    const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number; scale: number; rotation: number; emoji: string }>>([]);
    const triggerCountRef = useRef(0);

    useEffect(() => {
        if (trigger) {
            // Increment counter to ensure unique particle IDs even on re-trigger
            triggerCountRef.current += 1;
            const baseId = triggerCountRef.current * 100;

            // Generate more, bigger particles with wider spread
            const newParticles = Array.from({ length: 20 }, (_, i) => ({
                id: baseId + i,
                x: (Math.random() - 0.5) * 150, // Wider spread
                y: (Math.random() - 0.5) * 150,
                scale: 1 + Math.random() * 1.5, // Bigger (1x to 2.5x)
                rotation: Math.random() * 720, // More spin
                emoji: EMOJIS[Math.floor(Math.random() * EMOJIS.length)],
            }));
            setParticles(newParticles);

            // Clear after animation
            const timer = setTimeout(() => {
                setParticles([]);
                onComplete?.();
            }, 800);

            return () => clearTimeout(timer);
        }
    }, [trigger, onComplete]);

    return (
        <AnimatePresence>
            {particles.map((particle) => (
                <motion.div
                    key={particle.id}
                    className="absolute pointer-events-none text-2xl"
                    initial={{ opacity: 1, scale: 0, x: 0, y: 0, rotate: 0 }}
                    animate={{
                        opacity: [1, 1, 0],
                        scale: particle.scale,
                        x: particle.x,
                        y: particle.y,
                        rotate: particle.rotation,
                    }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                    style={{ color }}
                >
                    {particle.emoji}
                </motion.div>
            ))}
        </AnimatePresence>
    );
}

