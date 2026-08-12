import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RUN_LIST_COLUMNS,
  normalizeRunListColumns,
} from '../../src/renderer/runListColumns';

describe('run-list column preferences', () => {
  it('fills missing columns, removes unknown and duplicate ids, and keeps Map visible', () => {
    const result = normalizeRunListColumns({
      order: ['profit', 'profit', 'unknown', 'map'],
      hidden: ['map', 'kills', 'kills', 'unknown'],
    });
    expect(result.order).toEqual([
      'profit',
      'map',
      ...DEFAULT_RUN_LIST_COLUMNS.order.filter((id) => id !== 'map' && id !== 'profit'),
    ]);
    expect(result.hidden).toEqual(['kills']);
  });

  it('falls back to the current all-visible layout for malformed settings', () => {
    expect(normalizeRunListColumns(null)).toEqual(DEFAULT_RUN_LIST_COLUMNS);
    expect(normalizeRunListColumns({ order: [], hidden: [] })).toEqual(DEFAULT_RUN_LIST_COLUMNS);
  });
});
