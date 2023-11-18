import React, { useEffect } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import Divider from '@mui/material/Divider';
import { MenuList, MenuItem } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { electronService } from '../../electron.service';
import Logo from '../../assets/img/icons/png/128x128.png';
import Patreon from '../../assets/img/patreon.png';
import './SideNav.css';
import Price from '../Pricing/Price';
const { ipcRenderer } = electronService;

const ProfitPerHour = ({ hourly, daily, divinePrice }) => {
  return (
    <div className="Profit-Per-Hour">
      <div className="Profit-Per-Hour__Header">Profit per hr</div>

      <div className="Text--small">On last 24h</div>
      <div className="Profit-Per-Hour__Total__Text">
        <Price value={daily} divinePrice={divinePrice} />
      </div>

      <div className="Text--small">On last 1h</div>
      <div className="Profit-Per-Hour__Total__Text">
        <Price value={hourly} divinePrice={divinePrice} />
      </div>
    </div>
  );
};

const NetWorth = ({ value, change, divinePrice }) => {
  const changeClassNames = classNames({
    'Text--Error': change < 0,
    'Text--Legendary': change > 0,
    'Net-Worth__Change': true,
  });
  const formattedChange = (
    <span className={changeClassNames}>
      {change >= 0 ? '+' : ''}
      <Price value={change.toFixed(2)} divinePrice={divinePrice} />
    </span>
  );
  return (
    <div className="Net-Worth">
      <div>Net Worth:</div>
      <div className="Net-Worth__Total__Text">
        <Price value={value} divinePrice={divinePrice} displayChaos={false} />
      </div>
      <div>{formattedChange}</div>
    </div>
  );
};

const SideNav = ({ version, isNewVersion, turnNewVersionOff }) => {
  const [netWorth, setNetWorth] = React.useState(<>---</>);
  const [profitPerHour, setProfitPerHour] = React.useState(
    <ProfitPerHour daily={0} hourly={0} divinePrice={0} />
  );
  const [currentPageName, setCurrentPageName] = React.useState('Main');
  // This is to setup an about page if needed
  // const about = () => {
  //   turnNewVersionOff();
  // };
  const openPatreon = () => {
    electronService.shell.openExternal('https://patreon.com/MrTinED');
  };

  const menuData = [
    { name: 'Main', link: '/' },
    // { name: 'Gear', link: 'gear' },
    { name: 'Stash', link: 'stash' },
    { name: 'Search', link: 'search' },
    { name: 'Stats', link: 'stats' },
    { name: 'Settings', link: 'settings' },
  ];

  useEffect(() => {
    ipcRenderer.on('update-net-worth', (event, { value, change, divinePrice }) => {
      setNetWorth(<NetWorth value={value} change={change} divinePrice={divinePrice} />);
    });
    ipcRenderer.on('update-profit-per-hour', (event, { profitPerHour, divinePrice }) => {
      setProfitPerHour(
        <ProfitPerHour
          hourly={profitPerHour.hourly}
          daily={profitPerHour.daily}
          divinePrice={divinePrice}
        />
      );
    });
    ipcRenderer.invoke('refresh-profit-per-hour');
    ipcRenderer.send('get-net-worth');
    return () => {
      ipcRenderer.removeAllListeners('update-net-worth');
    };
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
            onClick={() => setCurrentPageName(item.name)}
            to={item.link}
            selected={currentPageName === item.name}
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

      <div className="Profit-Per-Hour__Container">{profitPerHour}</div>
      <div className="Net-Worth__Container">{netWorth}</div>

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
