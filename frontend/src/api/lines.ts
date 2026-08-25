import type { GeneratedTask, Line, NewLine } from '../types/line.js';
import { apiClient } from './client.js';

/**
 * Line API wrappers.
 *
 * Purpose: Typed calls to the `/lines` endpoints — list/create lines (super
 *   admin) and generate a task list from a scanned QR (managers).
 */

/** GET /lines — list all saved lines. */
export async function listLines(): Promise<Line[]> {
  const { data } = await apiClient.get<{ lines: Line[] }>('/lines');
  return data.lines;
}

/** POST /lines — create a line from a layout (super-admin only). */
export async function createLine(input: NewLine): Promise<Line> {
  const { data } = await apiClient.post<{ line: Line }>('/lines', input);
  return data.line;
}

/** PATCH /lines/:id — edit a line's name/layout (super-admin only). */
export async function updateLine(id: string, patch: Partial<NewLine>): Promise<Line> {
  const { data } = await apiClient.patch<{ line: Line }>(`/lines/${id}`, patch);
  return data.line;
}

/** DELETE /lines/:id — remove a line (super-admin only). */
export async function deleteLine(id: string): Promise<void> {
  await apiClient.delete(`/lines/${id}`);
}

/** POST /lines/:id/tasks — decode a QR recipe into an ordered task list. */
export async function generateTasks(
  lineId: string,
  qr: string,
): Promise<{ line: Line; tasks: GeneratedTask[] }> {
  const { data } = await apiClient.post<{ line: Line; tasks: GeneratedTask[] }>(
    `/lines/${lineId}/tasks`,
    { qr },
  );
  return data;
}
