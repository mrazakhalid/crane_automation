import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Unit tests for the OPC UA connection *pool* (services/plc/opcua-client.ts).
 *
 * These prove the engine can hold several independent sessions at once — one per
 * PLC / id — which is the backbone of the multi-line, multi-PLC architecture.
 * node-opcua and the PKI/security helper are mocked so no real server or on-disk
 * certificate store is touched: each mock session simply echoes the endpoint it
 * was connected to, so a read through id A vs id B proves the sessions are distinct.
 */

// --- Mock the PKI/security helper (no on-disk cert store in a unit test). ---
vi.mock('../services/plc/opcua-security.js', () => ({
  clientCertificateFile: 'test-client-cert.pem',
  securityOptions: vi.fn(async () => ({})),
}));

// --- Mock node-opcua: a fresh client+session per connect, echoing its endpoint. ---
vi.mock('node-opcua', () => {
  class MockClient {
    _endpoint = '';
    connect = vi.fn(async (endpoint: string) => {
      this._endpoint = endpoint;
    });
    createSession = vi.fn(async () => ({
      read: vi.fn(async () => ({
        // The read result echoes THIS client's endpoint so tests can tell sessions apart.
        value: { dataType: 12, value: this._endpoint },
        statusCode: { name: 'Good' },
        serverTimestamp: null,
      })),
      write: vi.fn(async () => ({ value: 0 })), // 0 === StatusCodes.Good.value below
      close: vi.fn(async () => undefined),
    }));
    disconnect = vi.fn(async () => undefined);
    static create = vi.fn(() => new MockClient());
  }
  return {
    OPCUAClient: MockClient,
    AttributeIds: { Value: 13 },
    // Proxy so DataType['Boolean'] and DataType[12] both resolve to a stable string.
    DataType: new Proxy({}, { get: (_t, k) => String(k) }),
    StatusCodes: { Good: { value: 0, name: 'Good' } },
  };
});

// Import AFTER the mocks are registered.
const opcua = await import('../services/plc/opcua-client.js');

const EP_A = 'opc.tcp://192.168.50.1:4840';
const EP_B = 'opc.tcp://192.168.60.1:4840';

afterEach(async () => {
  await opcua.disconnectAll();
  vi.clearAllMocks();
});

describe('opcua pool: many simultaneous sessions', () => {
  it('holds two connections at once, each reading from its own session', async () => {
    await opcua.connect('A', EP_A, 'None', 'None');
    await opcua.connect('B', EP_B, 'None', 'None');

    expect(opcua.getConnectionStatus('A').state).toBe('connected');
    expect(opcua.getConnectionStatus('B').state).toBe('connected');

    // Each session echoes the endpoint it was connected to → proves isolation.
    expect((await opcua.readValue('A', 'ns=1;s=x')).value).toBe(EP_A);
    expect((await opcua.readValue('B', 'ns=1;s=x')).value).toBe(EP_B);
  });

  it('lists every pooled connection via getAllStatuses', async () => {
    await opcua.connect('A', EP_A, 'None', 'None');
    await opcua.connect('B', EP_B, 'None', 'None');
    const ids = opcua.getAllStatuses().map((s) => s.connectionId).sort();
    expect(ids).toEqual(['A', 'B']);
  });

  it('disconnecting one connection leaves the others live', async () => {
    await opcua.connect('A', EP_A, 'None', 'None');
    await opcua.connect('B', EP_B, 'None', 'None');

    await opcua.disconnect('A');

    expect(opcua.getConnectionStatus('A').state).toBe('disconnected');
    expect(opcua.getConnectionStatus('B').state).toBe('connected');
    await expect(opcua.readValue('A', 'ns=1;s=x')).rejects.toThrow(/not connected/i);
    expect((await opcua.readValue('B', 'ns=1;s=x')).value).toBe(EP_B);
  });

  it('reconnecting the same id replaces only that entry', async () => {
    await opcua.connect('A', EP_A, 'None', 'None');
    await opcua.connect('B', EP_B, 'None', 'None');

    await opcua.connect('A', EP_B, 'None', 'None'); // A now points at EP_B

    expect((await opcua.readValue('A', 'ns=1;s=x')).value).toBe(EP_B);
    expect((await opcua.readValue('B', 'ns=1;s=x')).value).toBe(EP_B);
    expect(opcua.getAllStatuses()).toHaveLength(2);
  });

  it('reports disconnected for an unknown id and refuses reads/writes on it', async () => {
    expect(opcua.getConnectionStatus('nope').state).toBe('disconnected');
    await expect(opcua.readValue('nope', 'ns=1;s=x')).rejects.toThrow(/not connected/i);
    await expect(opcua.writeValue('nope', 'ns=1;s=x', 'Boolean', true)).rejects.toThrow(
      /not connected/i,
    );
  });

  it('writes succeed on a live connection (Good status)', async () => {
    await opcua.connect('A', EP_A, 'None', 'None');
    await expect(opcua.writeValue('A', 'ns=1;s=x', 'Boolean', true)).resolves.toBeUndefined();
  });

  it('leaves an entry in error state (with lastError) when connect fails', async () => {
    const { OPCUAClient } = (await import('node-opcua')) as unknown as {
      OPCUAClient: { create: ReturnType<typeof vi.fn> };
    };
    // Make the next created client fail to connect.
    OPCUAClient.create.mockImplementationOnce(() => ({
      connect: vi.fn(async () => {
        throw new Error('ECONNREFUSED boom');
      }),
      disconnect: vi.fn(async () => undefined),
    }));

    await expect(opcua.connect('bad', EP_A, 'None', 'None')).rejects.toThrow(/boom/i);
    const status = opcua.getConnectionStatus('bad');
    expect(status.state).toBe('error');
    expect(status.lastError).toMatch(/boom/i);
    expect(status.endpoint).toBe(EP_A);
  });
});
