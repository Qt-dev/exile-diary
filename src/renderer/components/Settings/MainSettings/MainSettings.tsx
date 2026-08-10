import React, { useEffect } from 'react';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Divider from '@mui/material/Divider';
import Select from '@mui/material/Select';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import { electronService } from '../../../electron.service';
import { useNavigate } from 'react-router-dom';
import MenuItem from '@mui/material/MenuItem';
import FormHelperText from '@mui/material/FormHelperText';
import { observer } from 'mobx-react-lite';
import '../SettingsCommon.css';

// Fix to allow for directory selection in inputs
declare module 'react' {
  interface InputHTMLAttributes<T> extends HTMLAttributes<T> {
    // extends React's HTMLAttributes
    directory?: string;
    webkitdirectory?: string;
  }
}

const MainSettings = ({ settings, store, runStore, revalidate }) => {
  const navigate = useNavigate();

  // Character
  const [character, setCharacter] = React.useState(
    settings.activeProfile.characterName ? settings.activeProfile.characterName : ''
  );
  const [league, setLeague] = React.useState(
    settings.activeProfile.league ? settings.activeProfile.league : ''
  );
  const handleCharacterChange = (e) => {
    e.preventDefault();
    setCharacter(e.target.value);
  };

  const handleLeagueChange = (e) => {
    e.preventDefault();
    setLeague(e.target.value);
  };

  const leagueOptions = store.characters
    .map((character: any) => character.league)
    .filter(
      (league, index) => store.characters.findIndex((char: any) => char.league === league) === index
    )
    .map((league) => (
      <MenuItem key={league} value={league}>
        {league}
      </MenuItem>
    ));

  const charactersOptions = store.characters
    .filter((character: any) => character.league === league)
    .map((character: any) => (
      <MenuItem key={character.name} value={character.name}>
        {character.name} (Level {character.level}) {character.class}{' '}
        {character.current ? '(Last Active)' : ''}
      </MenuItem>
    ));

  // Client File Location
  const [clientFileLocation, setClientFileLocation] = React.useState(settings.clientTxt);
  const handleOpenClientLocation = async (e) => {
    e.preventDefault();

    try {
      const result = await electronService.openFileDialog({
        title: 'Select Path of Exile Client.txt file',
        filters: [
          { name: 'Text Files', extensions: ['txt'] },
          { name: 'All Files', extensions: ['*'] },
        ],
        properties: ['openFile'],
      });

      if (result && !result.canceled && result.filePaths.length > 0) {
        const filePath = result.filePaths[0];
        console.log('Selected file path:', filePath);
        setClientFileLocation(filePath);
      }
    } catch (error) {
      console.error('Error opening file dialog:', error);
    }
  };

  // Screenshot Folder Location
  const [screenshotLocation, setScreenshotLocation] = React.useState(settings.screenshotDir);
  const handleOpenScreenshotLocation = async (e) => {
    e.preventDefault();
    try {
      const result = await electronService.openFileDialog({
        title: 'Select Screenshot Folder',
        properties: ['openDirectory'],
      });
      if (result && !result.canceled && result.filePaths.length > 0) {
        setScreenshotLocation(result.filePaths[0]);
      }
    } catch (error) {
      console.error('Error opening directory dialog:', error);
    }
  };

  // League Override
  const [leagueOverride, setLeagueOverride] = React.useState(
    settings.activeProfile.leagueOverride ? settings.activeProfile.leagueOverride : ''
  );

  // Auto-screenshot delay
  const [autoScreenshotDelay, setAutoScreenshotDelay] = React.useState(
    settings.autoScreenshotOnMapEntry?.delay || 2
  );

  // Checkbox states
  const [alternateSplinterPricingState, setAlternateSplinterPricingState] = React.useState(
    !!settings.alternateSplinterPricing
  );
  const [enableIncubatorAlertState, setEnableIncubatorAlertState] = React.useState(
    !!settings.enableIncubatorAlert
  );
  const [enableScreenshotFolderWatchState, setEnableScreenshotFolderWatchState] = React.useState(
    settings.screenshots && !!settings.screenshots.allowFolderWatch
  );
  const [enableScreenshotCustomShortcutState, setEnableScreenshotCustomShortcutState] =
    React.useState(settings.screenshots && !!settings.screenshots.allowCustomShortcut);
  const [runParseScreenshotEnabledState, setRunParseScreenshotEnabledState] = React.useState(
    !!settings.runParseScreenshotEnabled
  );
  const [autoScreenshotOnMapEntryState, setAutoScreenshotOnMapEntryState] = React.useState(
    !!settings.autoScreenshotOnMapEntry?.enabled
  );
  const [forceDebugModeState, setForceDebugModeState] = React.useState(!!settings.forceDebugMode);
  const [priceHistoryWindowWeeksState, setPriceHistoryWindowWeeksState] = React.useState(
    settings.priceHistoryWindowWeeks ?? 1
  );

  const handleRedirectToLogin = () => {
    navigate('/login');
  };
  const handleLogout = () => {
    electronService.logout();
  };

  const username = settings.username ? settings.username : '';

  // Overlay settings with state management
  const [overlayEnabled, setOverlayEnabled] = React.useState(!!settings.overlayEnabled);
  const [overlayPersistenceEnabled, setOverlayPersistenceEnabled] = React.useState(
    !!settings.overlayPersistenceEnabled
  );

  // Track if there are unsaved changes
  const hasUnsavedChanges = React.useMemo(() => {
    const selectedChar = store.characters.find((char: any) => char.name === character);
    return (
      character !== (settings.activeProfile.characterName || '') ||
      (selectedChar ? selectedChar.league : league) !== (settings.activeProfile.league || '') ||
      leagueOverride !== (settings.activeProfile.leagueOverride || '') ||
      clientFileLocation !== (settings.clientTxt || '') ||
      screenshotLocation !== (settings.screenshotDir || '') ||
      overlayEnabled !== !!settings.overlayEnabled ||
      autoScreenshotDelay !== (settings.autoScreenshotOnMapEntry?.delay || 2) ||
      alternateSplinterPricingState !== !!settings.alternateSplinterPricing ||
      enableIncubatorAlertState !== !!settings.enableIncubatorAlert ||
      enableScreenshotFolderWatchState !==
        !!(settings.screenshots && settings.screenshots.allowFolderWatch) ||
      enableScreenshotCustomShortcutState !==
        !!(settings.screenshots && settings.screenshots.allowCustomShortcut) ||
      runParseScreenshotEnabledState !== !!settings.runParseScreenshotEnabled ||
      autoScreenshotOnMapEntryState !== !!settings.autoScreenshotOnMapEntry?.enabled ||
      forceDebugModeState !== !!settings.forceDebugMode ||
      priceHistoryWindowWeeksState !== (settings.priceHistoryWindowWeeks ?? 1)
    );
  }, [
    character,
    league,
    leagueOverride,
    clientFileLocation,
    screenshotLocation,
    overlayEnabled,
    autoScreenshotDelay,
    alternateSplinterPricingState,
    enableIncubatorAlertState,
    enableScreenshotFolderWatchState,
    enableScreenshotCustomShortcutState,
    runParseScreenshotEnabledState,
    autoScreenshotOnMapEntryState,
    forceDebugModeState,
    priceHistoryWindowWeeksState,
    settings,
    store.characters,
  ]);

  const handleCancel = () => {
    // Reset all form fields to original settings values
    setCharacter(settings.activeProfile.characterName ? settings.activeProfile.characterName : '');
    setLeague(settings.activeProfile.league ? settings.activeProfile.league : '');
    setLeagueOverride(
      settings.activeProfile.leagueOverride ? settings.activeProfile.leagueOverride : ''
    );
    setClientFileLocation(settings.clientTxt);
    setScreenshotLocation(settings.screenshotDir);
    setAutoScreenshotDelay(settings.autoScreenshotOnMapEntry?.delay || 2);
    setAlternateSplinterPricingState(!!settings.alternateSplinterPricing);
    setEnableIncubatorAlertState(!!settings.enableIncubatorAlert);
    setEnableScreenshotFolderWatchState(
      settings.screenshots && !!settings.screenshots.allowFolderWatch
    );
    setEnableScreenshotCustomShortcutState(
      settings.screenshots && !!settings.screenshots.allowCustomShortcut
    );
    setRunParseScreenshotEnabledState(!!settings.runParseScreenshotEnabled);
    setAutoScreenshotOnMapEntryState(!!settings.autoScreenshotOnMapEntry?.enabled);
    setForceDebugModeState(!!settings.forceDebugMode);
    setPriceHistoryWindowWeeksState(settings.priceHistoryWindowWeeks ?? 1);
    setOverlayEnabled(!!settings.overlayEnabled);
    setOverlayPersistenceEnabled(!!settings.overlayPersistenceEnabled);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const selectedChar = store.characters.find((char: any) => char.name === character);
    const data = {
      activeProfile: {
        characterName: character,
        league: selectedChar ? selectedChar.league : league,
        leagueOverride: leagueOverride,
        valid: true,
      },
      clientTxt: clientFileLocation,
      screenshotDir: screenshotLocation,
      alternateSplinterPricing: alternateSplinterPricingState,
      overlayEnabled: overlayEnabled,
      overlayPersistenceEnabled: overlayPersistenceEnabled,
      enableIncubatorAlert: enableIncubatorAlertState,
      runParseScreenshotEnabled: runParseScreenshotEnabledState,
      forceDebugMode: forceDebugModeState,
      priceHistoryWindowWeeks: priceHistoryWindowWeeksState,
      screenshots: {
        allowCustomShortcut: enableScreenshotCustomShortcutState,
        allowFolderWatch: enableScreenshotFolderWatchState,
        screenshotDir: screenshotLocation,
      },
      autoScreenshotOnMapEntry: {
        enabled: autoScreenshotOnMapEntryState,
        delay: autoScreenshotDelay,
      },
    };

    // Save settings
    await electronService.saveSettings(data);
    revalidate();
  };

  const handleRefreshCharacters = () => {
    store.fetchCharacters();
  };

  useEffect(() => {
    store.fetchCharacters();
  }, [store]);

  // Listen for overlay persistence changes from the main process (e.g., when hotkey is pressed)
  useEffect(() => {
    const handlePersistenceChanged = (isEnabled) => {
      setOverlayPersistenceEnabled(isEnabled);
    };

    return electronService.on('settingsOverlayPersistenceChanged', handlePersistenceChanged);
  }, []);

  return (
    <form onSubmit={handleSubmit} role="tabpanel">
      <Box sx={{ p: 3 }}>
        <div className="Settings__Row">
          <TextField
            fullWidth
            label="Account Name"
            id="account"
            variant="standard"
            disabled
            size="small"
            value={username}
          />
        </div>
        <ButtonGroup
          variant="outlined"
          fullWidth
          color="primary"
          aria-label="contained primary button group"
        >
          <Button onClick={handleLogout}>Logout</Button>
          <Button onClick={handleRedirectToLogin}>Refresh Login</Button>
        </ButtonGroup>
        <Divider className="Settings__Separator" />
        <div className="Settings__Row">
          {store.isLoading ? (
            <div className="Text--Normal">Loading Characters...</div>
          ) : (
            <>
              <div className="Text--Normal">Currently Active Character: </div>
              <div className="Text--Rare">
                {character ? character : 'Unknown Character'} ({league} League)
              </div>
            </>
          )}
        </div>
        <div className="Settings__Row Settings__Character-Select">
          <Select
            label="League"
            id="league"
            variant="filled"
            size="small"
            disabled={leagueOptions.length === 0}
            value={store.isLoading ? null : league}
            onChange={handleLeagueChange}
          >
            {leagueOptions}
          </Select>
          <Select
            label="Character"
            id="character"
            variant="filled"
            size="small"
            disabled={charactersOptions.length === 0}
            value={store.isLoading ? null : character}
            onChange={handleCharacterChange}
          >
            {charactersOptions}
          </Select>
          {charactersOptions.length === 0 ? (
            <FormHelperText>Disabled - No character retrieved</FormHelperText>
          ) : (
            ''
          )}
          <Button component="label" disabled={store.isLoading} onClick={handleRefreshCharacters}>
            Refresh List
          </Button>
          {settings.forceDebugMode && (
            <Button
              component="label"
              disabled={store.isLoading || !character || !league}
              onClick={async () => await electronService.showCharacterDbFile()}
            >
              Show DB File
            </Button>
          )}
        </div>
        <Divider className="Settings__Separator" />
        <div className="Settings__Row">
          <TextField
            fullWidth
            label="Path of Exile Client.TXT Location (usually in PoE's log folder)"
            id="log_location"
            variant="filled"
            size="small"
            value={clientFileLocation}
            onChange={(e) => setClientFileLocation(e.target.value)}
          />
          <Button
            variant="contained"
            sx={{ marginTop: '7px', marginBottom: '10px', padding: '2px 15px' }}
            onClick={handleOpenClientLocation}
          >
            Find Path of Exile Log folder
          </Button>
        </div>
        <div className="Settings__Row">
          <TextField
            fullWidth
            label="Screenshot Directory"
            id="screenshot_location"
            variant="filled"
            size="small"
            value={screenshotLocation}
            onChange={(e) => setScreenshotLocation(e.target.value)}
          />
          <Button
            component="label"
            variant="contained"
            sx={{ marginTop: '7px', marginBottom: '10px', padding: '2px 15px' }}
            onClick={handleOpenScreenshotLocation}
          >
            Find PoE Screenshot Folder
          </Button>
        </div>
        <div className="Settings__Row">
          <TextField
            fullWidth
            label="PoE.ninja league name to change league used for pricing, leave blank for character's league. (e.g. Standard, Settlers)"
            id="league_override"
            variant="filled"
            size="small"
            value={leagueOverride}
            onChange={(e) => setLeagueOverride(e.target.value)}
          />
        </div>
        <Divider className="Settings__Separator" />
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <FormControlLabel
            control={
              <Checkbox
                id="alternate_splinter_pricing"
                checked={alternateSplinterPricingState}
                onChange={(e) => setAlternateSplinterPricingState(e.target.checked)}
              />
            }
            label="Enable Alternate Splinter Pricing"
          />
          <FormControlLabel
            control={
              <Checkbox
                id="enable_incubator_alert"
                checked={enableIncubatorAlertState}
                onChange={(e) => setEnableIncubatorAlertState(e.target.checked)}
              />
            }
            label="Enable Incubator Running Out Alert"
          />
          <FormControlLabel
            control={
              <Checkbox
                id="enable_screenshot_folder_watch"
                checked={enableScreenshotFolderWatchState}
                onChange={(e) => setEnableScreenshotFolderWatchState(e.target.checked)}
              />
            }
            label="Enable Screenshot Folder Monitoring"
          />
          <FormControlLabel
            control={
              <Checkbox
                id="overlay_enabled"
                checked={overlayEnabled}
                onChange={(e) => setOverlayEnabled(e.target.checked)}
              />
            }
            label="Enable Overlay Popup Messages"
          />
          <FormControlLabel
            control={
              <Checkbox
                id="overlay_persistence_enabled"
                checked={overlayPersistenceEnabled}
                onChange={(e) => setOverlayPersistenceEnabled(e.target.checked)}
              />
            }
            label={`Enable Overlay Persistence (${
              settings.overlayToggleShortcut || 'CommandOrControl+F7'
            })`}
          />
          <FormControlLabel
            control={
              <Checkbox
                id="enable_screenshot_custom_shortcut"
                checked={enableScreenshotCustomShortcutState}
                onChange={(e) => setEnableScreenshotCustomShortcutState(e.target.checked)}
              />
            }
            label={`Enable Custom Screenshot Shortcut (${
              settings.screenshotShortcut || 'CommandOrControl+F8'
            })`}
          />
          <FormControlLabel
            control={
              <Checkbox
                id="enable_run_parse_screenshot"
                checked={runParseScreenshotEnabledState}
                onChange={(e) => setRunParseScreenshotEnabledState(e.target.checked)}
              />
            }
            label={`Enable Shortcut to Finish a Run (${
              settings.runParseShortcut || 'CommandOrControl+F10'
            })`}
          />
          <Box
            sx={{ display: 'flex', alignItems: 'center', gap: 2, justifyContent: 'space-between' }}
          >
            <FormControlLabel
              control={
                <Checkbox
                  id="enable_auto_screenshot_on_map_entry"
                  checked={autoScreenshotOnMapEntryState}
                  onChange={(e) => setAutoScreenshotOnMapEntryState(e.target.checked)}
                />
              }
              label="Enable auto-screenshot when entering maps"
            />
            <Box sx={{ width: '30%' }}>
              <TextField
                fullWidth
                label="Delay after entering map (0-30s)"
                id="auto_screenshot_delay"
                variant="filled"
                size="small"
                type="number"
                slotProps={{ htmlInput: { min: 0, max: 30, step: 0.5 } }}
                value={autoScreenshotDelay}
                onChange={(e) => setAutoScreenshotDelay(parseFloat(e.target.value) || 0)}
                helperText=""
              />
            </Box>
          </Box>
          <FormControlLabel
            control={
              <Checkbox
                id="force_debug_mode"
                checked={forceDebugModeState}
                onChange={(e) => setForceDebugModeState(e.target.checked)}
              />
            }
            label="Force Debug Mode"
          />
        </Box>
        <Divider className="Settings__Separator" />
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <div className="Text--Normal">Price History Chart Range</div>
          <ButtonGroup size="small" variant="outlined" aria-label="Price history chart range">
            {(
              [
                { value: 1, label: '1 Week' },
                { value: 2, label: '2 Weeks' },
                { value: 3, label: '3 Weeks' },
                { value: 4, label: '4 Weeks' },
                { value: 'all', label: 'Full League' },
              ] as { value: 1 | 2 | 3 | 4 | 'all'; label: string }[]
            ).map(({ value, label }) => (
              <Button
                key={value}
                variant={priceHistoryWindowWeeksState === value ? 'contained' : 'outlined'}
                onClick={() => setPriceHistoryWindowWeeksState(value)}
              >
                {label}
              </Button>
            ))}
          </ButtonGroup>
          <FormHelperText>
            How much history the item price chart on the Prices page shows by default.
          </FormHelperText>
        </Box>
        {/* TODO: Add these settings if needed */}
        {/* <Divider className="Settings__Separator" />
        <div>This section is not plugged in yet</div>
        <div className="Settings__Checkbox__Row">
          <FormControlLabel control={<Checkbox disabled />} label="Minimize to Tray" />
        </div>
        <div className="Settings__Checkbox__Row">
          <FormControlLabel
            control={<Checkbox disabled />}
            label="Get Item Prices even in SSF Mode"
          />
        </div>
        <div className="Settings__Checkbox__Row">
          <FormControlLabel
            control={<Checkbox disabled />}
            label="Get Low-Confidence Pricing Data from poe.ninja"
          />
        </div>
        <div className="Settings__Checkbox__Row">
          <FormControlLabel control={<Checkbox disabled />} label="Disable Gear Tracking" />
        </div> */}
        <Divider className="Settings__Separator" />
        <ButtonGroup variant="outlined" fullWidth aria-label="Settings Control Buttons">
          <Button
            type="submit"
            variant={hasUnsavedChanges ? 'contained' : 'outlined'}
            className={hasUnsavedChanges ? 'Settings__Save-Button--unsaved' : ''}
          >
            {hasUnsavedChanges ? 'Save Changes' : 'Save'}
          </Button>
          <Button onClick={handleCancel}>Cancel</Button>
        </ButtonGroup>
      </Box>
    </form>
  );
};

export default observer(MainSettings);
