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
import EinharIcon from '../../assets/img/encountericons/einhar.png';
import AlvaIcon from '../../assets/img/encountericons/alva.png';
import IncursionRoom from '../../assets/img/encountericons/incursionRoom.png';
import KillsIcon from '../../assets/img/encountericons/kills.png';
import LegionIcon from '../../assets/img/encountericons/legion.png';
import SimulacrumIcon from '../../assets/img/encountericons/simulacrum.png';
import RedBeastIcon from '../../assets/img/redBeast.png';
import YellowBeastIcon from '../../assets/img/yellowBeast.png';
import WhiteBeastIcon from '../../assets/img/whiteBeast.png';
import SynthesisIcon from '../../assets/img/encountericons/rewritten.png';
import OshabiIcon from '../../assets/img/encountericons/oshabi.png';
import CatarinaIcon from '../../assets/img/encountericons/mastermind.png';
import ShaperIcon from '../../assets/img/encountericons/shaper.png';
import SirusIcon from '../../assets/img/encountericons/sirus.png';
import Case from 'case';
import dayjs from 'dayjs';
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
  betrayal: (info) => {
    const tooltipText = info.betrayal?.fights ? (
      <>
        <div>Encountered {Object.keys(info?.betrayal?.fights).length} Betrayal Members</div>
        <ul className="Tooltip-List">
          {info?.betrayal?.fights.map((fight) => (
            <li>{fight.npc} - {Case.capital(fight.action)}</li>
          ))}
        </ul>
      </>
    ) : null;
    return {
      condition: !!info.betrayal?.fights,
      icon: JunIcon,
      alt: 'Contained a Betrayal Encounter',
      tooltip: tooltipText,
    };
  },
  betrayalBoss: (info) => {
    return {
      condition: !!info.betrayal?.bossFights,
      icon: CatarinaIcon,
      alt: `Contained a Betrayal Boss Fight.\nFight lasted ${dayjs(info.betrayal?.bossFights[0].started).diff(dayjs(info.betrayal?.bossFights[info.betrayal?.bossFights.length - 1]?.finished), 'seconds')} seconds`,
      additionalIcons: info?.betrayal?.bossFights?.map((fight) => {
        return (
          <Tooltip title={`Defeated ${fight.bossName} in ${dayjs(info.betrayal?.bossFights[0].started).diff(dayjs(info.betrayal?.bossFights[info.betrayal?.bossFights.length - 1]?.finished), 'seconds')} seconds`}>
            <img className="Run-Event__Mini-Icon" src={CatarinaIcon} alt={fight.bossName} />
          </Tooltip>
        );
      }),
    };
  },
  blight: (info) => {
    return {
      condition: !!info.blight?.events,
      icon: BlightIcon,
      alt: `Contained a Blight Encounter with at least ${info.blight?.events ? info.blight.events.filter((event) => event.type === 'newLane').length + 1 : 1} lanes`,
    };
  },
  blightedMap: (info) => {
    return {
      condition: !!info.blightedMap,
      icon: BlightedMapIcon,
      alt: 'Blighted Map',
    };
  },
  capturedBeasts: (info) => {
    return {
      condition: !!info.beasts?.captured,
      icon: EinharIcon,
      alt: `Contained ${info?.beasts?.captured?.yellow + info?.beasts?.captured?.red} Beasts Encounter`,
      additionalIcons: info?.beasts?.captured ? Object.keys(info?.beasts?.captured).sort(() => -1).map((beastType) => {
        const icon = <img className="Run-Event__Mini-Icon" src={beastType === 'yellow' ? YellowBeastIcon : RedBeastIcon} alt={beastType} />
        const iconArray = Array(info?.beasts?.captured[beastType]).fill(icon);
        iconArray.unshift(<span className="Run-Event__Mini-Label">({info?.beasts?.captured[beastType]}x)</span>);
        return iconArray;
      }).flat() : null
    };
  },
  conquerors: (info) => {
    return {
      condition: !!info.conquerors?.bossFights,
      icon: KillsIcon,
      alt: `Contained ${info.conquerors?.bossFights.length} Conquerors Encounter(s)`,
      additionalIcons: info.conquerors?.bossFights.map((fight) => {
        const Icon = ConquerorsMap[fight.bossName];
        return (
          <Tooltip title={`Defeated ${fight.bossName} in ${dayjs(fight.finished).diff(dayjs(fight.started), 'seconds')} seconds`}>
            <img className="Run-Event__Mini-Icon" src={Icon} alt={fight.bossName} />
          </Tooltip>
        );
      }),
    };
  },
  craftedBeasts: (info) => {
    return {
      condition: !!info.beasts?.crafted,
      icon: EinharIcon,
      alt: `Crafted ${info?.beasts?.crafted?.length} Beasts Recipe(s)`,
      additionalIcons: info?.beasts?.crafted?.map((crafted) => {
        const icon = (
          <Tooltip title={`Crafted in ${dayjs(crafted.finished).diff(dayjs(crafted.started), 'seconds')} seconds`}>
            <img className="Run-Event__Mini-Icon" src={WhiteBeastIcon} alt="Beast Recipe Crafted" />
          </Tooltip>
        );
        return icon;
      })
    };
  },
  delirium: (info) => {
    return {
      condition: !!info.strangeVoiceEncountered,
      icon: DeliriumIcon,
      alt: 'Contained a Delirium Encounter',
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
  envoy: (info) => {
    return {
      condition: !!info.envoy,
      icon: MavenIcon,
      alt: 'Contained an Envoy Encounter',
    };
  },
  harvest: (info) => {
    return {
      condition: !!info.harvest?.bossFights,
      icon: OshabiIcon,
      alt: 'Encountered a Harvest Boss',
    }
  },
  incursionTemple: (info) => {
    return {
      condition: !!info.incursion?.rooms,
      icon: AlvaIcon,
      alt: `Entered an Incursion Temple`,
      additionalIcons: info?.incursion?.rooms?.map((room) => {
        const icon = (
          <Tooltip title={`Entered ${room.roomName} at ${dayjs(room.timestamp).format('HH:mm:ss')}`}>
            <img className="Run-Event__Mini-Icon" src={room.roomId ? IncursionRoom : KillsIcon} alt="Incursion Temple" />
          </Tooltip>
        );
        return icon;
      })
    };
  },
  incursionUnlocks: (info) => {
    return {
      condition: !!info.incursion?.unlocked,
      icon: AlvaIcon,
      alt: `Unlocked ${info?.incursion?.unlocked?.length} Incursion Room${info?.incursion?.unlocked?.length > 1 ? 's' : ''}`,
      additionalIcons: info?.incursion?.unlocked?.map((unlock) => {
        const icon = (
          <Tooltip title={`Unlocked in ${dayjs(unlock.finished).diff(dayjs(unlock.started), 'seconds')} seconds`}>
            <img className="Run-Event__Mini-Icon" src={AlvaIcon} alt="Incursion Room Unlocked" />
          </Tooltip>
        );
        return icon;
      })
    };
  },
  legionBosses: (info) => {
    return {
      condition: !!info.legion?.bossFights,
      icon: LegionIcon,
      alt: `Killed ${info?.legion?.bossFights?.length} Legion Boss${info?.legion?.bossFights?.length > 1 ? 'es' : ''}`,
      additionalIcons: info?.legion?.bossFights?.map((fight) => {
        const icon = (
          <Tooltip title={`Killed ${fight.bossName} at ${dayjs(fight.finished).format('HH:mm:ss')}`}>
            <img className="Run-Event__Mini-Icon" src={LegionIcon} alt="Legion Boss Killed" />
          </Tooltip>
        );
        return icon;
      })
    };
  },
  maven: (info) => {
    return {
      condition:
        info.maven?.witnesses &&
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
  shaper: (info) => {
    return {
      condition: !!info.shaper?.bossFights,
      icon: ShaperIcon,
      alt: `Encountered the Shaper`,
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
  simulacrum: (info) => {
    return {
      condition: !!info.delirium?.simulacrum,
      icon: SimulacrumIcon,
      alt: `Entered Delirium Simulacrum`,
      additionalIcons: 
        info?.delirium?.simulacrum?.waves?.map((wave) => {
        const actionText = wave.wave === 'end' ? 'Completed Simulacrum' : `Started Wave ${wave.wave}`;
        const icon = (
          <Tooltip title={`${actionText} at ${dayjs(wave.started).format('HH:mm:ss')}`}>
            <img className="Run-Event__Mini-Icon" src={DeliriumIcon} alt="Delirium Simulacrum Wave" />
          </Tooltip>
        );
        return icon;
      })
    };
  },
  sirus: (info) => {
    return {
      condition: !!info.sirus?.bossFights,
      icon: SirusIcon,
      alt: `Encountered Sirus`,
    };
  },
  synthesis: (info) => {
    return {
      condition: !!info.synthesis?.bossFights,
      icon: SynthesisIcon,
      alt: `Encountered a Synthesis Boss`,
    };
  }
};

const RunEventIcons = ({ info }) => {
  const icons: JSX.Element[] = [];
  for (const index in iconMap) {
    const icon = iconMap[index](info);
    if (icon.condition) {
      icons.push(
        <div className="Run-Event__Icon" key={`event-icon-${index}`}>
          <Tooltip title={icon.tooltip ?? icon.alt}>
            <div className="Run-Event__Main-Icon">
              <img className="" src={icon.icon} alt={icon.alt} />
            </div>
          </Tooltip>
          {icon.additionalIcons ?? null}
        </div>
      );
    }
  }

  return <div className="Run-Event__Icons">{icons}</div>;
};

export default RunEventIcons;
