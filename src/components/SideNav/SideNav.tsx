import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { electronService } from '../../electron.service';
import { Link } from 'react-router-dom';
import ExclamationMark from '../../assets/img/ExclamationMark.png';
import Logo from '../../assets/img/icons/png/128x128.png';
import Chaos from '../../assets/img/c.png';
import Patreon from '../../assets/img/patreon.png';
import './SideNav.css';

const SideNav = ({ version, isNewVersion, turnNewVersionOff }) => {
  const about = () => {
    turnNewVersionOff();
  };
  const openPatreon = () => {
    electronService.shell.openExternal("https://patreon.com/briansd9");
  };

  const menuData = [
    { name: 'Main', link: '/' },
    { name: 'Stash', link: 'stash' },
    { name: 'Search', link: 'search' },
    { name: 'Stats', link: 'stats' },
    { name: 'Settings', link: 'settings' },
    { name: 'Gear', link: 'gear' },
  ];

  return (
    <div className="Side-Nav">
      <div className="Header">
        <div className="Header__Logo">
          <img src={Logo} />
        </div>
        <div className="Header__Title">Exile Diary</div>
        <div className="Header__Version">{version}</div>
      </div>

      <hr className="Separator" />

      <div id="Side-Nav__Menu">
        {menuData.map((item) => (
          <div className="Side-Nav__Link" key={`Side-Nav-${item.name}`}>
            <Link to={item.link}>{item.name}</Link>
          </div>
        ))}
      </div>

      <hr className="Separator" />

      <div className="Side-Nav__Link Side-Nav__Link--About" onClick={about}>
        About
        <img
          className={classNames({
            'New-Version-Icon': true,
            'New-Version-Icon--hidden': !isNewVersion,
          })}
          src={ExclamationMark}
        />
      </div>

      <hr className="Separator" />

      <div className="Side-Nav__Link">
        <img onClick={openPatreon} className="Patreon-Button" src={Patreon} />
      </div>

      <div id="sideNetWorth" className="Net-Worth">
        <div>Net Worth</div>
        <div id="Net-Worth__Total">
          <span className="Net-Worth__Total__Text" id="sideNetWorthCValue"></span>
          <img className="Net-Worth__Total__Icon" src={Chaos} />
        </div>
        <div id="Net-Worth__Graph"></div>
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
