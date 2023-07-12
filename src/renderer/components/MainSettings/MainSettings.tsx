import React, { useEffect, useRef } from 'react';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Divider from '@mui/material/Divider';
import Select from '@mui/material/Select';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import { electronService } from '../../electron.service';
import { useNavigate } from 'react-router-dom';
import MenuItem from '@mui/material/MenuItem';
import FormHelperText from '@mui/material/FormHelperText';
import * as path from 'path';
import { observer } from 'mobx-react-lite';
const { ipcRenderer } = electronService;

// Fix to allow for directory selection in inputs
declare module 'react' {
  interface InputHTMLAttributes<T> extends HTMLAttributes<T> {
    // extends React's HTMLAttributes
    directory?: string;
    webkitdirectory?: string;
  }
}

const MainSettings = ({ settings, store }) => {
  const navigate = useNavigate();

  // Character
  const [character, setCharacter] = React.useState(
    settings.activeProfile.characterName ? settings.activeProfile.characterName : ''
  );
  const handleCharacterChange = (e) => {
    e.preventDefault();
    setCharacter(e.target.value);
  };
  const charactersOptions = store.characters.map((character: any) => (
    <MenuItem key={character.name} value={character.name}>
      {character.name} (Level {character.level}) {character.class} - {character.league}{' '}
      {character.current ? '(Last Active)' : ''}
    </MenuItem>
  ));

  // Client File Location
  const [clientFileLocation, setClientFileLocation] = React.useState(settings.clientTxt);
  const clientFileLocationRef = useRef(clientFileLocation);
  const handleOpenClientLocation = (e) => {
    e.preventDefault();
    setClientFileLocation(path.join(e.target.files[0].path, e.target.files[0].name));
  };

  // Screenshot Folder Location
  const [screenshotLocation, setScreenshotLocation] = React.useState(settings.screenshotDir);
  const screenshotLocationRef = useRef(screenshotLocation);
  const handleOpenScreenshotLocation = (e) => {
    e.preventDefault();
    setScreenshotLocation(path.join(e.target.files[0].path));
  };

  const handleRedirectToLogin = () => {
    navigate('/login');
  };
  const handleLogout = () => {
    ipcRenderer.invoke('oauth:logout');
  };

  const username = settings.username ? settings.username : '';
  const league = settings.activeProfile.league ? settings.activeProfile.league : 'Unknown';
  const alternateSplinterPricing = !!settings.alternateSplinterPricing;
  const overlayEnabled = !!settings.overlayEnabled;
  const enableIncubatorAlert = !!settings.enableIncubatorAlert;

  const handleBack = () => {
    navigate('/');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = {
      activeProfile: {
        characterName: character,
        league: store.characters.find((char: any) => char.name === character).league,
        valid: true,
      },
      clientTxt: e.target.log_location.value,
      screenshotDir: e.target.screenshot_location.value,
      alternateSplinterPricing: e.target.alternate_splinter_pricing.checked,
      overlayEnabled: e.target.overlay_enabled.checked,
      enableIncubatorAlert: e.target.enable_incubator_alert.checked,
    };
    ipcRenderer.invoke('save-settings', { settings: data });
  };

  const handleRefreshCharacters = () => {
    store.fetchCharacters();
  };

  useEffect(() => {
    store.fetchCharacters();
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
        <div className="Settings__Row">
          <Select
            fullWidth
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
        </div>
        <Divider className="Settings__Separator" />
        <div className="Settings__Row">
          <TextField
            fullWidth
            label="Client.TXT Location"
            id="log_location"
            variant="filled"
            size="small"
            value={clientFileLocation}
            onChange={(e) => setClientFileLocation(e.target.value)}
          />
          <Button component="label">
            Choose Folder
            <input
              hidden
              accept="Client.txt"
              type="file"
              ref={clientFileLocationRef}
              onInput={handleOpenClientLocation}
            />
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
          <Button component="label">
            Choose Folder
            <input
              hidden
              webkitdirectory=""
              directory=""
              type="file"
              ref={screenshotLocationRef}
              onInput={handleOpenScreenshotLocation}
            />
          </Button>
        </div>
        <Divider className="Settings__Separator" />
        <div className="Settings__Checkbox__Row">
          <FormControlLabel
            control={
              <Checkbox id="alternate_splinter_pricing" defaultChecked={alternateSplinterPricing} />
            }
            label="Enable Alternate Splinter Pricing"
          />
        </div>
        <div className="Settings__Checkbox__Row">
          <FormControlLabel
            control={<Checkbox id="overlay_enabled" defaultChecked={overlayEnabled} />}
            label="Enable Overlay Popup Messages"
          />
        </div>
        <div className="Settings__Checkbox__Row">
          <FormControlLabel
            control={<Checkbox id="enable_incubator_alert" defaultChecked={enableIncubatorAlert} />}
            label="Enable Incubator Running Out Alert"
          />
        </div>
        <Divider className="Settings__Separator" />
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
        </div>
        <Divider className="Settings__Separator" />
        <ButtonGroup variant="outlined" fullWidth aria-label="Settings Control Buttons">
          <Button type="submit">Save</Button>
          <Button onClick={handleBack}>Cancel</Button>
        </ButtonGroup>
      </Box>
    </form>
  );
};

export default observer(MainSettings);
