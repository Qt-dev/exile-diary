import React, { useCallback, useRef } from 'react';
import './Stats.css';
import { useLoaderData } from 'react-router';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import ScreenshotMonitorIcon from '@mui/icons-material/ScreenshotMonitor';
import MainStats from '../components/Stats/MainStats/MainStats';
import AreaStats from '../components/Stats/AreaStats/AreaStats';
import BossStats from '../components/Stats/BossStats/BossStats';
import LootStats from '../components/Stats/LootStats/LootStats';
import ItemStore from '../stores/itemStore';
import { toCanvas } from 'html-to-image';
import { electronService } from '../electron.service';
import moment from 'moment';
const { logger } = electronService;

function a11yProps(index: number) {
  return {
    id: `simple-tab-${index}`,
    'aria-controls': `simple-tabpanel-${index}`,
  };
}

const TabPanel = ({ children, index, value, ...other }) => {
  return (
    <div
      className="Stats__TabPanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {children}
    </div>
  );
};

const itemStore = new ItemStore([]);

const Stats = () => {
  const screenShotRef = useRef<HTMLDivElement>(null);
  const [ tabValue, setTabValue ] = React.useState(0);
  const [ isTakingScreenshot, setIsTakingScreenshot ] = React.useState(false);
  const { stats, activeProfile } = useLoaderData() as any;
  const { characterName, league } = activeProfile;
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };
  itemStore.createItems(stats.items.loot.map((item) => ({ ...item, ...JSON.parse(item.rawdata) })));
  const screenshot = useCallback(async () => {
    if (screenShotRef.current === null) {
      return
    }

    await setIsTakingScreenshot(true);
    toCanvas(screenShotRef.current, { cacheBust: true })
      .then((canvas) => {
        const now = moment().format('YYYY-MM-DD_HH-mm-ss');
        const link = document.createElement('a');
        link.download = `${characterName}_${now}.jpg`;
        link.href = canvas.toDataURL('image/jpeg');
        link.click();
        setIsTakingScreenshot(false);
      })
      .catch((error) => {
        setIsTakingScreenshot(false);
        logger.error(error);
      });
  }, [screenShotRef]);

  const screenshotIcon = (
    <div className={`Stats__Screenshot ${isTakingScreenshot ? "Stats__Screenshot--Ongoing" : ""}`} onClick={screenshot} >
      <ScreenshotMonitorIcon className='Stats__Screenshot-Icon' />
      {isTakingScreenshot ? "Capturing..." : "Capture Stats"}
    </div>);

  return (
    <div className="Stats__Page Box">
      <div className="Stats__Tabs-Container">
        <Tabs
          value={tabValue}
          aria-label="Settings Tabs"
          className="Stats__Tabs"
          onChange={handleTabChange}
        >
          <Tab label="Main Stats" {...a11yProps(0)} />
          <Tab label="Area Stats" {...a11yProps(1)} />
          <Tab label="Boss Stats" {...a11yProps(2)} />
          <Tab label="Loot Stats" {...a11yProps(3)} />
        </Tabs>
        {tabValue === 0 ? screenshotIcon : null}
      </div>
      <TabPanel value={tabValue} index={0}>
        <div ref={screenShotRef}>
          <h1 className="Stats__Header">Stats for <span className="Text--Legendary">{characterName}</span> in the <span className="Text--Legendary">{league}</span> League</h1>
          <MainStats stats={stats}/>
          {isTakingScreenshot ? <div className="Stats__Footer">Generated by <span className="Text--Legendary">Exile Diary Reborn</span>. Find out more on  <span className="Text--Magic">https://exilediary.com</span></div> : null}
        </div>
      </TabPanel>
      <TabPanel value={tabValue} index={1}>
        <AreaStats stats={stats} />
      </TabPanel>
      <TabPanel value={tabValue} index={2}>
        <BossStats stats={stats.bosses} />
      </TabPanel>
      <TabPanel value={tabValue} index={3}>
        <LootStats stats={stats.items} store={itemStore} />
      </TabPanel>
    </div>
  );
};

export default Stats;
