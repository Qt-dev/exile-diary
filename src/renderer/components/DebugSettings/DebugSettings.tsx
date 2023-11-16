import React from 'react';
import Divider from '@mui/material/Divider';
import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import CircularProgress from '@mui/material/CircularProgress';
import { electronService } from '../../electron.service';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs, { Dayjs } from 'dayjs';
import Stack from '@mui/material/Stack';
const { logger } = electronService;

const { ipcRenderer } = electronService;

const DebugSettings = ({ runStore }) => {
  const now = dayjs();
  const [reCalculateProfitStart, setReCalculateProfitStart] = React.useState<Dayjs | null>(now);
  const [reCalculateProfitEnd, setReCalculateProfitEnd] = React.useState<Dayjs | null>(now);
  const [isFetchingRates, setIsFetchingRates] = React.useState(false);
  const handleReCalculateProfit = async () => {
    await ipcRenderer.invoke('debug:recheck-gain', { from: reCalculateProfitStart?.format('YYYYMMDD'), to: reCalculateProfitEnd?.format('YYYYMMDD') });
    runStore.loadRuns();
  };

  const handleRefetchRates = async () => {
    setIsFetchingRates(true);
    await ipcRenderer.invoke('debug:refetch-rates');
    setIsFetchingRates(false);
  };

  return (
    <div>
      <h1>Debug Settings</h1>
      <Stack direction="row" gap={5} justifyContent="center">
        <LocalizationProvider dateAdapter={AdapterDayjs}>
          <DatePicker
            label="From"
            value={reCalculateProfitStart}
            slotProps={{ textField: { size: 'small' } }}
            maxDate={now}
            onChange={(newValue) => setReCalculateProfitStart(newValue)}
          />
        </LocalizationProvider>
        <LocalizationProvider dateAdapter={AdapterDayjs}>
          <DatePicker
            label="To"
            value={reCalculateProfitEnd}
            slotProps={{ textField: { size: 'small' } }}
            maxDate={now}
            onChange={(newValue) => setReCalculateProfitEnd(newValue)}
          />
        </LocalizationProvider>
        <ButtonGroup variant="outlined">
          <Button onClick={handleReCalculateProfit}>Recalculate Profit</Button>
        </ButtonGroup>
      </Stack>
      <Divider variant="middle" sx={{width: '50%', margin: '20px auto'}} />
      <Stack direction="row" gap={5} justifyContent="center">
        <ButtonGroup variant="outlined">
          <Button disabled={isFetchingRates} endIcon={isFetchingRates ? <CircularProgress size='0.8rem' /> : null}onClick={handleRefetchRates}>Re-Fetch Today's poe.ninja rates</Button>
        </ButtonGroup>
      </Stack>
    </div>
  );
};

export default DebugSettings;