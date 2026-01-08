'use client';

import { motion, AnimatePresence } from 'motion/react';
import { useEffect, useState } from 'react';

interface SparkleEffectProps {
    trigger: boolean;
    onComplete?: () => void;
    color?: string;
}

export function SparkleEffect({ trigger, onComplete, color = '#fbbf24' }: SparkleEffectProps) {
    const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number; scale: number; rotation: number }>>([]);

    useEffect(() => {
        if (trigger) {
            // Generate random particles
            const newParticles = Array.from({ length: 12 }, (_, i) => ({
                id: i,
                x: (Math.random() - 0.5) * 80,
                y: (Math.random() - 0.5) * 80,
                scale: 0.5 + Math.random() * 0.5,
                rotation: Math.random() * 360,
            }));
            setParticles(newParticles);

            // Clear after animation
            const timer = setTimeout(() => {
                setParticles([]);
                onComplete?.();
            }, 600);

            return () => clearTimeout(timer);
        }
    }, [trigger, onComplete]);

    return (
        <AnimatePresence>
            {particles.map((particle) => (
                <motion.div
                    key={particle.id}
                    className="absolute pointer-events-none"
                    initial={{ opacity: 1, scale: 0, x: 0, y: 0, rotate: 0 }}
                    animate={{
                        opacity: 0,
                        scale: particle.scale,
                        x: particle.x,
                        y: particle.y,
                        rotate: particle.rotation,
                    }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                    style={{ color }}
                >
                    ✨
                </motion.div>
            ))}
        </AnimatePresence>
    );
}
