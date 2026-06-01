import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AllocationModal } from './AllocationModal';

const buckets = [
  { id: 'pet', name: 'Pet', color: '#f00', groupName: 'Life' },
  { id: 'groceries', name: 'Groceries', color: '#0f0', groupName: 'Life' },
];

const txn = {
  id: 't1',
  amount: -12.9,
  merchant: 'Countdown',
  description: null,
  date: '2026-05-01',
  kind: 'expense' as const,
  status: 'confirmed' as const,
  source: 'akahu' as const,
  needsReview: false,
  allocations: [],
};

describe('AllocationModal', () => {
  it('does not render when isOpen is false', () => {
    const onAllocate = vi.fn();
    render(
      <AllocationModal
        isOpen={false}
        onClose={() => {}}
        buckets={buckets}
        transaction={txn}
        onAllocate={onAllocate}
      />
    );
    expect(screen.queryByText('Allocate Transaction')).toBeNull();
  });

  it('renders the transaction merchant and amount when open', () => {
    render(
      <AllocationModal
        isOpen
        onClose={() => {}}
        buckets={buckets}
        transaction={txn}
        onAllocate={vi.fn()}
      />
    );
    expect(screen.getByText('Countdown')).toBeInTheDocument();
    expect(screen.getByText('$12.90')).toBeInTheDocument();
  });

  it('single-bucket allocation calls onAllocate with the full signed amount', async () => {
    const onAllocate = vi.fn().mockResolvedValue(undefined);
    render(
      <AllocationModal
        isOpen
        onClose={() => {}}
        buckets={buckets}
        transaction={txn}
        onAllocate={onAllocate}
      />
    );

    // Select the first bucket by clicking its button in the grid
    const petButton = screen.getByRole('button', { name: /Pet/i });
    fireEvent.click(petButton);

    // Submit the allocation
    const allocateButton = screen.getByRole('button', { name: /Allocate/i });
    fireEvent.click(allocateButton);

    await waitFor(() => expect(onAllocate).toHaveBeenCalledTimes(1));

    const [calledId, calledAllocations] = onAllocate.mock.calls[0] as [
      string,
      { bucketId: string; amount: number }[],
      boolean,
      string | null,
    ];
    expect(calledId).toBe('t1');
    expect(calledAllocations).toHaveLength(1);
    expect(calledAllocations[0].bucketId).toBe('pet');
    // Full signed amount for an expense (-12.90)
    expect(calledAllocations[0].amount).toBeCloseTo(-12.9, 2);
  });

  it('shows bucket list matching the provided buckets', () => {
    render(
      <AllocationModal
        isOpen
        onClose={() => {}}
        buckets={buckets}
        transaction={txn}
        onAllocate={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: /Pet/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Groceries/i })).toBeInTheDocument();
  });
});
