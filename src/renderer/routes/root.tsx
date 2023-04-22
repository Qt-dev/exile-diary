import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
// import './Root.css';
import SideNav from '../components/SideNav/SideNav';

const version = '1.0.0-DEV';

function Root() {
  const [isNewVersion, setIsNewVersion] = useState(true); // Change this to make it save
  const turnNewVersionOff = () => {
    setIsNewVersion(false);
  };
  return (
    <div className="Root">
      <div className="Left-Column">
        <SideNav
          version={version}
          isNewVersion={isNewVersion}
          turnNewVersionOff={turnNewVersionOff}
        />
      </div>
      <div className="Right-Column">
        <Outlet />
      </div>
    </div>
  );
}

export default Root;
