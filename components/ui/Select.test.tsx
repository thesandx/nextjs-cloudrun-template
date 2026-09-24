import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Select } from './Select';

const GAMES = [
  { value: 'bingo', label: 'Bingo' },
  { value: 'trivia', label: 'Trivia' },
  { value: 'draw', label: 'Draw it', disabled: true },
] as const;

describe('Select', () => {
  it('is a labelled native select with every option', () => {
    render(<Select label="Game" options={GAMES} />);
    const select = screen.getByLabelText('Game');
    expect(select.tagName).toBe('SELECT');
    expect(screen.getAllByRole('option')).toHaveLength(3);
  });

  it('adds an empty first choice for the placeholder', () => {
    render(<Select label="Game" options={GAMES} placeholder="Pick a game" />);
    expect(screen.getByRole('option', { name: 'Pick a game' })).toHaveValue('');
  });

  it('disables an option on request', () => {
    render(<Select label="Game" options={GAMES} />);
    expect(screen.getByRole('option', { name: 'Draw it' })).toBeDisabled();
  });

  it('reports the chosen value', () => {
    const onChange = vi.fn();
    render(<Select label="Game" options={GAMES} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Game'), { target: { value: 'trivia' } });
    expect(onChange).toHaveBeenCalledOnce();
    expect(screen.getByLabelText('Game')).toHaveValue('trivia');
  });
});
