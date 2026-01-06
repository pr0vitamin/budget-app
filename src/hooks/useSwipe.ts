'use client';

import { useState, useRef, useCallback } from 'react';

interface SwipeState {
    isSwiping: boolean;
    offsetX: number;
    direction: 'left' | 'right' | null;
}

interface UseSwipeOptions {
    onSwipeLeft?: () => void;
    onSwipeRight?: () => void;
    threshold?: number; // pixels to trigger swipe action
}

export function useSwipe(options: UseSwipeOptions = {}) {
    const { onSwipeLeft, onSwipeRight, threshold = 80 } = options;

    const [state, setState] = useState<SwipeState>({
        isSwiping: false,
        offsetX: 0,
        direction: null,
    });

    const startX = useRef(0);
    const currentX = useRef(0);

    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        startX.current = e.touches[0].clientX;
        currentX.current = e.touches[0].clientX;
        setState((s) => ({ ...s, isSwiping: true }));
    }, []);

    const handleTouchMove = useCallback((e: React.TouchEvent) => {
        if (!state.isSwiping) return;

        currentX.current = e.touches[0].clientX;
        const diff = currentX.current - startX.current;

        // Limit the swipe distance with rubber band effect
        const maxOffset = 150;
        const clampedOffset = Math.sign(diff) * Math.min(Math.abs(diff), maxOffset);

        setState({
            isSwiping: true,
            offsetX: clampedOffset,
            direction: diff < 0 ? 'left' : diff > 0 ? 'right' : null,
        });
    }, [state.isSwiping]);

    const handleTouchEnd = useCallback(() => {
        const diff = currentX.current - startX.current;

        // Trigger action if past threshold
        if (Math.abs(diff) >= threshold) {
            if (diff < 0 && onSwipeLeft) {
                onSwipeLeft();
            } else if (diff > 0 && onSwipeRight) {
                onSwipeRight();
            }
        }

        // Reset state
        setState({
            isSwiping: false,
            offsetX: 0,
            direction: null,
        });
    }, [threshold, onSwipeLeft, onSwipeRight]);

    return {
        ...state,
        handlers: {
            onTouchStart: handleTouchStart,
            onTouchMove: handleTouchMove,
            onTouchEnd: handleTouchEnd,
        },
    };
}
