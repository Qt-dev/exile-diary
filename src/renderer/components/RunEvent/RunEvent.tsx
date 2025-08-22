import React, { ReactNode } from 'react';
import dayjs from 'dayjs';
import constants from '../../../helpers/constants';
import ItemStore from '../../stores/itemStore';
import ItemList from '../ItemList/ItemList';
import Logger from 'electron-log/renderer';
import './RunEvent.css';

const ignoredEventTypes = ['master', 'leagueNPC'];

const formatLine = (event, text): ReactNode => {
  Logger.info('Formatting event line:', event);
  const time = dayjs(event.timestamp).format('HH:mm:ss');
  if (ignoredEventTypes.includes(event.event_type)) {
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
        Game generated the area{' '}
        <span className="Text--Rare">
          {areaData.areaName} (lvl {areaData.level})
        </span>{' '}
        with seed <span className="Text--Magic">{areaData.seed}</span>
      </>
    );
  },
  // New events
  Shrines: (event) => {
    const eventData = JSON.parse(event.event_text);
    return (
      <>
        Activated <span className="Text--Rare">{eventData.arguments.name}</span> ({eventData.text})
      </>
    )
  },
  Beasts: (event) => {
    const eventData = JSON.parse(event.event_text);
    if (eventData.type === 'Capture') {
      return (
        <>
          Captured a <span className={eventData.arguments.beastType === 'yellow' ? 'Text--Rare' : 'Text--Error'}>{eventData.arguments.beastType}</span> beast.
        </>
      );
    } else if (eventData.type === 'Craft') {
      if (eventData.arguments.action === 'defeated') {
        return (
          <>
            Completed a beast recipe.
          </>
        );
      } else {
        return (
          <>
            Started a beast recipe.
          </>
        );
      }
    }
  },
  Incursion: (event) => {
    const eventData = JSON.parse(event.event_text);
    if(eventData.type === 'TempleRoom') {
      return (
        <>
          Entered a <span className="Text--Rare">{eventData.arguments.roomName}</span>{eventData.arguments.roomId ? <> (Room ID: <span className="Text--Magic">{eventData.arguments.roomId}</span>)</> : null}.
        </>
      );
    } else if (eventData.type === 'Unlock') {
      if(eventData.arguments.action === 'start') {
        return (
          <>
            Started unlocking an incursion Room.
          </>
        );
      } else {
        return (
          <>
            Unlocked an incursion Room.
          </>
        );
      }
    }
  },
  Elder: (event) => {
    const eventData = JSON.parse(event.event_text);
    return (
      <>
        Defeated <span className="Text--Rare">{eventData.npc}</span> in the Elder fight.
      </>
    );
  },
  Conquerors: (event) => {
    const eventData = JSON.parse(event.event_text);
    if(eventData.arguments.action === 'start') {
      return (
        <>
          Started a Conqueror fight against <span className="Text--Rare">{eventData.npc}</span>.
        </>
      )
    } else {
      return (
        <>
          Defeated <span className="Text--Rare">{eventData.npc}</span> in a Conqueror fight.
        </>
      );
    }
  },
  Legion: (event) => {
    const eventData = JSON.parse(event.event_text);
    return (
      <>
        Defeated <span className="Text--Rare">{eventData.npc}</span> in a fight against the legion.
      </>
    )
  },
  Betrayal: (event) => {
    const eventData = JSON.parse(event.event_text);
    if(eventData.type ==='Fight') {
      const action = eventData.arguments.action;
      switch(action) {
        case 'defeatedAsLeader':
          return (
            <>
              Started a Betrayal fight against <span className="Text--Rare">{eventData.arguments.target}</span>.
            </>
          );
        case 'defeated':
          return (
            <>
              Defeated <span className="Text--Rare">{eventData.arguments.target}</span> in a Betrayal fight.
            </>
          );
        case 'killedPlayer':
          return (
            <>
              <span className='Text--Rare'>{eventData.arguments.target}</span> killed you in a Betrayal fight.
            </>
          );
      }
    } else if (eventData.type === 'BossFight') {
      return (
        <>
          {eventData.arguments.action === 'start' ? 'Started' : 'Completed'} phase {eventData.arguments.phase} in a fight against <span className="Text--Rare">{eventData.arguments.target}</span>.
        </>
      );
    }
  },
  Delirium: (event) => {
    const eventData = JSON.parse(event.event_text);
    return (
      <>
        Started Delirium Wave <span className="Text--Rare">{eventData.arguments.wave}</span>.
      </>
    );
  },
  Blight: (event) => {
    const eventData = JSON.parse(event.event_text);
    if (eventData.arguments.action === 'start') {
      return (
        <>
          Started a Blight encounter.
        </>
      );
    } else if (eventData.arguments.action === 'newLane') {
      return (
        <>
          Blight encounter spawned a new lane.
        </>
      );
    }
  },
  Synthesis: (event) => {
    const eventData = JSON.parse(event.event_text);
    if(eventData.arguments.action === 'start') {
      return (
        <>
          Started a Synthesis fight against <span className="Text--Rare">{eventData.arguments.enemy}</span>.
        </>
      );
    } else {
      return (
        <>
          Defeated <span className="Text--Rare">{eventData.arguments.enemy}</span> in a Synthesis fight.
        </>
      );
    }
  },
  Harvest: (event) => {
    const eventData = JSON.parse(event.event_text);
    if(eventData.arguments.action === 'start') {
      return (
        <>
          Started a Harvest fight against <span className="Text--Rare">{eventData.npc}</span>.
        </>
      );
    } else {
      return (
        <>
          Defeated <span className="Text--Rare">{eventData.npc}</span> in a Harvest fight.
        </>
      );
    }
  },
  Shaper: (event) => {
    const eventData = JSON.parse(event.event_text);
    switch (eventData.arguments.action) {
      case 'entered':
      case 'started':
        return (
          <>
            Started a fight against <span className="Text--Rare">{eventData.arguments.enemy}</span> (Phase: {eventData.arguments.phase}).
          </>
        );
      case 'phaseStarted':
        return (
          <>
            Started phase {eventData.arguments.phase}.
          </>
        );
      case 'phaseEnded':
        return (
          <>
            Ended phase {eventData.arguments.phase}.
          </>
        );
      case 'defeated':
        return (
          <>
            Defeated <span className="Text--Rare">{eventData.arguments.enemy}</span>.
          </>
        );
    }
  },
  Sirus: (event) => {
    const eventData = JSON.parse(event.event_text);
    switch (eventData.arguments.action) {
      case 'started':
        return (
          <>
            Started phase {eventData.arguments.phase} against <span className="Text--Rare">{eventData.arguments.enemy}</span>.
          </>
        );
      case 'defeated':
        return (
          <>
            Defeated <span className="Text--Rare">{eventData.arguments.enemy}</span>.
          </>
        );
    }
  },
  Labyrinth: (event) => {
    const eventData = JSON.parse(event.event_text);
    if (eventData.arguments.action === 'start') {
      return (
        <>
          Started a Boss Fight against <span className="Text--Rare">{eventData.arguments.target}</span>.
        </>
      );
    } else {
      return (
        <>
          Defeated <span className="Text--Rare">{eventData.arguments.target}</span>.
        </>
      );
    }
  },
  Maven: (event) => {
    const eventData = JSON.parse(event.event_text);
    if(eventData.arguments.action === 'start') {
      return (
        <>
          Started a Maven fight against a map Boss.
        </>
      );
    } else {
      return (
        <>
          Maven witnessed the map Boss dying.
        </>
      );
    }
  }
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
