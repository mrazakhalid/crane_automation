import { describe, expect, it } from 'vitest';
import { parseRecipe, serializeRecipe } from '../utils/recipe.js';

describe('recipe parse/serialize', () => {
  it('parses a raw recipe string into ordered Tank/Time rows', () => {
    expect(parseRecipe('2-1A=5;2-1B=3;7-1=5;')).toEqual([
      { tank: '2-1A', time: '5' },
      { tank: '2-1B', time: '3' },
      { tank: '7-1', time: '5' },
    ]);
  });

  it('tolerates whitespace, a missing trailing semicolon, and empty input', () => {
    expect(parseRecipe(' 1-1 = 60 ; 5-2=30 ')).toEqual([
      { tank: '1-1', time: '60' },
      { tank: '5-2', time: '30' },
    ]);
    expect(parseRecipe('')).toEqual([]);
  });

  it('serializes rows back to the backend string, dropping blank tanks and defaulting time to 0', () => {
    expect(
      serializeRecipe([
        { tank: '2-1A', time: '5' },
        { tank: '', time: '9' }, // blank tank → dropped
        { tank: '2-2', time: '' }, // blank time → 0
      ]),
    ).toBe('2-1A=5;2-2=0;');
    expect(serializeRecipe([])).toBe('');
  });

  it('round-trips a recipe string unchanged', () => {
    const qr = '2-1A=5;2-1B=3;2-2=2;7-1=5;';
    expect(serializeRecipe(parseRecipe(qr))).toBe(qr);
  });
});
