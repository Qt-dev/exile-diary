import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import SideNav from '../components/SideNav/SideNav';
import Box from '@mui/material/Box';
import { electronService } from '../electron.service';
import IgnoreManager from '../../helpers/ignoreManager';
import LogBox from '../components/LogBox/LogBox';
import LogStore from '../stores/logStore';
import { RunListColumnsProvider } from '../runListColumns';
const logStore = new LogStore([]);
IgnoreManager.initialize(electronService.logger.scope('renderer/IgnoreManager'), () =>
  electronService.notifyFiltersUiUpdated()
);
const logger = electronService.logger.scope('renderer/Root');

const firstFiltersUpdate = async () => {
  const settings = await electronService.getSettings();
  IgnoreManager.updateSettings(settings.filters);
};

function Root() {
  const [isNewVersion, setIsNewVersion] = useState(true); // Change this to make it save
  const [version, setVersion] = useState('');
  const [enableAutoscroll, setEnableAutoscroll] = useState(true);
  const navigate = useNavigate();
  useEffect(() => {
    electronService.refreshGlobals().then(() => {
      const newVersion = electronService.getAppVersion();
      if (version !== newVersion) setVersion(newVersion);
    });

    const loadAutoscrollSetting = async () => {
      const settings = await electronService.getSettings();
      if (settings && typeof settings.enableAutoscroll === 'boolean') {
        setEnableAutoscroll(settings.enableAutoscroll);
      }
    };
    loadAutoscrollSetting();

    const unsubscribeLoggedOut = electronService.on('oauthLoggedOut', () => {
      logger.info('User logged out, redirecting to the login page');
      navigate('/login');
    });
    const unsubscribeExpiredToken = electronService.on('oauthExpiredToken', () => {
      logger.info('User Token expired, redirecting to the login page');
      navigate('/login');
    });
    const unsubscribeFilters = electronService.on('settingsFiltersUpdated', (settings) => {
      logger.debug('Settings filters updated, updating the Renderer Ignore Manager');
      IgnoreManager.updateSettings(settings);
    });
    const unsubscribeAutoscroll = electronService.on('settingsAutoscrollUpdated', (value) => {
      logger.debug('Autoscroll setting updated, updating the Renderer');
      setEnableAutoscroll(value);
    });
    firstFiltersUpdate();

    return () => {
      unsubscribeLoggedOut();
      unsubscribeExpiredToken();
      unsubscribeFilters();
      unsubscribeAutoscroll();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const turnNewVersionOff = () => {
    setIsNewVersion(false);
  };
  return (
    <div className="Root">
      <div className="Left-Column">
        <Box className="Left-Container">
          <SideNav
            version={version}
            isNewVersion={isNewVersion}
            turnNewVersionOff={turnNewVersionOff}
          />
        </Box>
      </div>
      <div className="Right-Column">
        <RunListColumnsProvider>
          <Outlet />
        </RunListColumnsProvider>
      </div>
      <div className="Log-Box__Overlay">
        <LogBox store={logStore} enableAutoscroll={enableAutoscroll} />
      </div>
    </div>
  );
}

export default Root;
