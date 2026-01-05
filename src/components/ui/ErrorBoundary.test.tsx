import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';

function ThrowingComponent(): never {
    throw new Error('Test error');
}

function GoodComponent() {
    return <div>Good content</div>;
}

describe('ErrorBoundary', () => {
    it('renders children when there is no error', () => {
        render(
            <ErrorBoundary>
                <GoodComponent />
            </ErrorBoundary>
        );

        expect(screen.getByText('Good content')).toBeInTheDocument();
    });

    it('renders error UI when child throws', () => {
        // Suppress console.error for this test
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

        render(
            <ErrorBoundary>
                <ThrowingComponent />
            </ErrorBoundary>
        );

        expect(screen.getByText('Something went wrong')).toBeInTheDocument();
        expect(screen.getByText('Test error')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();

        consoleSpy.mockRestore();
    });

    it('renders custom fallback when provided', () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

        render(
            <ErrorBoundary fallback={<div>Custom error view</div>}>
                <ThrowingComponent />
            </ErrorBoundary>
        );

        expect(screen.getByText('Custom error view')).toBeInTheDocument();

        consoleSpy.mockRestore();
    });
});
