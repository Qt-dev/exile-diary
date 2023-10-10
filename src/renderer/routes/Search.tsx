import React from 'react';
import { electronService } from '../electron.service';
import './Search.css';
import DataSearchForm from '../components/DataSearchForm/DataSearchForm';
import DataSearchResults from '../components/DataSearchResults/DataSearchResults';
import { observer } from 'mobx-react-lite';

const { logger, ipcRenderer } = electronService;

const Search = ({ store }) => {
  const handleSearch = async (searchParams) => {
    logger.debug('Search.handleSearch:', searchParams);
    ipcRenderer.invoke('search:trigger', searchParams);
  };
  
  return (
    <div className="Search">
      <DataSearchForm searchFunction={handleSearch}/>
      <DataSearchResults items={store.itemStore}/>
    </div>
  );
};

export default observer(Search);
