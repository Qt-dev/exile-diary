// Do not include items from these classes
const IgnoredClasses = [
  "HideoutDoodad",
  "Microtransaction",
  "DivinationCard",
  "HiddenItem",
  "NecropolisPack",
  "InstanceLocalItem",
  "ItemisedCorpse",
  "GiftBox",
  "Gold",
  "ItemisedSanctum",
  // "Tincture",
  "ArchnemesisMod",
  "SentinelDrone",
  "Relic",
  "IncubatorStackable",
  "AtlasUpgradeItem",
  "HeistObjective",
  "Relic",
  "SanctumSpecialRelic",
  "AnimalCharm",
];

// Do not include items with these in their name
const IgnoredNamePatterns = [
  "[DNT]",
  "...",
  "[UNUSED]",
];

// Hardcoded name for Gem Classes
const GemClasses = [
  "Active Skill Gem",
  "Support Skill Gem",
]

// Hardcoded name for Equipment Classes
const EquipmentClasses = [
  "Two Hand Sword",
  "Wand",
  "Dagger",
  "Rune Dagger",
  "Claw",
  "One Hand Axe",
  "One Hand Sword",
  "Thrusting One Hand Sword",
  "One Hand Mace",
  "Sceptre",
  "Bow",
  "Staff",
  "Warstaff",
  "Two Hand Axe",
  "Two Hand Mace",
  "FishingRod",
  "Ring",
  "Amulet",
  "Belt",
  "Shield",
  "Helmet",
  "Body Armour",
  "Boots",
  "Gloves",
  "LifeFlask",
  "ManaFlask",
  "HybridFlask",
  "UtilityFlask",
  "Quiver",
  "Trinket",
  "Jewel",
  "AbyssJewel",
  "HeistEquipmentWeapon",
  "HeistEquipmentTool",
  "HeistEquipmentUtility",
  "Currency",
];

// Hardcoded name for League Specific Classes
const LeagueClasses = [
  "Tincture",
];

// Special Classes for specific Currency Patterns
const SpecialCurrencyPattern = [
  {
    pattern: /^Splinter of/,
    customClass: "Breach Splinter"
  },
  {
    pattern: /^Blessing of/,
    customClass: "Breach Blessing"
  },
  {
    pattern: /Fossil$/,
    customClass: "Fossil"
  },
  {
    pattern: /Resonator$/,
    customClass: "Resonator"
  },
  {
    pattern: /(Essence of|^Remnant of Corruption$)/,
    customClass: "Essence"
  },
  {
    pattern: /Oil$/,
    customClass: "Oil"
  },
  {
    pattern: /Timeless (\d|\s)+ Splinter$/,
    customClass: "Timeless Splinter"
  },
  {
    pattern: /Vial$/,
    customClass: "Vial"
  },
  {
    pattern: /Catalyst$/,
    customClass: "Catalyst"
  },
  {
    pattern: /Delirium Orb$/,
    customClass: "Delirium Orb"
  },
];

// Special classes for specific Map Fragment Patterns
const SpecialMapFragmentPattern = [
  {
    pattern: /'s Key$/,
    customClass: "Pale Council Key"
  },
  {
    pattern: /Timeless (\d|\s)+ Emblem$/,
    customClass: "Timeless Emblem"
  },
  {
    pattern: /^Sacrifice at/,
    customClass: "Sacrifice Fragment"
  },
  {
    pattern: /^Mortal/,
    customClass: "Mortal Fragment"
  },
  {
    pattern: /Breachstone$/,
    customClass: "Breachstone"
  },
  {
    pattern: /^Fragment of/,
    customClass: "Guardian Fragment"
  },
  {
    // Elder Guardian
    pattern: /'s Crest$/,
    customClass: "Guardian Fragment"
  }
];

const itemsPerClass = {}


const sortItems = (Items, Classes) => {
  return Items.map((item) => {
    const itemClass = Classes.find((itemClass) => itemClass._index === item.ItemClassesKey);
    return {
      name: item.Name,
      class: itemClass.Id
    }
  })
  .filter((item) => !IgnoredClasses.includes(item.class));
}

const generateClasses = (items) => {
  const itemsPerClass = {}

  const classes = items.map((item) => item.class)
    .filter((item, index, self) => self.indexOf(item) === index);
  
  classes.forEach((itemClass) => {
    itemsPerClass[itemClass] = items.filter((item) => item.class === itemClass).map((item) => item.name);
  });
  
  return {
    itemsPerClass
  };
};

const generateframeTypes = (FrameTypes) => {
  return FrameTypes
    .sort((a, b) => a._index - b._index)
    .map((frameType) => frameType.Id.toLowerCase());
};

const generateNames = (itemsPerClass) => {
  return {
    memories: itemsPerClass["MemoryLine"],
    invitations: itemsPerClass["MiscMapItem"]
      .filter((item) => item.endsWith("Invitation")),
    heistQuestItems: itemsPerClass["QuestItem"]
      .filter((item) => item.includes("Contract: ")),
    metamorphSamples: itemsPerClass["MetamorphosisDNA"]
      .map((item) => `${item.replace("Metamorph ", "")}Inventory`),
  }
};

module.exports = {
  generateItems : () => {
    const Items = require('./tables/English/BaseItemTypes.json');
    const Classes = require('./tables/English/ItemClasses.json');
    const FrameTypes = require('./tables/English/ItemFrameType.json');
  
    const sortedItems = {
      equipments: {},
      gems: {},
      others: {},
    };
  
    const items = sortItems(Items, Classes);
    const { itemsPerClass } = generateClasses(items);
  
    const names = generateNames(itemsPerClass);
    const frameTypes = generateframeTypes(FrameTypes);
  
    items
      .filter((item) => item.name.length > 0 && IgnoredNamePatterns.every((pattern) => !item.name.includes(pattern)))
      .sort((a, b) => a.name.localeCompare(b.name))
      .sort((a, b) => a.class.localeCompare(b.class))
      .forEach((item) => {
        if (GemClasses.includes(item.class)) {
          sortedItems.gems[item.name] = item.class.replace(/(?<!(\s|^))([A-Z])/g, ' $1');
        } else if (EquipmentClasses.includes(item.class)) {
          sortedItems.equipments[item.name] = item.class.replace(/(?<!(\s|^))([A-Z])/g, ' $1');
        } else if (item.class === "StackableCurrency") {
          if(SpecialCurrencyPattern.some((pattern) => pattern.pattern.test(item.name))) {
            sortedItems.others[item.name] = ["Currency", SpecialCurrencyPattern.find((pattern) => pattern.pattern.test(item.name)).customClass];
          } else {
            sortedItems.others[item.name] = "Currency";
          }
        } else if (item.class === "Breachstone") {
          sortedItems.others[item.name] = ["Map Fragment", "Breachstone"];
        } else if (item.class === "MapFragment" && !sortedItems.others[item.name]) {
          if(SpecialMapFragmentPattern.some((pattern) => pattern.pattern.test(item.name))) {
            sortedItems.others[item.name] = ["Map Fragment", SpecialMapFragmentPattern.find((pattern) => pattern.pattern.test(item.name)).customClass];
          } else {
            sortedItems.others[item.name] = "Map Fragment";
          }
        } else if (item.class === "MiscMapItem" && !sortedItems.others[item.name]) {
          if(SpecialMapFragmentPattern.some((pattern) => pattern.pattern.test(item.name))) {
            sortedItems.others[item.name] = ["Misc Map Item", SpecialMapFragmentPattern.find((pattern) => pattern.pattern.test(item.name)).customClass];
          } else {
            sortedItems.others[item.name] = "Misc Map Item";
          }
        } else if (LeagueClasses.includes(item.class)) {
          sortedItems.others[item.name] = item.class;
        }
      });
  
    return {
      baseTypes: sortedItems,
      names,
      frameTypes,
    };
  }
}