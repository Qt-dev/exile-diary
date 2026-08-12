import { describe, expect, it } from 'vitest';
import {
  formatDuration,
  formatLootTime,
  groupedLoot,
  mapsPerHour,
  priciestDrops,
} from '../../src/renderer/components/Strategies/StrategySummary';
import { formatPriceNumber } from '../../src/renderer/components/Pricing/Price';

describe('strategy summary loot grouping', () => {
  it('groups by display name, sums quantity and value, and keeps the top five', () => {
    const loot = Array.from({ length: 6 }, (_, index) => ({
      typeLine: `Item ${index}`,
      value: index + 1,
      maxStackSize: 1,
      raw_data: JSON.stringify({ typeLine: `Item ${index}` }),
    }));
    loot.push(
      { typeLine: 'Orb', value: 10, maxStackSize: 20, pickupStackSize: 2, raw_data: JSON.stringify({ typeLine: 'Orb' }) },
      { typeLine: 'Orb', value: 15, maxStackSize: 20, pickupStackSize: 3, raw_data: JSON.stringify({ typeLine: 'Orb' }) }
    );

    const result = groupedLoot(loot);
    expect(result).toHaveLength(5);
    expect(result[0]).toEqual({ name: 'Orb', quantity: 5, totalValue: 25 });
  });

  it('returns an empty list for missing loot', () => {
    expect(groupedLoot()).toEqual([]);
    expect(priciestDrops()).toEqual([]);
  });

  it('keeps the three priciest individual drops separate', () => {
    const loot = [
      { id: 'a', typeLine: 'Divine Orb', value: 180, drop_timestamp: '2026-08-11T12:00:00' },
      { id: 'b', typeLine: 'Divine Orb', value: 180, drop_timestamp: '2026-08-11T12:01:00' },
      { id: 'c', typeLine: 'Mirror of Kalandra', value: 50_000, drop_timestamp: '2026-08-11T12:02:00' },
      { id: 'd', typeLine: 'Sacred Orb', value: 25 },
    ];

    expect(priciestDrops(loot)).toEqual([
      { name: 'Mirror of Kalandra', quantity: 1, totalValue: 50_000, lootedAt: '2026-08-11T12:02:00' },
      { name: 'Divine Orb', quantity: 1, totalValue: 180, lootedAt: '2026-08-11T12:00:00' },
      { name: 'Divine Orb', quantity: 1, totalValue: 180, lootedAt: '2026-08-11T12:01:00' },
    ]);
  });

  it('formats drop timestamps and handles missing values', () => {
    expect(formatLootTime('2026-08-11T12:34:56')).toBe('2026-08-11 12:34:56');
    expect(formatLootTime(null)).toBe('Unknown time');
  });

  it('formats total and per-map durations without wrapping after 24 hours', () => {
    expect(formatDuration(3_661)).toBe('01:01:01');
    expect(formatDuration(90_061)).toBe('25:01:01');
    expect(formatDuration(Number.NaN)).toBe('00:00:00');
  });

  it('calculates maps per hour and handles an empty duration', () => {
    expect(mapsPerHour(12, 7_200)).toBe(6);
    expect(mapsPerHour(12, 0)).toBe(0);
  });

  it('abbreviates six-digit prices with lowercase units', () => {
    expect(formatPriceNumber(99_999.99, true)).toBe(99_999.99);
    expect(formatPriceNumber(100_000, true)).toBe('100k');
    expect(formatPriceNumber(125_500, true)).toBe('125.5k');
    expect(formatPriceNumber(1_250_000, true)).toBe('1.25m');
  });
});
