import React, { useState } from 'react';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import TableSortLabel from '@mui/material/TableSortLabel';
import { observer } from 'mobx-react-lite';
import ChaosIcon from '../../assets/img/c.png';
import { Order } from '../../../helpers/types';
import './LootTable.css';
import { electronService } from '../../electron.service';
const { logger } = electronService;


type LootTableColumn = 'name' | 'quantity' | 'value' | 'totalValue';

const LootTable = ({ profit, store }) => {
  const [ orderBy, setOrderBy ] = useState<LootTableColumn>('totalValue');
  const [ order, setOrder ] = useState<Order>('desc');
  
  const sort = (column: LootTableColumn, order: Order) => () => {
    const realOrder = order === 'desc' && orderBy === column ? 'asc' : 'desc';
    setOrder(realOrder);
    setOrderBy(column);
  };
  const sortedItems = store.getItemsForLootTable(orderBy, order);

  return (
    <div>
      <h2 className="Loot-Table__Header">
        Profit Breakdown (Total = {profit}
        <img className="Loot-Table__Chaos-Icon" src={ChaosIcon} alt="profit" />)
      </h2>

      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell />
            <TableCell>
              <TableSortLabel
                hideSortIcon
                active={orderBy === 'name'}
                direction={orderBy === 'name' ? order : 'desc'}
                onClick={sort('name', order)}
              >
                Item Name
              </TableSortLabel>
            </TableCell>
            <TableCell align="right">
              <TableSortLabel
                hideSortIcon
                active={orderBy === 'quantity'}
                direction={orderBy === 'quantity' ? order : 'desc'}
                onClick={sort('quantity', order)}
              >
                Quantity
              </TableSortLabel>
            </TableCell>
            <TableCell align="right">
            <TableSortLabel
                hideSortIcon
                active={orderBy === 'value'}
                direction={orderBy === 'value' ? order : 'desc'}
                onClick={sort('value', order)}
              >
              Unit Value
              </TableSortLabel>
            </TableCell>
            <TableCell align="right">
              <TableSortLabel
                hideSortIcon
                active={orderBy === 'totalValue'}
                direction={orderBy === 'totalValue' ? order : 'desc'}
                onClick={sort('totalValue', order)}
              >
                Total Value
              </TableSortLabel>  
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {sortedItems.map((row) => (
            <TableRow key={row.id}>
              <TableCell width="3em"><img src={row.icon} alt="Item Icon" className="Loot-Table__Item-Icon" /></TableCell>
              <TableCell>{row.name}</TableCell>
              <TableCell align="right">{row.quantity}</TableCell>
              <TableCell align="right">{row.value.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </TableCell>
              <TableCell align="right">{row.totalValue.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default observer(LootTable);
