import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider } from '../components/ToastProvider.js';
import { LinesPage } from '../pages/LinesPage.js';
// The factory is hoisted above imports, so the line fixture is inlined here.
vi.mock('../api/lines.js', () => ({
  listLines: vi.fn().mockResolvedValue([
    {
      id: 'l1',
      name: 'line4',
      cranes: ['7A', '7B', '6'],
      createdAt: '',
      updatedAt: '',
      tanks: [
        { number: 1, name: '1-1A', crane: '7A' },
        { number: 8, name: '1-5', crane: '7B' },
        { number: 12, name: '1-8', crane: '6' },
      ],
    },
  ]),
  createLine: vi.fn(),
  updateLine: vi.fn(),
  deleteLine: vi.fn(),
  generateTasks: vi.fn(),
}));

describe('LinesPage', () => {
  it('shows the tabs, renders saved lines, and offers edit/delete', async () => {
    render(
      <ToastProvider>
        <LinesPage />
      </ToastProvider>,
    );
    expect(screen.getByRole('tab', { name: /lines/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /add line/i })).toBeInTheDocument();
    // Once the (mocked) fetch resolves, the line4 card + actions appear.
    expect(await screen.findByRole('heading', { name: /line4/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
  });

  it('collapses line detail by default and expands it on click', async () => {
    render(
      <ToastProvider>
        <LinesPage />
      </ToastProvider>,
    );
    const toggle = await screen.findByRole('button', { name: /line4/i });
    // Collapsed by default: the crane/tank detail is not rendered.
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('1-1A')).not.toBeInTheDocument();

    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await waitFor(() => expect(screen.getByText('1-1A')).toBeInTheDocument());
  });
});
