/**
 * Generated test datasets with OCR-style corruptions
 * 
 * All expected outputs are valid entries from src/helpers/data/mapMods.json
 * 
 * Dataset specifications:
 * - Small datasets: 10 mods each (3 datasets)
 * - Medium datasets: 20 and 30 mods respectively
 * - Large dataset: 40 mods
 * 
 * Corruption characteristics:
 * - At least 30% of strings are corrupted
 * - At least 10% have first character corrupted
 * - Maximum 20% of string length affected
 * - Realistic OCR errors: character replacements, additions, deletions
 */

interface TestData {
  original: string;
  corrupted: string;
  expected: string;
}

export const NEW_TEST_DATASETS = {
  "small1": [
    {
      "original": "Players have #% reduced Movement Speed",
      "corrupted": "»Players have 15% reduced Movement Speed",
      "expected": "Players have 15% reduced Movement Speed"
    },
    {
      "original": "Scarabs dropped in Area have #% increased chance to be Divination Scarabs",
      "corrupted": "Scara´bz drop3d in Area have 25% increase›d chance to b¸e Divination Scaiabs",
      "expected": "Scarabs dropped in Area have 25% increased chance to be Divination Scarabs"
    },
    {
      "original": "Area is very Alluring",
      "corrupted": "Area i very Alur~ing",
      "expected": "Area is very Alluring"
    },
    {
      "original": "Vaal Vessel contains an additional Corrupted Rare Item with an Incursion Modifier",
      "corrupted": "Vaal Vessel contains an additional Corrupted Rare Item with an Incursion Modifier",
      "expected": "Vaal Vessel contains an additional Corrupted Rare Item with an Incursion Modifier"
    },
    {
      "original": "Synthesised Monsters have #% chance to drop a Currency Shard",
      "corrupted": "Synthesised Monsters have 8% chance to drop a Currency Shard",
      "expected": "Synthesised Monsters have 8% chance to drop a Currency Shard"
    },
    {
      "original": "Beyond Demons in your Maps have #% increased chance to be followers of Beidat",
      "corrupted": "Beyond Demons inyour aqs· have« 12¸%-incresèd chance to be f¡ollower of Beidat",
      "expected": "Beyond Demons in your Maps have 12% increased chance to be followers of Beidat"
    },
    {
      "original": "Monsters take #% reduced Damage",
      "corrupted": "›Mqnsters take 18% red¸uced Damage",
      "expected": "Monsters take 18% reduced Damage"
    },
    {
      "original": "Map contains Veritania's Citadel\\nItem Quantity increases amount of Rewards Veritania drops by 20% of its value",
      "corrupted": "Map contains Veritania's Citadel\\nItem Quantity increases amount of Rewards Veritania drops by 20% of its value",
      "expected": "Map contains Veritania's Citadel\\nItem Quantity increases amount of Rewards Veritania drops by 20% of its value"
    },
    {
      "original": "Items dropped by Synthesised Magic Monsters have #% chance to be Corrupted",
      "corrupted": "Items dropped by Synthesised Magic Monsters have 30% chance to be Corrupted",
      "expected": "Items dropped by Synthesised Magic Monsters have 30% chance to be Corrupted"
    },
    {
      "original": "Rogue Exiles have #% reduced Maximum Life",
      "corrupted": "Rogue Exiles have 22% reduced Maximum Life",
      "expected": "Rogue Exiles have 22% reduced Maximum Life"
    }
  ],
  "small2": [
    {
      "original": "Players have #% chance to Suppress Spell Damage while in Nightmare",
      "corrupted": "‹Playèrs have 35%chance to Suppress Spel Damage while iri N‹ightmarê",
      "expected": "Players have 35% chance to Suppress Spell Damage while in Nightmare"
    },
    {
      "original": "Breaches in Area have #% increased chance to belong to Tul",
      "corrupted": "Breaches in Area have 45% increaed chance to belong to Tul",
      "expected": "Breaches in Area have 45% increased chance to belong to Tul"
    },
    {
      "original": "Area contains # additional Harbingers",
      "corrupted": "Aieä contains 3 additional Harbirigers",
      "expected": "Area contains 3 additional Harbingers"
    },
    {
      "original": "Harvests contain at least one Crop of Yellow Plants",
      "corrupted": "Harvest·s contain at least one Crop of Yellow Plants",
      "expected": "Harvests contain at least one Crop of Yellow Plants"
    },
    {
      "original": "Monsters and bosses invade from elsewhere in Wraeclast",
      "corrupted": "Monsters and bosses invade from elsewhere in Wraeclast",
      "expected": "Monsters and bosses invade from elsewhere in Wraeclast"
    },
    {
      "original": "Monsters near Shrines are Chilled",
      "corrupted": "Monsters near Shrines are Chilled",
      "expected": "Monsters near Shrines are Chilled"
    },
    {
      "original": "Players and Monsters fire # additional Projectiles",
      "corrupted": "Players and Monsters fire 2 additional Projectiles",
      "expected": "Players and Monsters fire 2 additional Projectiles"
    },
    {
      "original": "Non-Unique Equipment found in Area drops as Currency instead",
      "corrupted": "Non-Unique Equipment found in Area drops as Currency instead",
      "expected": "Non-Unique Equipment found in Area drops as Currency instead"
    },
    {
      "original": "Area contains #% increased number of Monster Markers",
      "corrupted": "Area contains 50% increased number of Monster Markers",
      "expected": "Area contains 50% increased number of Monster Markers"
    },
    {
      "original": "Izaro has #% reduced Area of Effect",
      "corrupted": "Izaro nas_28% reduced Areaof¨Etfect",
      "expected": "Izaro has 28% reduced Area of Effect"
    }
  ],
  "small3": [
    {
      "original": "Some Monsters guarding Shrines are Rare",
      "corrupted": "«Zome Monster gurding_Shrines @re Rare",
      "expected": "Some Monsters guarding Shrines are Rare"
    },
    {
      "original": "Delirium Reward Type: #",
      "corrupted": "Deli´rium Reward Type: Fossils",
      "expected": "Delirium Reward Type: Fossils"
    },
    {
      "original": "Area contains # additional Gloom Shrines",
      "corrupted": "Area conain 4 additiona¿l Gloom Shrines",
      "expected": "Area contains 4 additional Gloom Shrines"
    },
    {
      "original": "Synthesised Rare Monsters are resurrected as an Ally when slain",
      "corrupted": "Synthesised Rare Monsters are resurrected as an Ally when slain",
      "expected": "Synthesised Rare Monsters are resurrected as an Ally when slain"
    },
    {
      "original": "Monsters guarding Shrines are Magic",
      "corrupted": "Monsters guarding Shrines are Magic",
      "expected": "Monsters guarding Shrines are Magic"
    },
    {
      "original": "Items dropped by Rogue Exiles are Mirrored",
      "corrupted": "`Items dro¿pped by Rogue Exiles ae Mirrored",
      "expected": "Items dropped by Rogue Exiles are Mirrored"
    },
    {
      "original": "#% reduced number of Unique Crucible Monsters",
      "corrupted": "75% reduced number of Unique Crucible Monsters",
      "expected": "75% reduced number of Unique Crucible Monsters"
    },
    {
      "original": "Monsters with Silver Coins drop an additional Silver Coin",
      "corrupted": "Monsters with Silver Coins drop an additional Silver Coin",
      "expected": "Monsters with Silver Coins drop an additional Silver Coin"
    },
    {
      "original": "Area contains # additional Chest Markers",
      "corrupted": "Area contains 6 additional Chest Markers",
      "expected": "Area contains 6 additional Chest Markers"
    },
    {
      "original": "Rare and Unique Crucible Monsters drop a Ranged Weapon with a Crucible Passive Skill Tree",
      "corrupted": "Rare and Unique Crucible Monsters drop a Ranged Weapon with a Crucible Passive Skill Tree",
      "expected": "Rare and Unique Crucible Monsters drop a Ranged Weapon with a Crucible Passive Skill Tree"
    }
  ],
  "small4": [
    {
      "original": "Area contains many Totems",
      "corrupted": "area contains many totems",
      "expected": "Area contains many Totems"
    },
    {
      "original": "Players are Cursed with Enfeeble",
      "corrupted": "players are cursed with enfeeble",
      "expected": "Players are Cursed with Enfeeble"
    },
    {
      "original": "Monsters reflect #% of Physical Damage",
      "corrupted": "monsters reflect 19% of physical damage",
      "expected": "Monsters reflect 19% of Physical Damage"
    },
    {
      "original": "Area is inhabited by Cultists of Kitava",
      "corrupted": "area is inhabited by cultists of kitava",
      "expected": "Area is inhabited by Cultists of Kitava"
    },
    {
      "original": "Players have #% less Armour",
      "corrupted": "players have 33% less armour",
      "expected": "Players have 33% less Armour"
    },
    {
      "original": "Players have #% reduced Chance to Block",
      "corrupted": "players have 44% reduced chance to block",
      "expected": "Players have 44% reduced Chance to Block"
    },
    {
      "original": "#% increased Quantity of Items found in this Area",
      "corrupted": "83% increased quantity of items found in this area",
      "expected": "83% increased Quantity of Items found in this Area"
    },
    {
      "original": "#% increased Rarity of Items found in this Area",
      "corrupted": "37% increased rarity of items found in this area",
      "expected": "37% increased Rarity of Items found in this Area"
    },
    {
      "original": "#% increased Pack size",
      "corrupted": "24% increased pack size",
      "expected": "24% increased Pack size"
    }
  ],
  "medium1": [
    {
      "original": "Area is inhabited by ranged monsters",
      "corrupted": "›Area is nhbited by ranged monsters",
      "expected": "Area is inhabited by ranged monsters"
    },
    {
      "original": "Must successfully defend all Ichor Pumps in Area to claim Reward",
      "corrupted": "ust successfully defend all Ichor Pumps in Area to claim Reward",
      "expected": "Must successfully defend all Ichor Pumps in Area to claim Reward"
    },
    {
      "original": "Rare Scourge Monsters drop # additional Unique Item",
      "corrupted": "are Sourg~e Monsters drcp 1 ¯addtional Uniqu~e Item",
      "expected": "Rare Scourge Monsters drop 1 additional Unique Item"
    },
    {
      "original": "Invasion Bosses are guarded by a Magic Pack",
      "corrupted": "!nvasion Bósses are ¨guared¨ b›y a Magic Pack",
      "expected": "Invasion Bosses are guarded by a Magic Pack"
    },
    {
      "original": "Unique Bosses are possessed by Tormented Blasphemer",
      "corrupted": "Uniqe Bo$«ses are possessed by To¡rmented¯ Blasph‹emer",
      "expected": "Unique Bosses are possessed by Tormented Blasphemer"
    },
    {
      "original": "Area is inhabited by Lunaris fanatics",
      "corrupted": "Aea is inhabited by Lunari`s fanatics",
      "expected": "Area is inhabited by Lunaris fanatics"
    },
    {
      "original": "Area has # additional random Scarab effects",
      "corrupted": "Area has 3 additional random Scarab effects",
      "expected": "Area has 3 additional random Scarab effects"
    },
    {
      "original": "Area contains # additional Primal Harvest Bosses",
      "corrupted": "Area contains 2 additional Primal Harvest Bosses",
      "expected": "Area contains 2 additional Primal Harvest Bosses"
    },
    {
      "original": "Area is affected by # additional random Unallocated Notable Atlas Passives",
      "corrupted": "¨Area !s »affcte by 4 addifional rahdom n`allocated Notable-t¸las Pssives",
      "expected": "Area is affected by 4 additional random Unallocated Notable Atlas Passives"
    },
    {
      "original": "#% Monster Mana Leech Resistance",
      "corrupted": "65%Monster Mana Leech Resistance",
      "expected": "65% Monster Mana Leech Resistance"
    },
    {
      "original": "#% increased Monster Damage",
      "corrupted": "40% increased Monster Damage",
      "expected": "40% increased Monster Damage"
    },
    {
      "original": "Monsters gain # Endurance Charge every 20 seconds",
      "corrupted": "Monsters gain 1 Endurance Charge every 20 seconds",
      "expected": "Monsters gain 1 Endurance Charge every 20 seconds"
    },
    {
      "original": "#% more Rogue's Marker value of primary Heist Target",
      "corrupted": "15%› more Rôgue's Marker value of primary Heist Target",
      "expected": "15% more Rogue's Marker value of primary Heist Target"
    },
    {
      "original": "Players' Minions have #% more Cast Speed",
      "corrupted": "Players' Minions have 25% more Cast Speed",
      "expected": "Players' Minions have 25% more Cast Speed"
    },
    {
      "original": "Area contains a Breach",
      "corrupted": "Area contains a Breach",
      "expected": "Area contains a Breach"
    },
    {
      "original": "Area contains a Bearers of the Guardian Bloodline Pack",
      "corrupted": "Area c0ntins  Be@rers of thê¡_Guardian Bloodlin`e ´ack",
      "expected": "Area contains a Bearers of the Guardian Bloodline Pack"
    },
    {
      "original": "Area contains a Rogue Exile",
      "corrupted": "Areacotains¸ a Rogue Ex¦ile",
      "expected": "Area contains a Rogue Exile"
    },
    {
      "original": "# Monsters in this Area will summon Abaxoth when Slain",
      "corrupted": "8 Monsters in this Area will summon Abaxoth when Slain",
      "expected": "8 Monsters in this Area will summon Abaxoth when Slain"
    },
    {
      "original": "Players deal #% more Damage per Equipped Item",
      "corrupted": "Players deal 2% more Damage per Equipped Item",
      "expected": "Players deal 2% more Damage per Equipped Item"
    },
    {
      "original": "Monsters gain # Frenzy Charge every 20 seconds",
      "corrupted": "Monsters_gain 1 Frenzy Charge every 20 seconds",
      "expected": "Monsters gain 1 Frenzy Charge every 20 seconds"
    }
  ],
  "medium2": [
    {
      "original": "Harbingers have a #% chance to be replaced by a powerful Harbinger boss",
      "corrupted": "arbingers have a 2% chance to be reqla¯ced by a powerful Harbinger boss",
      "expected": "Harbingers have a 2% chance to be replaced by a powerful Harbinger boss"
    },
    {
      "original": "[DNT] Area contains # additional Epic Chest Marker",
      "corrupted": "@DNT@_Area contains 4 aditional Epic Chest Marker",
      "expected": "[DNT] Area contains 4 additional Epic Chest Marker"
    },
    {
      "original": "Synthesised Rare Monsters have #% chance to drop a Talisman",
      "corrupted": "ynthe¸sized Rare Mon`st~ers have 2 chance to ðop~ a Talisman",
      "expected": "Synthesised Rare Monsters have 2% chance to drop a Talisman"
    },
    {
      "original": "Players and Monsters have #% reduced Critical Strike Chance",
      "corrupted": "Players and Mon$ters_have 12%redueéd Critical¯ Strike Çþance",
      "expected": "Players and Monsters have 12% reduced Critical Strike Chance"
    },
    {
      "original": "Abysses in Area spawn #% increased Monsters",
      "corrupted": "Abysss in Area spawn 18% ¨increased Monsters",
      "expected": "Abysses in Area spawn 18% increased Monsters"
    },
    {
      "original": "Area is Repulsive",
      "corrupted": "Area is Re°rulsive",
      "expected": "Area is Repulsive"
    },
    {
      "original": "Area contains # Invasion Bosses",
      "corrupted": "Area contains¯ 30 Invazion 6o5zes",
      "expected": "Area contains 30 Invasion Bosses"
    },
    {
      "original": "Scarabs dropped in Area have #% increased chance to be Incursion Scarabs",
      "corrupted": "Scarabs droppd.in Area hvë 22% inc´reased chance t¯o be Incurion Scarab»s",
      "expected": "Scarabs dropped in Area have 22% increased chance to be Incursion Scarabs"
    },
    {
      "original": "Players are assaulted by apparitions of The Shaper",
      "corrupted": "Plaers are azsaulted ›by apparitions of The Shàp¦er",
      "expected": "Players are assaulted by apparitions of The Shaper"
    },
    {
      "original": "Players fire {1} additional Projectiles",
      "corrupted": "Players fire 1 additional Projectiles",
      "expected": "Players fire 1 additional Projectiles"
    },
    {
      "original": "#% increased chance for Strongboxes in Area to be Unique",
      "corrupted": "6% increas»ed chance fr °Stiong´boxes ~in Ar3a to be Uni0e",
      "expected": "6% increased chance for Strongboxes in Area to be Unique"
    },
    {
      "original": "Monsters cannot be Taunted",
      "corrupted": "Monsters cannot be Taunted",
      "expected": "Monsters cannot be Taunted"
    },
    {
      "original": "#% increased Rarity of Items found in Nightmare",
      "corrupted": "23% increased Rarity of Items found in Nightmare",
      "expected": "23% increased Rarity of Items found in Nightmare"
    },
    {
      "original": "# Monsters in this Area will summon a Unique Monster from Beyond when Slain",
      "corrupted": "42 Monsters in this Area will summon a Unique Monster from Beyond when Slain",
      "expected": "42 Monsters in this Area will summon a Unique Monster from Beyond when Slain"
    },
    {
      "original": "Players in Area are #% Delirious",
      "corrupted": "Players in Ar·ea are 2X¨ Delirious",
      "expected": "Players in Area are 2% Delirious"
    },
    {
      "original": "Nemesis Monsters drop # additional Basic Currency Item",
      "corrupted": "Nemesis Monsters drop 5 additional Basic Currency Item",
      "expected": "Nemesis Monsters drop 5 additional Basic Currency Item"
    },
    {
      "original": "Ultimatum Rewards in your Maps have #% reduced chance to be Delirium Items",
      "corrupted": "Ulimatum Rewards in your Maps have 2% reduced c‹hance to be Deliorium Items",
      "expected": "Ultimatum Rewards in your Maps have 2% reduced chance to be Delirium Items"
    },
    {
      "original": "Area is inhabited by Solaris fanatics",
      "corrupted": "Area is inhabited by Solaris fanatics",
      "expected": "Area is inhabited by Solaris fanatics"
    },
    {
      "original": "Unique Bosses are possessed by Tormented Smuggler",
      "corrupted": "Unique Bosses are possessed by Tormented Smuggler",
      "expected": "Unique Bosses are possessed by Tormented Smuggler"
    },
    {
      "original": "Players and Monsters take #% increased Fire Damage",
      "corrupted": "Flayers and Mnsters 1ake 6% increased F!re Damage",
      "expected": "Players and Monsters take 6% increased Fire Damage"
    },
    {
      "original": "Area contains a Perandus Chest",
      "corrupted": "‹Area-contains áPerandus Cezt",
      "expected": "Area contains a Perandus Chest"
    },
    {
      "original": "Area contains # additional packs of Frogs",
      "corrupted": "Area ontains 2 adi°tional packs ot» Frogs",
      "expected": "Area contains 2 additional packs of Frogs"
    },
    {
      "original": "Area contains a Gemcutter's Strongbox",
      "corrupted": "Area contains a Gemcutter's Strongbox",
      "expected": "Area contains a Gemcutter's Strongbox"
    },
    {
      "original": "#% chance for Maps Tier 14 and above found in Area to drop as Elder Guardian Maps instead",
      "corrupted": "12% chance for Maps Tier 14 and above found in Area to drop as Elder Guardian Maps instead",
      "expected": "12% chance for Maps Tier 14 and above found in Area to drop as Elder Guardian Maps instead"
    },
    {
      "original": "Area contains # additional Clusters of Highly Volatile Barrels",
      "corrupted": "Area contains 52 adoitionl Clu¡zters of Highly Volâtile Barrels",
      "expected": "Area contains 52 additional Clusters of Highly Volatile Barrels"
    },
    {
      "original": "Players have Point Blank",
      "corrupted": "Players have Point Blank",
      "expected": "Players have Point Blank"
    },
    {
      "original": "Rare Scourge Monsters drop items # levels higher",
      "corrupted": "Rare Scourge Nonsters drop items ¸2 levels higher",
      "expected": "Rare Scourge Monsters drop items 2 levels higher"
    },
    {
      "original": "Oils found in Area have #% chance to be 1 tier higher",
      "corrupted": "Oils found_in @r¦ea have2% ch@nce t3o be.1 tier higen",
      "expected": "Oils found in Area have 2% chance to be 1 tier higher"
    },
    {
      "original": "Synthesised Rare Monsters drop an Elder Item",
      "corrupted": "Synthesised Rare Monsters drop an Elder Item",
      "expected": "Synthesised Rare Monsters drop an Elder Item"
    },
    {
      "original": "#% Monster Energy Shield Leech Resistance",
      "corrupted": "35% Monster Energy Shield Leech Resistance",
      "expected": "35% Monster Energy Shield Leech Resistance"
    }
  ],
  "large1": [
    {
      "original": "#% less Unique Items found from Beyond Demons in your Maps\\nthat are followers of Ghorr",
      "corrupted": "11% less Uniqe Items foun`d from Beyond Demos in your Maps\\nthat are ƒollowers qf Ghorr",
      "expected": "11% less Unique Items found from Beyond Demons in your Maps\\nthat are followers of Ghorr"
    },
    {
      "original": "Area contains # additional Smuggler's Caches",
      "corrupted": "´Anea contains.45 additional Smüggler3$ Caches",
      "expected": "Area contains 45 additional Smuggler's Caches"
    },
    {
      "original": "Players and Monsters take #% reduced Chaos Damage",
      "corrupted": "¦P›layers and¡ Monsiers take »3% reducedChaos D@mage",
      "expected": "Players and Monsters take 3% reduced Chaos Damage"
    },
    {
      "original": "Area contains additional waves of Bone Rhoas",
      "corrupted": "rêa contains additional waves of Bone Rhoas",
      "expected": "Area contains additional waves of Bone Rhoas"
    },
    {
      "original": "Debuffs on Monsters expire #% faster",
      "corrupted": "Deuffs on« Monsters« exie 2% faster",
      "expected": "Debuffs on Monsters expire 2% faster"
    },
    {
      "original": "Area contains an Avatar of Nemesis",
      "corrupted": "Area cntains an A›vatar of Nemesis",
      "expected": "Area contains an Avatar of Nemesis"
    },
    {
      "original": "Area is always alluringly Alluring",
      "corrupted": "Area is alw`ays allurin¸gly Allurin",
      "expected": "Area is always alluringly Alluring"
    },
    {
      "original": "Area contains #% increased number of Remnants",
      "corrupted": "°Area contins 50% increased number of Remnats",
      "expected": "Area contains 50% increased number of Remnants"
    },
    {
      "original": "#% reduced Effect of Curses on Monsters",
      "corrupted": "28% reduced Effeç¯t` of Curses on Monsters",
      "expected": "28% reduced Effect of Curses on Monsters"
    },
    {
      "original": "Rare Scourge Monsters drop # additional Blight Oils",
      "corrupted": "Rare Scourge M~onsters drop 4 additional Blight Oils",
      "expected": "Rare Scourge Monsters drop 4 additional Blight Oils"
    },
    {
      "original": "Labyrinth Monsters have #% increased maximum Life",
      "corrupted": "Labyrinth Monsters have 75% incrëased maximum Lif",
      "expected": "Labyrinth Monsters have 75% increased maximum Life"
    },
    {
      "original": "Perandus Chests have #% more Quantity of Items Dropped",
      "corrupted": "Perandus Chests have 6 more Quantity of Items Oropped",
      "expected": "Perandus Chests have 6% more Quantity of Items Dropped"
    },
    {
      "original": "Area contains an additional Perandus Jewellery Box",
      "corrupted": "Area contains an additional Perandus Jewellery Box",
      "expected": "Area contains an additional Perandus Jewellery Box"
    },
    {
      "original": "Players have #% reduced Maximum total Life, Mana and Energy Shield Recovery per second from Leech",
      "corrupted": "Players have 1% reduced Maximum total Life, Mana and Energy Shield Recovery per second from Leech",
      "expected": "Players have 1% reduced Maximum total Life, Mana and Energy Shield Recovery per second from Leech"
    },
    {
      "original": "Monster Damage penetrates #% of Cold Resistance",
      "corrupted": "Monster Damage penetra¡te$ 3% of Cold Resistance",
      "expected": "Monster Damage penetrates 3% of Cold Resistance"
    },
    {
      "original": "Area contains # additional packs with Mirrored Rare Monsters",
      "corrupted": "Area contains 2 additional packs with Mirrored Rare Monsters",
      "expected": "Area contains 2 additional packs with Mirrored Rare Monsters"
    },
    {
      "original": "Area contains an additional Primal Harvest Boss",
      "corrupted": "Area contains an additional Primal Harvest Boss",
      "expected": "Area contains an additional Primal Harvest Boss"
    },
    {
      "original": "#% chance for Map Drops to be Duplicated",
      "corrupted": "4% c`hance for Map Drops to be Duplicated",
      "expected": "4% chance for Map Drops to be Duplicated"
    },
    {
      "original": "#% increased Rarity of Items Dropped by Synthesised Monsters",
      "corrupted": "65% inreased Rrity of› Iems Dropped by Synthes~ised Monster",
      "expected": "65% increased Rarity of Items Dropped by Synthesised Monsters"
    },
    {
      "original": "Area is alluringly Repulsive",
      "corrupted": "Area is alluringly Repulsive",
      "expected": "Area is alluringly Repulsive"
    },
    {
      "original": "Area contains a Silver Coin",
      "corrupted": "Area contains a Silver Coin",
      "expected": "Area contains a Silver Coin"
    },
    {
      "original": "Area is always Repulsive",
      "corrupted": "Area is always Repulsive",
      "expected": "Area is always Repulsive"
    },
    {
      "original": "Warbands in the Area have an additional Support Member",
      "corrupted": "Warbands in the Area have an additional Support Member",
      "expected": "Warbands in the Area have an additional Support Member"
    },
    {
      "original": "Players have #% increased Cost of Skills for each Skill they've used Recently",
      "corrupted": "Players have 40% increased Cost of Skills for each Skill theý've used Recently",
      "expected": "Players have 40% increased Cost of Skills for each Skill they've used Recently"
    },
    {
      "original": "Players are Cursed with Vulnerability",
      "corrupted": "Players are Curzed with Vulnerábilit",
      "expected": "Players are Cursed with Vulnerability"
    },
    {
      "original": "Weapons and Shields found have #% chance to have the maximum number of Sockets",
      "corrupted": "Weapons and Shields found have 1% chance to have the maximum number of Sockets",
      "expected": "Weapons and Shields found have 1% chance to have the maximum number of Sockets"
    },
    {
      "original": "#% increased number of Unique Crucible Monsters",
      "corrupted": "20% increasêd¿ nurnber ot Uniqu Cruoible Monsteis",
      "expected": "20% increased number of Unique Crucible Monsters"
    },
    {
      "original": "Area is always extremely Repulsive",
      "corrupted": "Area is always extree´ly P·epu¨l$ive",
      "expected": "Area is always extremely Repulsive"
    },
    {
      "original": "Monsters Overwhelm #% Physical Damage Reduction",
      "corrupted": "Monsters Overwhelm 14% Physical Damage Reduction",
      "expected": "Monsters Overwhelm 14% Physical Damage Reduction"
    },
    {
      "original": "Ultimatum Stone Circles in your Maps have #% reduced radius",
      "corrupted": "Ultimatum Stone Crcles in your Maps have 16% reduced radius",
      "expected": "Ultimatum Stone Circles in your Maps have 16% reduced radius"
    },
    {
      "original": "Map owner gains #% more Sulphite",
      "corrupted": "Map owner gains 42%¸ more Sulphite",
      "expected": "Map owner gains 42% more Sulphite"
    },
    {
      "original": "Monsters Imprisoned by a Shrieking Essence will be Duplicated when released",
      "corrupted": "Monstèrs Impris¸oned_bya Shrieking Esence will be Duplicated whn released",
      "expected": "Monsters Imprisoned by a Shrieking Essence will be Duplicated when released"
    },
    {
      "original": "Area contains an additional Perandus Locker",
      "corrupted": "Area contains an additional Perandus Locker",
      "expected": "Area contains an additional Perandus Locker"
    },
    {
      "original": "Unique Bosses are possessed by Tormented Martyr",
      "corrupted": "Unique Bosses re possessed by Tormented Mart´yr",
      "expected": "Unique Bosses are possessed by Tormented Martyr"
    },
    {
      "original": "Players have #% reduced Chance to Block",
      "corrupted": "Players have 9% reduced Chance to Block",
      "expected": "Players have 9% reduced Chance to Block"
    },
    {
      "original": "Slaying Enemies has a #% reduced chance to spawn a Beyond Portal",
      "corrupted": "Slaying Enemies has a 5% reduced chance to spawn a Beyond Portal",
      "expected": "Slaying Enemies has a 5% reduced chance to spawn a Beyond Portal"
    },
    {
      "original": "Area contains two Unique Bosses",
      "corrupted": "Area contains two Unique Bosses",
      "expected": "Area contains two Unique Bosses"
    },
    {
      "original": "Unique Monsters have #% increased Maximum Life",
      "corrupted": "Unique Monsters h¸ave 80% increased Maximum Life",
      "expected": "Unique Monsters have 80% increased Maximum Life"
    },
    {
      "original": "Player Skills which Throw Traps throw up to # additional Traps",
      "corrupted": "P¿layer Skills which Thrw Traps throw up to 35 additìonal »Trap›s",
      "expected": "Player Skills which Throw Traps throw up to 35 additional Traps"
    },
    {
      "original": "Delirium Monsters in Area have #% reduced Pack Size",
      "corrupted": "Delirium Wonsters in Area have 7% reduced Pck Size",
      "expected": "Delirium Monsters in Area have 7% reduced Pack Size"
    }
  ]
};
