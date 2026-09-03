import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider } from '../components/ToastProvider.js';
import { ProcessProvider } from '../context/ProcessProvider.js';
import { ProcessPage } from '../pages/ProcessPage.js';

// A one-group plan: PLC_A runs crane 7A with a single task (tank 1-1A).
// `vi.hoisted` so the fixture is available inside the hoisted vi.mock factories.
const { plan } = vi.hoisted(() => ({
  plan: {
    steps: [{ step: 1, key: '1-1A', time: 6, status: 'resolved' }],
    groups: [
      {
        connectionId: 'CA',
        plcName: 'PLC_A',
        lineId: 'LA',
        lineName: 'lineA',
        cranes: [{ crane: '7A', tasks: [{ step: 1, key: '1-1A', tankName: '1-1A', station: 2, time: 6 }] }],
      },
    ],
    missing: [],
    ambiguous: [],
    unrouted: [],
    counts: { total: 1, routed: 1, missing: 0, ambiguous: 0, unrouted: 0 },
  },
}));

vi.mock('../api/recipes.js', () => ({
  listRecipes: vi.fn().mockResolvedValue([]),
  createRecipe: vi.fn(),
  updateRecipe: vi.fn(),
  deleteRecipe: vi.fn(),
}));

vi.mock('../api/process.js', () => ({
  planProcess: vi.fn().mockResolvedValue(plan),
  startProcess: vi.fn().mockResolvedValue({ runId: 'run-1', plan }),
  getRunStatus: vi.fn().mockResolvedValue({
    runId: 'run-1',
    done: false,
    progress: 0,
    steps: [{ step: 1, state: 'in_progress' }],
  }),
  stopProcess: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../utils/qr.js', () => ({ decodeQrFromFile: vi.fn() }));

function renderPage() {
  return render(
    <ToastProvider>
      <ProcessProvider>
        <ProcessPage />
      </ProcessProvider>
    </ToastProvider>,
  );
}

/** Enter a one-tank recipe via the Tank / Time table (replaces the old textarea). */
async function enterRecipe(tank: string, time: string) {
  await userEvent.click(screen.getByRole('button', { name: /add task/i }));
  await userEvent.type(screen.getByLabelText(/tank for row 1/i), tank);
  await userEvent.type(screen.getByLabelText(/time in seconds for row 1/i), time);
}

describe('ProcessPage', () => {
  it('divides a pasted recipe and shows which PLC/crane gets the task', async () => {
    renderPage();

    await enterRecipe('1-1A', '6');
    await userEvent.click(screen.getByRole('button', { name: /divide tasks/i }));

    // The summary shows the routed PLC, its crane, and the tank.
    expect(await screen.findByText('PLC_A')).toBeInTheDocument();
    expect(screen.getByText(/Crane 7A/i)).toBeInTheDocument();
    expect(screen.getByText('1-1A')).toBeInTheDocument();
    expect(screen.getByText(/1 routed/i)).toBeInTheDocument();
    // The timed run is now the "Preview (sim)" button (does not touch the PLC).
    expect(screen.getByRole('button', { name: /preview/i })).toBeInTheDocument();
  });

  it('starts a run and reflects the in-progress state', async () => {
    renderPage();
    await enterRecipe('1-1A', '6');
    await userEvent.click(screen.getByRole('button', { name: /divide tasks/i }));
    await screen.findByText('PLC_A');

    await userEvent.click(screen.getByRole('button', { name: /preview/i }));
    // Once started, a Stop control replaces Preview and the task shows "in progress".
    expect(await screen.findByRole('button', { name: /stop/i })).toBeInTheDocument();
    expect(await screen.findByLabelText('in progress')).toBeInTheDocument();
  });
});
