import React, { useEffect } from 'react';
import './StashTabs.css';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import TableBody from '@mui/material/TableBody';
import TableSortLabel from '@mui/material/TableSortLabel';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Checkbox from '@mui/material/Checkbox';
import ListItemText from '@mui/material/ListItemText';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import OutlinedInput from '@mui/material/OutlinedInput';
import Item from '../components/Item/Item';
import ChaosIcon from '../assets/img/c.png';
import { Order } from '../../helpers/types';
import { observer } from 'mobx-react-lite';

type StashTabsColumn = 'name' | 'quantity' | 'value' | 'totalValue' | 'stashTabName';

const StashTabs = ({ store }) => {
  const allTrackedStashTabsIds = store.trackedStashTabs.map((stashTab) => stashTab.id);
  const [orderBy, setOrderBy] = React.useState<StashTabsColumn>('name');
  const [order, setOrder] = React.useState<Order>('desc');
  const [selectedStashTabs, setSelectedStashTabs] =
    React.useState<string[]>(allTrackedStashTabsIds);
  const sortCallback = (column: StashTabsColumn, order: Order) => () => {
    const realOrder = order === 'desc' && orderBy === column ? 'asc' : 'desc';
    setOrder(realOrder);
    setOrderBy(column);
  };
  const areAllTabsSelected = selectedStashTabs.length === store.trackedStashTabs.length;

  const toggleSelectedSoloStashTab = (stashTabId: string) => () => {
    if (areAllTabsSelected) {
      setSelectedStashTabs([stashTabId]);
    } else {
      setSelectedStashTabs(allTrackedStashTabsIds);
    }
  };

  const [searchString, setSearchString] = React.useState<string>('');
  const sortedItems = store.itemStore
    .getItemsForLootTable(orderBy, order)
    .filter((item) => selectedStashTabs.includes(item.stashTabId))
    .filter((item) => item.name.toLowerCase().includes(searchString));

  const changeSelectedTabs = (event: SelectChangeEvent<typeof selectedStashTabs>) => {
    const {
      target: { value },
    } = event;
    if (value.includes('all')) {
      setSelectedStashTabs(areAllTabsSelected ? [] : allTrackedStashTabsIds);
    } else {
      setSelectedStashTabs([...value]);
    }
  };

  return (
    <div className="StashTabs Box">
      <div className="StashTabs__Header">
        <div className="Page__Title">Stash Tabs</div>
        <div className="StashTabs__Filters">
          <FormControl className="StashTabs__Filter">
            <InputLabel shrink>StashTabs</InputLabel>
            <Select
              size="small"
              multiple
              autoWidth
              sx={{ minWidth: 200 }}
              value={selectedStashTabs}
              input={<OutlinedInput label="StashTabs" />}
              notched
              onChange={changeSelectedTabs}
              renderValue={(totalValue) => {
                return areAllTabsSelected
                  ? 'All'
                  : totalValue
                      .map((value) => store.trackedStashTabs.find((tab) => value === tab.id).name)
                      .join(',');
              }}
            >
              <MenuItem value="all" sx={{ color: 'white' }}>
                <Checkbox checked={areAllTabsSelected} />
                <ListItemText>All</ListItemText>
              </MenuItem>
              {store.trackedStashTabs.map((stashTab) => (
                <MenuItem
                  value={stashTab.id}
                  key={stashTab.id}
                  sx={{ minWidth: 200, color: 'white' }}
                >
                  <Checkbox checked={selectedStashTabs.includes(stashTab.id)} />
                  <ListItemText>{stashTab.name}</ListItemText>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl className="StashTabs__Filter">
            <InputLabel shrink>Search Name</InputLabel>
            <OutlinedInput
              size="small"
              value={searchString}
              notched
              onChange={(event) => setSearchString(event.target.value)}
              label="Search Name"
            />
          </FormControl>
        </div>
      </div>
      <Table size="small">
        <TableHead>
          <TableRow className="Stats__Table-Header">
            <TableCell align="center">
              <TableSortLabel
                active={orderBy === 'stashTabName'}
                direction={orderBy === 'stashTabName' ? order : 'asc'}
                onClick={sortCallback('stashTabName', order)}
              >
                Stash
              </TableSortLabel>
            </TableCell>
            <TableCell align="center">
              <TableSortLabel
                active={orderBy === 'name'}
                direction={orderBy === 'name' ? order : 'asc'}
                onClick={sortCallback('name', order)}
              >
                Name
              </TableSortLabel>
            </TableCell>
            <TableCell align="right">
              <TableSortLabel
                active={orderBy === 'quantity'}
                direction={orderBy === 'quantity' ? order : 'asc'}
                onClick={sortCallback('quantity', order)}
              >
                Quantity
              </TableSortLabel>
            </TableCell>
            <TableCell align="right">
              <TableSortLabel
                active={orderBy === 'value'}
                direction={orderBy === 'value' ? order : 'asc'}
                onClick={sortCallback('value', order)}
              >
                Unit <img className="Loot-Table__Chaos-Icon" src={ChaosIcon} alt="profit" />
              </TableSortLabel>
            </TableCell>
            <TableCell align="right" width={4}>
              <TableSortLabel
                active={orderBy === 'totalValue'}
                direction={orderBy === 'totalValue' ? order : 'asc'}
                onClick={sortCallback('totalValue', order)}
              >
                Total <img className="Loot-Table__Chaos-Icon" src={ChaosIcon} alt="profit" />
              </TableSortLabel>
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {sortedItems.map((item) => {
            const stashTab = store.getStashTab(item.stashTabId);
            return (
              <TableRow key={item.id}>
                <TableCell>
                  <div className="StashTab-Box-Container">
                    <div
                      className="StashTab-Box"
                      onClick={toggleSelectedSoloStashTab(item.stashTabId)}
                      style={{
                        backgroundColor: stashTab?.metadata?.colour
                          ? `#${stashTab.metadata.colour}`
                          : 'initial',
                      }}
                    >
                      {stashTab.name}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="StashTab-Item-Container">
                    <Item item={item.item} showQuantityInTitle={false} />
                  </div>
                </TableCell>
                <TableCell align="right">{item.quantity.toFixed(0)}</TableCell>
                <TableCell align="right">{item.value.toFixed(2)}</TableCell>
                <TableCell align="right">{item.totalValue.toFixed(2)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};

export default observer(StashTabs);
