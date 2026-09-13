import type {
  ConnectionInput,
  PlcConnectionConfig,
  PlcStatus,
  PlcTagConfig,
  TagInput,
} from '../types/plc-config.js';
import { apiClient } from './client.js';

/**
 * PLC Manager API wrappers (super-admin only endpoints under /plc-connections).
 *
 * Purpose: Typed CRUD for saved OPC UA connections and their tag mappings.
 */

/* ------------------------------- Connections ------------------------------ */

/** GET /plc-connections — list saved connections. */
export async function listConnections(): Promise<PlcConnectionConfig[]> {
  const { data } = await apiClient.get<{ connections: PlcConnectionConfig[] }>('/plc-connections');
  return data.connections;
}

/** POST /plc-connections — create a connection. */
export async function createConnection(input: ConnectionInput): Promise<PlcConnectionConfig> {
  const { data } = await apiClient.post<{ connection: PlcConnectionConfig }>(
    '/plc-connections',
    input,
  );
  return data.connection;
}

/** PATCH /plc-connections/:id — edit a connection. */
export async function updateConnection(
  id: string,
  patch: Partial<ConnectionInput>,
): Promise<PlcConnectionConfig> {
  const { data } = await apiClient.patch<{ connection: PlcConnectionConfig }>(
    `/plc-connections/${id}`,
    patch,
  );
  return data.connection;
}

/** DELETE /plc-connections/:id — remove a connection (and its tags). */
export async function deleteConnection(id: string): Promise<void> {
  await apiClient.delete(`/plc-connections/${id}`);
}

/** POST /plc-connections/:id/activate — make it the active connection. */
export async function activateConnection(id: string): Promise<PlcConnectionConfig> {
  const { data } = await apiClient.post<{ connection: PlcConnectionConfig }>(
    `/plc-connections/${id}/activate`,
  );
  return data.connection;
}

/** GET /plc-connections/status — live pool status for every connection. */
export async function getConnectionStatuses(): Promise<PlcStatus[]> {
  const { data } = await apiClient.get<{ statuses: PlcStatus[] }>('/plc-connections/status');
  return data.statuses;
}

/** POST /plc-connections/:id/connect — open a live session to this PLC. */
export async function connectConnection(id: string): Promise<PlcStatus> {
  const { data } = await apiClient.post<{ status: PlcStatus }>(`/plc-connections/${id}/connect`);
  return data.status;
}

/** POST /plc-connections/:id/disconnect — close this PLC's session. */
export async function disconnectConnection(id: string): Promise<PlcStatus> {
  const { data } = await apiClient.post<{ status: PlcStatus }>(`/plc-connections/${id}/disconnect`);
  return data.status;
}

/** POST /plc/stop — emergency-stop all of this connection's cranes immediately. */
export async function stopConnection(id: string): Promise<string[]> {
  const { data } = await apiClient.post<{ ok: boolean; cranes: string[] }>('/plc/stop', {
    connectionId: id,
  });
  return data.cranes;
}

/** POST /plc/clean — send this connection's cranes home to Parking and wipe the recipe. */
export async function cleanConnection(id: string): Promise<string[]> {
  const { data } = await apiClient.post<{ ok: boolean; cranes: string[] }>('/plc/clean', {
    connectionId: id,
  });
  return data.cranes;
}

/* ---------------------------------- Tags ---------------------------------- */

/** GET /plc-connections/:id/tags — list a connection's tags. */
export async function listTags(connectionId: string): Promise<PlcTagConfig[]> {
  const { data } = await apiClient.get<{ tags: PlcTagConfig[] }>(
    `/plc-connections/${connectionId}/tags`,
  );
  return data.tags;
}

/** POST /plc-connections/:id/tags — add a tag. */
export async function createTag(connectionId: string, input: TagInput): Promise<PlcTagConfig> {
  const { data } = await apiClient.post<{ tag: PlcTagConfig }>(
    `/plc-connections/${connectionId}/tags`,
    input,
  );
  return data.tag;
}

/** PATCH /plc-connections/:id/tags/:tagId — edit a tag. */
export async function updateTag(
  connectionId: string,
  tagId: string,
  patch: Partial<TagInput>,
): Promise<PlcTagConfig> {
  const { data } = await apiClient.patch<{ tag: PlcTagConfig }>(
    `/plc-connections/${connectionId}/tags/${tagId}`,
    patch,
  );
  return data.tag;
}

/** DELETE /plc-connections/:id/tags/:tagId — remove a tag. */
export async function deleteTag(connectionId: string, tagId: string): Promise<void> {
  await apiClient.delete(`/plc-connections/${connectionId}/tags/${tagId}`);
}
