import React from 'react';
import './MainStats.css';
import KillIcon from '../../../assets/img/encountericons/kills.png';
import DeathIcon from '../../../assets/img/encountericons/deaths.png';
import KillDeathIcon from '../../../assets/img/encountericons/kd.png';
import MavenIcon from '../../../assets/img/encountericons/maven.png';
import AbyssalDepthIcon from '../../../assets/img/encountericons/abyss.png';
import VaalSideAreaIcon from '../../../assets/img/encountericons/vaalsidearea.png';
import ShrinesIcon from '../../../assets/img/encountericons/shrine.png';
import EnvoyEncounterIcon from '../../../assets/img/encountericons/envoy.png';
import EnvoyWordsIcon from '../../../assets/img/encountericons/words.png';
import BlightIcon from '../../../assets/img/encountericons/blight.png';
import BlightedMapIcon from '../../../assets/img/encountericons/blightedmap.png';
// import UnrighteousIcon from '../../../assets/img/encountericons/cassia.png'; // This is not used anymore while we figure out why it was there
import DeliriumMirrorIcon from '../../../assets/img/encountericons/delirium.png';
import MetamorphIcon from '../../../assets/img/encountericons/metamorph.png';
import LegionIcon from '../../../assets/img/encountericons/legion.png';
import AlvaIcon from '../../../assets/img/encountericons/alva.png';
import EinharIcon from '../../../assets/img/encountericons/einhar.png';
import RedBeastIcon from '../../../assets/img/redBeast.png';
import YellowBeastIcon from '../../../assets/img/yellowBeast.png';
import NikoIcon from '../../../assets/img/encountericons/niko.png';
import JunIcon from '../../../assets/img/encountericons/jun.png';
import ChaosIcon from '../../Pricing/ChaosIcon';
import DivineIcon from '../../Pricing/DivineIcon';

import { Table, TableBody, TableCell, TableHead, TableRow } from '@mui/material';
import Price from '../../Pricing/Price';
const MainStats = ({ stats }) => {
  return (
    <div className="Main-Stats">
      <h2 className="Main-Stats__Header">Main Stats</h2>
      <div className="Main-Stats__Container Main-Stats--Two-Columns">
        <div className="Main-Stats__Column Main-Stats__Left-Column">
          <div className="Main-Stat">
            <div className="Main-Stat__Text">
              <ChaosIcon />
              Value of drops:{' '}
              <span className="Main-Stat__Value">
                <Price value={stats.misc.valueOfDrops.toFixed(2)} divinePrice={stats.divinePrice} />
              </span>
            </div>
          </div>
          <div className="Main-Stat">
            <div className="Main-Stat__Text">
              <DivineIcon />
              Raw divine drops:{' '}
              <span className="Main-Stat__Value">{stats.misc.rawDivineDrops}</span>
            </div>
          </div>
          <br />
          <div className="Main-Stat">
            <div className="Main-Stat__Text">
              <img src={KillIcon} alt="Kills Icon" className="Main-Stat__Icon" />
              Monsters slain:{' '}
              <span className="Main-Stat__Value">{stats.misc.kills.toLocaleString('en-US')}</span>
            </div>
          </div>
          <div className="Main-Stat">
            <div className="Main-Stat__Text">
              <img src={DeathIcon} alt="Deaths Icon" className="Main-Stat__Icon" />
              Deaths: <span className="Main-Stat__Value">{stats.misc.deaths}</span>
            </div>
          </div>
          <div className="Main-Stat">
            <div className="Main-Stat__Text">
              <img src={KillDeathIcon} alt="K/D Ratio Icon" className="Main-Stat__Icon" />
              K/D Ratio:{' '}
              <span className="Main-Stat__Value">
                {(stats.misc.kills / stats.misc.deaths).toLocaleString('en-US')}
              </span>
            </div>
          </div>
          <br />
          <div className="Main-Stat">
            <div className="Main-Stat__Text">
              <img src={MavenIcon} alt="Maven Icon" className="Main-Stat__Icon" />
              Maven Crucibles:{' '}
              <span className="Main-Stat__Value">{stats.misc.maven.crucible.started}</span> (
              <span className="Main-Stat__Value">{stats.misc.maven.crucible.completed}</span>{' '}
              completed)
            </div>
          </div>
          <br />
          <div className="Main-Stat">
            <div className="Main-Stat__Text">
              <img src={AbyssalDepthIcon} alt="Abyssal Depth Icon" className="Main-Stat__Icon" />
              Abyssal Depths entered:{' '}
              <span className="Main-Stat__Value">{stats.misc.abyssalDepths}</span>
            </div>
          </div>
          <div className="Main-Stat">
            <div className="Main-Stat__Text">
              <img src={VaalSideAreaIcon} alt="Vaal Side Area Icon" className="Main-Stat__Icon" />
              Vaal side areas entered:{' '}
              <span className="Main-Stat__Value">{stats.misc.vaalSideAreas}</span>
            </div>
          </div>
          <br />
          <div className="Main-Stat">
            <div className="Main-Stat__Text">
              <img src={ShrinesIcon} alt="Shrines Icon" className="Main-Stat__Icon" />
              Shrines activated:{' '}
              <span className="Main-Stat__Value">{stats.misc.shrines.total}</span>
            </div>
          </div>
          <div className="Main-Stat__Table-Container">
            <Table className="Main-Stat--List" size="small" padding="normal" sx={{ width: 'auto' }}>
              <TableHead>
                <TableRow>
                  <TableCell
                    align="center"
                    colSpan={3}
                    sx={{ backgroundColor: 'rgba(155,155,155,0.1)', borderRadius: '5px' }}
                    padding="none"
                  >
                    Shrine Types
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {Object.keys(stats.misc.shrines.types)
                  .sort((a, b) => stats.misc.shrines.types[b] - stats.misc.shrines.types[a])
                  .map((shrineType: string) => {
                    const Icon = require(`../../../assets/img/shrineicons/${shrineType.replace(
                      ' Shrine',
                      ''
                    )}.png`);
                    return (
                      <TableRow className="Main-Stat" key={shrineType}>
                        <TableCell sx={{ width: '1.5em' }} align="center">
                          <img
                            src={Icon}
                            alt={`${shrineType} Icon`}
                            className="Main-Stat__Table__Icon"
                          />
                        </TableCell>
                        <TableCell>{shrineType}</TableCell>
                        <TableCell align="center">
                          <span className="Main-Stat__Value">
                            {stats.misc.shrines.types[shrineType]}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          </div>
        </div>
        <div className="Main-Stats__Column Main-Stats__Right-Column">
          <div className="Main-Stat">
            <div className="Main-Stat__Text">
              <img
                src={EnvoyEncounterIcon}
                alt="Envoy Encounter Icon"
                className="Main-Stat__Icon"
              />
              Envoy encountered:{' '}
              <span className="Main-Stat__Value">{stats.misc.envoy.encounters}</span>
            </div>
          </div>
          <div className="Main-Stat">
            <div className="Main-Stat__Text">
              <img src={EnvoyWordsIcon} alt="Envoy Words Icon" className="Main-Stat__Icon" />
              Total words spoken: <span className="Main-Stat__Value">{stats.misc.envoy.words}</span>
            </div>
          </div>
          <br />
          <div className="Main-Stat">
            <div className="Main-Stat__Text">
              <img src={BlightIcon} alt="Blight Icon" className="Main-Stat__Icon" />
              Blight encounters:{' '}
              <span className="Main-Stat__Value">{stats.misc.blight.encounters}</span>
            </div>
          </div>
          <div className="Main-Stat">
            <div className="Main-Stat__Text">
              <img src={BlightIcon} alt="Blight Icon" className="Main-Stat__Icon" />
              Blight lanes:{' '}
              <span className="Main-Stat__Value">{stats.misc.blight.lanes.total}</span>
            </div>
          </div>
          <div className="Main-Stat">
            <div className="Main-Stat__Text">
              <img src={BlightedMapIcon} alt="Blighted Map Icon" className="Main-Stat__Icon" />
              Blighted Maps: <span className="Main-Stat__Value">{stats.misc.blight.maps}</span>
            </div>
          </div>
          {/* <div className="Main-Stat">
            <div className="Main-Stat__Text">
              <img src={UnrighteousIcon} alt="Unrighteous Icon" className="Main-Stat__Icon" />
              Unrighteous turned to ash:{' '}
              <span className="Main-Stat__Value">{stats.misc.unrighteousTurnedToAsh}</span>
            </div>
          </div> */}
          <br />
          <div className="Main-Stat">
            <div className="Main-Stat__Text">
              <img
                src={DeliriumMirrorIcon}
                alt="Delirium Mirror Icon"
                className="Main-Stat__Icon"
              />
              Delirium Mirrors:{' '}
              <span className="Main-Stat__Value">{stats.misc.simulacrum.encounters}</span>
            </div>
          </div>
          <br />
          <div className="Main-Stat">
            <div className="Main-Stat__Text">
              <img src={MetamorphIcon} alt="Metamorph Icon" className="Main-Stat__Icon" />
              Metamorphs Encountered:{' '}
              <span className="Main-Stat__Value">{stats.misc.metamorph.encountered}</span>
            </div>
          </div>
          {Object.keys(stats.misc.metamorph.organs).map((organ: string) => {
            const Icon = require(`../../../assets/img/metamorphicons/${organ.replace(
              ' ',
              ''
            )}.png`);
            return (
              <div className="Main-Stat" key={organ}>
                <div className="Main-Stat__Text">
                  <img src={Icon} alt={`${organ} Icon`} className="Main-Stat__Icon" />
                  {organ} Harvested:{' '}
                  <span className="Main-Stat__Value">{stats.misc.metamorph.organs[organ]}</span>
                </div>
              </div>
            );
          })}
          <br />
          <div className="Main-Stat">
            <div className="Main-Stat__Text">
              <img src={LegionIcon} alt="Legion Icon" className="Main-Stat__Icon" />
              Legion General Encounters:{' '}
              <span className="Main-Stat__Value">{stats.misc.legion.generals.encounters}</span> (
              <span className="Main-Stat__Value">{stats.misc.legion.generals.kills}</span> killed)
            </div>
          </div>
          {Object.keys(stats.misc.legionGenerals.generals).map((general: string) => {
            const LegionGeneralIcon = require(`../../../assets/img/legionicons/${general
              .replace(',', '')
              .split(' ')[0]
              .toLowerCase()}.png`);
            return (
              <div className="Main-Stat" key={general}>
                <div className="Main-Stat__Text">
                  <img
                    src={LegionGeneralIcon}
                    alt={`${general} Icon`}
                    className="Main-Stat__Icon"
                  />
                  {general}:{' '}
                  <span className="Main-Stat__Value">
                    {stats.misc.legionGenerals.generals[general].encounters}
                  </span>{' '}
                  (
                  <span className="Main-Stat__Value">
                    {stats.misc.legionGenerals.generals[general].kills}
                  </span>{' '}
                  killed)
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <h2 className="Main-Stats__Header">League Mechanics</h2>
      <div className="Main-Stats__Container Main-Stats--One-Column Main-Stats--Masters">
        <div className="Main-Stat__Section Main-Stat__Section--One-Column">
          <div className="Main-Stat__Section-Header Main-Stat__Header--alva">
            <img src={AlvaIcon} alt="Conqueror Icon" className="Main-Stat__Header__Icon" />
            Incursions
          </div>
          <div className="Main-Stat">
            <div className="Main-Stat__Text">
              Alva room cleared in maps:{' '}
              <span className="Main-Stat__Value">{stats.misc.incursion.unlocks.count}</span>
            </div>
          </div>
          <div className="Main-Stat">
            <div className="Main-Stat__Text">
              Time Spent in Incursion rooms in maps:{' '}
              <span className="Main-Stat__Value">{stats.misc.incursion.unlocks.time.total}</span>sec
              (max: <span className="Main-Stat__Value">{stats.misc.incursion.unlocks.time.max}</span>sec | min: <span className="Main-Stat__Value">{stats.misc.incursion.unlocks.time.min}</span>sec)
            </div>
          </div>
          <div className="Main-Stat">
            <div className="Main-Stat__Text">
              Temple Runs:{' '}
              <span className="Main-Stat__Value">{stats.misc.incursion.rooms.temples}</span> (
              T3 Rooms:{' '}<span className="Main-Stat__Value">
                {stats.misc.incursion.rooms.count}
              </span>
              )
            </div>
          </div>
        </div>
        <div className="Main-Stat__Section Main-Stat__Section--One-Column">
          <div className="Main-Stat__Section-Header Main-Stat__Header--einhar">
            <img src={EinharIcon} alt="Einhar Icon" className="Main-Stat__Header__Icon" />
            Bestiary
          </div>
          <div className="Main-Stat">
            <div className="Main-Stat__Text">
              Crafted Recipes:{' '}
              <span className="Main-Stat__Value">{stats.misc.bestiary.crafted.count}</span>
            </div>
          </div>
          <div className="Main-Stat">
            <div className="Main-Stat__Text">
              Time Spent Crafting:{' '}
              <span className="Main-Stat__Value">{stats.misc.bestiary.crafted.time.total}</span>sec
              (max: <span className="Main-Stat__Value">{stats.misc.bestiary.crafted.time.max}</span>sec | min: <span className="Main-Stat__Value">{stats.misc.bestiary.crafted.time.min}</span>sec)
            </div>
          </div>
          <div className="Main-Stat">
            <div className="Main-Stat__Text">
              Captured Beasts:
              <span className="Main-Stat__Value">{stats.misc.bestiary.captured.red + stats.misc.bestiary.captured.yellow}</span>
              <span className="Main-Stat__Value--Beasts">
                (
                <img
                  className="Main-Stat__Beast-Icon"
                  src={RedBeastIcon}
                  alt="Red Beast Icon"
                />x {stats.misc.bestiary.captured.red} |
                <img
                  className="Main-Stat__Beast-Icon"
                  src={YellowBeastIcon}
                  alt="Yellow Beast Icon"
                />
                x {stats.misc.bestiary.captured.yellow})
              </span>
            </div>
          </div>
        </div>
        <div className="Main-Stat__Section Main-Stat__Section--One-Column">
          <div className="Main-Stat__Section-Header Main-Stat__Header--niko">
            <img src={NikoIcon} alt="Niko Icon" className="Main-Stat__Header__Icon" />
            Delve
          </div>
          <div className="Main-Stat">
            <div className="Main-Stat__Text">
              Niko Encounters:{' '}
              <span className="Main-Stat__Value">{stats.misc.delve.niko}</span>
            </div>
          </div>
          <div className="Main-Stat">
            <div className="Main-Stat__Text">
              Sulphite Deposits Collected:{' '}
              <span className="Main-Stat__Value">{stats.misc.delve.sulphiteNodes}</span>
            </div>
          </div>
        </div>
        <div className="Main-Stat__Section Main-Stat__Section--Two-Columns">
          <div className="Main-Stat__Section-Header Main-Stat__Header--jun">
            <img src={JunIcon} alt="Jun Icon" className="Main-Stat__Header__Icon" />
            Betrayal
          </div>
          <div className="Main-Stat__Section__Column">
            <div className="Main-Stat">
              <div className="Main-Stat__Text">
                Encounters:{' '}
                <span className="Main-Stat__Value">{stats.misc.betrayal.junCounter}</span>
              </div>
            </div>
            <div className="Main-Stat">
              <div className="Main-Stat__Text">
                Mastermind Lairs:{' '}
                <span className="Main-Stat__Value">{stats.misc.betrayal.boss.started}</span>(
                <span className="Main-Stat__Value">{stats.misc.betrayal.boss.finished}</span>{' '}
                defeated)
              </div>
            </div>
            <div className="Main-Stat">
              <div className="Main-Stat__Text">
                Syndicate Member encountered:{' '}
                <span className="Main-Stat__Value">{stats.misc.betrayal.memberEncounters}</span>
              </div>
            </div>
          </div>
          <div className="Main-Stat__Section__Column">
            <Table size="small" padding="none">
              <TableHead>
                <TableRow sx={{ backgroundColor: 'rgba(155,155,155,0.1)', borderRadius: '5px' }}>
                  <TableCell>Syndicate Member</TableCell>
                  <TableCell align="center">Encounters</TableCell>
                  <TableCell align="center">Kills</TableCell>
                  <TableCell align="center">Kills as Leader</TableCell>
                  <TableCell align="center">Killed a player</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {Object.keys(stats.misc.betrayal.members)
                  .sort()
                  .map((name) => {
                    const member = stats.misc.betrayal.members[name];
                    return (
                      <TableRow key={name}>
                        <TableCell>{name}</TableCell>
                        <TableCell align="center">{member.encounters}</TableCell>
                        <TableCell align="center">{member.defeated}</TableCell>
                        <TableCell align="center">{member.defeatedAsLeader}</TableCell>
                        <TableCell align="center">{member.killedPlayers}</TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MainStats;
