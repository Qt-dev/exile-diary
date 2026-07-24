import Items from './data/tables/English/BaseItemTypes.json' with { type: "json" };
import Classes from './data/tables/English/ItemClasses.json' with { type: "json" };
import FrameTypes from './data/tables/English/ItemFrameType.json' with { type: "json" };
import fs from 'fs/promises';


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

const IgnoredNamePatterns = [
  "[DNT]",
  "...",
  "[UNUSED]",
];

const GemClasses = [
  "Active Skill Gem",
  "Support Skill Gem",
]

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

const LeagueClasses = [
  "Tincture",
];

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
  {
    pattern: /Wombgift$/,
    customClass: "Wombgift"
  }
];

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

export default async () => {
  const itemsPerClass = {}

  // Pre-Sort Items and Classes
  const items = Items.map((item) => {
    const itemClass = Classes.find((itemClass) => itemClass._index === item.ItemClassesKey);
    return {
      name: item.Name,
      class: itemClass.Id
    }
  })
  .filter((item) => !IgnoredClasses.includes(item.class));

  const classes = items.map((item) => item.class)
    .filter((item, index, self) => self.indexOf(item) === index);

  classes.forEach((itemClass) => {
    itemsPerClass[itemClass] = items.filter((item) => item.class === itemClass).map((item) => item.name);
  });

  const frameTypes = FrameTypes
    .sort((a, b) => a._index - b._index)
    .map((frameType) => frameType.Id.toLowerCase());

  // Build Proper Sorted Items
  const sortedItems = {
    equipments: {},
    gems: {},
    others: {},
  };

  const names = {
    memories: itemsPerClass["MemoryLine"],
    invitations: itemsPerClass["MiscMapItem"]
      .filter((item) => item.endsWith("Invitation")),
    heistQuestItems: itemsPerClass["QuestItem"]
      .filter((item) => item.includes("Contract: ")),
    metamorphSamples: itemsPerClass["MetamorphosisDNA"]
      .map((item) => `${item.replace("Metamorph ", "")}Inventory`),
  }

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
      } else if (item.class === "BrequelFruit") {
        sortedItems.others[item.name] = ["Currency", "Wombgift"];
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


  await fs.mkdir('./output/temp', { recursive: true });
  await Promise.all([
    fs.writeFile('./output/temp/items.json', JSON.stringify(items, null, 2)),
    fs.writeFile('./output/temp/classes.json', JSON.stringify(classes, null, 2)),
    fs.writeFile('./output/temp/itemsPerClass.json', JSON.stringify(itemsPerClass, null, 2)),
    fs.writeFile('./output/temp/sortedItems.json', JSON.stringify(sortedItems, null, 2)),
    fs.writeFile('./output/items.json', JSON.stringify({
      baseTypes: sortedItems,
      names,
      frameTypes
    }, null, 2)),
  ]);

  console.log("Items generated successfully.");
}
