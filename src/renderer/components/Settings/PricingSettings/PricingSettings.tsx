import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Stack from '@mui/material/Stack';
import React from 'react';
import { electronService } from '../../../electron.service';
import Autocomplete  from '@mui/material/Autocomplete';
const { logger, ipcRenderer } = electronService;

const PricingSettings = ({ settings }) => {
  const [minimumValue, setMinimumValue] = React.useState(
    settings?.pricing?.minimumValue ?? 0
  );
  const [filterPatterns, setFilterPatterns] = React.useState(
    settings?.pricing?.filterPatterns ?? []
  );
  const handleUpdateMinimumValue = async (e) => {
    const newPrice = e.target.value;
    logger.info('Updating minimum price to', newPrice);
    setMinimumValue(newPrice);
  };
  const handleUpdateFilterPatterns = async (e, newValue) => {
    logger.info('DONE', e.target.value);
    logger.info('Updating filter patterns to', e, newValue);
    setFilterPatterns(newValue);
  };


  const handleSaveSettings = async () => {
    logger.info('Saving settings');
    ipcRenderer.invoke('save-settings:pricing', { minimumValue, filterPatterns });
  };

  return (
    <div className='Pricing-Settings'>
      <div className="Pricing-Settings__Settings-Form">
        <Stack gap={5} justifyContent="center">
          <TextField
            size="small"
            type="number"
            label="Do not price items below this value (in chaos)"
            value={minimumValue}
            onChange={handleUpdateMinimumValue}
          />
          <Autocomplete
            multiple
            freeSolo
            clearOnBlur
            clearOnEscape
            filterSelectedOptions
            value={filterPatterns}
            onChange={handleUpdateFilterPatterns}
            options={filterPatterns}
            renderInput={(params) => <TextField {...params} label="Filter out items with these pattern in their name (Not Case Sensitive)" size="small" />}
            // limitTags={2}
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