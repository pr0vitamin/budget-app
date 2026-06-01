export interface Rule {
  id: string;
  merchantPattern: string; // stored lowercase
  bucketId: string;
}

/** Normalize a user-entered pattern for storage and comparison. */
export function normalizePattern(pattern: string): string {
  return pattern.trim().toLowerCase();
}

/**
 * Find the first rule whose pattern is a substring of the merchant/description.
 * Matching is case-insensitive. Works for both enriched merchants (confirmed)
 * and raw descriptions (pending), since rules use substring matching.
 */
export function findMatchingRule(merchant: string | null | undefined, rules: Rule[]): Rule | null {
  if (!merchant) return null;
  const haystack = merchant.toLowerCase();
  for (const rule of rules) {
    if (rule.merchantPattern && haystack.includes(rule.merchantPattern)) {
      return rule;
    }
  }
  return null;
}
