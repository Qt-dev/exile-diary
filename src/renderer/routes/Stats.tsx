import React from 'react';
import './Stats.css';
import { useLoaderData } from 'react-router';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import MainStats from '../components/Stats/MainStats/MainStats';
import AreaStats from '../components/Stats/AreaStats/AreaStats';
import BossStats from '../components/Stats/BossStats/BossStats';
import LootStats from '../components/Stats/LootStats/LootStats';

import ItemStore from '../stores/itemStore';
import { electronService } from '../electron.service';
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
  const [tabValue, setTabValue] = React.useState(0);
	const { stats } =  useLoaderData() as any;
	const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };
	itemStore.createItems(stats.items.loot.map((item) => ({...item, ...JSON.parse(item.rawdata)})));
	logger.info(stats);
	return (
		<div className="Stats__Page Box">
        <Tabs value={tabValue} aria-label="Settings Tabs" className="Stats__Tabs" onChange={handleTabChange}>
          <Tab label="Main Stats" {...a11yProps(0)} />
          <Tab label="Area Stats" {...a11yProps(1)} />
					<Tab label="Boss Stats" {...a11yProps(2)} />
					<Tab label="Loot Stats" {...a11yProps(3)} />
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
				<TabPanel value={tabValue} index={3}>
					<LootStats stats={stats.items} store={itemStore}/>
				</TabPanel>
		</div>
		);
	};
	
	export default Stats;