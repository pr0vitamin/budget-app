'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useRules } from '@/lib/query/hooks';
import { api } from '@/lib/api';
import { qk } from '@/lib/query/keys';
import { showToast } from '@/lib/toast';

// View and delete auto-categorization rules (merchant pattern → cat). Rules are
// created via the "Always allocate … to this cat" checkbox in the allocation modal.
export function RulesList() {
  const qc = useQueryClient();
  const { data: rules, isLoading } = useRules();

  const onDelete = async (id: string, pattern: string) => {
    if (!confirm(`Delete the rule for "${pattern}"?`)) return;
    try {
      await api.deleteRule(id);
      qc.invalidateQueries({ queryKey: qk.rules });
      showToast('Rule deleted', 'success');
    } catch {
      showToast('Failed to delete rule', 'error');
    }
  };

  if (isLoading && !rules) {
    return <p className="text-sm text-gray-400">Loading…</p>;
  }

  if (!rules || rules.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        No rules yet — create one when allocating a transaction (&ldquo;Always allocate … to this cat&rdquo;).
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {rules.map((r) => (
        <li key={r.id} className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: r.bucket.color }}
            />
            <span className="text-sm text-gray-700 truncate">
              <span className="font-medium">{r.merchantPattern}</span>
              <span className="text-gray-400"> → </span>
              {r.bucket.name}
            </span>
          </div>
          <button
            onClick={() => onDelete(r.id, r.merchantPattern)}
            className="flex-shrink-0 text-xs text-red-600 px-2 py-1 rounded-lg hover:bg-red-50"
          >
            Delete
          </button>
        </li>
      ))}
    </ul>
  );
}
