import './RunList.css';
import dayjs from 'dayjs';
import React from 'react';
import {
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Select,
  MenuItem,
  Drawer,
  Pagination,
  FormControl,
} from '@mui/material';
import classNames from 'classnames';
import ChaosIcon from '../components/Pricing/ChaosIcon';
import { useNavigate } from 'react-router-dom';
import { observer } from 'mobx-react-lite';

const RunList = ({ NumbersOfMapsToShow = 10, store, isBoxed = true }) => {
  const navigate = useNavigate();
  const [runsPerPage, setrunsPerPage] = React.useState<number>(NumbersOfMapsToShow);
  const [isDrawerOpen, setIsDrawerOpen] = React.useState(false);
  const [page, setPage] = React.useState(0);

  const togglePopupMenu = () => {
    setIsDrawerOpen(!isDrawerOpen);
  };

  const handleMapFilterChange = (event) => {
    setrunsPerPage(Number(event.target.value));
    setPage(0);
  };

  const getXPClassName = (xp: number) => {
    return classNames({
      'Run-List__XP--Positive': xp > 0,
      'Run-List__XP--Negative': xp <= 0,
    });
  };
  const handleRunClick = (mapId) => {
    navigate(`/run/${mapId}`);
  };
  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage - 1);
  };

  const FilterMenu = () => {
    return <div> This feature was disabled - Coming Soon </div>; // TODO: Add filter menu
  };

  const mainClasses = classNames({
    Box: isBoxed,
    'Run-List': true,
  });

  return (
    <div className={mainClasses}>
      <div className="Run-List__Header">
        <div className="Page__Title Run-List__Header__Title">
          Most Recent {store.runs.length} Runs
        </div>
        <div className="">
          (Total Time: {store.getFullDuration().format('D [days] HH[h] mm[m] ss[s]')})
        </div>
        {/* <MenuIcon className="Run-List__Header__Burger" onClick={togglePopupMenu}>
          ≡
        </MenuIcon> */}
      </div>
      <Drawer anchor="right" open={isDrawerOpen} onClose={togglePopupMenu}>
        {FilterMenu()}
      </Drawer>
      <TableContainer className="Run-List__List">
        <Table size="small" align="center">
          <TableHead>
            <TableRow className="Run-List__List-Header">
              <TableCell variant="head">Date</TableCell>
              <TableCell variant="head">Map</TableCell>
              <TableCell variant="head" align="center">
                Level
              </TableCell>
              <TableCell variant="head" align="center">
                IIQ
              </TableCell>
              <TableCell variant="head" align="center">
                IIR
              </TableCell>
              <TableCell variant="head" align="center">
                Pack Size
              </TableCell>
              <TableCell variant="head">Duration</TableCell>
              <TableCell variant="head" align="center">
                <span
                  style={{
                    display: 'flex',
                    gap: '0.2em',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <ChaosIcon />
                </span>
              </TableCell>
              <TableCell variant="head" align="center">
                <span
                  style={{
                    display: 'flex',
                    gap: '0.2em',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <ChaosIcon />/ Hr
                </span>
              </TableCell>
              <TableCell variant="head" align="center">
                XP/Hr
              </TableCell>
              <TableCell variant="head" align="center">
                Deaths
              </TableCell>
              <TableCell variant="head" align="center">
                Kills
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {store.getSortedRuns(runsPerPage, page).map((run, i) => {
              if (i > runsPerPage) return null;
              const deaths = [...Array(run.deaths || 0)].map((death, i) => (
                <div key={`death-${i}`} className="Run__Death-Icon" />
              ));
              const classes = classNames({
                'Run-list__Run': true,
                'Run-list__Run--Incomplete': !run.completed,
              });
              return (
                <TableRow
                  key={run.id}
                  onClick={() => handleRunClick(run.runId)}
                  className={classes}
                  hover
                >
                  <TableCell>{run.firstEvent?.calendar()}</TableCell>
                  <TableCell>{run.name}</TableCell>
                  <TableCell align="center">
                    {run.level}
                    {run.tier !== null ? ` (T${run.tier})` : '-'}
                  </TableCell>
                  <TableCell align="center">{run.iiq ? `${run.iiq}%` : '-'}</TableCell>
                  <TableCell align="center">{run.iir ? `${run.iir}%` : '-'}</TableCell>
                  <TableCell align="center">{run.packSize ? `${run.packSize}%` : '-'}</TableCell>
                  <TableCell>{dayjs.utc(run.duration?.asMilliseconds()).format('mm:ss')}</TableCell>
                  <TableCell align="center">{run.gained?.toFixed(2)}</TableCell>
                  <TableCell align="center">{run.gainedPerHour?.toFixed(2)}</TableCell>
                  <TableCell align="center" className={getXPClassName(run.xpPerHour)}>
                    {run.completed ? run.xpPerHour.toLocaleString('en') : '-- Ongoing --'}
                  </TableCell>
                  <TableCell align="center">{deaths.length > 0 ? deaths : '-'}</TableCell>
                  <TableCell align="center">
                    {run.kills && run.kills > -1 ? run.kills : '-'}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
      <div className="Run-List__Footer">
        <div className="Run-List__Footer__Select">
          <div className="Run-List__Footer__Title">Maps per page</div>
          <FormControl variant="outlined" size="small">
            <Select
              id="Run-Filter-Selector"
              className="Run-Filter-Selector"
              onChange={handleMapFilterChange}
              value={runsPerPage}
            >
              <MenuItem className="Map_Filter-Selector__Item" value={5}>
                5
              </MenuItem>
              <MenuItem className="Map_Filter-Selector__Item" value={10}>
                10
              </MenuItem>
              <MenuItem className="Map_Filter-Selector__Item" value={25}>
                25
              </MenuItem>
              <MenuItem className="Map_Filter-Selector__Item" value={50}>
                50
              </MenuItem>
              <MenuItem className="Map_Filter-Selector__Item" value={100}>
                100
              </MenuItem>
            </Select>
          </FormControl>
        </div>
        {/* <Divider orientation="vertical" flexItem /> */}
        <Pagination
          count={store.getPageCount(runsPerPage)}
          page={page + 1}
          onChange={handleChangePage}
          color="secondary"
          size="large"
          variant="outlined"
          shape="rounded"
          showFirstButton
        />
      </div>

      <div className="Text--Bottom">
        This product is <span className="Text--Error">NOT</span> affiliated with or endorsed by{' '}
        <span className="Text--Legendary">Grinding Gear Games</span> in any way.
      </div>
    </div>
  );
};

RunList.propTypes = {
  // version: PropTypes.string.isRequired,
};

export default observer(RunList);
