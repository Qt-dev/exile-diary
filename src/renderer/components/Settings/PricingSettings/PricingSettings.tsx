import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Stack from '@mui/material/Stack';
import React from 'react';
import { electronService } from '../../../electron.service';
const { logger, ipcRenderer } = electronService;

const PricingSettings = ({ settings }) => {
  const [minimumValue, setMinimumValue] = React.useState(
    settings?.pricing?.minimumValue ?? 0
  );
  const handleUpdateMinimumValue = async (e) => {
    const newPrice = e.target.value;
    logger.info('Updating minimum price to', newPrice);
    setMinimumValue(newPrice);
  }
  const handleSaveSettings = async () => {
    logger.info('Saving settings');
    ipcRenderer.invoke('save-settings:pricing', { minimumValue });
  };

  return (
    <div className='Pricing-Settings'>
      <div className="Stash-Settings__Settings-Form">
        <Stack gap={5} justifyContent="center">
          <TextField
            size="small"
            type="number"
            label="Do not price items below this value (in chaos)"
            value={minimumValue}
            onChange={handleUpdateMinimumValue}
          />
          <TextField
            size="small"
            type="number"
            label="Filter out items with these pattern in their name - FUTURE"
            value={0}
            onChange={() => {}}
          />
          <TextField
            size="small"
            type="number"
            label="Specific items to filter out - FUTURE"
            value={0}
            onChange={() => {}}
          />
        </Stack>
        <Button variant="outlined" onClick={handleSaveSettings}>
          Save
        </Button>
      </div>
    </div>
  );
};

export default PricingSettings;