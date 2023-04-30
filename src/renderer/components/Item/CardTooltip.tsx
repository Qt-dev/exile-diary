import React from 'react';
import { Divider } from '@mui/material';

// Mods are in this format:
// <default>{Quality:} <augmented>{+20%}
const parseMod = (modString) => {
  let fontSize = null;
  const divs: any = [];

  let sizeMatch = modString.match(/<size:[0-9]+>/g);
  if (sizeMatch) {
    fontSize = sizeMatch[0].replace(/[a-z<>:]/g, '');
    modString = modString.replace(/<size:[0-9]+>/, '');
  }

  let markupMatches = modString.match(/<([^{}<>]+)>/g); // detect the xml-style markup ...
  let textMatches = modString.match(/{([^{}<>]+)}/g); // detect the matching string
  if (!markupMatches || !textMatches) return modString;

  for (let i = 0; i < markupMatches.length; i++) {
    const style = {
      fontSize: fontSize ? `${fontSize / 2}px` : 'inherit',
    };
    const text = textMatches[i].replace(/[{}]/g, '');
    const className = `Text--${markupMatches[i].replace(/[<>]/g, '')}`;

    divs.push(
      <span style={style} className={className}>
        {text}
      </span>
    );
  }

  return <>{divs}</>;
};

const getMods = (rawData) => {
  if (!rawData.explicitMods || rawData.typeLine === 'The Void') return [''];

  const formattedMods: any = [];
  for (const mod of rawData.explicitMods[0].split('\r\n')) {
    formattedMods.push(<div className="Mod">{parseMod(mod)}</div>);
  }

  return formattedMods;
};

// Flavor text is in this format:
/*
[
  'Our Lady Dialla,\r',
  'as a symbol of our progress,\r',
  'shines greater than all the gems.'
]
*/
const getDivCardFlavourText = (rawData) => {
  if (!rawData.flavourText) return null;

  let fontSize = '';
  const divs: JSX.Element[] = [];

  for (const line of rawData.flavourText) {
    let sizeInfoMatch = line.match(/<size:[0-9]+>/g);
    let text = line.slice();
    if (sizeInfoMatch) {
      fontSize = sizeInfoMatch[0].replace(/[a-z<>:]/g, '');
      text = text.replace(/<size:[0-9]+>/, '');
    }
    text = text.replace(/[{}]/g, '');
    divs.push(<div className="Text--flavour">{text}</div>);
  }

  const style = {
    fontSize: fontSize ? `${parseInt(fontSize) / 2}px` : 'inherit',
  };

  return <div style={style}>{divs}</div>;
};

const DivinationTooltip = ({ item }) => {
  const { rawData } = item;
  return (
    <div className="Card">
      <div className="Card__Face">
        <img alt="Exile Diary Reborn Logo" src={`https://web.poecdn.com/image/divination-card/${rawData.artFilename}.png`} />
      </div>
      <div className="Card__Background"></div>
      <div className="Card__Text">
        <div className="Card__Name">{rawData.typeLine}</div>
        <div className="Card_Stack">
          {rawData.pickupStackSize || rawData.stackSize}/{rawData.maxStackSize}
        </div>
        <div className="Card__Text__Main">
          <div className="Card__Mods">{getMods(rawData)}</div>
          <Divider className="Card__Divider" />
          <div className="Card__FlavourText">{getDivCardFlavourText(rawData)}</div>
        </div>
      </div>
    </div>
  );
};

export default DivinationTooltip;
