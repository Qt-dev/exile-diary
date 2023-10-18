import React from 'react';
import './DataSearchResults.css';
import LootTable from '../LootTable/LootTable';
import ChaosIcon from '../../assets/img/c.png';
import { observer } from 'mobx-react-lite';
import { Box, Divider, Stack, Typography } from '@mui/material';
import { styled } from '@mui/material/styles'
import MuiAccordionSummary, {
  AccordionSummaryProps,
} from '@mui/material/AccordionSummary';
import MuiAccordion, { AccordionProps } from '@mui/material/Accordion';
import MuiAccordionDetails from '@mui/material/AccordionDetails';
import RunList from '../../routes/RunList';
import ArrowForwardIosSharpIcon from '@mui/icons-material/ArrowForwardIosSharp';
import moment from 'moment';
import momentDurationFormatSetup from "moment-duration-format-commonjs";
momentDurationFormatSetup(moment);
const Accordion = styled((props: AccordionProps) => (
  <MuiAccordion elevation={0} square {...props} />
))(({ theme }) => ({
  border: `1px solid ${theme.palette.divider}`,
  '&:before': {
    display: 'none',
  },
}));

const AccordionSummary = styled((props: AccordionSummaryProps) => (
  <MuiAccordionSummary
    expandIcon={<ArrowForwardIosSharpIcon sx={{ fontSize: '0.9rem' }} />}
    {...props}
  />
))(({ theme }) => ({
  backgroundColor:
    theme.palette.mode === 'dark'
      ? 'rgba(255, 255, 255, .05)'
      : 'rgba(0, 0, 0, .03)',
  flexDirection: 'row-reverse',
  '&.MuiAccordionSummary-root.Mui-expanded': {
    minHeight: '0px',
  },
  '& .MuiAccordionSummary-expandIconWrapper.Mui-expanded': {
    transform: 'rotate(90deg)',
  },
  '& .MuiAccordionSummary-content.Mui-expanded': {
    margin: theme.spacing(1),
  },
  '& .MuiAccordionSummary-content': {
    marginLeft: theme.spacing(1),
    margin: theme.spacing(1),
  },
}));

const AccordionDetails = styled(MuiAccordionDetails)(({ theme }) => ({
  padding: theme.spacing(2),
  borderTop: '1px solid rgba(0, 0, 0, .125)',
}));

const DataSearchResults = ({ itemStore, runStore }) => {
  const [ expanded, setExpanded ] = React.useState<(string | false)[]>(['panel 1']);
  const handleTabChange = (panel: string) => {
    return (event: React.SyntheticEvent, isExpanded: boolean) => {
      const newExpanded = [...expanded];
      if(isExpanded && newExpanded.indexOf(panel) === -1) {
        newExpanded.push(panel);
      }
      if(!isExpanded) {
        newExpanded.splice(newExpanded.indexOf(panel), 1);
      } 
      setExpanded(newExpanded);
    };
  }
  return (
    <div className="DataSearchResults">
      <Accordion expanded={expanded.includes('panel 1')} onChange={handleTabChange('panel 1')}>
        <AccordionSummary>
          <Typography variant="button">Stats</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={2} direction="row" justifyContent="space-evenly">
            <div className="Main_Stat__Column">
              <div className="DataSearchResults__Stat">Number of items looted: {itemStore.stats.items.count}</div>
              <div className="DataSearchResults__Stat">Total Value of items found: {itemStore.stats.value.total}<img className="Stat__Chaos-Icon" src={ChaosIcon} alt="profit" /></div>
              <div className="DataSearchResults__Stat">Average Value of value items: {itemStore.stats.value.average}<img className="Stat__Chaos-Icon" src={ChaosIcon} alt="profit" /></div>
            </div>
            <div className="Main_Stat__Column">
              <div className="DataSearchResults__Stat">Number of runs: {runStore.stats.count}</div>
              <div className="DataSearchResults__Stat">Total time spent: {runStore.stats.time.total.format()}</div>
              <div className="DataSearchResults__Stat">Average time spent per run: {runStore.stats.time.average.format()}</div>
              <div className="DataSearchResults__Stat">Average profit per run: {runStore.stats.profit.average}<img className="Stat__Chaos-Icon" src={ChaosIcon} alt="profit" /></div>
            </div>
          </Stack>
        </AccordionDetails>
      </Accordion>
      <Accordion expanded={expanded.includes('panel 2')} onChange={handleTabChange('panel 2')}>
        <AccordionSummary>
          <Typography className="Stat__Summary">Loot ({itemStore.stats.value.total}<img className="Stat__Chaos-Icon" src={ChaosIcon} alt="profit" />)</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={{ marginBottom: 5 }}>
            <Stack spacing={2} direction="row" justifyContent="space-evenly">
              <Box sx={{width: '100%'}}>
                <LootTable profit={itemStore.stats.value.total} store={itemStore} />
              </Box>
            </Stack>
          </Box>
        </AccordionDetails>
      </Accordion>
      <Accordion expanded={expanded.includes('panel 3')} onChange={handleTabChange('panel 3')}>
        <AccordionSummary>
          <Typography className="Stat__Summary">Runs ({runStore.stats.count} runs in {runStore.stats.time.total.format()} - avg: {runStore.stats.time.average.format()})</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <RunList store={runStore} isBoxed={false} />
        </AccordionDetails>
      </Accordion>
    </div>
  );
};

export default observer(DataSearchResults);
