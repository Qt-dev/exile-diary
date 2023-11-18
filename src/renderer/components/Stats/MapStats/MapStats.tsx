import React from 'react';
import Case from 'case';
import dayjs from 'dayjs';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import ChaosIcon from '../../Pricing/ChaosIcon';
import { Order } from '../../../../helpers/types';
import TableSortLabel from '@mui/material/TableSortLabel';
import IconButton from '@mui/material/IconButton';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import Collapse from '@mui/material/Collapse';
import { Link } from 'react-router-dom';

const MapRow = ({ maps }) => {
  return (
    <div className="Stats__Map-List">
      <div className="Stats__Map-List__Header">Map List</div>
      <Table size="small" className="Stats__Map-List__Table">
        <TableHead>
          <TableRow>
            <TableCell>Date</TableCell>
            <TableCell>Time</TableCell>
            <TableCell align="right">
              <ChaosIcon />
            </TableCell>
            <TableCell align="right">
              <span>
                <ChaosIcon />
                /Hr
              </span>
            </TableCell>
            <TableCell align="right">Kills</TableCell>
            <TableCell align="right">Deaths</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {maps.map((map, index) => (
            <TableRow key={index} component={Link} to={`/run/${map.id}`}>
              <TableCell>{dayjs(map.date, 'YYYYMMDDHHmmss').toString()}</TableCell>
              <TableCell>{dayjs.utc(map.time * 1000).format('HH:mm:ss')}</TableCell>
              <TableCell align="right">
                {map.gained.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </TableCell>
              <TableCell align="right">
                {map.profitPerHour.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </TableCell>
              <TableCell align="right">{map.kills.toLocaleString()}</TableCell>
              <TableCell align="right">{map.deaths.toLocaleString()}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

const MapStatsRow = ({ stats }) => {
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => {
    setOpen(false);
  }, [stats]);
  return (
    <>
      <TableRow
        sx={{ '& > *, & > td': { borderBottom: 'none' } }}
        className="Area-Stats__Sub-Table"
      >
        <TableCell sx={{ width: '10px', padding: '0' }}>
          <IconButton aria-label="expand row" size="small" onClick={() => setOpen(!open)}>
            {open ? <RemoveIcon /> : <AddIcon />}
          </IconButton>
        </TableCell>
        <TableCell>{Case.capital(stats.name)}</TableCell>
        <TableCell align="center">{stats.count}</TableCell>
        <TableCell align="center">{dayjs.utc(stats.time * 1000).format('HH:mm:ss')}</TableCell>
        <TableCell align="right">
          {stats.gained.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </TableCell>
        <TableCell align="right">
          {stats.profitPerHour.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </TableCell>
        <TableCell align="right">{stats.kills.toLocaleString('en-US')}</TableCell>
        <TableCell align="right">{stats.deaths.toLocaleString('en-US')}</TableCell>
      </TableRow>
      <TableRow>
        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={8}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            {stats.maps.length > 0 ? <MapRow maps={stats.maps} /> : <></>}
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
};

const MapStats = ({ stats }) => {
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
    <Table size="small" sx={{ marginTop: '5px', marginBottom: '15px' }}>
      <TableHead>
        <TableRow className="Stats__Table-Header ">
          <TableCell variant="head" />
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
              Times Entered
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
          <MapStatsRow stats={stats.areas[areaKey]} key={areaKey} />
        ))}
      </TableBody>
    </Table>
  );
};

export default MapStats;
