/**
 * electron-builder afterPack hook
 * This script runs after the app is packed but before it's built into an installer/portable exe
 * For portable builds, we create a marker file to indicate portable mode
 */

const fs = require('fs');
const path = require('path');

exports.default = async function(context) {
  const { packager, electronPlatformName, appOutDir, targets } = context;

  console.log('AfterPack hook running...');
  console.log('Platform:', electronPlatformName);
  console.log('Targets:', targets.map(t => t.name).join(', '));

  // Check if we're building a zip target (which we use for portable)
  const isPortableTarget = targets.some(target => target.name === 'zip');

  if (isPortableTarget) {
    console.log('Zip target detected - creating portable marker file');

    // Create a marker file in the resources directory
    // appOutDir is the unpacked app directory (e.g., win-unpacked)
    // We need to put the marker in the resources folder
    const resourcesDir = path.join(appOutDir, 'resources');
    const markerPath = path.join(resourcesDir, 'portable');

    try {
      // Ensure resources directory exists
      if (!fs.existsSync(resourcesDir)) {
        fs.mkdirSync(resourcesDir, { recursive: true });
      }

      fs.writeFileSync(
        markerPath,
        'This file indicates the app should run in portable mode.\n' +
        'All data will be stored in the "exile-data" folder next to the executable.\n' +
        'This marker is read from process.resourcesPath at runtime.'
      );
      console.log('✓ Portable marker file created:', markerPath);
    } catch (error) {
      console.error('✗ Failed to create portable marker:', error);
      throw error;
    }
  } else {
    console.log('Not a portable target - skipping marker creation');
  }

  console.log('AfterPack hook completed');
};
