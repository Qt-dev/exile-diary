import React from 'react';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import TableSortLabel from '@mui/material/TableSortLabel';
import InputAdornment from '@mui/material/InputAdornment';
import Item from '../../Item/Item';
import ChaosIcon from '../../../assets/img/c.png';
import DivineIcon from '../../../assets/img/div.png';
import { Order } from '../../../../helpers/types'
import './LootStats.css';


type LootStatOrderOptions = 'name' | 'value';

const LootStats = ({ stats, store }) => {
  const [minValue, setMinValue] = React.useState(stats.divinePrice ?? 0);
  const [orderBy, setOrderBy] = React.useState<LootStatOrderOptions>('value');
  const [order, setOrder] = React.useState<Order>('desc');


  const updateMinValue = (event) => {
    const value = event.target.value > 10 ? event.target.value : 10;
    setMinValue(value);
  };

  const sort = (key, order) => {
    return () => {
      const realOrder = order === 'desc' && orderBy === key ? 'asc' : 'desc';
      setOrder(realOrder);
      setOrderBy(key);
    }
  };

  const items = store.getItemsAbove(minValue)
    .sort((a, b) => {
      if (orderBy === 'name') {
        return order === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
      } else {
        return order === 'asc' ? a[orderBy] - b[orderBy] : b[orderBy] - a[orderBy];
      }
    });
  const filterLabel = <>Minimum Value (1<img src={DivineIcon} alt="Divine Icon" className="Loot-Stats__Profit-Icon" /> = {stats.divinePrice} <img src={ChaosIcon} alt="Chaos Icon" className="Loot-Stats__Profit-Icon" />)</>;
  return (
    <div>
      <div className="Loot-Stats__Search-Bar">
        <TextField
          label={filterLabel}
          variant="filled"
          value={minValue}
          fullWidth
          onChange={updateMinValue}
          size="small"
          type="number"
          color="primary"
          InputProps={{
            startAdornment: <InputAdornment position="start"><img src={ChaosIcon} alt="Chaos Icon" className="Loot-Stats__Profit-Icon" /></InputAdornment>,
          }}
        />
      </div>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell align="center"><TableSortLabel active={orderBy === 'name'} direction={orderBy === 'name' ? order : 'desc'} onClick={sort('name', order)}>Item</TableSortLabel></TableCell>
            <TableCell align="right"><TableSortLabel active={orderBy === 'name'} direction={orderBy === 'name' ? order : 'desc'} onClick={sort('name', order)}><img src={ChaosIcon} alt="Chaos Icon" className="Loot-Stats__Profit-Icon" /></TableSortLabel></TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {items.map((item, index) => {
            const divineValue = (item.value / stats.divinePrice).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
            return (
              <TableRow key={index}>
                <TableCell align="center"><div className="Loot-Stats__Item-Container"><Item item={item} /></div></TableCell>
                <TableCell align="right">
                  {item.value.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}&nbsp;({divineValue}<img src={DivineIcon} alt="Divine Icon" className="Loot-Stats__Profit-Icon" />)</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};

export default LootStats;