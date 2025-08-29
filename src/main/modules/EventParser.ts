import Constants from '../../helpers/constants';
import Logger from 'electron-log';

const logger = Logger.scope('EventParser');


const rules = {
  "Beasts": {
    "Capture": (run, event) => {
      const eventData = JSON.parse(event.event_text);
      run.beasts = run.beasts || {};
      run.beasts.captured = run.beasts.captured || { yellow: 0, red: 0 };
      run.beasts.captured[eventData.arguments.beastType]++;
    },
    "Craft": (run, event) => {
      const eventData = JSON.parse(event.event_text);
      run.beasts = run.beasts || {};
      run.beasts.crafted = run.beasts.crafted || [];
      if(eventData.arguments.action === 'start') {
        run.beasts.crafted.push({ started: event.timestamp });
      } else {
        run.beasts.crafted[run.beasts.crafted.length - 1].finished = event.timestamp;
      }
    }
  },
  "Betrayal": {
    "Fight": (run, event) => {
      const eventData = JSON.parse(event.event_text);
      run.betrayal = run.betrayal || {};
      run.betrayal.fights = run.betrayal.fights || [];
      run.betrayal.fights.push({ npc: eventData.arguments.target, action: eventData.arguments.action, timestamp: event.timestamp });
    },
    "BossFight": (run, event) => {
      const eventData = JSON.parse(event.event_text);
      run.betrayal = run.betrayal || {};
      run.betrayal.bossFights = run.betrayal.bossFights || [];
      run.betrayal.boss = eventData.npc;
      if(eventData.arguments.action === 'start') {
        run.betrayal.bossFights.push({ bossName: eventData.npc, started: event.timestamp, phase: eventData.arguments.phase });
      } else {
        run.betrayal.bossFights[run.betrayal.bossFights.length - 1].finished = event.timestamp;
      }
    }
  },
  "Blight": {
    "Event": (run, event) => {
      const eventData = JSON.parse(event.event_text);
      run.blight = run.blight || {};
      run.blight.events = run.blight.events || [];
      run.blight.events.push({ action: eventData.arguments.action, timestamp: event.timestamp });
    }
  },
  "Conquerors": {
    "BossFight": (run, event) => {
      const eventData = JSON.parse(event.event_text);
      run.conquerors = run.conquerors || {};
      run.conquerors.bossFights = run.conquerors.bossFights || [];
      run.conquerors.boss = eventData.npc;
      if(eventData.arguments.action === 'start') {
        run.conquerors.bossFights.push({ bossName: eventData.npc, started: event.timestamp, stones: eventData.arguments.stones });
      } else {
        run.conquerors.bossFights[run.conquerors.bossFights.length - 1].finished = event.timestamp;
      }
    }
  },
  "Delirium": {
    "Wave": (run, event) => {
      const eventData = JSON.parse(event.event_text);
      run.delirium = run.delirium || {};
      run.delirium.simulacrum = run.delirium.simulacrum || {};
      run.delirium.simulacrum.waves = run.delirium.simulacrum.waves || [];
      run.delirium.simulacrum.waves.push({ wave: eventData.arguments.wave, started: event.timestamp });
    }
  },
  "Elder": {
    "BossFight": (run, event) => {
      const eventData = JSON.parse(event.event_text);
      run.elder = run.elder || {};
      run.elder.bossFights = run.elder.bossFights || [];
      run.elder.boss = eventData.npc;
      run.elder.bossFights.push({ bossName: eventData.npc, finished: event.timestamp });
    }
  },
  "Harvest": {
    "BossFight": (run, event) => {
      const eventData = JSON.parse(event.event_text);
      run.harvest = run.harvest || {};
      run.harvest.bossFights = run.harvest.bossFights || [];
      run.harvest.boss = eventData.npc;
      if(eventData.arguments.action === 'start') {
        run.harvest.bossFights.push({ bossName: eventData.npc, started: event.timestamp });
      } else {
        run.harvest.bossFights[run.harvest.bossFights.length - 1].finished = event.timestamp;
      }
    }
  },
  "Incursion": {
    "Unlock" : (run, event) => {
      const eventData = JSON.parse(event.event_text);
      run.incursion = run.incursion || {};
      run.incursion.unlocked = run.incursion.unlocked || [];
      if(eventData.arguments.action === 'start') {
        run.incursion.unlocked.push({ started: event.timestamp });
      } else {
        run.incursion.unlocked[run.incursion.unlocked.length - 1].finished = event.timestamp;
      }
    },
    "TempleRoom": (run, event) => {
      const eventData = JSON.parse(event.event_text);
      run.incursion = run.incursion || {};
      run.incursion.rooms = run.incursion.rooms || [];
      run.incursion.rooms.push({ roomName: eventData.arguments.roomName, roomId: eventData.arguments.roomId, timestamp: event.timestamp });
    }
  },
  "Labyrinth": {
    "Run": (run, event) => {
      const eventData = JSON.parse(event.event_text);
      run.labyrinth = run.labyrinth || {};
      run.labyrinth.runs = run.labyrinth.runs || [];
      if(eventData.arguments.target === 'Argus') {
        run.labyrinth.argus = run.labyrinth.argus || {};
        run.labyrinth.argus.fights = run.labyrinth.argus.fights || [];
        run.labyrinth.argus.fights.push({ defeated: event.timestamp });
      } else if (eventData.arguments.action === 'start') {
        run.labyrinth.bossFights.push({ phase: eventData.arguments.phase, started: event.timestamp });
      } else {
        run.labyrinth.bossFights[run.labyrinth.bossFights.length - 1].finished = event.timestamp;
      }
    }
  },

  "Legion": {
    "BossFight": (run, event) => {
      const eventData = JSON.parse(event.event_text);
      run.legion = run.legion || {};
      run.legion.bossFights = run.legion.bossFights || [];
      run.legion.boss = eventData.npc;
      run.legion.bossFights.push({ bossName: eventData.npc, finished: event.timestamp });
    }
  },
  "Maven": {
    "Witness": (run, event) => {
      const eventData = JSON.parse(event.event_text);
      run.maven = run.maven || {};
      run.maven.witnesses = run.maven.witnesses || [];
      if(eventData.arguments.action === 'start') {
        run.maven.witnesses.push({ started: event.timestamp });
      } else {
        run.maven.witnesses.push({ finished: event.timestamp });
      }
    },
    "BossFight": (run, event) => {
      const eventData = JSON.parse(event.event_text);
      run.maven = run.maven || {};
      run.maven.bossFights = run.maven.bossFights || [];
      run.maven.boss = eventData.npc;
      run.maven.bossFights.push({ bossName: eventData.npc, finished: event.timestamp });
    }
  },
  "Shaper": {
    "Guardian": (run, event) => {
      const eventData = JSON.parse(event.event_text); 
      run.shaper = run.shaper || {};
      run.shaper.guardians = run.shaper.guardians || [];
      run.shaper.guardians.push({ guardianName: eventData.arguments.enemy, started: event.timestamp });
    },
    "BossFight": (run, event) => {
      const eventData = JSON.parse(event.event_text); 
      run.shaper = run.shaper || {}; 
      run.shaper.bossFights = run.shaper.bossFights || [];
      run.shaper.boss = eventData.npc;
      if(eventData.arguments.action === 'started' || eventData.arguments.action === 'phaseStarted') {
        run.shaper.bossFights.push({ bossName: eventData.arguments.enemy, phase: eventData.arguments.phase, started: event.timestamp });
      } else {
        run.shaper.bossFights[run.shaper.bossFights.length - 1].finished = event.timestamp;
      }
    }
  },
  "Shrines": {
    "Activation": (run, event) => {
      const eventData = JSON.parse(event.event_text);
      run.shrines = run.shrines || [];
      run.shrines.push(eventData.arguments.name);
    }
  },
  "Sirus": {
    "BossFight": (run, event) => {
      const eventData = JSON.parse(event.event_text);
      run.sirus = run.sirus || {};
      run.sirus.bossFights = run.sirus.bossFights || [];
      run.sirus.boss = eventData.npc;
      if(eventData.arguments.action === 'start') {
        run.sirus.bossFights.push({ bossName: eventData.npc, started: event.timestamp, phase: eventData.arguments.phase });
      } else {
        run.sirus.bossFights[run.sirus.bossFights.length - 1].finished = event.timestamp;
      }
    }
  },
  "Synthesis": {
    "BossFight": (run, event) => {
      const eventData = JSON.parse(event.event_text);
      run.synthesis = run.synthesis || {};
      run.synthesis.bossFights = run.synthesis.bossFights || [];
      run.synthesis.boss = eventData.npc;
      if(eventData.arguments.action === 'unknown') {
        return null;
      } else if(eventData.arguments.action === 'start') {
        run.synthesis.bossFights.push({ enemy: eventData.arguments.enemy, started: event.timestamp });
      } else {
        run.synthesis.bossFights[run.synthesis.bossFights.length - 1].finished = event.timestamp;
      }
    }
  }
}

// Make a function to get an event based on the quote
function getEventByQuote(npcName: string, quote: string): any | undefined {
  return Constants.events.byQuote[quote];
};


function parseEventData(run: any, event: any) {
  if(event.event_text.startsWith('{')) {
    const eventData = JSON.parse(event.event_text);
    // logger.debug("Getting Event Data for ", eventData);
    if(rules[eventData.category]?.[eventData.type]) {
      rules[eventData.category][eventData.type](run, event);
      return true;
    }
  }
  return false;
}

export default {
  getEventByQuote,
  parseEventData
}