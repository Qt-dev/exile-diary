import React, { useCallback, useEffect, useRef } from 'react';
import { electronService } from '../electron.service';
import './Search.css';
import DataSearchForm from '../components/DataSearchForm/DataSearchForm';
import DataSearchResults from '../components/DataSearchResults/DataSearchResults';
import ScreenshotMonitorIcon from '@mui/icons-material/ScreenshotMonitor';
import Backdrop from '@mui/material/Backdrop'
import CircularProgress from '@mui/material/CircularProgress';
import { observer } from 'mobx-react-lite';
import { Chip, Divider, Stack } from '@mui/material';
import { toBlob } from 'html-to-image';
import moment from 'moment';
import { useLoaderData } from 'react-router';
import { saveAs } from 'file-saver';

const { logger, ipcRenderer } = electronService;


const Search = ({ store }) => {
  const screenShotRef = useRef<HTMLDivElement>(null);
  const [ isTakingScreenshot, setIsTakingScreenshot] = React.useState(false);

  const { activeProfile } = useLoaderData() as any;
  const { characterName, league } = activeProfile;

  const handleSearch = async (searchParams) => {
    logger.debug('Search.handleSearch:', searchParams);
    ipcRenderer.invoke('search:trigger', searchParams);
  };

  useEffect(() => {
    store.reset();
  }, []);

  const runScreenshotCommand = () => {
    if (screenShotRef.current === null) {
      if(isTakingScreenshot) setIsTakingScreenshot(false);
      return;
    }
    if(isTakingScreenshot) {
      toBlob(screenShotRef.current, { cacheBust: true })
        .then((blob) => {
          const now = moment().format('YYYY-MM-DD_HH-mm-ss');
          const fileName = `${characterName}_${now}.png`;
          if(blob) saveAs(blob, fileName);
          setTimeout(() => setIsTakingScreenshot(false), 3000);
        })
        .catch((error) => { 
          logger.error('Error in saving Screenshot', error);
          setIsTakingScreenshot(false);
        });
      }
  }
  
  const screenshot = useCallback(async () => {
    if (screenShotRef.current !== null) {
      setIsTakingScreenshot(true);
    }
  }, [screenShotRef]); // eslint-disable-line react-hooks/exhaustive-deps


  const screenshotIcon = (
    <div
      className={`Search__Screenshot ${isTakingScreenshot ? 'Search__Screenshot--Ongoing' : ''}`}
      onClick={screenshot}
    >
      <ScreenshotMonitorIcon className="Stats__Screenshot-Icon" />
      {isTakingScreenshot ? 'Capturing...' : 'Capture Stats'}
    </div>
  );

  return (
    <div className="Search">
      <Backdrop open={isTakingScreenshot} sx={{ background: 'rgba(0,0,0,0.9)', zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Stack direction="column" spacing={2} alignItems="center">
          <h3>
            Generating Screenshot
          </h3>
          <CircularProgress />
        </Stack>
      </Backdrop>
      <DataSearchForm searchFunction={handleSearch}/>
      <Divider className="Search__Divider" sx={{margin: '1em 0'}}>
        <Chip label="Results" />
      </Divider>
      {screenshotIcon}
      <div ref={screenShotRef}>
        <DataSearchResults
          activeProfile={activeProfile}
          itemStore={store.itemStore}
          runStore={store.runStore}
          isTakingScreenshot={isTakingScreenshot}
          runScreenshotCommand={runScreenshotCommand}
        />
      </div>
    </div>
  );
};

export default observer(Search);
