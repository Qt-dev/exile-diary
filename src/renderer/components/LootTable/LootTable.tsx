import React, { useState } from 'react';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import TableSortLabel from '@mui/material/TableSortLabel';
import IconButton from '@mui/material/IconButton';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import { observer } from 'mobx-react-lite';
import ChaosIcon from '../Pricing/ChaosIcon';
import { Order } from '../../../helpers/types';
import './LootTable.css';
import Collapse from '@mui/material/Collapse';
import Price from '../Pricing/Price';
import { electronService } from '../../electron.service';
const { logger } = electronService;

type LootTableColumn = 'name' | 'quantity' | 'value' | 'totalValue' | 'originalValue';

const LootTableSubRow = ({ item, shouldHideExpandIcon = false }) => {
  const [orderBy, setOrderBy] = useState<LootTableColumn>('totalValue');
  const [order, setOrder] = useState<Order>('desc');
  const [open, setOpen] = React.useState(false);

  const sort = (column: LootTableColumn, order: Order) => () => {
    const realOrder = order === 'desc' && orderBy === column ? 'asc' : 'desc';
    setOrder(realOrder);
    setOrderBy(column);
  };
  const sortedItems = item.items
    ? item.items.sort((a, b) => {
        let first = a;
        let second = b;
        if (order === 'asc') {
          first = b;
          second = a;
        }
        if (typeof second[orderBy] === 'string') {
          return second[orderBy].localeCompare(first[orderBy]);
        } else {
          return second[orderBy] > first[orderBy] ? 1 : -1;
        }
      })
    : null;

  const hasSubRows = item.items && item.items.length > 1;
  const mainStyle = { '& > *': { borderBottom: 'none' } };
  return (
    <>
      <TableRow sx={hasSubRows ? mainStyle : null}>
        <TableCell sx={{ width: '10px', padding: '0', borderBottom: hasSubRows ? 'none' : null }}>
          {hasSubRows && !shouldHideExpandIcon ? (
            <IconButton aria-label="expand row" size="small" onClick={() => setOpen(!open)}>
              {open ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
            </IconButton>
          ) : null}
        </TableCell>
        <TableCell sx={{ borderBottom: hasSubRows ? 'none' : null }}>
          <img src={item.icon} alt="Item Icon" className="Loot-Table__Item-Icon" />
        </TableCell>
        <TableCell sx={{ borderBottom: hasSubRows ? 'none' : null }} align="right">
          {item.quantity}
        </TableCell>
        <TableCell sx={{ borderBottom: hasSubRows ? 'none' : null }} align="right">
          {item.originalValue.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </TableCell>
        <TableCell sx={{ borderBottom: hasSubRows ? 'none' : null }} align="right">
          {item.value.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </TableCell>
        <TableCell sx={{ borderBottom: hasSubRows ? 'none' : null }} align="right">
          {item.totalValue.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </TableCell>
        <TableCell>{item.name}</TableCell>
      </TableRow>
      {hasSubRows && (
        <TableRow className="Loot-Table__Subtable">
          <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={7}>
            <Collapse in={open} timeout="auto" unmountOnExit>
              <LootTable
                isSubTable={true}
                items={sortedItems}
                order={order}
                orderBy={orderBy}
                sortCallback={sort}
              />
            </Collapse>
          </TableCell>
        </TableRow>
      )}
    </>
  );
};

type LootTableProps = {
  items: any[];
  sortCallback: (column: LootTableColumn, order: Order) => () => void;
  order: Order;
  orderBy: LootTableColumn;
  isSubTable?: boolean;
  stats?: any;
  shouldHideExpandIcon?: boolean;
};

const LootTable = ({
  items,
  sortCallback,
  order,
  orderBy,
  isSubTable = false,
  stats = undefined,
  shouldHideExpandIcon = false,
}: LootTableProps) => {
  return (
    <Table size="small" sx={isSubTable ? { margin: '20px 0' } : null}>
      <TableHead className="Loot-Table__Header">
        <TableRow>
          <TableCell />
          <TableCell width="3em" />
          <TableCell align="right" sx={{ width: '6em' }}>
            <TableSortLabel
              hideSortIcon
              active={orderBy === 'quantity'}
              direction={orderBy === 'quantity' ? order : 'asc'}
              onClick={sortCallback('quantity', order)}
            >
              Quantity
            </TableSortLabel>
          </TableCell>
          <TableCell align="right" sx={{ width: '6em' }}>
            <TableSortLabel
              hideSortIcon
              active={orderBy === 'originalValue'}
              direction={orderBy === 'originalValue' ? order : 'asc'}
              onClick={sortCallback('originalValue', order)}
            >
              <span
                style={{
                  display: 'flex',
                  gap: '0.2em',
                  flexDirection: 'row',
                  alignItems: 'center',
                }}
              >
                Original <ChaosIcon />
              </span>
            </TableSortLabel>
          </TableCell>
          <TableCell align="right" sx={{ width: '6em' }}>
            <TableSortLabel
              hideSortIcon
              active={orderBy === 'value'}
              direction={orderBy === 'value' ? order : 'asc'}
              onClick={sortCallback('value', order)}
            >
              <span
                style={{
                  display: 'flex',
                  gap: '0.2em',
                  flexDirection: 'row',
                  alignItems: 'center',
                }}
              >
                <ChaosIcon /> / Unit
              </span>
            </TableSortLabel>
          </TableCell>
          <TableCell align="right" sx={{ width: '6em' }}>
            <TableSortLabel
              hideSortIcon
              active={orderBy === 'totalValue'}
              direction={orderBy === 'totalValue' ? order : 'asc'}
              onClick={sortCallback('totalValue', order)}
            >
              <span
                style={{
                  display: 'flex',
                  gap: '0.2em',
                  flexDirection: 'row',
                  alignItems: 'center',
                }}
              >
                Total <ChaosIcon />
              </span>
            </TableSortLabel>
          </TableCell>
          <TableCell>
            <TableSortLabel
              hideSortIcon
              active={orderBy === 'name'}
              direction={orderBy === 'name' ? order : 'asc'}
              onClick={sortCallback('name', order)}
            >
              Item Name
            </TableSortLabel>
          </TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {items.map((row) => (
          <LootTableSubRow key={row.id} item={row} shouldHideExpandIcon={shouldHideExpandIcon} />
        ))}
        {stats && (
          <TableRow>
            <TableCell sx={{ width: '10px', padding: '0' }}></TableCell>
            <TableCell></TableCell>
            <TableCell align="right">{stats.items.count}</TableCell>
            <TableCell align="right">{stats.value.average}</TableCell>
            <TableCell align="right">{stats.value.original}</TableCell>
            <TableCell align="right">{stats.value.total}</TableCell>
            <TableCell>Total</TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
};

const LootTablePage = ({ profit, store, shouldHideExpandIcon = false }) => {
  const [orderBy, setOrderBy] = useState<LootTableColumn>('totalValue');
  const [order, setOrder] = useState<Order>('desc');

  const sort = (column: LootTableColumn, order: Order) => () => {
    const realOrder = order === 'desc' && orderBy === column ? 'asc' : 'desc';
    setOrder(realOrder);
    setOrderBy(column);
  };
  const sortedItems = store.getItemsForLootTable(orderBy, order);
  const sortedIgnoredItems = store.getIgnoredItemsForLootTable(orderBy, order);
  logger.info('Sorted items for LootTable', profit);

  return (
    <div>
      <h2 className="Loot-Table-Page__Header">
        Profit Breakdown (Total = <Price value={profit} />)
      </h2>

      <LootTable
        items={sortedItems}
        sortCallback={sort}
        order={order}
        orderBy={orderBy}
        stats={store.stats}
        shouldHideExpandIcon={shouldHideExpandIcon}
      />

      <h2 className="Loot-Table-Page__Header">Ignored Items</h2>
      <LootTable items={sortedIgnoredItems} sortCallback={sort} order={order} orderBy={orderBy} />
    </div>
  );
};

export default observer(LootTablePage);
