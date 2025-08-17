import Constants from '../../helpers/constants';
import Logger from 'electron-log';

const logger = Logger.scope('EventParser');


const rules = {
  "Beasts": {
    "Capture": (run, event) => {
      const eventData = JSON.parse(event.event_text);
      run.beasts = run.beasts || { captured: { yellow: 0, red: 0 } };
      run.beasts.captured[eventData.arguments.beastType]++;
    }
  },
  "Shrines": {
    "Activation": (run, event) => {
      const eventData = JSON.parse(event.event_text);
      run.shrines = run.shrines || [];
      run.shrines.push(eventData.arguments.name);
    }
  }
}

// Make a function to get an event based on the quote
function getEventByQuote(npcName: string, quote: string): any | undefined {
  return Constants.events.byQuote[quote];
};


function parseEventData(run: any, event: any) {
  const eventData = JSON.parse(event.event_text);
  logger.info("Getting Event Data for ", eventData);
  if(rules[eventData.category]?.[eventData.type]) {
    rules[eventData.category][eventData.type](run, event);
  }
}

export default {
  getEventByQuote,
  parseEventData
}