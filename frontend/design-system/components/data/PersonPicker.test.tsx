import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PersonPicker } from './PersonPicker';

const PEOPLE = [
  { id: 2, name: 'Sam Rivera' },
  { id: 3, name: 'Ángela Ruiz' },
  { id: 4, name: 'Roc' },
];

describe('PersonPicker', () => {
  it('names every box by the person, not by their initials', () => {
    render(<PersonPicker label="Who to share with" people={PEOPLE} value={[]} onChange={vi.fn()} />);
    expect(screen.getByRole('group', { name: 'Who to share with' })).toBeDefined();
    expect(screen.getAllByRole('checkbox').map((one) => one.textContent)).toEqual([
      'SRSam Rivera',
      'ÁRÁngela Ruiz',
      'RRoc',
    ]);
    expect(screen.getByRole('checkbox', { name: 'Ángela Ruiz' })).toBeDefined();
  });

  it('says who is chosen, however many', () => {
    render(
      <PersonPicker label="Who to share with" people={PEOPLE} value={[3, 4]} onChange={vi.fn()} />,
    );
    expect(screen.getByRole('checkbox', { name: 'Ángela Ruiz' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('checkbox', { name: 'Roc' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('checkbox', { name: 'Sam Rivera' }).getAttribute('aria-checked')).toBe('false');
  });

  it('adds on press, and answers the set in the order the people are listed', async () => {
    const onChange = vi.fn();
    render(<PersonPicker label="Who to share with" people={PEOPLE} value={[4]} onChange={onChange} />);
    await userEvent.click(screen.getByRole('checkbox', { name: 'Sam Rivera' }));
    expect(onChange).toHaveBeenCalledWith([2, 4]);
  });

  it('takes somebody out on a second press', async () => {
    const onChange = vi.fn();
    render(<PersonPicker label="Who to share with" people={PEOPLE} value={[2, 4]} onChange={onChange} />);
    await userEvent.click(screen.getByRole('checkbox', { name: 'Sam Rivera' }));
    expect(onChange).toHaveBeenCalledWith([4]);
  });

  it('is one tab stop, the arrows only move, and Space chooses', async () => {
    const onChange = vi.fn();
    render(<PersonPicker label="Who to share with" people={PEOPLE} value={[]} onChange={onChange} />);
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole('checkbox', { name: 'Sam Rivera' }));
    await userEvent.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(screen.getByRole('checkbox', { name: 'Ángela Ruiz' }));
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(document.activeElement).toBe(screen.getByRole('checkbox', { name: 'Roc' }));
    expect(onChange).not.toHaveBeenCalled();
    await userEvent.keyboard(' ');
    expect(onChange).toHaveBeenCalledWith([4]);
  });
});
