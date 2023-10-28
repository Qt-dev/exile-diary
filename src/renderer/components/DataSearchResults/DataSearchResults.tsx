import React, { useEffect } from 'react';
import './DataSearchResults.css';
import LootTable from '../LootTable/LootTable';
import { observer } from 'mobx-react-lite';
import { saveAs } from 'file-saver';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import Backdrop from '@mui/material/Backdrop';
import CircularProgress from '@mui/material/CircularProgress';
import { styled } from '@mui/material/styles';
import MuiAccordionSummary, { AccordionSummaryProps } from '@mui/material/AccordionSummary';
import MuiAccordion, { AccordionProps } from '@mui/material/Accordion';
import MuiAccordionDetails from '@mui/material/AccordionDetails';
import RunList from '../../routes/RunList';
import ArrowForwardIosSharpIcon from '@mui/icons-material/ArrowForwardIosSharp';
import Price from '../Pricing/Price';

const DurationFormat = 'HH:mm:ss';

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
    theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, .05)' : 'rgba(0, 0, 0, .03)',
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

const DownloadButton = ({ csv, name, classNames = '' }) => {
  const [isDownloading, setIsDownloading] = React.useState(false);
  const downloadCsv = (
    event: React.MouseEvent<HTMLButtonElement, MouseEvent>,
    csv: BlobPart,
    name: string
  ) => {
    event.preventDefault();
    event.stopPropagation();
    if (!isDownloading) {
      setIsDownloading(true);
      const file = new Blob([csv], { type: 'text/csv' });
      saveAs(file, `${name}.csv`);
      setIsDownloading(false);
      // setTimeout(() => setIsDownloading(false) , 1000); // Welp... Apparently the save is so fast that the loading icon doesn't even show up. So we'll just fake it for now so that people do not double click
    }
  };

  return (
    <Button
      className={`${classNames} DataSearchResults__Save-Button`}
      onClick={(event) => downloadCsv(event, csv, name)}
    >
      <FileDownloadIcon />
    </Button>
  );
};

const DataSearchResults = ({
  itemStore,
  runStore,
  isTakingScreenshot = false,
  runScreenshotCommand,
  header,
  divinePrice,
  isSearching,
}) => {
  const Panels = ['panel 1', 'panel 2', 'panel 3'];
  const [expanded, setExpanded] = React.useState<(string | false)[]>(['panel 1']);
  const fallbackExpanded = React.useRef<(string | false)[]>(['panel 1']);
  const expandedPanels = React.useRef<(string | false)[]>(['panel 1']);
  const handleTabChange = (panel: string) => {
    return (event: React.SyntheticEvent, isExpanded: boolean) => {
      const newExpanded = [...expanded];
      if (isExpanded && newExpanded.indexOf(panel) === -1) {
        newExpanded.push(panel);
      }
      if (!isExpanded) {
        newExpanded.splice(newExpanded.indexOf(panel), 1);
      }
      setExpanded(newExpanded);
    };
  };
  const handleOpenTabEnd = (panel: string) => {
    return () => {
      if (!expandedPanels.current.includes(panel)) expandedPanels.current.push(panel);
      if (expandedPanels.current.length === Panels.length && isTakingScreenshot) {
        runScreenshotCommand();
      }
    };
  };

  useEffect(() => {
    if (isTakingScreenshot) {
      fallbackExpanded.current = [...expanded];
      setExpanded(Panels);
    } else {
      setExpanded(fallbackExpanded.current);
      fallbackExpanded.current = ['panel 1'];
      expandedPanels.current = ['panel 1'];
    }
  }, [isTakingScreenshot]); // eslint-disable-line react-hooks/exhaustive-deps

  const profitPerHour = runStore.stats.time.total.asMilliseconds()
    ? itemStore.stats.value.total / runStore.stats.time.total.asHours()
    : 0;

  return (
    <div className="DataSearchResults" style={{ position: 'relative' }}>
      <Backdrop
        open={isSearching || itemStore.isLoading || runStore.isLoading}
        sx={{
          position: 'absolute',
          background: 'rgba(0,0,0,0.9)',
          zIndex: (theme) => theme.zIndex.drawer + 1,
        }}
      >
        <Stack direction="column" spacing={2} alignItems="center">
          <h3>Getting data from the DB</h3>
          <CircularProgress color="secondary" />
        </Stack>
      </Backdrop>
      <Accordion expanded={expanded.includes('panel 1')} onChange={handleTabChange('panel 1')}>
        <AccordionSummary>
          <Typography variant="button">Stats</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <div className="DataSearchResults__Header-Container">{header}</div>

          <Stack spacing={2} direction="row" justifyContent="space-evenly" alignItems="center">
            <div className="Main_Stat__Column">
              <div className="DataSearchResults__Stat">
                Number of items looted: {itemStore.stats.items.count}
              </div>
              <div className="DataSearchResults__Stat">
                Total Value of items found:{' '}
                <Price value={itemStore.stats.value.total} divinePrice={divinePrice} />
              </div>
              <div className="DataSearchResults__Stat">
                Average Value of value items:{' '}
                <Price value={itemStore.stats.value.average} divinePrice={divinePrice} />
              </div>
              <div className="DataSearchResults__Stat">
                Profit per hour:{' '}
                <Price value={profitPerHour.toFixed(2)} divinePrice={divinePrice} />
              </div>
            </div>

            {/* <Divider orientation="vertical" flexItem /> */}
            <div className="Main_Stat__Column">
              <div className="DataSearchResults__Stat">Number of runs: {runStore.stats.count}</div>
              <div className="DataSearchResults__Stat">
                Total time spent: {runStore.stats.time.total.format(DurationFormat)}
              </div>
              <div className="DataSearchResults__Stat">
                Average time spent per run: {runStore.stats.time.average.format(DurationFormat)}
              </div>
              <div className="DataSearchResults__Stat">
                Average profit per run:{' '}
                <Price value={runStore.stats.profit.average} divinePrice={divinePrice} />
              </div>
            </div>
          </Stack>
        </AccordionDetails>
      </Accordion>
      <Accordion
        expanded={expanded.includes('panel 2')}
        onChange={handleTabChange('panel 2')}
        TransitionProps={{ onEntered: handleOpenTabEnd('panel 2') }}
      >
        <AccordionSummary>
          <Stack direction="row" width="100%" justifyContent="space-between">
            <Typography className="DataSearchResults__Stat__Summary">
              Loot - <Price value={itemStore.stats.value.total} divinePrice={divinePrice} />
            </Typography>
            <DownloadButton csv={itemStore.csv} name={'items'} />
          </Stack>
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={{ marginBottom: 5 }}>
            <Stack spacing={2} direction="row" justifyContent="space-evenly">
              <Box sx={{ width: '100%' }}>
                <LootTable
                  profit={itemStore.stats.value.total}
                  store={itemStore}
                  shouldHideExpandIcon={isTakingScreenshot}
                />
              </Box>
            </Stack>
          </Box>
        </AccordionDetails>
      </Accordion>
      <Accordion
        expanded={expanded.includes('panel 3')}
        onChange={handleTabChange('panel 3')}
        TransitionProps={{ onEntered: handleOpenTabEnd('panel 3') }}
      >
        <AccordionSummary>
          <Stack direction="row" width="100%" justifyContent="space-between">
            <Typography className="DataSearchResults__Stat__Summary">
              Runs ({runStore.stats.count} runs in{' '}
              {runStore.stats.time.total.format(DurationFormat)} - avg:{' '}
              {runStore.stats.time.average.format(DurationFormat)})
            </Typography>
            <DownloadButton csv={runStore.csv} name={'runs'} />
          </Stack>
        </AccordionSummary>
        <AccordionDetails>
          <RunList store={runStore} isBoxed={false} />
        </AccordionDetails>
      </Accordion>
      {isTakingScreenshot && (
        <div className="Stats__Footer">
          Generated by <span className="Text--Legendary">Exile Diary Reborn</span>. Find out more on{' '}
          <span className="Text--Magic">https://exilediary.com</span>
        </div>
      )}
    </div>
  );
};

export default observer(DataSearchResults);
