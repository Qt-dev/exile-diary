import React from 'react';
import Case from 'case';
import dayjs from 'dayjs';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TableSortLabel from '@mui/material/TableSortLabel';
import IconButton from '@mui/material/IconButton';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import { Order } from '../../../../helpers/types';
import Collapse from '@mui/material/Collapse';
import './BossStats.css';

type BossStat = {
  name: string;
  count: number;
  totalTime: number;
  fastest: number;
  deaths: number;
  details?: {
    [key: string]: BossStat;
  };
};

type BossStats = {
  maps: BossStat;
  shaperGuardians: BossStat;
  elderGuardians: BossStat;
  conquerors: BossStat;
  mastermind: BossStat;
  maven: BossStat;
  sirus: BossStat;
  shaper: BossStat;
  oshabi: BossStat;
  venarius: BossStat;
};

type BossStatOrder = 'name' | 'count' | 'totalTime' | 'fastest' | 'deaths';
type BossStatColumn = {
  id: string;
  label: string;
  align?: 'right' | 'center' | 'left' | 'inherit' | 'justify' | undefined;
};

const columns: BossStatColumn[] = [
  { id: 'name', label: 'Name' },
  { id: 'count', label: 'Times Killed' },
  { id: 'totalTime', label: 'Time', align: 'center' },
  { id: 'fastest', label: 'Fastest Time', align: 'center' },
  { id: 'deaths', label: 'Deaths', align: 'right' },
];

const BossTable = ({ stats }: { stats: { [key: string]: BossStat } }) => {
  const [order, setOrder]: [Order, Function] = React.useState<Order>('desc');
  const [orderBy, setOrderBy]: [BossStatOrder, Function] = React.useState<BossStatOrder>('name');
  const sort = (key, order) => {
    return () => {
      const realOrder = order === 'desc' && orderBy === key ? 'asc' : 'desc';
      setOrder(realOrder);
      setOrderBy(key);
    };
  };
  const sortedKeys = Object.keys(stats).sort((a, b) => {
    if (stats[a][orderBy] > stats[b][orderBy]) {
      return order === 'asc' ? 1 : -1;
    }
    if (stats[a][orderBy] < stats[b][orderBy]) {
      return order === 'asc' ? -1 : 1;
    }
    return 0;
  });
  return (
    <Table
      size="small"
      sx={{ marginTop: '5px', marginBottom: '15px', width: '100%' }}
      className="Boss-Stats__Table"
    >
      <TableHead>
        <TableRow className="Stats__Table-Header">
          <TableCell />
          {columns.map((column) => (
            <TableCell
              key={column.id}
              variant="head"
              align={column.align ?? 'center'}
              sx={{ width: 100 }}
            >
              <TableSortLabel
                active={orderBy === column.id}
                direction={orderBy === column.id ? order : 'desc'}
                onClick={sort(column.id, order)}
                hideSortIcon
              >
                {column.label}
              </TableSortLabel>
            </TableCell>
          ))}
        </TableRow>
      </TableHead>
      <TableBody>
        {sortedKeys.map((key) => {
          const stat = stats[key];
          return <BossStatsRow stat={stat} key={key} />;
        })}
      </TableBody>
    </Table>
  );
};

const SubTable = ({ details, open }: { details: { [key: string]: BossStat }; open: boolean }) => (
  <TableRow>
    <TableCell
      style={{ paddingBottom: 0, paddingTop: 0 }}
      colSpan={6}
      className="Boss-Stats__Sub-Table"
    >
      <Collapse in={open} timeout="auto" unmountOnExit sx={{ width: '100%' }}>
        <BossTable stats={details} />
      </Collapse>
    </TableCell>
  </TableRow>
);

const BossStatsRow = ({ stat }: { stat: BossStat }) => {
  const [open, setOpen]: [boolean, Function] = React.useState(false);
  const isCollapsible = stat.details && Object.keys(stat.details).length > 0;
  const collapsibleSx = {
    '& > *, & > td': { borderBottom: 'none' },
  };

  return (
    <>
      <TableRow sx={isCollapsible ? collapsibleSx : {}}>
        <TableCell sx={{ width: '10px', padding: '0' }}>
          {isCollapsible ? (
            <IconButton aria-label="expand row" size="small" onClick={() => setOpen(!open)}>
              {open ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
            </IconButton>
          ) : null}
        </TableCell>
        <TableCell>{Case.capital(stat.name)}</TableCell>
        <TableCell align="center">
          {stat.count.toLocaleString('en-US', { maximumFractionDigits: 0 })}
        </TableCell>
        <TableCell align="center">
          {stat.count === 0
            ? '--'
            : stat.totalTime > 0
            ? dayjs.utc(stat.totalTime * 1000).format('HH:mm:ss')
            : 'N/A'}
        </TableCell>
        <TableCell align="center">
          {stat.count === 0
            ? '--'
            : stat.fastest < Number.MAX_SAFE_INTEGER
            ? dayjs.utc(stat.fastest * 1000).format('HH:mm:ss')
            : 'N/A'}
        </TableCell>
        <TableCell align="right">{stat.deaths}</TableCell>
      </TableRow>
      {isCollapsible && !!stat.details ? <SubTable details={stat.details} open={open} /> : null}
    </>
  );
};

const BossStatsComponent = ({ stats }: { stats: BossStats }) => {
  return (
    <div className="Boss-Stats">
      <div className="Boss-Stats__Header">
        This list may be incomplete. Most boss battles can only be recorded when witnessed by the
        Maven.
      </div>
      <BossTable stats={stats} />
    </div>
  );
};

export default BossStatsComponent;
