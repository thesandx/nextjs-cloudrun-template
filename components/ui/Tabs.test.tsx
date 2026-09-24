import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Tabs } from './Tabs';

const ITEMS = [
  { id: 'board', label: 'Board', content: <p>The board</p> },
  { id: 'players', label: 'Players', content: <p>The players</p> },
  { id: 'rules', label: 'Rules', content: <p>The rules</p> },
];

describe('Tabs', () => {
  it('shows the first panel and hides the rest', () => {
    render(<Tabs label="Game views" items={ITEMS} />);
    expect(screen.getByRole('tab', { name: 'Board' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('The board')).toBeVisible();
    expect(screen.getByText('The players')).not.toBeVisible();
  });

  it('switches panel on click and reports it', () => {
    const onChange = vi.fn();
    render(<Tabs label="Game views" items={ITEMS} onChange={onChange} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Players' }));
    expect(screen.getByText('The players')).toBeVisible();
    expect(onChange).toHaveBeenCalledWith('players');
  });

  it('keeps one tab stop and moves with the arrow keys', () => {
    render(<Tabs label="Game views" items={ITEMS} />);
    const board = screen.getByRole('tab', { name: 'Board' });
    expect(screen.getByRole('tab', { name: 'Players' })).toHaveAttribute('tabindex', '-1');

    fireEvent.keyDown(board, { key: 'ArrowLeft' });
    const rules = screen.getByRole('tab', { name: 'Rules' });
    expect(rules).toHaveAttribute('aria-selected', 'true');
    expect(rules).toHaveFocus();

    fireEvent.keyDown(rules, { key: 'Home' });
    expect(board).toHaveAttribute('aria-selected', 'true');
  });

  it('opens on the default tab', () => {
    render(<Tabs label="Game views" items={ITEMS} defaultTab="rules" />);
    expect(screen.getByText('The rules')).toBeVisible();
  });

  it('labels each panel with its tab', () => {
    render(<Tabs label="Game views" items={ITEMS} />);
    expect(screen.getByRole('tabpanel', { name: 'Board' })).toBeInTheDocument();
  });
});
