import React from 'react';
import { useLoaderData, useRevalidator } from 'react-router';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Box from '@mui/material/Box';
import StashSettings from '../components/Settings/StashSettings/StashSettings';
import MainSettings from '../components/Settings/MainSettings/MainSettings';
import FilterSettings from '../components/Settings/FilterSettings/FilterSettings';
import DebugSettings from '../components/Settings/DebugSettings/DebugSettings';
import HotkeySettings from '../components/Settings/HotkeySettings/HotkeySettings';
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
  const { revalidate } = useRevalidator();
  const [tabValue, setTabValue] = React.useState(0);
  const [stashLoadError, setStashLoadError] = React.useState(false);

  const loadStashTabs = async () => {
    setStashLoadError(false);
    try {
      await stashTabStore.ensureLoaded();
    } catch {
      setStashLoadError(true);
    }
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
    if (newValue === 1) {
      void loadStashTabs();
    }
  };

  // const handleStashSettingsChange = (stashSettings) => {};
  // const handleCharacterRefresh = () => {};

  return (
    <div className="Settings">
      <Box>
        <Tabs value={tabValue} centered aria-label="Settings Tabs" onChange={handleTabChange}>
          <Tab label="Account" {...a11yProps(0)} />
          <Tab label="Stashes" {...a11yProps(1)} />
          <Tab label="Item Filter" {...a11yProps(2)} />
          <Tab label="Hotkeys" {...a11yProps(3)} />
          <Tab label="Debug" {...a11yProps(4)} />
          {/* Add new stuff here */}
        </Tabs>
      </Box>
      <div hidden={tabValue !== 0}>
        <MainSettings
          store={characterStore}
          settings={settings}
          runStore={runStore}
          revalidate={revalidate}
        />
      </div>
      <div hidden={tabValue !== 1}>
        {stashLoadError ? (
          <div role="alert">
            <p>Unable to load stash tabs.</p>
            <button type="button" onClick={() => void loadStashTabs()}>
              Retry
            </button>
          </div>
        ) : (
          <StashSettings store={stashTabStore} settings={settings} />
        )}
      </div>
      <div hidden={tabValue !== 2}>
        <FilterSettings settings={settings} revalidate={revalidate} />
      </div>
      <div hidden={tabValue !== 3}>
        <HotkeySettings settings={settings} revalidate={revalidate} />
      </div>
      <div hidden={tabValue !== 4}>
        <DebugSettings runStore={runStore} settings={settings} />
      </div>
    </div>
  );
};

export default observer(Settings);
