import React from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { Select, MenuItem, SelectChangeEvent, Divider, Link } from '@mui/material';
import { observer } from 'mobx-react-lite';

const RunNavigation = ({ run, store }) => {
  const navigate = useNavigate();

  const { id } = run;
  const previousRun = store.getPreviousRun(id);
  const nextRun = store.getNextRun(id);

  // const currentRunId = id ? parseInt(id, 10) : 0;

  const handleMapChange = (event: SelectChangeEvent) => {
    navigate(`/run/${event.target.value}`);
  };

  return (
    <div className="Run__Navigation">
      <Link
        component={RouterLink}
        to={previousRun ? `/run/${previousRun.runId}` : '#'}
        className="Run__Navigation__Link--Previous Run__Navigation__Link"
        underline="hover"
        sx={{ fontSize: '1.1em' }}
      >
        {previousRun
          ? `<< ${previousRun.firstEvent.format('L HH:mm:ss')} (${previousRun.name})`
          : null}
      </Link>

      <Select
        id="Run__Selector"
        className="Run__Selector"
        onChange={handleMapChange}
        value={run.runId}
        size="small"
        variant="outlined"
      >
        {store.getSortedRuns().map((run) => {
          return (
            <MenuItem value={run.runId}>
              {run.firstEvent.format('L HH:mm:ss')} ({run.name})
            </MenuItem>
          );
        })}
      </Select>
      <Link
        component={RouterLink}
        to={nextRun ? `/run/${nextRun.runId}` : '#'}
        className="Run__Navigation__Link--Next Run__Navigation__Link"
        underline="hover"
        sx={{ fontSize: '1.1em' }}
      >
        {nextRun ? `${nextRun.firstEvent.format('L HH:mm:ss')} (${nextRun.name}) >>` : null}
      </Link>
    </div>
  );
};

export default observer(RunNavigation);
