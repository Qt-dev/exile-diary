import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import SideNav from '../components/SideNav/SideNav';
import Box from '@mui/material/Box';
import { electronService } from '../electron.service';

function Root() {
  const [isNewVersion, setIsNewVersion] = useState(true); // Change this to make it save
  const [version, setVersion] = useState('');
  useEffect(() => {
    electronService.refreshGlobals().then(() => {
      const newVersion = electronService.getAppVersion();
      if (version !== newVersion) setVersion(newVersion);
    });
  }, []);
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
    </div>
  );
}

export default Root;
