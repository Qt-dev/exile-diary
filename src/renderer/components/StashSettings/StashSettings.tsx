import React from 'react';
import { observer } from 'mobx-react-lite';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import TextField from '@mui/material/TextField';
import classNames from 'classnames';
import './StashSettings.css';

import { electronService } from '../../electron.service';
import ListItemButton from '@mui/material/ListItemButton';
import Checkbox from '@mui/material/Checkbox';
import ListItemText from '@mui/material/ListItemText';
import ListItemIcon from '@mui/material/ListItemIcon';
import Button from '@mui/material/Button';
const { logger, ipcRenderer } = electronService;

const ContainerComponent = ({ children, isFolder, disabled, callback }) => {
  if(isFolder) {
    return <div className="Stash-Settings__List-Item-Container">{children}</div>;
  } else {
    return <ListItemButton dense onClick={callback} disabled={disabled}>{children}</ListItemButton>;
  }
};

const SubTitleForType = {
  'Folder': "Folder",
  'MapStash': "(Map Stash Tab)",
  'UniqueStash': "(Unique Stash Tab)",
}

const StashTabRow = ({ stashTab, indentationLevel = 0 }) => {
  const isFolder = stashTab.type === 'Folder';
  const rowClasses = classNames({
    'Stash-Settings__List-Item': true,
    [`Stash-Settings__List-Item--${stashTab.type}`]: true,
    [`Stash-Settings__List-Item--level-${indentationLevel}`]: true,
  });
  const Icon = require(`../../assets/img/tabicons/${stashTab.type}.png`);
  const toggleEnabled = async (e) => {
    const newCheckedValue = !stashTab.tracked;
    await stashTab.setTracking(newCheckedValue);
  };
  const subtitle = SubTitleForType[stashTab.type] ?? null;

  return (
    <>
      <ListItem
        key={stashTab.id}
        sx={{
          backgroundColor: stashTab.metadata?.colour ? `#${stashTab.metadata.colour }` : 'initial',
          height: '2.5em',
          marginLeft: `${indentationLevel * 25}px`,
          width: `calc(100% - ${indentationLevel * 25}px)`
        }}
        disablePadding
        className={rowClasses}>
        <ContainerComponent callback={toggleEnabled} isFolder={isFolder} disabled={stashTab.disabled}>
          <ListItemIcon sx={{ minWidth: 0 }} className='Stash-Settings__Item-Icon'>
            <img className="Stash-Settings__Item-Icon__Image" src={Icon} alt={stashTab.type} />
            {!isFolder && <Checkbox
              size="small"
              edge="start"
              checked={stashTab.tracked}
              sx={{
                // color: pink[800],
                '&.Mui-checked': {
                  color: '#fff',
                },
              }}
              />}
          </ListItemIcon>
          
          <ListItemText>
            {stashTab.name} {subtitle && subtitle}
          </ListItemText>
        </ContainerComponent>
      </ListItem>
      {isFolder && stashTab.children.map((child: any) => (
        <ObservedStashTabRow stashTab={child} key={child.id} indentationLevel={indentationLevel + 1}/>
        ))}
    </>
  );
};
const ObservedStashTabRow = observer(StashTabRow);

const StashSettings = ({ store, settings }) => {
  const [ refreshInterval, setRefreshInterval ] = React.useState(settings?.netWorthCheck?.interval ?? 500);
  let refreshIntervalUpdateTimeout : NodeJS.Timeout | undefined = undefined;
  const handleStoreRefreshCallback= () => {
    store.fetchStashTabs();
  };
  const handleUpdateInterval = async (e) => {
    const newInterval = e.target.value;
    setRefreshInterval(newInterval);
    // We delay the settings save in case the user is still typingF
    clearTimeout(refreshIntervalUpdateTimeout);
    refreshIntervalUpdateTimeout = setTimeout(() => {
      ipcRenderer.invoke('save-settings:stash-refresh-interval', { interval: newInterval });
    }, 3000);
  };
  return (
    <div className='Stash-Settings'>
      <div className="Stash-Settings__Header">
        <div>Select the stash tabs you want to track, The app will then start pulling stats from these periodically</div>
        <div>Unique and Maps stash tabs are disabled because such tabs take so much time that Exile Diary would not be able to be able to read these in time for proper stats aggregation.</div>
      </div>
      <div className='Stash-Settings__Settings-Form'>
        <TextField size="small" type="number" label='Refresh Frequency (seconds)' value={refreshInterval} onChange={handleUpdateInterval}/>
        <Button variant="outlined" disabled={store.isLoading} onClick={handleStoreRefreshCallback}>Refresh Tabs</Button>
      </div>
      <List className='Stash-Settings__List'>
        {
          store.stashTabs.map((stashTab: any) => (<ObservedStashTabRow stashTab={stashTab} key={stashTab.id} />))
        }
      </List>
    </div>
  );
}

export default observer(StashSettings);