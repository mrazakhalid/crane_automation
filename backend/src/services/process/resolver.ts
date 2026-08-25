import type { PublicLine, Tank } from '../../models/line.model.js';
import { resolveTank } from '../task-generator.js';

/**
 * Cross-line tank resolver (pure, side-effect-free).
 *
 * Purpose: A recipe spans several lines, so a single tank key must be resolved
 *   against ALL saved lines — not one chosen line. This reuses the per-line
 *   matcher `resolveTank` (exact name, then normalized lowest-numbered) and
 *   collapses the results: no match → missing, one line → resolved, many lines →
 *   ambiguous (unless a per-step override picks the intended line).
 */

/** A tank found on a specific line for a given key. */
export interface LineTankMatch {
  line: PublicLine;
  tank: Tank;
}

/** The outcome of resolving one key across every line. */
export type ResolveOutcome =
  | { status: 'resolved'; line: PublicLine; tank: Tank }
  | { status: 'missing' }
  | { status: 'ambiguous'; candidates: LineTankMatch[] };

/**
 * Resolve a recipe key to a tank across all lines.
 *
 * Args: lines — every saved line; key — a recipe key such as `1-1A`; overrideLineId
 *   — optional line id chosen by the user to break an ambiguity.
 * Returns: `resolved` with the line+tank when exactly one line matches (or the
 *   override selects one of several), `missing` when none match, or `ambiguous`
 *   with the matching lines when more than one matches and no override applies.
 */
export function resolveAcrossLines(
  lines: PublicLine[],
  key: string,
  overrideLineId?: string,
): ResolveOutcome {
  const matches: LineTankMatch[] = [];
  for (const line of lines) {
    const tank = resolveTank(line, key);
    if (tank) matches.push({ line, tank });
  }

  if (matches.length === 0) return { status: 'missing' };
  if (matches.length === 1) {
    const only = matches[0]!;
    return { status: 'resolved', line: only.line, tank: only.tank };
  }

  // More than one line matched — honour an explicit override, else flag ambiguous.
  if (overrideLineId) {
    const picked = matches.find((m) => m.line.id === overrideLineId);
    if (picked) return { status: 'resolved', line: picked.line, tank: picked.tank };
  }
  return { status: 'ambiguous', candidates: matches };
}
