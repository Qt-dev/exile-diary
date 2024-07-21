import React from 'react';
import { useLoaderData } from 'react-router';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Box from '@mui/material/Box';
import StashSettings from '../components/Settings/StashSettings/StashSettings';
import MainSettings from '../components/Settings/MainSettings/MainSettings';
import FilterSettings from '../components/Settings/FilterSettings/FilterSettings';
import DebugSettings from '../components/Settings/DebugSettings/DebugSettings';
import './Settings.css';
import { observer } from 'mobx-react-lite';

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

const Settings = ({ characterStore, stashTabStore, runStore }) => {
  const { settings } = useLoaderData() as SettingsLoaderData;
  const [tabValue, setTabValue] = React.useState(0);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  // const handleStashSettingsChange = (stashSettings) => {};
  // const handleCharacterRefresh = () => {};

  return (
    <div className="Settings">
      <Box>
        <Tabs value={tabValue} centered aria-label="Settings Tabs" onChange={handleTabChange}>
          <Tab label="Account" {...a11yProps(0)} />
          <Tab label="Stashes" {...a11yProps(2)} />
          <Tab label="Item Filter" {...a11yProps(3)} />
          <Tab label="Debug" {...a11yProps(4)} />
          {/* Add new stuff here */}
        </Tabs>
      </Box>
      <div hidden={tabValue !== 0}>
        <MainSettings store={characterStore} settings={settings} runStore={runStore} />
      </div>
      <div hidden={tabValue !== 1}>
        <StashSettings store={stashTabStore} settings={settings} />
      </div>
      <div hidden={tabValue !== 2}>
        <FilterSettings settings={settings} />
      </div>
      <div hidden={tabValue !== 3}>
        <DebugSettings runStore={runStore} />
      </div>
    </div>
  );
};

export default observer(Settings);
