import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../components/ToastProvider.js';
import { PlcPage } from '../pages/PlcPage.js';

vi.mock('../api/plc.js', () => ({
  getState: vi.fn().mockResolvedValue({
    connection: { state: 'disconnected', endpoint: null, security: null, lastError: null },
    defaults: {
      endpoint: 'opc.tcp://localhost:4840',
      readNode: 'ns=1;s=HR0',
      writeNode: 'ns=1;s=Coil0',
      securityMode: 'None',
      securityPolicy: 'None',
    },
    active: null,
    tags: [],
  }),
  connect: vi.fn().mockResolvedValue({
    state: 'connected',
    endpoint: 'opc.tcp://localhost:4840',
    security: 'None/None',
    lastError: null,
  }),
  disconnect: vi.fn().mockResolvedValue({ state: 'disconnected', endpoint: null, security: null, lastError: null }),
  readNode: vi.fn().mockResolvedValue({ value: 42, dataType: 'UInt16', statusCode: 'Good', serverTimestamp: null }),
  sendCommand: vi.fn().mockResolvedValue({ value: true, dataType: 'Boolean', statusCode: 'Good', serverTimestamp: null }),
}));

function renderPage() {
  return render(
    <ToastProvider>
      <PlcPage />
    </ToastProvider>,
  );
}

describe('PlcPage', () => {
  it('loads disconnected status with the default endpoint pre-filled', async () => {
    renderPage();
    expect(await screen.findByText(/disconnected/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/opc\.tcp/i)).toHaveValue('opc.tcp://localhost:4840');
    expect(screen.getByRole('button', { name: /connect/i })).toBeInTheDocument();
  });

  it('connects, then reveals the live watch table and the command form', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: /connect/i }));

    // Live watch table (PLC → software) streams the mocked value in.
    expect(await screen.findByText('42')).toBeInTheDocument();
    // Command form (software → PLC) appears once connected.
    expect(screen.getByRole('button', { name: /send to plc/i })).toBeInTheDocument();
  });

  it('lets you add a NodeId to the live watch table', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: /connect/i }));
    await screen.findByText('42'); // connected + polling

    await user.type(screen.getByLabelText(/tag label/i), 'Counter');
    await user.type(screen.getByLabelText(/nodeid to watch/i), 'ns=2;i=1');
    await user.click(screen.getByRole('button', { name: /add/i }));

    expect(await screen.findByText('Counter')).toBeInTheDocument();
    expect(screen.getByText('ns=2;i=1')).toBeInTheDocument();
  });
});
