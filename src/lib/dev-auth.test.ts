import { describe, it, expect, afterEach, vi } from 'vitest';
import { isAuthBypassEnabled } from './dev-auth';

afterEach(() => vi.unstubAllEnvs());

describe('isAuthBypassEnabled', () => {
  it('is disabled when the flag is unset', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('AUTH_DEV_BYPASS', '');
    expect(isAuthBypassEnabled()).toBe(false);
  });

  it('is enabled in non-production when the flag is "true"', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('AUTH_DEV_BYPASS', 'true');
    expect(isAuthBypassEnabled()).toBe(true);
  });

  it('is HARD-disabled in production even when the flag is "true"', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('AUTH_DEV_BYPASS', 'true');
    expect(isAuthBypassEnabled()).toBe(false);
  });
});
