import { vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

// Mock Next.js router
vi.mock('next/navigation', () => ({
    useRouter: () => ({
        push: vi.fn(),
        replace: vi.fn(),
        back: vi.fn(),
        forward: vi.fn(),
        refresh: vi.fn(),
        prefetch: vi.fn(),
    }),
    usePathname: () => '/',
    useSearchParams: () => new URLSearchParams(),
}));

// Mock Next.js headers (for server components)
vi.mock('next/headers', () => ({
    cookies: () => ({
        get: vi.fn(),
        getAll: vi.fn(() => []),
        set: vi.fn(),
        delete: vi.fn(),
    }),
    headers: () => new Headers(),
}));
