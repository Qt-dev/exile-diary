import { describe, test, expect } from '@jest/globals';
import StringMatcher from '../../../src/main/modules/StringMatcher';
import logger from 'electron-log';
import Constants from '../../../src/helpers/constants';

jest.mock('electron-log', () => ({
  scope: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
}));

// Example function to test
function stringContains(baseString: string, searchString: string): boolean {
  return baseString.includes(searchString);
}

describe('StringMatcher', () => {
  describe('getClosest', () => {
    it('should return the closest match for the basic mods', () => {
      const mods = [
        '20% increased pack size', 
        '30% increased rarity of items found in this area', 
        '67% increased quantity of items found in this area'
      ];

      for(const mod of mods) {
        const now = new Date();
        const closest = StringMatcher.getClosest(mod, Constants.mapMods);
        console.log(`Found closest match: ${closest} for mod: ${mod} in ${new Date().getMilliseconds() - now.getMilliseconds()} ms`);
        expect(closest.toLowerCase()).toBe(mod.replace(/\d+/g, '#'));
      };
    });
    it('should return the closest match for more rare mods', () => {
      const mods = [
        'Unique boss deals 27% increased damage',
        'Monsters have a 55% chance to avoid poison, impale, and bleeding',
        'Unique Boss has 33% increased attack and cast Speed',
        'Buffs on players expire 77% faster',
      ];

      for(const mod of mods) {
        const now = new Date();
        const closest = StringMatcher.getClosest(mod, Constants.mapMods);
        console.log(`Found closest match: ${closest} for mod: ${mod} in ${new Date().getMilliseconds() - now.getMilliseconds()} ms`);
        expect(closest.toLowerCase()).toBe(mod.toLowerCase().replace(/\d+/g, '#'));
      };
    });
    it('should return the closest match for rare implicits', () => {
      const mods = [
        'Area contains 2 additional Map Bosses',
        'Area contains an additional Smuggler\'s Cache',
      ];

      for(const mod of mods) {
        const now = new Date();
        const closest = StringMatcher.getClosest(mod, Constants.mapMods);
        console.log(`Found closest match: ${closest} for mod: ${mod} in ${new Date().getMilliseconds() - now.getMilliseconds()} ms`);
        expect(closest.toLowerCase()).toBe(mod.toLowerCase().replace(/\d+/g, '#'));
      };
    });

    it('should return the closest match when the result is fuzzy', () => {
      const modsData = [
        { input: 'Fr Area contains 2 additional Map Bosses', expected: 'Area contains # additional Map Bosses' },
        { input: 'Area contains an additional Smuggler\'s Cache 3', expected: 'Area contains an additional Smuggler\'s Cache' },
        { input: 'sa r 30% increased rarity of items found in this areas', expected: '#% increased rarity of items found in this area' }
      ];

      for(const mod of modsData) {
        const now = new Date();
        const closest = StringMatcher.getClosest(mod.input, Constants.mapMods);
        console.log(`Found closest match: ${closest} for mod: ${mod} in ${new Date().getMilliseconds() - now.getMilliseconds()} ms`);
        expect(closest.toLowerCase()).toBe(mod.expected.toLowerCase());
      };
    });
  });
});