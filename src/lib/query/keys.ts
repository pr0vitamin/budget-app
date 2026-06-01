export const qk = {
  overview: ['overview'] as const,
  inbox: ['transactions', 'inbox'] as const,
  transactions: (q: string) => ['transactions', q] as const,
  settings: ['settings'] as const,
  rules: ['rules'] as const,
};
