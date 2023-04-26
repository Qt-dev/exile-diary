import React from 'react';
import { electronService } from '../../electron.service';
import Tooltip, { TooltipProps, tooltipClasses } from '@mui/material/Tooltip';
import { styled } from '@mui/material/styles';
import Sockets from './Sockets';
import './Item.css';
import ItemTooltip from './ItemTooltip';
import CardTooltip from './CardTooltip';
const logger = electronService.logger;

const Rarity = {
  Normal: 0,
  Magic: 1,
  Rare: 2,
  Unique: 3,

  getTextFromCode: (code) => {
    switch (code) {
      case 0:
        return 'Normal';
      case 1:
        return 'Magic';
      case 2:
        return 'Rare';
      case 3:
        return 'Unique';
      default:
        throw 'Invalid Rarity: ' + code;
    }
  },

  isValid: (code) => {
    return 0 <= code && code <= 3;
  },

  getCodeFromText: (text) => {
    switch (text.toLowerCase()) {
      case 'normal':
        return 0;
      case 'magic':
        return 1;
      case 'rare':
        return 2;
      case 'unique':
        return 3;
      default:
        throw 'Invalid Rarity: ' + text;
    }
  },
};

const Colors = {
  BLACK_75: { r: 0, g: 0, b: 0, a: 190 },
  WHITE: { r: 200, g: 200, b: 200 },
  BLUE: { r: 136, g: 136, b: 255 },
  YELLOW: { r: 255, g: 255, b: 119 },
  ORANGE: { r: 175, g: 96, b: 37 },
  GOLD: { r: 170, g: 158, b: 130 },
  CYAN: { r: 27, g: 162, b: 155 },
  GREEN: { r: 74, g: 230, b: 58 },
  LIGHT_CYAN: { r: 170, g: 230, b: 230 },
  getColorFromRarity: (rarity) => {
    const rarityMap = {};
    rarityMap[Rarity.Magic] = Colors.BLUE;
    rarityMap[Rarity.Rare] = Colors.YELLOW;
    rarityMap[Rarity.Unique] = Colors.ORANGE;

    return rarityMap[rarity] || false;
  },
  getColorFromItemClass: (itemClass) => {
    const classMap = {};
    classMap['Currency'] = Colors.GOLD;
    classMap['Quest Items'] = Colors.GREEN;
    classMap['Divination Card'] = Colors.LIGHT_CYAN;
    classMap['Labyrinth Item'] = Colors.GOLD;
    classMap['Labyrinth Trinket'] = Colors.GOLD;

    return classMap[itemClass] || false;
  },
  getDefaultColor: (item) => {
    let color: any = false;
    color = Colors.getColorFromRarity(item.rarity);
    color = !color ? Colors.getColorFromItemClass(item.itemClass) : color;
    if (!color && item.itemClass.includes('Gem')) {
      color = Colors.CYAN;
    }
    color = !color ? Colors.WHITE : color;

    return `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a || 255})`;
  },
};

const getInfluenceIcons = (item) => {
  const icons: JSX.Element[] = [];
  const influenceIcons: any[] = [];
  if (item.veiled) {
    influenceIcons.push('veiled');
  } else if (item.synthesised) {
    influenceIcons.push('synthesised');
  } else if (item.fractured) {
    influenceIcons.push('fractured');
  } else {
    for (const influence of item.influence) {
      influenceIcons.push(influence);
    }
  }

  for (const icon of influenceIcons) {
    const Icon = require(`../../assets/img/${icon}.png`);
    icons.push(<img className="Item__Influence" key={`influence-${icon}`} src={Icon} />);
  }
  return icons;
};

const StyledTooltip = styled(({ className, ...props }: TooltipProps) => (
  <Tooltip {...props} classes={{ popper: className }} />
))(({ theme }) => ({
  [`& .${tooltipClasses.tooltip}`]: {
    borderRadius: 0,
    padding: 0,
    background: 'transparent',
  },
}));

const Item = ({ item }) => {
  const color = item.styleModifiers?.textColor || Colors.getDefaultColor(item);
  const style = {
    color,
    border: `1px solid ${color}`,
    fontSize: `${item.styleModifiers?.fontSize || 18}px`,
  };
  const influenceIcons = getInfluenceIcons(item);
  const sockets = item.sockets.length > 0 ? <Sockets item={item} /> : null;
  const influencesDiv =
    influenceIcons.length > 0 ? <div className="Item__Influences">{influenceIcons}</div> : null;

  const tooltip =
    item.rawData.frameType === 6 ? (
      <CardTooltip item={item} />
    ) : (
      <ItemTooltip item={item} influenceIcons={influenceIcons} />
    );

  return (
    <StyledTooltip title={tooltip}>
      <div className="Item" style={style}>
        {influencesDiv}
        <div className="Item__Name">
          {item.getDisplayName().map((line) => (
            <div className="Item__Name__Line">{line}</div>
          ))}
        </div>
        {sockets}
      </div>
    </StyledTooltip>
  );
};

export default Item;
