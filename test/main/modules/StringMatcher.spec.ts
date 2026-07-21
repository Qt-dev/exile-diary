import { describe, it, expect } from '@jest/globals';
import StringParser from '../../../src/main/modules/StringParser/StringParser';

describe('StringParser legacy matcher coverage', () => {
  describe('GetMod', () => {
    it('returns the exact clean map mods', () => {
      const mods = [
        '20% increased Pack size',
        '30% increased Rarity of Items found in this Area',
        '67% increased Quantity of Items found in this Area',
      ];

      for (const mod of mods) {
        expect(StringParser.GetMod(mod)).toBe(mod);
      }
    });

    it('returns the clean mod string for rarer exact inputs', () => {
      const mods = [
        'Unique Boss deals 27% increased Damage',
        'Monsters have a 55% chance to avoid Poison, Impale, and Bleeding',
        'Unique Boss has 33% increased Attack and Cast Speed',
        'Buffs on Players expire 77% faster',
      ];

      for (const mod of mods) {
        expect(StringParser.GetMod(mod)).toBe(mod);
      }
    });

    it('keeps the original numbers when resolving fuzzy OCR-style inputs', () => {
      const cases = [
        {
          input: 'Fr Area contains 2 additional Map Bosses',
          expected: 'Area contains 2 additional Map Bosses',
        },
        {
          input: "Area contains an additional Smuggler's Cache 3",
          expected: "Area contains an additional Smuggler's Cache",
        },
        {
          input: 'sa r 30% increased rarity of items found in this areas',
          expected: '30% increased Rarity of Items found in this Area',
        },
      ];

      for (const testCase of cases) {
        expect(StringParser.GetMod(testCase.input)).toBe(testCase.expected);
      }
    });
  });
});
