import React, { ReactNode } from 'react';
import dayjs from 'dayjs';
import constants from '../../../helpers/constants';
import ItemStore from '../../stores/itemStore';
import ItemList from '../ItemList/ItemList';
import Logger from 'electron-log/renderer';
import './RunEvent.css';


const ignoredEventTypes = [
  'master',
  'leagueNPC',
];

const formatLine = (event, text): ReactNode => {
  Logger.info('Formatting event line:', event);
  const time = dayjs(event.timestamp).format('HH:mm:ss');
  if(ignoredEventTypes.includes(event.event_type)) {
    return null;
  }

  return (
    <div className="Run__Event">
      <span className="Text--Legendary--2 Run__Event__Time">[{time}]</span> {text}
    </div>
  );
};

const textPerEventType = {
  entered: (event, runInfo, previousEvent) => {
    if (
      previousEvent &&
      previousEvent.event_type === 'entered' &&
      previousEvent.event_text === event.event_text
    ) {
      return false;
    }
    return (
      <>
        Entered <span className="Text--Rare">{event.event_text}</span>
      </>
    );
  },
  leagueNPC: (event, runInfo) => {
    if (
      event.event_text.startsWith('The Maven') &&
      constants.mavenQuotes[event.event_text.replace('The Maven: ', '')] === 'bossKilled' &&
      runInfo.bossBattle
    ) {
      const duration = dayjs
        .utc(dayjs.duration(Number(runInfo.bossBattle.time), 'seconds').asMilliseconds())
        .format('mm:ss');
      return (
        <>
          Maven witnessed boss kill in <span className="Text--Rare">{duration}</span>
        </>
      );
    } else if (
      event.event_text.startsWith('Sister Cassia') &&
      constants.blightStartQuote.includes(event.event_text.replace('Sister Cassia: ', ''))
    ) {
      return <>Blight encounter started</>;
    } else {
      return false;
    }
  },
  slain: () => {
    return <>You were slain</>;
  },
  loot: (event) => {
    const lootData = JSON.parse(event.event_text).map((loot) => JSON.parse(loot));
    Logger.info('Loot data:', lootData);
    return (
      <>
        <span>Picked Up:</span>
        <ItemList store={new ItemStore(lootData)} />
      </>
    );
  },
  generatedArea: (event) => {
    const areaData = JSON.parse(event.event_text);
    return (
      <>
        Game generated the area <span className="Text--Rare">{areaData.areaName} (lvl {areaData.level})</span> with seed <span className="Text--Magic">{areaData.seed}</span>
      </>
    );
  },
  shrine: (event) => {
    // const shrineData = JSON.parse(event.event_text);
    const shrineName = constants.shrineQuotes[event.event_text];
    return (
      <>
        Activated <span className="Text--Rare">{shrineName}</span>
      </>
    );
  },
};

const generateNode = (event, runInfo, previousEvent): ReactNode => {
  const type = event.event_type;
  const isImportant =
    textPerEventType[type] && textPerEventType[type](event, runInfo, previousEvent);

  return isImportant
    ? formatLine(event, textPerEventType[type](event, runInfo, previousEvent))
    : formatLine(event, `Unknown event type: ${event.event_type}`);
};

const RunEvent = ({ event, runInfo, previousEvent }) => {
  return (
    <>
      {generateNode(event, runInfo, previousEvent)}
      {/* {JSON.stringify(event)} */}
    </>
  );
};

export default RunEvent;
