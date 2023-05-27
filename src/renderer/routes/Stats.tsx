import React from 'react';
import './Stats.css';
import { electronService } from '../electron.service';
import { useLoaderData } from 'react-router';
import MainStats from '../components/Stats/MainStats/MainStats';
import AreaStats from '../components/Stats/AreaStats/AreaStats';

import { Tab, Tabs} from '@mui/material';
import BossStats from '../components/Stats/BossStats/BossStats';
const { logger } = electronService;


/* Stats we want:

- Value of drops
- Raw divine drops
- Monsters slain
- Deaths
- K/D Ratio

- Maven Crucibles
- Abyssal Depths entered
- Vaal side areas entered

- Envoy encountered
- Total words spoken ?
- Blight encounters
- Blighted Maps
- Unrighteous turned to ash ?

- Delirium Mirrors
- Metamorphs
- Metamorph specific organs

- Legion General encounters
- Each Legion General

- Lab trials completed

- Shrines activated

-----

Conquerors defeated

-----

Masters
- Encounters, Missions completed
- Beasts captured ?
- Incursions completed?
- Sulphie deposits?

Syndicate
- Mastermind 
- Each member
*/

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

const Stats = () => {
  const [tabValue, setTabValue] = React.useState(0);
	const { stats } =  useLoaderData() as any;
	const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };
	logger.info(stats);
	return (
		<div className="Stats__Page Box">
        <Tabs value={tabValue} aria-label="Settings Tabs" className="Stats__Tabs" onChange={handleTabChange}>
          <Tab label="Main Stats" {...a11yProps(0)} />
          <Tab label="Area Stats" {...a11yProps(1)} />
					<Tab label="Boss Stats" {...a11yProps(2)} />
          {/* Add new stuff here */}
        </Tabs>
				<TabPanel value={tabValue} index={0}>
					<MainStats stats={stats} />
				</TabPanel>
				<TabPanel value={tabValue} index={1}>
					<AreaStats stats={stats} />
				</TabPanel>
				<TabPanel value={tabValue} index={2}>
					<BossStats stats={stats.bosses} />
				</TabPanel>
		</div>
		);
	};
	
	export default Stats;