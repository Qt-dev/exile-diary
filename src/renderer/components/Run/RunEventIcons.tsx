import React from 'react';
import MavenIcon from '../../assets/img/encountericons/maven.png';
import BlightIcon from '../../assets/img/encountericons/blight.png';
import BlightedMapIcon from '../../assets/img/encountericons/blightedmap.png';
import DeliriumIcon from '../../assets/img/encountericons/delirium.png';
import BaranIcon from '../../assets/img/encountericons/crusader.png';
import AlHezminIcon from '../../assets/img/encountericons/hunter.png';
import VeritaniaIcon from '../../assets/img/encountericons/redeemer.png';
import DroxIcon from '../../assets/img/encountericons/warlord.png';
// import BaranIcon from , the Crusader'
// 'Al-Hezmin, the Hunter'
// 'Veritania, the Redeemer'
// 'Drox, the Warlord'

import { Tooltip } from '@mui/material';

const ElderGuardianMap = {
  'Baran, the Crusader': BaranIcon,
  'Al-Hezmin, the Hunter': AlHezminIcon,
  'Veritania, the Redeemer': VeritaniaIcon,
  'Drox, the Warlord': DroxIcon,
};

// React component that displays the icons for the run events
const iconMap = {
  blight : (info) => {
    return {
      condition: !!info.blightEncounter,
      icon: BlightIcon,
      alt: 'Contained a Blight Encounter'
    }
  },
  blightedMap: (info) => {
    return {
      condition: !!info.blightedMap,
      icon: BlightedMapIcon,
      alt: 'Blighted Map'
    }
  },
  delirium: (info) => {
    return {
      condition: !!info.strangeVoiceEncountered,
      icon: DeliriumIcon,
      alt: 'Contained a Delirium Encounter'
    }
  },
  envoy: (info) => {
    return {
      condition: !!info.envoy,
      icon: MavenIcon,
      alt: 'Contained an Envoy Encounter'
    }
  },
  elderGuardian: (info) => {
    const guardianKey = info.elderGuardian?.replace("The ", "");
    return {
      condition: !!info.elderGuardian,
      icon: ElderGuardianMap[guardianKey],
      alt: `Contained a ${guardianKey} Encounter`
    }
  },
  maven : (info) => {
    return {
      condition: (info.maven && info.name !== "The Maven's Crucible" && info.name !== "Absence of Mercy and Empathy"),
      icon: MavenIcon,
      alt: 'Boss Battle witnessed by the Maven'
    }
  },
};

/*
        if(info.strangeVoiceEncountered) {
          $("#masterDiv").show();
          $("#DeliriumIcon").show();
        }
        if(info.blightEncounter) {
          $("#masterDiv").show();
          $("#BlightIcon").show();
        } else if(info.blightedMap) {
          $("#masterDiv").show();
          $("#BlightedMapIcon").show();
        }
        if(info.metamorph) {
          $("#masterDiv").show();
          $("#MetamorphIcon").show();
        }
        if(info.maven && info.name !== "The Maven's Crucible" && info.name !== "Absence of Mercy and Empathy") {
          $("#masterDiv").show();
          $("#MavenIcon").show();
        }
        if(info.envoy) {
          $("#masterDiv").show();
          $("#EnvoyIcon").show();
        }
        if(info.oshabiBattle) {
          $("#masterDiv").show();
          $("#OshabiIcon").show();
        }
        if(info.elderGuardian) {
          $("#masterDiv").show();
          $(`#${info.elderGuardian.replace("The ", "")}Icon`).show();
        }
        if(info.ultimatum) {
          $("#masterDiv").show();
          $("#UltimatumIcon").show();
        }

        
          <div class='encounterIcon' id='CrusaderIcon' title='Baran, the Crusader'>
            <div style='position:relative;display:inline;'>
              <img src='res/img/encountericons/crusader.png'/>
            </div>
          </div>
          <div class='encounterIcon' id='HunterIcon' title='Al-Hezmin, the Hunter'>
            <div style='position:relative;display:inline;'>
              <img src='res/img/encountericons/hunter.png'/>
            </div>
          </div>
          <div class='encounterIcon' id='RedeemerIcon' title='Veritania, the Redeemer'>
            <div style='position:relative;display:inline;'>
              <img src='res/img/encountericons/redeemer.png'/>
            </div>
          </div>
          <div class='encounterIcon' id='WarlordIcon' title='Drox, the Warlord'>
            <div style='position:relative;display:inline;'>
              <img src='res/img/encountericons/warlord.png'/>
            </div>
          </div>

*/

const RunEventIcons = ({ info }) => {
  const icons : JSX.Element[] = [];

  for(const index in iconMap) {
    const test = iconMap[index](info);
    if(test.condition) {
      icons.push(
      <div className="Run__Event-Icon" key={`event-icon-${index}`}>
        <Tooltip title={test.alt}>
          <img src={test.icon} alt={test.alt} />
        </Tooltip>
      </div>
      )
    }
  }


  return (
    <div className="Run__Event-Icons">
      {icons}
    </div>
  );
};

export default RunEventIcons;