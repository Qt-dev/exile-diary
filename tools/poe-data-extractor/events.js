import NPCs from './data/tables/English/NPCs.json' with { type: "json" };
import NPCTextAudio from './data/tables/English/NPCTextAudio.json' with { type: "json" };
import IncursionRooms from './data/tables/English/IncursionRooms.json' with { type: "json" };
import BetrayalTargets from './data/tables/English/BetrayalTargets.json' with { type: "json" };
import ClientStrings from './data/tables/English/ClientStrings.json' with { type: "json" };
import Shrines from './data/tables/English/Shrines.json' with { type: "json" };
import UltimatumModifiers from './data/tables/English/UltimatumModifiers.json' with { type: "json" };
import fs from 'fs/promises';
import Case from 'case';

const formattedShrines = Shrines.map((shrine) => {
  return {
    id: shrine.Id,
    name: ClientStrings.find((str) => str._index === shrine.Name)?.Text || 'Unknown',
    description: ClientStrings.find((str) => str._index === shrine.Description)?.Text || 'Unknown'
  };
});
await fs.writeFile('output/temp/shrines.json', JSON.stringify(formattedShrines, null, 2));

const formattedUltimatumModifiers = UltimatumModifiers.map((mod) => {
  return {
    id: mod.Id,
    name: mod.Name,
    tier: mod.Tier,
    npcTextAudioId: NPCTextAudio.find((str) => str._index === mod.TextAudio)?.Id || 'Unknown',
    Text: NPCTextAudio.find((str) => str._index === mod.TextAudio)?.Text || 'Unknown',
    description: mod.Description
  };
});
await fs.writeFile(
  'output/temp/ultimatum_modifiers.json',
  JSON.stringify(formattedUltimatumModifiers, null, 2)
);

const BetrayalIds = BetrayalTargets.filter((target) => target.Id !== 'Catarina').map((target) => target.Id);
const BetrayalTest = new RegExp(`(${BetrayalIds.join('|')}).*(?<action>KillPlayer|Defeated|LeaderDefeated).*`);
const DeliriumTest = /DeliriumVoiceSimulacrum(?<wave>\d+)-/;
const BlightTest = /Cassia.*(?<action>Interrupt|NewLane).*/;
const SynthesisTest = /Venarius(BossFight|Guardian\d)(?<action>\w+)\d*/;
const HarvestTest = /HarvestBoss(?<action>[A-Z][a-z]+)[A-Z].*/;
const ShaperTest = /Shaper(?<keyword>Banish\d|MapShapersRealm|Miniboss\dKilled|HalfHealthA|QuarterHealthA).*/;
const ShaperGuardiansTest = /ShaperMap(?<guardian>Phoenix|Hydra|Minotaur|Chimera).*/;
const CatarinaTest = /Catarina(?<action>Phase[A-Z][a-z]+|VaultIntro|VaultFleeing|Downed).*/;
const SirusTest = /Sirus(?<action>Dismount|SimpleDeathLine|ComplexDeathLine).*/;
const DarkshrineTest = /Labyrinth(Divine|Darkshrine|Izaro|Portal|Players|BossRoom)[A-Z].*/;
const LabTest = /Izaro(GargoyleDeath|\d_Prefight|Death).*/;
const MavenWitnessTest = /Maven(?<keyword>Tier\dBossVictory\d+|FirstEncounter.*)/;
const MavenTest = /MavenFinalFightCallsEnvoy\d+/;

const SimulacrumWaveByNumber = [
  { id: '1', wave: '0' },
  { id: '2', wave: '1' },
  { id: '3', wave: '2' },
  { id: '4', wave: '4' },
  { id: '5', wave: '6' },
  { id: '6', wave: '8' },
  { id: '7', wave: '9' },
  { id: '8', wave: '10' },
  { id: '9', wave: '11' },
  { id: '10', wave: '13' },
  { id: '11', wave: '15' },
  { id: '12', wave: 'end' }
];


const rules = [
  {
    id: 'Beasts',
    rule: (text) => text.Id.includes('Einhar') && text.Id.includes('Capture'),
    action: (text, output) => {
      output[text.Text] = {
        id: text.Id,
        npc: NPCs.find((npc) => npc._index === text.NPCs[0])?.Name || 'Unknown',
        category: 'Beasts',
        type: 'Capture',
        arguments: {
          beastType: text.Id.includes('Special') ? 'red' : 'yellow'
        }
      };
    }
  },
  {
    id: 'BeastCraft',
    rule: (text) => text.Id.includes('Einhar') && text.Id.includes('Beastcraft'),
    action: (text, output) => {
      output[text.Text] = {
        id: text.Id,
        npc: NPCs.find((npc) => npc._index === text.NPCs[0])?.Name || 'Unknown',
        category: 'Beasts',
        type: 'Craft',
        arguments: {
          action: text.Id.includes('Start') ? 'start' : 'defeated'
        }
      };
    }
  },
  {
    id: 'Incursion',
    rule: (text) => text.Id.startsWith('AlvaIncursionCongrats') || text.Id.startsWith('AlvaPortal'),
    action: (text, output) => {
      output[text.Text] = {
        id: text.Id,
        npc: NPCs.find((npc) => npc._index === text.NPCs[0])?.Name || 'Unknown',
        category: 'Incursion',
        type: 'Unlock',
        arguments: {
          action: text.Id.startsWith('AlvaIncursionCongrats') ? 'end' : 'start',
        }
      };
    }
  },
  {
    id: 'Incursion',
    rule: (text) => text.Id.startsWith('AlvaTempleFeature'),
    action: (text, output) => {
      const roomId = text.Id.replace('AlvaTempleFeature_', '');
      output[text.Text] = {
        id: text.Id,
        npc: NPCs.find((npc) => npc._index === text.NPCs[0])?.Name || 'Unknown',
        category: 'Incursion',
        type: 'TempleRoom',
        arguments: {
          roomId,
          roomName: IncursionRooms.find((room) => room.Id === roomId)?.Name || 'Unknown'
        }
      };
    }
  },
  {
    id: 'Incursion Boss',
    rule: (text) => text.Id.startsWith('AlvaBossFight'),
    action: (text, output) => {
      output[text.Text] = {
        id: text.Id,
        npc: NPCs.find((npc) => npc._index === text.NPCs[0])?.Name || 'Unknown',
        category: 'Incursion',
        type: 'TempleRoom',
        arguments: {
          roomName: 'Temple of Atzoatl'
        }
      };
    }
  },
  {
    id: 'Elder',
    rule: (text) => text.Id.startsWith('ZanaElderBoss'),
    action: (text, output) => {
      output[text.Text] = {
        id: text.Id,
        npc: NPCs.find((npc) => npc._index === text.NPCs[0])?.Name || 'Unknown',
        category: 'Elder',
        type: 'BossFight',
        arguments: {
          boss: 'Elder',
          action: 'defeated'
        }
      };
    }
  },
  {
    id: 'Conquerors',
    rule: (text) => /.*Stone(Fight|Flee|Death).*/.test(text.Id),
    action: (text, output) => {
      const stoneCountRegex = /(?<Count>[A-Z][a-z]+)Stone(Fight|Flee|Death)/;
      const match = text.Id.match(stoneCountRegex);
      const stoneCount = match?.groups?.Count || 'Unknown';
      output[text.Text] = {
        id: text.Id,
        npc: NPCs.find((npc) => npc._index === text.NPCs[0])?.Name || 'Unknown',
        category: 'Conquerors',
        type: 'BossFight',
        arguments: {
          action: text.Id.includes('Fight') ? 'start' : 'end',
          boss: NPCs.find((npc) => npc._index === text.NPCs[0])?.Name || 'Unknown',
          stones: stoneCount
        }
      };
    }
  },
  {
    id: 'Legion',
    rule: (text) => /Legion.+Fleeing.*/.test(text.Id),
    action: (text, output) => {
      output[text.Text] = {
        id: text.Id,
        npc: NPCs.find((npc) => npc._index === text.NPCs[0])?.Name || 'Unknown',
        category: 'Legion',
        type: 'BossFight',
        arguments: {
          action: 'end',
          boss: NPCs.find((npc) => npc._index === text.NPCs[0])?.Name || 'Unknown'
        }
      };
    }
  },
  {
    id: 'Betrayal',
    rule: (text) => BetrayalTest.test(text.Id),
    action: (text, output) => {
      const match = text.Id.match(BetrayalTest);
      let action = 'unknown';
      switch(match?.groups?.action) {
        case 'KillPlayer':
          action = 'killedPlayer';
          break;
        case 'Defeated':
          action = 'defeated';
          break;
        case 'LeaderDefeated':
          action = 'defeatedAsLeader';
          break;
      }
      const target = match?.[1] || 'Unknown';
      output[text.Text] = {
        id: text.Id,
        npc: NPCs.find((npc) => npc._index === text.NPCs[0])?.Name || 'Unknown',
        category: 'Betrayal',
        type: 'Fight',
        arguments: {
          target,
          action
        }
      };
    }
  },
  {
    id: "Delirium",
    rule: (text) => DeliriumTest.test(text.Id),
    action: (text, output) => {
      const match = text.Id.match(DeliriumTest);
      let wave = 'Unknown';
      if (match?.groups?.wave) {
        wave = SimulacrumWaveByNumber.find((waveData) => waveData.id === match.groups.wave)?.wave || 'Unknown';
      }
      output[text.Text] = {
        id: text.Id,
        npc: NPCs.find((npc) => npc._index === text.NPCs[0])?.Name || 'Unknown',
        category: 'Delirium',
        type: 'Wave',
        arguments: {
          simulacrum: true,
          wave
        }
      };
    }
  },
  {
    id: 'Blight',
    rule: (text) => BlightTest.test(text.Id),
    action: (text, output) => {
      const match = text.Id.match(BlightTest);
      const actionId = match?.groups?.action || 'Unknown';
      let actionIdText = 'unknown';
      switch(actionId) {
        case 'Interrupt':
          actionIdText = 'start';
          break;
        case 'NewLane':
          actionIdText = 'newLane';
          break;
      }
      output[text.Text] = {
        id: text.Id,
        npc: NPCs.find((npc) => npc._index === text.NPCs[0])?.Name || 'Unknown',
        category: 'Blight',
        type: 'Event',
        arguments: {
          blight: true,
          action: actionIdText
        }
      };
    }
  },
  {
    id: 'Synthesis',
    rule: (text) => SynthesisTest.test(text.Id),
    action: (text, output) => {
      const match = text.Id.match(SynthesisTest);
      const actionText = match?.groups?.action || 'Unknown';

      const formattedAction = Case.snake(actionText);
      const actionWords = formattedAction.split('_');

      const args = {
        action: 'unknown'
      };
      switch(actionWords[0]) {
        case 'introduction':
          args.action = 'start';
          args.enemy = 'Venarius';
          break;
        case 'golem':
          args.enemy = actionWords[1] === 'one' ? 'Fractal Gargantuan' : 'Fractal Titan';
          if(actionWords[actionWords.length - 1] === 'defeated') {
            args.action = 'defeated';
          } else {
            args.action = 'start';
          }
          break;
        case 'humanoid':
          args.enemy = actionWords[1] === 'one' ? 'Synthete Masterpiece' : 'Synthete Nightmare';
          if(actionWords[actionWords.length - 1] === 'defeated') {
            args.action = 'defeated';
          } else {
            args.action = 'start';
          }
          break;
        case 'depart':
        case 'defeat':
          args.enemy = 'Venarius';
          args.action = 'defeated';
      }

      output[text.Text] = {
        id: text.Id,
        npc: NPCs.find((npc) => npc._index === text.NPCs[0])?.Name || 'Unknown',
        category: 'Synthesis',
        type: 'BossFight',
        arguments: {
          synthesis: true,
          ...args
        }
      };
    }
  },
  {
    id: "Harvest",
    rule: (text) => HarvestTest.test(text.Id),
    action: (text, output) => {
      const match = text.Id.match(HarvestTest);
      let action = 'unknown';
      switch(match?.groups?.action) {
        case 'Intro':
          action = 'start';
          break;
        case 'Death':
          action = 'defeated';
          break;
        default:
          return;
          break;
      }
      output[text.Text] = {
        id: text.Id,
        npc: NPCs.find((npc) => npc._index === text.NPCs[0])?.Name || 'Unknown',
        category: 'Harvest',
        type: 'BossFight',
        arguments: {
          action
        }
      };
    }
  },
  {
    id: "Shaper",
    rule: (text) => ShaperTest.test(text.Id),
    action: (text, output) => {
      const match = text.Id.match(ShaperTest);
      const actionText = match?.groups?.keyword || 'Unknown';

      let action = 'unknown';
      let enemy = 'Shaper';
      let phase = 1;

      switch(actionText) {
        case 'MapShapersRealm':
          action = 'started';
          break;
        case 'Miniboss1Killed':
          action = 'defeated';
          enemy = 'Miniboss 1';
          phase = 1;
          break;
        case 'Miniboss2Killed':
          action = 'defeated';
          enemy = 'Miniboss 2';
          phase = 1;
          break;
        case 'Miniboss3Killed':
          action = 'defeated';
          enemy = 'Miniboss 3';
          phase = 1;
          break;
        case 'Miniboss4Killed':
          action = 'defeated';
          enemy = 'Miniboss 4';
          phase = 2;
          break;
        case 'HalfHealthA':
          action = 'phaseStarted';
          phase = 2;
          break;
        case 'QuarterHealthA':
          action = 'phaseStarted';
          phase = 3;
          break;
        case 'Banish6':
          action = 'phaseEnded';
          phase = 1;
          break;
        case 'Banish2':
          action = 'phaseEnded';
          phase = 2;
          break;
        case 'Banish3':
          action = 'defeated';
          phase = 3;
          break;
        default:
          return;
      }

      output[text.Text] = {
        id: text.Id,
        npc: NPCs.find((npc) => npc._index === text.NPCs[0])?.Name || 'Unknown',
        category: 'Shaper',
        type: 'BossFight',
        arguments: {
          action,
          enemy,
          phase,
        }
      };
    }
  },
  {
    id: "ShaperGuardians",
    rule: (text) => ShaperGuardiansTest.test(text.Id),
    action: (text, output) => {
      const match = text.Id.match(ShaperGuardiansTest);
      if( !(match?.groups?.guardian) ) return;

      const guardianName = `Guardian of the ${match.groups.guardian}`;

      output[text.Text] = {
        id: text.Id,
        npc: NPCs.find((npc) => npc._index === text.NPCs[0])?.Name || 'Unknown',
        category: 'Shaper',
        type: 'Guardian',
        arguments: {
          mapStarted: true,
          enemy: guardianName,
        }
      };
    }
  },
  {
    id: "Catarina",
    rule: (text) => CatarinaTest.test(text.Id),
    action: (text, output) => {
      const match = text.Id.match(CatarinaTest);
      let action = 'unknown';
      let phase = 1;
      let firstFight = false;
      switch(match?.groups?.action) {
        case 'VaultIntro':
          action = 'start';
          firstFight = true;
          break;
        case 'VaultFleeing':
          action = 'defeated';
          firstFight = true;
          break;
        case 'Downed':
          action = 'defeated';
          phase = 4;
          break;
        case 'PhaseZero':
          action = 'start';
          phase = 1;
          break;
        case 'PhaseOne':
          action = 'start';
          phase = 2;
          break;
        case 'PhaseTwo':
          action = 'start';
          phase = 3;
          break;
        case 'PhaseThree':
          action = 'start';
          phase = 4;
          break;
        case 'PhaseFour':
          action = 'start';
          phase = 5;
          break;
        default:
          return;
      }
      output[text.Text] = {
        id: text.Id,
        npc: NPCs.find((npc) => npc._index === text.NPCs[0])?.Name || 'Unknown',
        category: 'Betrayal',
        type: 'BossFight',
        arguments: {
          action,
          phase,
          firstFight
        }
      };
    }
  },
  {
    id: "Sirus",
    rule: (text) => SirusTest.test(text.Id),
    action: (text, output) => {
      const match = text.Id.match(SirusTest);
      const actionText = match?.groups?.action || 'Unknown';

      let action = 'unknown';
      let phase = 1;

      switch(actionText) {
        case 'Dismount':
          action = 'start';
          const phaseText = Case.snake(text.Id.replace('SirusDismount', '')).split('_')[0];
          switch(phaseText) {
            case 'one':
              phase = 1;
              break;
            case 'two':
              phase = 2;
              break;
            case 'three':
              phase = 3;
              break;
          }
          break;
        case 'SimpleDeathLine':
          action = 'defeated';
          phase = 3;
          break;
        case 'ComplexDeathLine':
          action = 'defeated';
          phase = 3;
          break;
      }

      output[text.Text] = {
        id: text.Id,
        npc: NPCs.find((npc) => npc._index === text.NPCs[0])?.Name || 'Unknown',
        category: 'Sirus',
        type: 'BossFight',
        arguments: {
          action,
          phase,
        }
      };
    }
  },
  {
    id: "Lab",
    rule: (text) => LabTest.test(text.Id),
    action: (text, output) => {
      const match = text.Id.match(LabTest);
      if (!match) return;
      let action = 'unknown';
      let target = 'Izaro'
      let phase = 0;
      switch(match[1]) {
        case 'GargoyleDeath':
          action = 'defeated';
          target = 'Argus';
          phase = 1;
          break;
        case '1_Prefight':
          action = 'started';
          phase = 1;
          break;
        case '2_Prefight':
          action = 'started';
          phase = 2;
          break;
        case '3_Prefight':
          action = 'started';
          phase = 3;
          break;
        case 'Death':
          action = 'defeated';
          phase = 4;
          break;
      }

      output[text.Text] = {
        id: text.Id,
        npc: 'Izaro',
        category: 'Labyrinth',
        type: 'Run',
        arguments: {
          action,
          phase,
          target
        }
      };
    }
  },
  {
    id: "MavenWitness",
    rule: (text) => MavenWitnessTest.test(text.Id),
    action: (text, output) => {
      const match = text.Id.match(MavenWitnessTest);
      if (!match) return;

      const keyword = match.groups.keyword;

      output[text.Text] = {
        id: text.Id,
        npc: NPCs.find((npc) => npc._index === text.NPCs[0])?.Name || 'Unknown',
        category: 'Maven',
        type: 'Witness',
        arguments: {
          action: keyword.startsWith('FirstEncounter') ? 'start' : 'defeated',
        }
      };
    }
  },
  {
    id: "MavenFight",
    rule: (text) => MavenTest.test(text.Id),
    action: (text, output) => {
      output[text.Text] = {
        id: text.Id,
        npc: NPCs.find((npc) => npc._index === text.NPCs[0])?.Name || 'Unknown',
        category: 'Maven',
        type: 'BossFight',
        arguments: {
          action: 'defeated',
        }
      };
    }
  }
];

// Specific rules that need to be applied manually
const ShrineRules =   {
  id: "Shrines",
  action: (text, output) => {
    output[text.description] = {
      id: text.id,
      npc: 'Unknown',
      category: 'Shrines',
      type: 'Activation',
      arguments: {
        name: text.name
      }
    };
  }
};

const UltimatumRules = {
  id: "Ultimatum",
  action: (text, output) => {
    output[text.Text] = {
      id: text.id,
      npc: NPCs.find((npc) => npc._index === 505)?.Name || 'Unknown',
      category: 'Ultimatum',
      type: 'Activation',
      arguments: {
        name: text.name,
        tier: text.tier,
        npcTextAudioId: text.npcTextAudioId,
        description: text.description
      }
    };
  }
}

const ClientStringsRules = [
  {
    id: "DarkShrines",
    rule: (ClientString) => DarkshrineTest.test(ClientString.Id),
    action: (ClientString, output) => {
      const match = ClientString.Id.match(DarkshrineTest);
      if (!match) return;

      output[ClientString.Text] = {
        id: ClientString.Id,
        npc: 'Unknown',
        category: 'Darkshrines',
        type: 'Activation',
        arguments: {
          shrineId: match[1]
        }
      };
    }
  }
];


export default async () => {
  const eventsData = {
    dialogue: {},
    byQuote: {

    }
  };

  for (const text of NPCTextAudio) {
    for (const rule of rules) {
      if (rule.rule(text)) {
        rule.action(text, eventsData.byQuote);
        // console.log(`Applied rule ${rule.id} to text ${text.Id}`);
        break;
      }
    }
  }

  for (const clientString of ClientStrings) {
    for (const rule of ClientStringsRules) {
      if(rule.rule(clientString)) {
        rule.action(clientString, eventsData.byQuote);
        // console.log(`Applied rule ${rule.id} to client string ${clientString.Id}`);
        break;
      }
    }
  }

  // Special rules
  for (const text of formattedShrines) {
    ShrineRules.action(text, eventsData.byQuote);
  }

  for (const mod of formattedUltimatumModifiers) {
    UltimatumRules.action(mod, eventsData.byQuote);
  }

  await fs.writeFile('output/events.json', JSON.stringify(eventsData, null, 2));
  console.log('Events generated successfully.');
}
