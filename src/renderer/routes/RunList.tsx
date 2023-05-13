import './RunList.css';
import React from 'react';
import MenuIcon from '@mui/icons-material/Menu';
import {
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Select,
  MenuItem,
  SelectChangeEvent,
  Divider,
  Drawer,
} from '@mui/material';
import classNames from 'classnames';
import ChaosIcon from '../assets/img/c.png';
import { useNavigate } from 'react-router-dom';
import moment from 'moment';
import { observer } from 'mobx-react-lite';

const RunList = ({ NumberOfMapsToShow = '10', store }) => {
  const navigate = useNavigate();
  const [numberOfMapsToShow, setNumberOfMapsToShow] = React.useState(NumberOfMapsToShow);
  const [isDrawerOpen, setIsDrawerOpen] = React.useState(false);

  const togglePopupMenu = () => {
    setIsDrawerOpen(!isDrawerOpen);
  };

  const handleMapFilterChange = (event: SelectChangeEvent) => {
    setNumberOfMapsToShow(event.target.value as string);
    store.setSize(event.target.value);
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

  const FilterMenu = () => {
    return <div> This feature was disabled - Coming Soon </div>; // TODO: Add filter menu
  };

  return (
    <div className="Run-List Box">
      <div className="Run-List__Header">
        <div className="Run-List__Header__Title">Most Recent Maps</div>
        <MenuIcon className="Run-List__Header__Burger" onClick={togglePopupMenu}>
          ≡
        </MenuIcon>
      </div>
      <Divider />
      <Drawer anchor="right" open={isDrawerOpen} onClose={togglePopupMenu}>
        {FilterMenu()}
      </Drawer>
      <TableContainer className="Run-List__List">
        <Table size="small" align="center">
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell>Map</TableCell>
              <TableCell align="center">Level</TableCell>
              <TableCell align="center">IIQ</TableCell>
              <TableCell align="center">IIR</TableCell>
              <TableCell align="center">Pack Size</TableCell>
              <TableCell>Duration</TableCell>
              <TableCell align="center">
                <img className="Run-List__List__Header__Icon" src={ChaosIcon} alt="profit" />
              </TableCell>
              <TableCell align="center">
                <img className="Run-List__List__Header__Icon" src={ChaosIcon} alt="profit" />
                /Hr
              </TableCell>
              <TableCell align="center">XP/Hr</TableCell>
              <TableCell align="center">Deaths</TableCell>
              <TableCell align="center">Kills</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {store.sortedRuns.map((run, i) => {
              if (i > numberOfMapsToShow) return null;
              const deaths = [...Array(run.deaths || 0)].map((death, i) => (
                <div key={`death-${i}`} className="Run__Death-Icon" />
              ));
              return (
                <TableRow
                  key={run.id}
                  onClick={() => handleRunClick(run.runId)}
                  className="Run-list__Run"
                  hover
                >
                  <TableCell>{run.firstEvent.toString()}</TableCell>
                  <TableCell>{run.name}</TableCell>
                  <TableCell align="center">
                    {run.level}
                    {run.tier !== null ? ` (T${run.tier})` : '-'}
                  </TableCell>
                  <TableCell align="center">{run.iiq ? `${run.iiq}%` : '-'}</TableCell>
                  <TableCell align="center">{run.iir ? `${run.iir}%` : '-'}</TableCell>
                  <TableCell align="center">{run.packSize ? `${run.packSize}%` : '-'}</TableCell>
                  <TableCell>{moment.utc(run.duration.asMilliseconds()).format('mm:ss')}</TableCell>
                  <TableCell align="center">{run.profit?.toFixed(2)}</TableCell>
                  <TableCell align="center">{run.profitPerHour?.toFixed(2)}</TableCell>
                  <TableCell align="center" className={getXPClassName(run.xpPerHour)}>
                    {run.xpPerHour.toLocaleString('en')}
                  </TableCell>
                  <TableCell align="center">{deaths.length > 0 ? deaths : '-'}</TableCell>
                  <TableCell align="center">{run.kills || '-'}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
      <Divider />
      <div className="Run-List__Footer">
        <div className="Run-List__Footer__Title">Maps per page</div>
        <Select
          id="Run-Filter-Selector"
          className="Run-Filter-Selector"
          onChange={handleMapFilterChange}
          value={numberOfMapsToShow}
          size="small"
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
      </div>
    </div>
  );
};

RunList.propTypes = {
  // version: PropTypes.string.isRequired,
};

export default observer(RunList);
