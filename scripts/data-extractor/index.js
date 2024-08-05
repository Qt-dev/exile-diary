const config = require('./config.json');
const fs = require('fs');
const { generateItems } = require('./items.js');
const latestVersionURL = 'https://raw.githubusercontent.com/poe-tool-dev/latest-patch-version/main/latest.txt';
const ItemsJsonPath = '../../src/helpers/data/items.json';

// Update the latest version in the config.json file
async function updateConfigPatchNumber() {
  const response = await fetch(latestVersionURL);
  const latestVersion = await response.text();
  console.log(`Latest version is ${latestVersion} - Updating config.json`);

  config.patch = latestVersion;
  fs.writeFileSync('./config.json', JSON.stringify(config, null, 2));
  console.log('config.json updated');
}

const order = process.argv[2];
switch(order) {
  case 'items':
    console.log('Generating items.json');
    const items = generateItems();
    fs.writeFileSync(ItemsJsonPath, JSON.stringify(items, null, 2));
    console.log('items.json generated');
    break;
  case 'update':
    console.log('Updating config.json with the latest patch number');
    updateConfigPatchNumber();
    break;
  default:
    console.log('Invalid order');
}