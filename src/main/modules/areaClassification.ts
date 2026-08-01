import Constants from '../../helpers/constants';

export function isTownArea(name: string): boolean {
  if (name === 'Kingsmarch') {
    return false;
  }

  if (Constants.townstrings.includes(name)) {
    return true;
  }

  return Object.values(Constants.worldAreas).some(
    (area) => area.name === name && (area.isTown || area.isHideout || area.isLabyrinthAirlock)
  );
}
