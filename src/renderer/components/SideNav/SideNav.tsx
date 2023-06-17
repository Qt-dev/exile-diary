import React, { useEffect } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import Divider from '@mui/material/Divider';
import { MenuList, MenuItem } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { electronService } from '../../electron.service';
import ExclamationMark from '../../assets/img/ExclamationMark.png';
import Logo from '../../assets/img/icons/png/128x128.png';
import Chaos from '../../assets/img/c.png';
import Patreon from '../../assets/img/patreon.png';
import './SideNav.css';
const { ipcRenderer, logger } = electronService;

const NetWorth = ({ value, change }) => {
  const changeClassNames = classNames({
    'Text--Error': change < 0,
    'Text--Legendary': change > 0,
  })
  const formattedChange = <span className={changeClassNames}>{change >= 0 ? '+' : ''}{change}</span>;
  return (<div className="Net-Worth">
    <div>Net Worth:</div>
    <div className="Net-Worth__Total__Text">{value}<img alt="Chaos Icon" className="Net-Worth__Total__Icon" src={Chaos} /> ({formattedChange})</div>
  </div>)
}

const SideNav = ({ version, isNewVersion, turnNewVersionOff }) => {
  const [ netWorth, setNetWorth ] = React.useState(<>---</>);
  const about = () => {
    turnNewVersionOff();
  };
  const openPatreon = () => {
    electronService.shell.openExternal('https://patreon.com/MrTinED');
  };

  const menuData = [
    { name: 'Main', link: '/' },
    // { name: 'Gear', link: 'gear' },
    { name: 'Stash', link: 'stash' },
    // { name: 'Search', link: 'search' },
    { name: 'Stats', link: 'stats' },
    { name: 'Settings', link: 'settings' },
  ];

  useEffect(() => {
    ipcRenderer.on('update-net-worth', (event, { value, change }) => {
      setNetWorth(<NetWorth value={value} change={change} />);
    });
    ipcRenderer.send('get-net-worth');
  }, []);

  return (
    <div className="Side-Nav Box">
      <div className="Header">
        <div className="Header__Logo">
          <img src={Logo} alt="Exile Diary Logo" />
        </div>
        <div className="Header__Title">
          Exile Diary <span className="Text--Legendary">Reborn</span>
        </div>
        <div className="Header__Version">{version}</div>
      </div>

      <Divider className="Separator" />

      <MenuList id="Side-Nav__Menu" dense>
        {menuData.map((item) => (
          <MenuItem
            className="Side-Nav__Link"
            key={`Side-Nav-${item.name}`}
            component={RouterLink}
            to={item.link}
          >
            {item.name}
          </MenuItem>
        ))}

        {/* <Divider light className="Separator" /> */}

        {/* <MenuItem className="Side-Nav__Link Side-Nav__Link--About" onClick={about}>
          About
          <img
            alt="New Version Icon"
            className={classNames({
              'New-Version-Icon': true,
              'New-Version-Icon--hidden': !isNewVersion,
            })}
            src={ExclamationMark}
          />
        </MenuItem> */}
      </MenuList>

      <Divider className="Separator" />

      <div className="Side-Nav__Link">
        <img alt="Patreon Button" onClick={openPatreon} className="Patreon-Button" src={Patreon} />
      </div>

      <Divider className="Separator" />

      <div className="Net-Worth__Container">
        {netWorth}
      </div>

      <div id="myModal" className="modal">
        <div id="modalContent" className="modal-content"></div>
      </div>
    </div>
  );
};

SideNav.propTypes = {
  version: PropTypes.string.isRequired,
};

export default SideNav;
