import React, { useEffect } from 'react';
import { electronService } from '../electron.service';
import './Search.css';
import DataSearchForm from '../components/DataSearchForm/DataSearchForm';
import DataSearchResults from '../components/DataSearchResults/DataSearchResults';
import { observer } from 'mobx-react-lite';
import { Chip, Divider } from '@mui/material';

const { logger, ipcRenderer } = electronService;

const Search = ({ store }) => {
  const handleSearch = async (searchParams) => {
    logger.debug('Search.handleSearch:', searchParams);
    ipcRenderer.invoke('search:trigger', searchParams);
  };

  useEffect(() => {
    store.reset();
  }, []);
  
  return (
    <div className="Search">
      <DataSearchForm searchFunction={handleSearch}/>
      <Divider className="Search__Divider" sx={{margin: '1em 0'}}>
        <Chip label="Results" />
      </Divider>
      <DataSearchResults itemStore={store.itemStore} runStore={store.runStore}/>
    </div>
  );
};

export default observer(Search);
