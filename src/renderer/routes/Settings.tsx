import React, { useRef } from 'react';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Divider from '@mui/material/Divider';
import Select from '@mui/material/Select';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import './Settings.css';
import { useLoaderData } from 'react-router';
import { electronService } from '../electron.service';
import { useNavigate } from 'react-router-dom';
import MenuItem from '@mui/material/MenuItem';
import FormHelperText from '@mui/material/FormHelperText';
import * as path from 'path';
const { ipcRenderer } = electronService;

// Fix to allow for directory selection in inputs
declare module 'react' {
  interface InputHTMLAttributes<T> extends HTMLAttributes<T> {
    // extends React's HTMLAttributes
    directory?: string;
    webkitdirectory?: string;
  }
}

type SettingsLoaderData = {
  settings: any;
  characters: any;
};

function a11yProps(index: number) {
  return {
    id: `simple-tab-${index}`,
    'aria-controls': `simple-tabpanel-${index}`,
  };
}

const Settings = () => {
  const navigate = useNavigate();
  const { settings, characters } = useLoaderData() as SettingsLoaderData;
  const [tabValue, setTabValue] = React.useState(0);

  // Character
  const [character, setCharacter] = React.useState(
    settings.activeProfile.characterName ? settings.activeProfile.characterName : ''
  );
  const handleCharacterChange = (e) => {
    e.preventDefault();
    setCharacter(e.target.value);
  };

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

  const accountName = settings.accountName ? settings.accountName : '';
  const league = settings.activeProfile.league ? settings.activeProfile.league : 'Unknown';
  const charactersOptions = characters.map((character: any) => (
    <MenuItem key={character.name} value={character.name}>
      {character.name} (Level {character.level}) {character.class} - {character.league} {character.current ? '(Last Active)' : ''}
    </MenuItem>
  ));
  const alternateSplinterPricing = !!settings.alternateSplinterPricing;

  const handleBack = () => {
    navigate('/');
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = {
      activeProfile: {
        characterName: character,
        league: characters.find((char: any) => char.name === character).league,
        valid: true,
      },
      clientTxt: e.target.log_location.value,
      screenshotDir: e.target.screenshot_location.value,
      alternateSplinterPricing: e.target.alternate_splinter_pricing.checked,
    };
    ipcRenderer.invoke('save-settings', { settings: data });
  };

  return (
    <div className="Settings">
      <Box>
        <Tabs value={tabValue} centered aria-label="Settings Tabs" onChange={handleTabChange}>
          <Tab label="Account" {...a11yProps(0)} />
          {/* Add new stuff here */}
        </Tabs>
      </Box>
      <form onSubmit={handleSubmit} role="tabpanel" hidden={tabValue !== 0}>
        {tabValue === 0 && (
          <Box sx={{ p: 3 }}>
            <div className="Settings__Row">
              <TextField
                fullWidth
                label="Account Name"
                id="account"
                variant="standard"
                disabled
                size="small"
                value={accountName}
              />
            </div>
            <ButtonGroup variant="outlined" fullWidth color="primary" aria-label="contained primary button group">
              <Button onClick={handleLogout}>Logout</Button>
              <Button onClick={handleRedirectToLogin}>Refresh Login</Button>
            </ButtonGroup>
            <Divider className="Settings__Separator" />
            <div className="Settings__Row">
              <div className="Text--Normal">Currently Active Character:{' '}</div>
              <div className="Text--Rare">
                {character ? character : 'Unknown Character'} ({league} League)
              </div>
            </div>
            <div className="Settings__Row">
              <Select
                fullWidth
                label="Character"
                id="character"
                variant="filled"
                size="small"
                disabled={charactersOptions.length === 0}
                value={character}
                onChange={handleCharacterChange}
              >
                {charactersOptions}
              </Select>
              {charactersOptions.length === 0 ? (
                <FormHelperText>Disabled - No character retrieved</FormHelperText>
              ) : (
                ''
              )}
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
                control={<Checkbox id="alternate_splinter_pricing" defaultChecked={alternateSplinterPricing} />}
                label="Enable Alternate Splinter Pricing"
              />
            </div>
            {/* alternateSplinterPricing */}
            <Divider className="Settings__Separator" />
            <div>This section is not plugged in yet</div>
            <div className="Settings__Checkbox__Row">
              <FormControlLabel control={<Checkbox disabled />} label="Minimize to Tray" />
            </div>
            <div className="Settings__Checkbox__Row">
              <FormControlLabel
                control={<Checkbox disabled />}
                label="Enable Overlay Popup Messages"
              />
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
              <FormControlLabel
                control={<Checkbox disabled />}
                label="Enable Incubator Running Out Alert"
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
        )}
      </form>
    </div>
  );
};

export default Settings;
