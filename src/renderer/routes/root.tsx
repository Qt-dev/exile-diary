import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import SideNav from '../components/SideNav/SideNav';
import Box from '@mui/material/Box';

const version = require('../../../package.json').version;

function Root() {
  const [isNewVersion, setIsNewVersion] = useState(true); // Change this to make it save
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
