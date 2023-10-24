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
import dayjs from 'dayjs';
import { useLoaderData } from 'react-router';
import { saveAs } from 'file-saver';
import Price from '../components/Pricing/Price';
import ChaosIcon from '../components/Pricing/ChaosIcon';

const { logger, ipcRenderer } = electronService;

const SearchResultsHeader = ({ activeProfile, searchParams, divinePrice }) => {
  const dateFormat = 'YYYYMMDDHHmmss'
  const dateString = searchParams?.to && searchParams?.from ?
    <div className="DataSearchResults__Stats__SubTitle">
      Between <b className="Text--Implicit Text">{dayjs(searchParams.from, dateFormat).format('YYYY-MM-DD HH:mm:ss')}</b> and <b className="Text--Implicit Text">{dayjs(searchParams.to, dateFormat).format('YYYY-MM-DD HH:mm:ss')}</b>
    </div> : null;

  const minLootString = searchParams?.minLootValue ?
    <div className="DataSearchResults__Stats__SubTitle">
      Only loot with a minimum value of <b className="Text--Implicit Text"><Price value={searchParams.minLootValue} /></b>
    </div> : null;

  const neededItemNameString = searchParams?.neededItemName ?
    <div className="DataSearchResults__Stats__SubTitle">
      Only contain runs where you found at least one <b className="Text--Implicit Text">{searchParams.neededItemName}</b>
    </div> : null;

  const selectedMapsString = searchParams?.selectedMaps && searchParams?.selectedMaps.length > 0 ?
    <>
      <div className="DataSearchResults__Stats__SubTitle">
          Only contain runs on the following maps:
      </div>
      <div className="DataSearchResults__Stats__SubTitle">
          <b className="Text--Implicit Text">{searchParams.selectedMaps.join(', ')}</b>
      </div>
    </> : null;

  const minMapValueString = searchParams?.minMapValue ?
    <div className="DataSearchResults__Stats__SubTitle">
      Only contain runs with a minimum map profit of <b className="Text--Implicit Text"><Price value={searchParams.minMapValue} divinePrice={divinePrice} /></b>
    </div> : null;

  return (
    <>
      <h3 className="DataSearchResults__Stats__Title">
        Stats for <span className="Text--Legendary">{activeProfile.characterName}</span> in <span className="Text--Rare">{activeProfile.league}</span> League
      </h3>
      {dateString}
      {minLootString}
      {selectedMapsString}
      {neededItemNameString}
      {minMapValueString}
    </>
  );
};

const Search = ({ store }) => {
  const screenShotRef = useRef<HTMLDivElement>(null);
  const [ isTakingScreenshot, setIsTakingScreenshot] = React.useState(false);
  const [ searchParams, setSearchParams ] = React.useState({} as any);

  const { activeProfile, divinePrice, maps } = useLoaderData() as any;
  const { characterName } = activeProfile;

  const handleSearch = async (searchParams) => {
    await ipcRenderer.invoke('search:trigger', searchParams);
    setSearchParams(searchParams);
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
          const now = dayjs().format('YYYY-MM-DD_HH-mm-ss');
          const fileName = `${characterName}_${now}.png`;
          if(blob) saveAs(blob, fileName);
          setIsTakingScreenshot(false);
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
      <DataSearchForm searchFunction={handleSearch} availableMaps={maps} />
      <Divider className="Search__Divider" sx={{margin: '1em 0'}}>
        <Chip label="Results" />
      </Divider>
      <div className="Search__Screenshot__Container">
        {screenshotIcon}
      </div>
      <div ref={screenShotRef}>
        <DataSearchResults
          activeProfile={activeProfile}
          itemStore={store.itemStore}
          runStore={store.runStore}
          isTakingScreenshot={isTakingScreenshot}
          runScreenshotCommand={runScreenshotCommand}
          header={<SearchResultsHeader activeProfile={activeProfile} searchParams={searchParams} divinePrice={divinePrice} />}
          divinePrice={divinePrice}
        />
      </div>
    </div>
  );
};

export default observer(Search);
