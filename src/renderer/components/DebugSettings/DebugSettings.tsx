import React from 'react';
import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import { electronService } from '../../electron.service';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs, { Dayjs } from 'dayjs';
import Stack from '@mui/material/Stack';

const { ipcRenderer } = electronService;

const DebugSettings = ({ runStore }) => {
  const now = dayjs();
  const [reCalculateProfitStart, setReCalculateProfitStart] = React.useState<Dayjs | null>(now);
  const [reCalculateProfitEnd, setReCalculateProfitEnd] = React.useState<Dayjs | null>(now);
  const handleReCalculateProfit = async () => {
    await ipcRenderer.invoke('debug:recheck-gain', { from: reCalculateProfitStart?.format('YYYYMMDD'), to: reCalculateProfitEnd?.format('YYYYMMDD') });
    runStore.loadRuns();
  };

  return (
    <div>
      <h1>Debug Settings</h1>
      <Stack direction="row" gap={5}>
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
        <ButtonGroup variant="outlined" aria-label="Debug">
          <Button onClick={handleReCalculateProfit}>Recalculate Profit</Button>
        </ButtonGroup>
      </Stack>
    </div>
  );
};

export default DebugSettings;