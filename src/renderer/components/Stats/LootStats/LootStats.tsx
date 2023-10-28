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
import ChaosIcon from '../../Pricing/ChaosIcon';
import DivineIcon from '../../Pricing/DivineIcon';
import { Order } from '../../../../helpers/types';
import './LootStats.css';
import { Link } from 'react-router-dom';
import dayjs from 'dayjs';

type LootStatOrderOptions = 'name' | 'value' | 'map_id' | 'area';

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
    };
  };

  const items = store.getItemsAbove(minValue).sort((a, b) => {
    if (orderBy === 'name') {
      return order === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
    } else {
      return order === 'asc' ? a[orderBy] - b[orderBy] : b[orderBy] - a[orderBy];
    }
  });
  const filterLabel = (
    <span style={{ display: 'flex', gap: '0.2em', alignItems: 'center' }}>
      Minimum Value (1
      <DivineIcon /> = {stats.divinePrice} <ChaosIcon />)
    </span>
  );
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
            startAdornment: (
              <InputAdornment position="start">
                <ChaosIcon />
              </InputAdornment>
            ),
          }}
        />
      </div>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell align="center">
              <TableSortLabel
                hideSortIcon
                active={orderBy === 'name'}
                direction={orderBy === 'name' ? order : 'desc'}
                onClick={sort('name', order)}
              >
                Item
              </TableSortLabel>
            </TableCell>
            <TableCell align="right">
              <TableSortLabel
                hideSortIcon
                active={orderBy === 'value'}
                direction={orderBy === 'value' ? order : 'desc'}
                onClick={sort('value', order)}
              >
                <ChaosIcon />
              </TableSortLabel>
            </TableCell>
            <TableCell align="center">
              <TableSortLabel
                hideSortIcon
                active={orderBy === 'area'}
                direction={orderBy === 'area' ? order : 'desc'}
                onClick={sort('area', order)}
              >
                Looted in
              </TableSortLabel>
            </TableCell>
            <TableCell align="center">
              <TableSortLabel
                hideSortIcon
                active={orderBy === 'map_id'}
                direction={orderBy === 'map_id' ? order : 'desc'}
                onClick={sort('map_id', order)}
              >
                Looted on
              </TableSortLabel>
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {items.map((item, index) => {
            const divineValue = (item.value / stats.divinePrice).toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            });
            const date = dayjs(item.map_id, 'YYYYMMDDHHmmss').toString();
            return (
              <TableRow key={index}>
                <TableCell align="center">
                  <div className="Loot-Stats__Item-Container">
                    <Item item={item} />
                  </div>
                </TableCell>
                <TableCell align="right">
                  {item.value.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                  &nbsp;({divineValue}
                  <DivineIcon />)
                </TableCell>
                <TableCell align="center">
                  <Link to={`/run/${item.map_id}`} className="Loot-Stats__Link">
                    {item.area}
                  </Link>
                </TableCell>
                <TableCell align="center">{date}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};

export default LootStats;
