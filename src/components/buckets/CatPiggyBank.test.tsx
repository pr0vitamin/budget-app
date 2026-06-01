import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CatPiggyBank } from './CatPiggyBank';

describe('CatPiggyBank', () => {
  it('renders the name and rounded balance', () => {
    render(<CatPiggyBank name="Groceries" balance={382.2} />);
    expect(screen.getByText('Groceries')).toBeInTheDocument();
    expect(screen.getByText('$382')).toBeInTheDocument();
  });

  it('shows a negative balance in red text without a minus duplication', () => {
    render(<CatPiggyBank name="Dining" balance={-12} isOverspent />);
    expect(screen.getByText('$12')).toBeInTheDocument();
  });
});
