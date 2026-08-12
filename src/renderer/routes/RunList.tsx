import './RunList.css';
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
  Pagination,
  FormControl,
} from '@mui/material';
import classNames from 'classnames';
import { useNavigate } from 'react-router-dom';
import { observer } from 'mobx-react-lite';
import { electronService } from '../electron.service';
import StrategySelector from '../components/Strategies/StrategySelector';
import type { RunStrategy, Strategy } from '../../shared/strategies';
import {
  ColumnsButton,
  RUN_LIST_COLUMNS,
  RunListColumnsPopover,
  useRunListColumns,
} from '../runListColumns';

const RunList = ({ NumbersOfMapsToShow = 10, store, isBoxed = true }) => {
  const navigate = useNavigate();
  const { preferences, ready } = useRunListColumns();
  const [runsPerPage, setRunsPerPage] = React.useState(NumbersOfMapsToShow);
  const [page, setPage] = React.useState(0);
  const [columnsAnchor, setColumnsAnchor] = React.useState<HTMLElement | null>(null);
  const [strategies, setStrategies] = React.useState<Strategy[]>([]);
  const [defaultStrategies, setDefaultStrategies] = React.useState<RunStrategy[]>([]);

  React.useEffect(() => {
    if (typeof electronService.listStrategies !== 'function') return;
    void electronService
      .listStrategies()
      .then((loaded) => setStrategies(loaded ?? []))
      .catch(() => undefined);
  }, []);
  React.useEffect(() => {
    void electronService
      .getSettings(['defaultStrategyIds'])
      .then((loaded) => {
        const ids: number[] = loaded?.defaultStrategyIds ?? [];
        setDefaultStrategies(strategies.filter((strategy) => ids.includes(strategy.id)));
      })
      .catch(() => undefined);
  }, [strategies]);
  const handleDefaultStrategyChange = (next: Strategy[]) => {
    setDefaultStrategies(next);
    void electronService.saveSettings({ defaultStrategyIds: next.map((strategy) => strategy.id) });
  };
  const getXPClassName = (xp: number) =>
    classNames({ 'Run-List__XP--Positive': xp > 0, 'Run-List__XP--Negative': xp <= 0 });
  const visibleColumns = preferences.order
    .map((id) => RUN_LIST_COLUMNS.find((column) => column.id === id)!)
    .filter((column) => !preferences.hidden.includes(column.id));
  const mainClasses = classNames({ Box: isBoxed, 'Run-List': true });

  return (
    <div className={mainClasses}>
      <div className="Run-List__Header">
        <div className="Run-List__Header__DefaultStrategy">
          <StrategySelector
            options={strategies}
            value={defaultStrategies}
            onChange={handleDefaultStrategyChange}
            label="Default Strategies"
            placeholder="No strategy"
          />
        </div>
        <div className="Page__Title Run-List__Header__Title">
          Most Recent {store.runs.length} Runs
        </div>
        <div>(Total Time: {store.getFullDuration().format('D [days] HH[h] mm[m] ss[s]')})</div>
        <div className="Run-List__Header__ColumnAction">
          <ColumnsButton onOpen={(event) => setColumnsAnchor(event.currentTarget)} />
        </div>
      </div>
      {ready && (
        <RunListColumnsPopover anchorEl={columnsAnchor} onClose={() => setColumnsAnchor(null)} />
      )}
      <TableContainer className="Run-List__List">
        <Table size="small" align="center">
          <TableHead>
            <TableRow className="Run-List__List-Header">
              {visibleColumns.map((column) => (
                <TableCell key={column.id} variant="head" align={column.align}>
                  {column.header}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {store.getSortedRuns(runsPerPage, page).map((run) => {
              const classes = classNames({
                'Run-list__Run': true,
                'Run-list__Run--Incomplete': !run.completed,
              });
              return (
                <TableRow
                  key={run.id}
                  onClick={() => navigate(`/run/${run.runId}`)}
                  className={classes}
                  hover
                >
                  {visibleColumns.map((column) => (
                    <TableCell
                      key={column.id}
                      align={column.align}
                      className={
                        column.id === 'xpPerHour' ? getXPClassName(run.xpPerHour) : undefined
                      }
                    >
                      {column.cell(
                        run,
                        strategies,
                        (next) =>
                          store.setRunStrategies(
                            run,
                            next.map((strategy) => strategy.id)
                          ),
                        getXPClassName
                      )}
                    </TableCell>
                  ))}
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
              onChange={(event) => {
                setRunsPerPage(Number(event.target.value));
                setPage(0);
              }}
              value={runsPerPage}
            >
              {[5, 10, 25, 50, 100].map((value) => (
                <MenuItem key={value} value={value}>
                  {value}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </div>
        <Pagination
          count={store.getPageCount(runsPerPage)}
          page={page + 1}
          onChange={(_, newPage) => setPage(newPage - 1)}
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

export default observer(RunList);
