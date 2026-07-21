import { haveActiveProfilesChanged } from '../../../src/main/runtime/haveActiveProfilesChanged';

describe('haveActiveProfilesChanged', () => {
  const profile = { characterName: 'Mapper', league: 'Mirage' };

  it('treats the first valid profile as a change', () => {
    expect(haveActiveProfilesChanged(profile, null)).toBe(true);
  });

  it('does not relaunch for an unchanged profile', () => {
    expect(haveActiveProfilesChanged(profile, { ...profile })).toBe(false);
  });

  it('detects character and league changes', () => {
    expect(haveActiveProfilesChanged({ ...profile, characterName: 'Bosser' }, profile)).toBe(true);
    expect(haveActiveProfilesChanged({ ...profile, league: 'Standard' }, profile)).toBe(true);
  });
});
