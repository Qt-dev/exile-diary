type ActiveProfile = {
  characterName?: string;
  league?: string;
} | null | undefined;

export function haveActiveProfilesChanged(
  newProfile: ActiveProfile,
  oldProfile: ActiveProfile
) {
  return (
    newProfile?.characterName !== oldProfile?.characterName ||
    newProfile?.league !== oldProfile?.league
  );
}
