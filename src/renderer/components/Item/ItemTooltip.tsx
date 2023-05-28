import React from 'react';
import reactStringReplace from 'react-string-replace';
import Constants from '../../../helpers/constants';
import classNames from 'classnames';

const getHeader = (item, influenceIcons: JSX.Element[]) => {
  const { rawData } = item;

  const name = rawData.name || rawData.secretName;
  const type = rawData.hybrid ? rawData.hybrid.baseTypeName : rawData.typeLine;
  const nameClassNames = classNames({
    'Item-Tooltip__Header__Name': true,
    'Item-Tooltip__Header__Name--Secret': !!rawData.secretName,
  });
  const headerClassNames = classNames({
    'Item-Tooltip__Header': true,
    'Item-Tooltip__Header--Double': !!name,
  });

  const influences: JSX.Element[] = [];
  for (const influenceIcon of influenceIcons) {
    influences.push(<div className="Item-Tooltip__Header__Influence">{influenceIcon}</div>);
  }
  if (influenceIcons.length === 1) {
    influences.push(influences[0]);
  }

  return (
    <div key={`header`} className={headerClassNames}>
      {influences.length > 0 ? influences[0] : null}
      <div className="Item-Tooltip__Header__Text">
        {name ? <div className={nameClassNames}>{name}</div> : null}
        {type ? <div className="Item-Tooltip__Header__Type">{type}</div> : null}
      </div>
      {influences.length > 0 ? influences[1] : null}
    </div>
  );
};

type Property = {
  type: number;
  values?: string[];
  name: string;
  displayMode: number;
};

const colorClassByCode = {
  0: 'Text--Default',
  1: 'Text--Augmented',
  2: 'Text--Unmet',
  3: 'Text--Physical-Damage',
  4: 'Text--Fire-Damage',
  5: 'Text--Cold-Damage',
  6: 'Text--Lightning-Damage',
  7: 'Text--Chaos-Damage',
  12: 'Text--Harvest-Red',
  13: 'Text--Harvest-Green',
  14: 'Text--Harvest-Blue',
  // color 15 is used for maven invitations, varies depending on completed bosses
  // we don't have access to this data, so just use default color
  15: 'Text--Default',
};
const formatValue = (value) => {
  if (value.length < 1) return null;
  const [text, color] = value;
  const formattedText = text.split('/\n/');
  return formattedText.map((text) => [colorClassByCode[color], text]);
};

type PropertyLineProps = {
  value: string[];
  children?: JSX.Element[] | React.ReactNodeArray | string;
  prefix?: string;
};
const PropertyLine = ({ value, prefix = '', children = [] }: PropertyLineProps) => {
  const text = children.length > 0 ? children : <span className={value[0]}>{value[1]}</span>;
  return (
    <div className="Item-Tooltip__Property">
      {prefix}
      {text}
    </div>
  );
};

const getPropertyString = (property: Property): JSX.Element[] | null => {
  if (!property.values || !property.values.length) {
    return [<span key={`prop-${property.name}`}>{property.name}</span>];
  } else {
    const stringMap = [
      (property: Property) => {
        if (property.values === undefined || !property.values[0]) return null;
        const formattedValues = formatValue(property.values[0]);
        if (property.type === 49) {
          // type 49: list of required boss for maven invitations
          for (const value of property.values) {
            formattedValues.push(formatValue(value));
          }
        }
        return formattedValues.map((value: string[], index) => (
          <PropertyLine
            prefix={property.name ? `${property.name}: ` : ''}
            key={`Property-${index}`}
            value={value}
          />
        ));
      },
      (property: Property) => {
        if (property.values === undefined) return null;
        return [<PropertyLine value={[property.values[0]]} />];
      },
      (property: Property) => {
        // Progress bar type value, handle this later
        return null;
      },
      (property: Property) => {
        if (property.values === undefined) return null;
        const propertyLines = property.name.split(/\n/);
        const isStoredExperience = propertyLines[0].startsWith('Stored Experience');
        const formatExperience = (xp) => new Intl.NumberFormat().format(Number.parseInt(xp));
        const propertyElements: any[] = [];
        const pattern = /[%{](?<id>\d)\}*/g;

        for (const line of propertyLines) {
          propertyElements.push(
            <PropertyLine key={line} value={[]}>
              {reactStringReplace(line, new RegExp(pattern), (match) => {
                const cleanValueText = isStoredExperience
                  ? formatExperience(property.values?.[match][0])
                  : property.values?.[match][0];
                return <span className={colorClassByCode[0]}>{cleanValueText}</span>;
              })}
            </PropertyLine>
          );
        }

        return propertyElements;
      },
    ];
    return stringMap[property.displayMode](property);
  }
};

// getPropertiesAndUtilityMods generates div elements for each property and utility mod of the item
// it reads the item's properties and utilityMods arrays and generates a div for each entry
const getPropertiesAndUtilityMods = (item) => {
  const { rawData } = item;
  const properties = rawData.properties || [];
  const utilityMods = rawData.utilityMods || [];

  const propertiesAndUtilityMods = properties.concat(utilityMods);

  const propertyElements = propertiesAndUtilityMods.map((property, index) => {
    return <div key={`prop-${item.id}-${index}`} className="Item-Tooltip__Property">{getPropertyString(property)}</div>;
  });

  return propertyElements;
};

// getItemLevelAndRequirements generates a div element for the item's level and requirements
const getItemLevelAndRequirements = (item) => {
  const { rawData } = item;
  if (!rawData.requirements && rawData.ilvl === 0) return null;
  if (rawData.isVaalGem) return null; // Gem info is calculated somewhere else

  const elements: any[] = [];
  const { ilvl, requirements } = rawData;
  if (ilvl)
    elements.push(
      <PropertyLine key="ilvl" value={[colorClassByCode[0], ilvl]} prefix={'Item Level: '} />
    );
  if (requirements) {
    const prefix = 'Requires ';
    let values: any[] = [];
    for (const requirement of requirements) {
      const stringPrefix = requirement.name === 'Level' ? `${requirement.name} ` : '';
      const stringSuffix = requirement.name !== 'Level' ? ` ${requirement.name}` : '';
      values.push(
        <>
          <span>{stringPrefix}</span>
          <span className={colorClassByCode[0]}>{requirement.values[0][0]}</span>
          <span>{stringSuffix}</span>
        </>
      );
    }

    // Add separator between requirements
    values = values.reduce(
      (previousValue, currentValue) =>
        previousValue === null ? (
          currentValue
        ) : (
          <>
            {previousValue}, {currentValue}
          </>
        ),
      null
    );

    elements.push(
      <PropertyLine key="requirements" value={[]} prefix={prefix}>
        {[values]}
      </PropertyLine>
    );
  }

  return [<>{elements}</>];
};

const getEnchantMods = (item) => {
  const { rawData } = item;
  if (!rawData.enchantMods || rawData.enchantMods.length === 0) return null;
  const enchantMods: JSX.Element[] = [];
  for (const mod of rawData.enchantMods) {
    mod.split('\r\n').forEach((splitMod, index) => {
      enchantMods.push(<div key={`enchant-${item.id}-${index}`} className="Item-Tooltip__Property Text--Enchantment">{splitMod}</div>);
    });
  }
  return enchantMods;
};

const getImplicitMods = (item) => {
  const { rawData } = item;
  if (!rawData.implicitMods || rawData.implicitMods.length === 0) return null;
  const implicitMods: JSX.Element[] = [];
  for (const mod of rawData.implicitMods) {
    mod.split('\r\n').forEach((splitMod, index) => {
      implicitMods.push(<div key={`impl-${item.id}-${index}`} className="Item-Tooltip__Property Text--Implicit">{splitMod}</div>);
    });
  }
  return implicitMods;
};

const getUnidentified = (item) => {
  const { rawData } = item;
  // hybrid-type gems - no identified property, but always IDed
  if (rawData.baseTypeName) return null;
  return rawData.identified
    ? null
    : [<div key={`unid-${item.id}`} className="Item-Tooltip__Property Text--Unidentified">Unidentified</div>];
};

const getSecDescrText = (item) => {
  const { rawData } = item;
  if (!rawData.secDescrText) return null;
  return [
    <div key={`descr-text-${item.id}`} className="Item-Tooltip__Property .Text--Secret-Description">{rawData.secDescrText}</div>,
  ];
};

const getExplicitMods = (item) => {
  const { rawData } = item;
  const explicitMods: JSX.Element[] = [];
  if (rawData.fracturedMods) {
    for (const mod of rawData.fracturedMods) {
      mod.split('\r\n').forEach((splitMod, index) => {
        explicitMods.push(<div key={`explicit-${item.id}-${index}`} className="Item-Tooltip__Property Text--Fractured">{splitMod}</div>);
      });
    }
  }

  if (rawData.explicitMods) {
    for (const mod of rawData.explicitMods) {
      mod.split(/[\r\n]+/).forEach((splitMod) => {
        let formattedMod = splitMod.slice();
        // Essences have one empty line
        // Incubators have 2 lines separated by \r\n
        if (rawData.typeLine && rawData.typeLine.includes('Incubator')) {
          formattedMod = formattedMod.replace(/[0-9]+/g, (number) =>
            new Intl.NumberFormat().format(number)
          );
        }
        if (formattedMod.length > 0) {
          explicitMods.push(
            <div
              key={`mod-explicit-${explicitMods.length}`}
              className="Item-Tooltip__Property Text--Explicit"
            >
              {splitMod}
            </div>
          );
        }
      });
    }
  }

  if (rawData.craftedMods) {
    for (const mod of rawData.craftedMods) {
      mod.split('\r\n').forEach((splitMod) => {
        explicitMods.push(
          <div
            key={`mod-implicit-${explicitMods.length}`}
            className="Item-Tooltip__Property Text--Crafted"
          >
            {splitMod}
          </div>
        );
      });
    }
  }

  if (rawData.veiledMods) {
    for (const mod of rawData.veiledMods) {
      const veiledModClass = classNames({
        'Item-Tooltip__Property': true,
        'Text--Veiled': true,
      });
      const veiledModContentClass = classNames({
        'Text--Veiled__Content': true,
        'Text--Veiled__Content--Prefix': mod.toLowerCase().includes('prefix'),
        'Text--Veiled__Content--Suffix': mod.toLowerCase().includes('suffix'),
        [`${mod.toLowerCase()}`]: true,
      });
      const text = mod.toLowerCase().includes('prefix') ? 'Veiled Prefix' : 'Veiled Suffix';
      explicitMods.push(
        <div key={`mod-veiled-${explicitMods.length}`} className={veiledModClass}>
          <span className={veiledModContentClass}>{text}</span>
        </div>
      );
    }
  }

  if (rawData.corrupted && (!rawData.hybrid || !rawData.hybrid.isVaalGem)) {
    explicitMods.push(
      <div
        key={`mod-corrupted-${explicitMods.length}`}
        className="Item-Tooltip__Property Text--Corrupted"
      >
        Corrupted
      </div>
    );
  }

  if (rawData.isVaalGem) {
    explicitMods.push(
      <div
        key={`mod-corrupted-${explicitMods.length}`}
        className="Item-Tooltip__Property Text--Corrupted"
      >
        Corrupted
      </div>
    );
  }

  return explicitMods;
};

const getAdditionalProperties = (item) => {
  const { rawData } = item;
  if (!rawData.additionalProperties || rawData.additionalProperties.length === 0) return null;
  const additionalProperties: JSX.Element[] = [];

  for (const property of rawData.additionalProperties) {
    if (property.name === 'Quality') {
      const xpString = property.values[0][0].split('/');
      const currentXp = new Intl.NumberFormat().format(xpString[0]);
      const totalXp = new Intl.NumberFormat().format(xpString[1]);
      const progress = Math.floor(property.progress * 100);
      additionalProperties.push(
        <div key={`${item.id}-${property.name}`} className="Item-Tooltip__Property">
          <div className="Item-Tooltip__Experience-Bar__Container">
            <div className="Item-Tooltip__Experience-Bar__Background">
              <div
                className="Item-Tooltip__Experience-Bar__Foreground"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
          <div className={`Item-Tooltip__Experience-Bar__Text ${colorClassByCode[0]}`}>
            {currentXp}/{totalXp}
          </div>
        </div>
      );
    }
  }
  return additionalProperties;
};

const getCosmeticMods = (item) => {
  const { rawData } = item;
  if (!rawData.cosmeticMods || rawData.cosmeticMods.length === 0) return null;
  const cosmeticMods: JSX.Element[] = [];
  for (const mod of rawData.cosmeticMods) {
    cosmeticMods.push(<div key={`cosmetic-mods-${item.id}-${mod}`} className="Item-Tooltip__Property Text--Cosmetic">{mod}</div>);
  }
  return cosmeticMods;
};

const getFlavourText = (item) => {
  const { rawData } = item;
  if (!rawData.flavourText || rawData.flavourText.length === 0) return null;
  const flavourText: JSX.Element[] = [];
  rawData.flavourText.forEach((mod, count) => {
    mod.split('\r\n').forEach((splitMod, index) => {
      flavourText.push(<div key={`flavour-${item.id}-${count}-${index}`} className="Item-Tooltip__Property Text--Flavour">{splitMod}</div>);
    });
  });
  return flavourText;
};

// This is for when text is split by character, somehow
const getFlavourTextParsed = (item) => {
  const { rawData } = item;
  if (!rawData.flavourTextParsed || rawData.flavourTextParsed.length === 0) return null;
  const flavourTextParsed: JSX.Element[] = [];
  let glyphLine: any = [];
  let glyphLines: any = [];
  for (const mod of rawData.flavourTextParsed) {
    if (mod === '\r\n' && glyphLine.length > 0) {
      // End of block
      glyphLines.push(glyphLine.slice(0));
      glyphLine = [];
    } else if (mod.type === 'class' && mod.class === 'glyph') {
      glyphLine.push(mod.id);
    }
  }

  if (glyphLine.length > 0) glyphLines.push(glyphLine.slice(0));
  for (const line of glyphLines) {
    for (const letter in line) {
      flavourTextParsed.push(
        <div key={`Flavour-Text-${line}`} className="Item-Tooltip__Property Text--Flavour">
          <div className={`Glyph Glyph--${letter}`} />
        </div>
      );
    }
  }

  return flavourTextParsed;
};

const getProphecyText = (item) => {
  const { rawData } = item;
  return rawData.prophecyText
    ? [
        <div key={`prophecy-${item.id}`} className={`Item-Tooltip__Property ${colorClassByCode[0]}`}>
          ${rawData.prophecyText}
        </div>,
      ]
    : null;
};

const getDescrText = (item) => {
  const { rawData } = item;
  return rawData.descrText
    ? [<div key={`description-text-${item.id}`} className="Item-Tooltip__Property Text--Description">{rawData.descrText}</div>]
    : null;
};

const getIncubatedItem = (item) => {
  const { rawData } = item;
  if (!rawData.incubatedItem) return null;

  const { progress, level, total } = rawData.incubatedItem;
  const progressPercent = Math.floor((progress / total) * 100);
  const { format } = new Intl.NumberFormat();

  return [
    <div key={`incubated${item.id}`} className="Item-Tooltip__Property Text--Incubated">
      <div className="Item-Tooltip__Experience-Bar__Container">
        <div className="Item-Tooltip__Experience-Bar__Background">
          <div
            className="Item-Tooltip__Experience-Bar__Foreground"
            style={{ width: `${progressPercent}%` }}
          ></div>
        </div>
      </div>

      <div className={`Item-Tooltip__Incubator-Bar__Text ${colorClassByCode[0]}`}>
        <div className="Item-Tooltip__Incubator-Bar__Text__Progress">
          {format(progress)}/{format(total)}
        </div>
        <div className="Item-Tooltip__Incubator-Bar__Text__Level">Level {level} Monster Kills</div>
      </div>
    </div>,
  ];
};

const getDescription = (item) => {
  const elementsMap: Function[] = [
    getPropertiesAndUtilityMods,
    getItemLevelAndRequirements,
    getEnchantMods,
    getImplicitMods,
    getUnidentified,
    getSecDescrText,
    getExplicitMods,
    getAdditionalProperties,
    getCosmeticMods,
    getFlavourText,
    getFlavourTextParsed,
    getProphecyText,
    getDescrText,
    getIncubatedItem,
  ];
  let elements: any = [];

  for (const generateElement of elementsMap) {
    const generatedElements = generateElement(item);
    if (generatedElements && generatedElements.length > 0) elements.push(generatedElements);
  }

  elements = elements.reduce(
    (previousValue, currentValue) =>
      previousValue === null ? (
        currentValue
      ) : (
        <React.Fragment key={`description`}>
          {previousValue}
          <hr key={`separator`} style={{ borderColor: 'none' }} className="separator" />
          {currentValue}
        </React.Fragment>
      ),
    null
  );

  return <>{elements}</>;
};

const getIcon = (item) => {
  const { rawData } = item;
  const { w: width, h: height } = rawData;
  let backgroundImage: any = null;
  if (rawData.shaper) {
    backgroundImage = require(`../../assets/img/itemicons/ShaperBackground${width}x${height}.png`);
  } else if (rawData.elder) {
    backgroundImage = require(`../../assets/img/itemicons/ElderBackground${width}x${height}.png`);
  }

  return (
    <div key={`icon`} className="Item-Tooltip__Icon">
      <div className="Item-Tooltip__Icon__Stack">
        {rawData.maxStackSize ? rawData.pickupStackSize || rawData.stackSize : ''}
      </div>
      <img
        style={{ minWidth: width, minHeight: height, backgroundImage }}
        className="Item-Tooltip__Icon__Image"
        alt={`Item Logo for ${rawData.typeLine}`}
        src={rawData.icon}
      />
    </div>
  );
};

const ItemTooltip = ({ item, influenceIcons }) => {
  const frameType = Constants.items.frameTypes[item.rawData.frameType]?.replace(/\b\w/g, (l) =>
    l.toUpperCase()
  );
  if (frameType === 'Card') return null; // Cards need special handler

  const containerClasses = classNames({
    'Item-Tooltip__Container': true,
    [`Item-Tooltip__Container--${frameType}`]: !!frameType,
  });

  return (
    <div className={containerClasses}>
      {getIcon(item)}
      {getHeader(item, influenceIcons)}
      <div className="Item-Tooltip__Content">{getDescription(item)}</div>
    </div>
  );
};

export default ItemTooltip;
