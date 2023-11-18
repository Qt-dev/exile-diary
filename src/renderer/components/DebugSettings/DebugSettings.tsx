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
import './DebugSettings.css';
const { logger } = electronService;

const { ipcRenderer } = electronService;

const DebugSettings = ({ runStore }) => {
  const now = dayjs();
  const [reCalculateProfitStart, setReCalculateProfitStart] = React.useState<Dayjs | null>(now);
  const [reCalculateProfitEnd, setReCalculateProfitEnd] = React.useState<Dayjs | null>(now);
  const [isFetchingRates, setIsFetchingRates] = React.useState(false);
  const [isRecalculatingProfit, setIsRecalculatingProfit] = React.useState(false);
  const [isFetchingStashTabs, setIsFetchingStashTabs] = React.useState(false);
  const handleReCalculateProfit = async () => {
    setIsRecalculatingProfit(true);
    await ipcRenderer.invoke('debug:recheck-gain', {
      from: reCalculateProfitStart?.format('YYYYMMDD'),
      to: reCalculateProfitEnd?.format('YYYYMMDD'),
    });
    await runStore.loadRuns();
    setIsRecalculatingProfit(false);
  };

  const handleFetchRates = async () => {
    setIsFetchingRates(true);
    await ipcRenderer.invoke('debug:fetch-rates');
    setIsFetchingRates(false);
  };

  const handleFetchStashTabs = async () => {
    setIsFetchingStashTabs(true);
    await ipcRenderer.invoke('debug:fetch-stash-tabs');
    setIsFetchingStashTabs(false);
  };

  return (
    <div className="Debug-Settings">
      <h3 className="Debug-Settings__Header">Pricing and Debugging options.</h3>
      <Divider sx={{ width: '50%', margin: '20px auto' }} />
      <div className="Debug-Settings__Header">
        Recalculate Loot Price and Map Profit using rates for that day
      </div>
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
          <Button
            disabled={isRecalculatingProfit}
            endIcon={isRecalculatingProfit ? <CircularProgress size="0.8rem" /> : null}
            onClick={handleReCalculateProfit}
          >
            Recalculate
          </Button>
        </ButtonGroup>
      </Stack>
      <Divider variant="middle" sx={{ width: '50%', margin: '20px auto' }} />
      <div className="Debug-Settings__Header">Fetch Today's poe.ninja rates again</div>
      <Stack direction="row" gap={5} justifyContent="center">
        <ButtonGroup variant="outlined">
          <Button
            disabled={isFetchingRates}
            endIcon={isFetchingRates ? <CircularProgress size="0.8rem" /> : null}
            onClick={handleFetchRates}
          >
            Fetch Rates
          </Button>
        </ButtonGroup>
      </Stack>
      <Divider variant="middle" sx={{ width: '50%', margin: '20px auto' }} />
      <div className="Debug-Settings__Header">
        Fetch all stash tabs from the GGG API. This takes a while, and is rate limited.
        <br />
        Do not trigger this too fast or you will get rate limited and will not be able to fetch
        stash tabs for a while (5 minutes minimum)
      </div>
      <Stack direction="row" gap={5} justifyContent="center">
        <ButtonGroup variant="outlined">
          <Button
            disabled={isFetchingStashTabs}
            endIcon={isFetchingStashTabs ? <CircularProgress size="0.8rem" /> : null}
            onClick={handleFetchStashTabs}
          >
            Fetch Stash Tabs
          </Button>
        </ButtonGroup>
      </Stack>
    </div>
  );
};

export default DebugSettings;
