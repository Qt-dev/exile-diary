import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import SideNav from '../components/SideNav/SideNav';
import Box from '@mui/material/Box';
import { electronService } from '../electron.service';
import LogBox from '../components/LogBox/LogBox';
import LogStore from '../stores/logStore';
const logStore = new LogStore([]);
const { ipcRenderer, logger } = electronService;

function Root() {
  const [isNewVersion, setIsNewVersion] = useState(true); // Change this to make it save
  const [version, setVersion] = useState('');
  const navigate = useNavigate()
  useEffect(() => {
    electronService.refreshGlobals().then(() => {
      const newVersion = electronService.getAppVersion();
      if (version !== newVersion) setVersion(newVersion);
    });

    ipcRenderer.on('oauth:logged-out', () => {
      logger.info('User logged out, redirecting to the login page');
      navigate('/login');
    });
    ipcRenderer.on('oauth:expired-token', () => {
      logger.info('User Token expired, redirecting to the login page');
      navigate('/login');
    });
    
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
        <Outlet />
      </div>
      <div className="Log-Box__Overlay">
        <LogBox store={logStore} />
      </div>
    </div>
  );
}

export default Root;
