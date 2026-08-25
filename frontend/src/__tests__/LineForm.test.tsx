import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LineForm } from '../components/LineForm.js';

describe('LineForm builder', () => {
  it('builds a line (crane + tank) and submits the assembled payload', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(true);
    render(<LineForm submitLabel="Save line" onSubmit={onSubmit} />);

    await user.type(screen.getByPlaceholderText(/e\.g\. line4/i), 'line9');
    await user.type(screen.getByLabelText(/new crane code/i), '7A');
    await user.click(screen.getByRole('button', { name: /add crane/i }));
    await user.click(screen.getByRole('button', { name: /add tank/i }));
    await user.type(screen.getByLabelText(/tank 1 name/i), '1-1A');
    await user.click(screen.getByRole('button', { name: /save line/i }));

    expect(onSubmit).toHaveBeenCalledWith({
      name: 'line9',
      cranes: ['7A'],
      tanks: [{ number: 1, name: '1-1A', crane: '7A' }],
    });
  });

  it('blocks submit with a validation message when nothing is filled in', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<LineForm submitLabel="Save line" onSubmit={onSubmit} />);

    await user.click(screen.getByRole('button', { name: /save line/i }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
