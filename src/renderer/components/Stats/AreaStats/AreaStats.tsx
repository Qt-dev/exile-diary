import React from 'react';
import Case from 'case';
import dayjs from 'dayjs';
import { Order } from '../../../../helpers/types';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import TableSortLabel from '@mui/material/TableSortLabel';
import Collapse from '@mui/material/Collapse';
import IconButton from '@mui/material/IconButton';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import MapStats from '../MapStats/MapStats';
import ChaosIcon from '../../Pricing/ChaosIcon';
import './AreaStats.css';

const AreaStatsRow = ({ stats }) => {
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => {
    setOpen(false);
  }, [stats]);
  return (
    <>
      <TableRow sx={{ '& > *': { borderBottom: 'none' } }}>
        <TableCell sx={{ width: '10px', padding: '0' }}>
          <IconButton aria-label="expand row" size="small" onClick={() => setOpen(!open)}>
            {open ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
          </IconButton>
        </TableCell>
        <TableCell sx={{ width: 100 }}>{Case.capital(stats.name)}</TableCell>
        <TableCell sx={{ width: 100 }} align="center">
          {stats.count.toLocaleString()}
        </TableCell>
        <TableCell sx={{ width: 100 }} align="center">
          {dayjs.utc(stats.time * 1000).format('HH:mm:ss')}
        </TableCell>
        <TableCell sx={{ width: 100 }} align="right">
          {stats.gained.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </TableCell>
        <TableCell sx={{ width: 100 }} align="right">
          {stats.profitPerHour.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </TableCell>
        <TableCell sx={{ width: 100 }} align="right">
          {stats.kills.toLocaleString()}
        </TableCell>
        <TableCell sx={{ width: 100 }} align="right">
          {stats.deaths.toLocaleString()}
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={8}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <MapStats stats={stats} />
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
};

const AreaStats = ({ stats }) => {
  const [order, setOrder]: [Order, Function] = React.useState<Order>('desc');
  const [orderBy, setOrderBy] = React.useState('name');
  const sort = (key, order) => {
    return () => {
      const realOrder = order === 'desc' && orderBy === key ? 'asc' : 'desc';
      setOrder(realOrder);
      setOrderBy(key);
    };
  };
  const sortedKeys = Object.keys(stats.areas).sort((a, b) => {
    let first = a;
    let second = b;
    if (order === 'asc') {
      first = b;
      second = a;
    }
    if (typeof stats.areas[second][orderBy] === 'string') {
      return stats.areas[second][orderBy].localeCompare(stats.areas[first][orderBy]);
    } else {
      return stats.areas[second][orderBy] > stats.areas[first][orderBy] ? 1 : -1;
    }
  });
  return (
    <div className="Area-Stats">
      <Table size="small" sx={{ marginTop: '5px', marginBottom: '15px' }}>
        <TableHead>
          <TableRow className="Area-Stats__Header">
            <TableCell />
            <TableCell variant="head">
              <TableSortLabel
                hideSortIcon
                active={orderBy === 'name'}
                direction={orderBy === 'name' ? order : 'desc'}
                onClick={sort('name', order)}
              >
                Area
              </TableSortLabel>
            </TableCell>
            <TableCell variant="head" align="center">
              <TableSortLabel
                hideSortIcon
                active={orderBy === 'count'}
                direction={orderBy === 'count' ? order : 'desc'}
                onClick={sort('count', order)}
              >
                Count
              </TableSortLabel>
            </TableCell>
            <TableCell variant="head" align="center">
              <TableSortLabel
                hideSortIcon
                active={orderBy === 'time'}
                direction={orderBy === 'time' ? order : 'desc'}
                onClick={sort('time', order)}
              >
                Time
              </TableSortLabel>
            </TableCell>
            <TableCell variant="head" align="right">
              <TableSortLabel
                hideSortIcon
                active={orderBy === 'gained'}
                direction={orderBy === 'gained' ? order : 'desc'}
                onClick={sort('gained', order)}
              >
                <ChaosIcon />
              </TableSortLabel>
            </TableCell>
            <TableCell variant="head" align="right">
              <TableSortLabel
                hideSortIcon
                active={orderBy === 'profitPerHour'}
                direction={orderBy === 'profitPerHour' ? order : 'desc'}
                onClick={sort('profitPerHour', order)}
              >
                <span
                  style={{
                    display: 'flex',
                    gap: '0.2em',
                    flexDirection: 'row',
                    alignItems: 'center',
                  }}
                >
                  <ChaosIcon />
                  /hr
                </span>
              </TableSortLabel>
            </TableCell>
            <TableCell variant="head" align="right">
              <TableSortLabel
                hideSortIcon
                active={orderBy === 'kills'}
                direction={orderBy === 'kills' ? order : 'desc'}
                onClick={sort('kills', order)}
              >
                Kills
              </TableSortLabel>
            </TableCell>
            <TableCell variant="head" align="right">
              <TableSortLabel
                hideSortIcon
                active={orderBy === 'deaths'}
                direction={orderBy === 'deaths' ? order : 'desc'}
                onClick={sort('deaths', order)}
              >
                Deaths
              </TableSortLabel>
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {sortedKeys.map((areaKey) => (
            <AreaStatsRow stats={stats.areas[areaKey]} key={stats.areas[areaKey].name} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default AreaStats;
