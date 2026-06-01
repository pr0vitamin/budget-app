import { describe, it, expect } from 'vitest';
import { classifyKind } from './classify';

describe('classifyKind', () => {
  it('classifies a positive amount as income', () => {
    expect(classifyKind({ type: 'CREDIT', amount: 1200 })).toBe('income');
  });

  it('classifies a negative amount as expense', () => {
    expect(classifyKind({ type: 'DEBIT', amount: -42.5 })).toBe('expense');
  });

  it('classifies an Akahu TRANSFER as transfer regardless of sign', () => {
    expect(classifyKind({ type: 'TRANSFER', amount: 500 })).toBe('transfer');
    expect(classifyKind({ type: 'TRANSFER', amount: -500 })).toBe('transfer');
  });

  it('treats missing type by falling back to sign', () => {
    expect(classifyKind({ amount: 30 })).toBe('income');
    expect(classifyKind({ amount: -30 })).toBe('expense');
  });

  it('treats a zero amount as expense (needs allocation review)', () => {
    expect(classifyKind({ amount: 0 })).toBe('expense');
  });
});
