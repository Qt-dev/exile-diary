import React from 'react';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Divider from '@mui/material/Divider';
import Select from '@mui/material/Select';
import FormGroup from '@mui/material/FormGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import './Settings.css';


function a11yProps(index: number) {
  return {
    id: `simple-tab-${index}`,
    'aria-controls': `simple-tabpanel-${index}`,
  };
}

const Settings = () => {
  const [value, setValue] = React.useState(0);
  const handleChange = (event: React.SyntheticEvent, newValue: number) => {
    setValue(newValue);
  };

  return (
    <div className="Settings">
      <Box>
        <Tabs value={value} centered onChange={handleChange} aria-label="Settings Tabs">
          <Tab label="Account" {...a11yProps(0)} />
          {/* Add new stuff here */}
        </Tabs>
      </Box>
      <FormGroup 
        role='tabpanel'
        hidden={value !== 0}
        id={`simple-tabpanel-${0}`}
        aria-labbeledby={`simple-tab-${0}`}
      >
        {value === 0 && (
          <Box sx={{ p: 3 }}>
            <div className="Settings__Row">
              <TextField fullWidth label="Account Name" id="account" variant="filled"  size="small"/>
            </div>
            <div className="Settings__Row">
              <TextField fullWidth label="POESESSID" id="poesessid" variant="filled" size="small"/>
            </div>
            <Divider className="Settings__Separator"/>
            Currently Active Character: <div className='Text--Rare'>Character Name (Crucible League)</div>
            <div className="Settings__Row">
              <Select fullWidth label="Character" id="character" variant="filled" size="small" />
            </div>
            <Divider className="Settings__Separator"/>
            <div className="Settings__Row">
              <TextField fullWidth label="Client.TXT Location" id="log_location" variant="filled"  size="small"/>
            </div>
            <div className="Settings__Row">
              <TextField fullWidth label="Screenshot Directory" id="screenshot_location" variant="filled" size="small"/>
            </div>
            <Divider className="Settings__Separator"/>
            <div className="Settings__Checkbox__Row"><FormControlLabel control={<Checkbox />} label="Minimize to Tray" /></div>
            <div className="Settings__Checkbox__Row"><FormControlLabel control={<Checkbox />} label="Enable Overlay Popup Messages" /></div>
            <div className="Settings__Checkbox__Row"><FormControlLabel control={<Checkbox />} label="Get Item Prices even in SSF Mode" /></div>
            <div className="Settings__Checkbox__Row"><FormControlLabel control={<Checkbox />} label="Get Low-Confidence Pricing Data from poe.ninja" /></div>
            <div className="Settings__Checkbox__Row"><FormControlLabel control={<Checkbox />} label="Enable Incubator Running Out Alert" /></div>
            <div className="Settings__Checkbox__Row"><FormControlLabel control={<Checkbox />} label="Disable Gear Tracking" /></div>
            <Divider className="Settings__Separator"/>
            <ButtonGroup variant="outlined" fullWidth aria-label="Settings Control Buttons">
              <Button>Save</Button>
              <Button>Cancel</Button>
            </ButtonGroup>
          </Box>
        )}
      </FormGroup>
    </div>
  );
};

export default Settings;
