import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock the PLC Manager API so the page renders against controlled data.
vi.mock('../api/plc-connections.js', () => ({
  listConnections: vi.fn(),
  createConnection: vi.fn(),
  updateConnection: vi.fn(),
  deleteConnection: vi.fn(),
  activateConnection: vi.fn(),
  getConnectionStatuses: vi.fn(),
  connectConnection: vi.fn(),
  disconnectConnection: vi.fn(),
  listTags: vi.fn(),
  createTag: vi.fn(),
  updateTag: vi.fn(),
  deleteTag: vi.fn(),
}));

// The page also loads lines (for the line/crane pickers).
vi.mock('../api/lines.js', () => ({ listLines: vi.fn() }));

import * as api from '../api/plc-connections.js';
import * as linesApi from '../api/lines.js';
import { ToastProvider } from '../components/ToastProvider.js';
import { PlcManagerPage } from '../pages/PlcManagerPage.js';
import type { PlcConnectionConfig, PlcTagConfig } from '../types/plc-config.js';

function renderPage() {
  render(
    <ToastProvider>
      <PlcManagerPage />
    </ToastProvider>,
  );
}

const conn: PlcConnectionConfig = {
  id: 'c1',
  name: 'Sim S7-1500',
  endpoint: 'opc.tcp://192.168.50.1:4840',
  securityMode: 'None',
  securityPolicy: 'None',
  isActive: true,
  lineId: null,
  cranes: [],
  createdAt: '',
  updatedAt: '',
};

const readTag: PlcTagConfig = {
  id: 't1',
  connectionId: 'c1',
  label: 'cycle_count',
  nodeId: 'ns=3;s="PlcData"."cycle_count"',
  dataType: 'Int16',
  direction: 'read',
  description: null,
  createdAt: '',
  updatedAt: '',
};

describe('PlcManagerPage (super-admin)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(linesApi.listLines).mockResolvedValue([]);
    vi.mocked(api.getConnectionStatuses).mockResolvedValue([]);
  });

  it('shows Connections / New connection in the top nav bar and lists connections', async () => {
    vi.mocked(api.listConnections).mockResolvedValue([conn]);
    renderPage();

    expect(screen.getByRole('tab', { name: /connections/i })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /new connection/i })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Sim S7-1500')).toBeInTheDocument());
    expect(screen.getByText(/opc\.tcp:\/\/192\.168\.50\.1:4840/)).toBeInTheDocument();
    expect(screen.getByText(/active/i)).toBeInTheDocument();
  });

  it('creates a connection from the New connection tab', async () => {
    vi.mocked(api.listConnections).mockResolvedValue([]);
    vi.mocked(api.createConnection).mockResolvedValue({ ...conn, id: 'c2', name: 'New PLC' });
    renderPage();

    await userEvent.click(screen.getByRole('tab', { name: /new connection/i }));
    await userEvent.clear(screen.getByPlaceholderText(/PLC_4/i));
    await userEvent.type(screen.getByPlaceholderText(/PLC_4/i), 'New PLC');
    await userEvent.clear(screen.getByPlaceholderText(/opc\.tcp:\/\/192/i));
    await userEvent.type(screen.getByPlaceholderText(/opc\.tcp:\/\/192/i), 'opc.tcp://10.0.0.5:4840');
    await userEvent.click(screen.getByRole('button', { name: /create connection/i }));

    await waitFor(() =>
      expect(api.createConnection).toHaveBeenCalledWith({
        name: 'New PLC',
        endpoint: 'opc.tcp://10.0.0.5:4840',
        securityMode: 'None',
        securityPolicy: 'None',
        lineId: null,
        cranes: [],
      }),
    );
  });

  it('opens tag mappings when a connection is selected', async () => {
    vi.mocked(api.listConnections).mockResolvedValue([conn]);
    vi.mocked(api.listTags).mockResolvedValue([readTag]);
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: /manage tags for sim s7-1500/i }));
    await waitFor(() => expect(api.listTags).toHaveBeenCalledWith('c1'));
    expect(await screen.findByText(/tag mappings — sim s7-1500/i)).toBeInTheDocument();
    expect(screen.getByText('cycle_count')).toBeInTheDocument();
  });
});
