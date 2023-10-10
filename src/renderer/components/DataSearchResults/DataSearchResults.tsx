import React from 'react';
import './DataSearchResults.css';
import LootTable from '../LootTable/LootTable';
import ChaosIcon from '../../assets/img/c.png';

const DataSearchResults = ({ items }) => {
  return (
    <div className="DataSearchResults">
      <div className="Stats">
        <div className="Stat">Number of items looted: {items.stats.items.count}</div>
        <div className="Stat">Total Value: {items.stats.value.total}<img className="Stat__Chaos-Icon" src={ChaosIcon} alt="profit" /></div>
        <div className="Stat">Average Value: {items.stats.value.average}<img className="Stat__Chaos-Icon" src={ChaosIcon} alt="profit" /></div>
      </div>
      <LootTable profit={items.stats.value.total} store={items} />
    </div>
  );
};

export default DataSearchResults;
