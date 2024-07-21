import TextField from '@mui/material/TextField';
import Stack from '@mui/material/Stack';
import React from 'react';
import { electronService } from '../../../electron.service';
import Autocomplete  from '@mui/material/Autocomplete';
import FormControl from '@mui/material/FormControl';
import { observer } from 'mobx-react-lite';
import './PricingFilterSettings.css';
const { logger } = electronService;

const PricingFilterSettings = ({ settings, updateCallback }) => {
  const { minimumValue = 0, filterPatterns = [] } = settings;
  const handleUpdateMinimumValue = async (e) => {
    const newPrice = e.target.value;
    logger.info('Updating minimum price to', newPrice);
    updateCallback({ minimumValue: newPrice, filterPatterns });
  };
  const handleUpdateFilterPatterns = async (e, newValue) => {
    logger.info('Updating filter patterns to', newValue);
    updateCallback({ minimumValue, filterPatterns: newValue });
  };

  return (
    <div className='Pricing-Filter-Settings'>
      <FormControl className="Pricing-Filter-Settings__Settings-Form" fullWidth>
        <Stack gap={5} direction={'row'} justifyContent="space-evenly" className='Pricing-Filter-Settings__Form-Fields'>
          <TextField
            size="small"
            fullWidth
            type="number"
            label="Ignore items below this value (in chaos)"
            value={minimumValue}
            onChange={handleUpdateMinimumValue}
          />
          <Autocomplete
            fullWidth
            size="small"
            multiple
            freeSolo
            clearOnBlur
            clearOnEscape
            filterSelectedOptions
            value={filterPatterns}
            onChange={handleUpdateFilterPatterns}
            options={filterPatterns}
            renderInput={(params) => <TextField {...params} label="Ignore items with these pattern in their name (Not Case Sensitive)" size="small" />}
            // limitTags={2}
          />
        </Stack>
      </FormControl>
    </div>
  );
};

export default observer(PricingFilterSettings);