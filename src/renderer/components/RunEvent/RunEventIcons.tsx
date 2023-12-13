import React from 'react';
import { Tooltip } from '@mui/material';
import MavenIcon from '../../assets/img/encountericons/maven.png';
import BlightIcon from '../../assets/img/encountericons/blight.png';
import BlightedMapIcon from '../../assets/img/encountericons/blightedmap.png';
import DeliriumIcon from '../../assets/img/encountericons/delirium.png';
import BaranIcon from '../../assets/img/encountericons/baran.png';
import AlHezminIcon from '../../assets/img/encountericons/al-hezmin.png';
import VeritaniaIcon from '../../assets/img/encountericons/veritania.png';
import DroxIcon from '../../assets/img/encountericons/drox.png';
import EradicatorIcon from '../../assets/img/encountericons/eradicator.png';
import ConstrictorIcon from '../../assets/img/encountericons/constrictor.png';
import PurifierIcon from '../../assets/img/encountericons/purifier.png';
import EnslaverIcon from '../../assets/img/encountericons/enslaver.png';
import MetamorphIcon from '../../assets/img/encountericons/metamorph.png';
import JunIcon from '../../assets/img/encountericons/jun.png';
import ShrineIcon from '../../assets/img/encountericons/shrine.png';
// import BaranIcon from , the Crusader'
// 'Al-Hezmin, the Hunter'
// 'Veritania, the Redeemer'
// 'Drox, the Warlord'

const ConquerorsMap = {
  'Baran, the Crusader': BaranIcon,
  'Al-Hezmin, the Hunter': AlHezminIcon,
  'Veritania, the Redeemer': VeritaniaIcon,
  'Drox, the Warlord': DroxIcon,
};

const ElderGuardiansMap = {
  'The Eradicator': EradicatorIcon,
  'The Constrictor': ConstrictorIcon,
  'The Purifier': PurifierIcon,
  'The Enslaver': EnslaverIcon,
};

// React component that displays the icons for the run events
const iconMap = {
  blight: (info) => {
    return {
      condition: !!info.blightEncounter,
      icon: BlightIcon,
      alt: 'Contained a Blight Encounter',
    };
  },
  blightedMap: (info) => {
    return {
      condition: !!info.blightedMap,
      icon: BlightedMapIcon,
      alt: 'Blighted Map',
    };
  },
  delirium: (info) => {
    return {
      condition: !!info.strangeVoiceEncountered,
      icon: DeliriumIcon,
      alt: 'Contained a Delirium Encounter',
    };
  },
  envoy: (info) => {
    return {
      condition: !!info.envoy,
      icon: MavenIcon,
      alt: 'Contained an Envoy Encounter',
    };
  },
  conquerors: (info) => {
    const guardianKey = info.conquerors;
    return {
      condition: !!info.conquerors,
      icon: ConquerorsMap[guardianKey],
      alt: `Contained a ${guardianKey} Encounter`,
    };
  },
  elderGuardian: (info) => {
    const guardianKey = info.elderGuardian;
    return {
      condition: !!info.elderGuardian,
      icon: ElderGuardiansMap[guardianKey],
      alt: `Contained a ${guardianKey?.replace('The ', '')} Encounter`,
    };
  },
  conqueror: (info) => {
    return {
      condition: !!info.conqueror,
      icon: MavenIcon,
      alt: 'Contained a Conqueror Encounter',
    };
  },
  maven: (info) => {
    return {
      condition:
        info.maven &&
        info.name !== "The Maven's Crucible" &&
        info.name !== 'Absence of Mercy and Empathy',
      icon: MavenIcon,
      alt: 'Boss Battle witnessed by the Maven',
    };
  },
  metamorph: (info) => {
    return {
      condition: !!info.metamorph,
      icon: MetamorphIcon,
      alt: 'Contained a Metamorph Encounter',
      additionalIcons: info.metamorph
        ? Object.keys(info?.metamorph).map((organ) => {
            const Icon = require(`../../assets/img/metamorphicons/${organ}.png`);
            return (
              <Tooltip title={`${organ} x ${info.metamorph[organ]}`}>
                <img className="Run-Event__Mini-Icon" src={Icon} alt={organ} />
              </Tooltip>
            );
          })
        : null,
    };
  },
  syndicate: (info) => {
    const tooltipText = info.syndicate ? (
      <>
        <div>Encountered {Object.keys(info?.syndicate).length} Syndicate Members</div>
        <ul className="Tooltip-List">
          {Object.keys(info?.syndicate).map((syndicateMember) => (
            <li>{syndicateMember}</li>
          ))}
        </ul>
      </>
    ) : null;
    return {
      condition: !!info.syndicate,
      icon: JunIcon,
      alt: 'Contained a Syndicate Encounter',
      tooltip: tooltipText,
    };
  },
  shrines: (info) => {
    return {
      condition: !!info.shrines,
      icon: ShrineIcon,
      alt: `Contained ${info?.shrines?.length} Shrine${info?.shrines?.length > 1 ? 's' : ''}`,
      additionalIcons: info?.shrines?.map((shrine) => {
        if (shrine) {
          const Icon = require(`../../assets/img/shrineicons/${shrine.replace(' Shrine', '')}.png`);
          return (
            <Tooltip title={shrine}>
              <img className="Run-Event__Mini-Icon" src={Icon} alt={shrine} />
            </Tooltip>
          );
        } else {
          return null;
        }
      }),
    };
  },
};

const RunEventIcons = ({ info }) => {
  const icons: JSX.Element[] = [];
  for (const index in iconMap) {
    const icon = iconMap[index](info);
    if (icon.condition) {
      icons.push(
        <div className="Run-Event__Icon" key={`event-icon-${index}`}>
          <Tooltip title={icon.tooltip ?? icon.alt}>
            <img className="Run-Event__Main-Icon" src={icon.icon} alt={icon.alt} />
          </Tooltip>
          {icon.additionalIcons ?? null}
        </div>
      );
    }
  }

  return <div className="Run-Event__Icons">{icons}</div>;
};

export default RunEventIcons;
