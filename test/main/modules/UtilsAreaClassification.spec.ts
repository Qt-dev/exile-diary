import { isTownArea } from '../../../src/main/modules/areaClassification';

describe('Utils area classification', () => {
  it.each(['Karui Shores', 'The Rogue Harbour'])(
    'treats the non-map hub %s as a town',
    (area) => {
      expect(isTownArea(area)).toBe(true);
    }
  );

  it('treats Kingsmarch as a map-tracked area', () => {
    expect(isTownArea('Kingsmarch')).toBe(false);
  });

  it('treats hideouts as towns for map tracking', () => {
    expect(isTownArea('Alpine Hideout')).toBe(true);
  });

  it('treats labyrinth staging areas as towns for map tracking', () => {
    expect(isTownArea("Aspirants' Plaza")).toBe(true);
  });

  it('does not classify a map area as a town', () => {
    expect(isTownArea('Dunes')).toBe(false);
  });
});
