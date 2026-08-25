import {
  toPublicLine,
  type GeneratedTask,
  type LineRecord,
  type PublicLine,
} from '../models/line.model.js';
import * as connRepo from '../repositories/plc-connection.repository.js';
import * as lineRepo from '../repositories/line.repository.js';
import type { CreateLineInput, UpdateLineInput } from '../schemas/line.schema.js';
import { conflict, notFoundError } from '../utils/http-error.js';
import { newId } from '../utils/id.js';
import { generateTasks } from './task-generator.js';

/**
 * Line service (business logic layer).
 *
 * Purpose: Create, list, and fetch plating lines, and generate a task list from
 *   a decoded QR recipe against a saved line. Ignorant of HTTP and of the DB
 *   driver — controllers pass validated input, repositories persist it.
 */

/**
 * List every saved line (super-admin manages them; managers read them to scan).
 *
 * Returns: All lines as `PublicLine[]`, newest first.
 */
export async function listLines(): Promise<PublicLine[]> {
  const records = await lineRepo.listAll();
  return records.map(toPublicLine);
}

/**
 * Create a line with a super-admin-supplied layout.
 *
 * Args: input — validated `{ name, cranes, tanks }`.
 * Returns: The created `PublicLine`.
 * Raises: 409 if a line with that name already exists.
 */
export async function createLine(input: CreateLineInput): Promise<PublicLine> {
  if (await lineRepo.findByName(input.name)) {
    throw conflict(`A line named "${input.name}" already exists`);
  }

  const now = new Date().toISOString();
  const record: LineRecord = {
    _id: newId(),
    name: input.name,
    cranes: input.cranes,
    tanks: input.tanks,
    createdAt: now,
    updatedAt: now,
  };
  await lineRepo.insertLine(record);
  return toPublicLine(record);
}

/** Load a line by id or throw 404. */
async function requireLine(id: string): Promise<PublicLine> {
  const record = await lineRepo.findById(id);
  if (!record) throw notFoundError('Line not found');
  return toPublicLine(record);
}

/**
 * Edit a line's name and/or layout.
 *
 * Args: id — target line id; input — validated partial `{ name?, cranes?, tanks? }`.
 * Returns: The updated `PublicLine`.
 * Raises: 404 if absent, 409 if the new name is taken by another line.
 */
export async function updateLine(id: string, input: UpdateLineInput): Promise<PublicLine> {
  const existing = await lineRepo.findById(id);
  if (!existing) throw notFoundError('Line not found');

  const patch: Partial<Pick<CreateLineInput, 'name' | 'cranes' | 'tanks'>> & { updatedAt: string } = {
    updatedAt: new Date().toISOString(),
  };
  if (input.name !== undefined && input.name !== existing.name) {
    const clash = await lineRepo.findByName(input.name);
    if (clash && clash._id !== id) throw conflict(`A line named "${input.name}" already exists`);
    patch.name = input.name;
  }
  if (input.cranes !== undefined) patch.cranes = input.cranes;
  if (input.tanks !== undefined) patch.tanks = input.tanks;

  const updated = await lineRepo.updateLine(id, patch);
  if (!updated) throw notFoundError('Line not found');
  return toPublicLine(updated);
}

/**
 * Delete a line and unassign any PLCs bound to it.
 *
 * Args: id — target line id.
 * Raises: 404 if the line does not exist.
 *
 * Note: PLC connections are NOT deleted — a controller outlives a line's config.
 *   Their `lineId` is nulled and `cranes` cleared so they are simply unassigned.
 */
export async function deleteLine(id: string): Promise<void> {
  if (!(await lineRepo.deleteLine(id))) throw notFoundError('Line not found');
  await connRepo.unassignLine(id, new Date().toISOString());
}

/** Fetch a single line by id. Raises 404 if absent. */
export async function getLine(id: string): Promise<PublicLine> {
  return requireLine(id);
}

/**
 * Generate the task list for a QR recipe against a saved line.
 *
 * Args: id — the line id; qr — the decoded QR text (`key=seconds;…`).
 * Returns: `{ line, tasks }` — the line and the ordered `GeneratedTask[]`.
 * Raises: 404 if the line does not exist.
 */
export async function generateTasksForLine(
  id: string,
  qr: string,
): Promise<{ line: PublicLine; tasks: GeneratedTask[] }> {
  const line = await requireLine(id);
  return { line, tasks: generateTasks(line, qr) };
}
