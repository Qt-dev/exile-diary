import React from 'react';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';
import {
  Checkbox,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Popover,
  Button,
  Stack,
  Typography,
} from '@mui/material';
import dayjs from 'dayjs';
import ChaosIcon from './components/Pricing/ChaosIcon';
import { electronService } from './electron.service';
import type { Run } from './stores/domain/run';
import type { RunStrategy, Strategy } from '../shared/strategies';
import StrategySelector from './components/Strategies/StrategySelector';

export type RunListColumnId =
  | 'date'
  | 'map'
  | 'level'
  | 'iiq'
  | 'iir'
  | 'packSize'
  | 'duration'
  | 'profit'
  | 'profitPerHour'
  | 'xpPerHour'
  | 'deaths'
  | 'kills'
  | 'strategies';

export type RunListColumnPreferences = { order: RunListColumnId[]; hidden: RunListColumnId[] };

export const RUN_LIST_COLUMN_IDS: RunListColumnId[] = [
  'date',
  'map',
  'level',
  'iiq',
  'iir',
  'packSize',
  'duration',
  'profit',
  'profitPerHour',
  'xpPerHour',
  'deaths',
  'kills',
  'strategies',
];

export const DEFAULT_RUN_LIST_COLUMNS: RunListColumnPreferences = {
  order: RUN_LIST_COLUMN_IDS,
  hidden: [],
};

export function normalizeRunListColumns(value: unknown): RunListColumnPreferences {
  const input = value as Partial<RunListColumnPreferences> | null;
  const order = Array.isArray(input?.order) ? input.order : [];
  const normalizedOrder = order.filter(
    (id, index, list): id is RunListColumnId =>
      RUN_LIST_COLUMN_IDS.includes(id as RunListColumnId) && list.indexOf(id) === index
  );
  RUN_LIST_COLUMN_IDS.forEach((id) => {
    if (!normalizedOrder.includes(id)) normalizedOrder.push(id);
  });
  const hidden = Array.isArray(input?.hidden)
    ? input.hidden.filter(
        (id, index, list) =>
          RUN_LIST_COLUMN_IDS.includes(id) && list.indexOf(id) === index && id !== 'map'
      )
    : [];
  return { order: normalizedOrder, hidden };
}

type ColumnDefinition = {
  id: RunListColumnId;
  label: string;
  align?: 'left' | 'center' | 'right' | 'inherit' | 'justify';
  header: React.ReactNode;
  cell: (
    run: Run,
    strategies: Strategy[],
    onStrategiesChange: (next: Strategy[]) => void,
    getXPClassName: (xp: number) => string
  ) => React.ReactNode;
};

export const RUN_LIST_COLUMNS: ColumnDefinition[] = [
  { id: 'date', label: 'Date', header: 'Date', cell: (run) => run.firstEvent?.calendar() },
  { id: 'map', label: 'Map', header: 'Map', cell: (run) => run.name },
  {
    id: 'level',
    label: 'Level',
    header: 'Level',
    align: 'center',
    cell: (run) => (
      <>
        {run.level}
        {run.tier !== null ? ` (T${run.tier})` : '-'}
      </>
    ),
  },
  {
    id: 'iiq',
    label: 'IIQ',
    header: 'IIQ',
    align: 'center',
    cell: (run) => (run.iiq ? `${run.iiq}%` : '-'),
  },
  {
    id: 'iir',
    label: 'IIR',
    header: 'IIR',
    align: 'center',
    cell: (run) => (run.iir ? `${run.iir}%` : '-'),
  },
  {
    id: 'packSize',
    label: 'Pack Size',
    header: 'Pack Size',
    align: 'center',
    cell: (run) => (run.packSize ? `${run.packSize}%` : '-'),
  },
  {
    id: 'duration',
    label: 'Duration',
    header: 'Duration',
    cell: (run) => dayjs.utc(run.duration?.asMilliseconds()).format('mm:ss'),
  },
  {
    id: 'profit',
    label: 'Profit',
    align: 'center',
    header: <ChaosIcon />,
    cell: (run) => run.gained?.toFixed(2),
  },
  {
    id: 'profitPerHour',
    label: 'Profit / Hr',
    align: 'center',
    header: (
      <>
        <ChaosIcon /> / Hr
      </>
    ),
    cell: (run) => run.gainedPerHour?.toFixed(2),
  },
  {
    id: 'xpPerHour',
    label: 'XP / Hr',
    align: 'center',
    header: 'XP/Hr',
    cell: (run, _s, _c, getXPClassName) => (
      <span className={getXPClassName(run.xpPerHour)}>
        {run.completed ? run.xpPerHour.toLocaleString('en') : '-- Ongoing --'}
      </span>
    ),
  },
  {
    id: 'deaths',
    label: 'Deaths',
    align: 'center',
    header: 'Deaths',
    cell: (run) =>
      run.deaths > 0
        ? [...Array(run.deaths)].map((_, i) => (
            <div key={`death-${i}`} className="Run__Death-Icon" />
          ))
        : '-',
  },
  {
    id: 'kills',
    label: 'Kills',
    align: 'center',
    header: 'Kills',
    cell: (run) => (run.kills && run.kills > -1 ? run.kills : '-'),
  },
  {
    id: 'strategies',
    label: 'Strategies',
    header: 'Strategies',
    cell: (run, strategies, onStrategiesChange) => (
      <div onClick={(event) => event.stopPropagation()}>
        <StrategyCell
          strategies={strategies}
          value={run.strategies}
          onChange={onStrategiesChange}
        />
      </div>
    ),
  },
];

function StrategyCell({
  strategies,
  value,
  onChange,
}: {
  strategies: Strategy[];
  value: RunStrategy[];
  onChange: (next: Strategy[]) => void;
}) {
  return <StrategySelector compact options={strategies} value={value} onChange={onChange} />;
}

type ContextValue = {
  preferences: RunListColumnPreferences;
  update: (next: RunListColumnPreferences) => void;
  reset: () => void;
  ready: boolean;
};
const RunListColumnsContext = React.createContext<ContextValue | null>(null);

export function RunListColumnsProvider({ children }: { children: React.ReactNode }) {
  const [preferences, setPreferences] = React.useState(DEFAULT_RUN_LIST_COLUMNS);
  const [ready, setReady] = React.useState(false);
  React.useEffect(() => {
    void electronService
      .getSettings(['runListColumns'])
      .then((settings) => {
        setPreferences(normalizeRunListColumns(settings?.runListColumns));
        setReady(true);
      })
      .catch(() => setReady(true));
  }, []);
  const update = React.useCallback((next: RunListColumnPreferences) => {
    const normalized = normalizeRunListColumns(next);
    setPreferences(normalized);
    void electronService.saveSettings({ runListColumns: normalized });
  }, []);
  const reset = React.useCallback(() => update(DEFAULT_RUN_LIST_COLUMNS), [update]);
  return (
    <RunListColumnsContext.Provider value={{ preferences, update, reset, ready }}>
      {children}
    </RunListColumnsContext.Provider>
  );
}

export function useRunListColumns() {
  const value = React.useContext(RunListColumnsContext);
  if (!value) throw new Error('useRunListColumns must be used inside RunListColumnsProvider');
  return value;
}

export function RunListColumnsPopover({
  anchorEl,
  onClose,
}: {
  anchorEl: HTMLElement | null;
  onClose: () => void;
}) {
  const { preferences, update, reset } = useRunListColumns();
  const [dragged, setDragged] = React.useState<RunListColumnId | null>(null);
  const move = (id: RunListColumnId, direction: -1 | 1) => {
    const order = [...preferences.order];
    const index = order.indexOf(id);
    const target = index + direction;
    if (target < 0 || target >= order.length) return;
    [order[index], order[target]] = [order[target], order[index]];
    update({ ...preferences, order });
  };
  const drop = (target: RunListColumnId) => {
    if (!dragged || dragged === target) return;
    const order = preferences.order.filter((id) => id !== dragged);
    order.splice(order.indexOf(target), 0, dragged);
    update({ ...preferences, order });
    setDragged(null);
  };
  return (
    <Popover
      open={Boolean(anchorEl)}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      transformOrigin={{ vertical: 'top', horizontal: 'right' }}
    >
      <Stack sx={{ p: 1, width: 280 }} spacing={0.5}>
        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="subtitle1">Run columns</Typography>
          <Button size="small" onClick={reset}>
            Reset
          </Button>
        </Stack>
        <List dense disablePadding>
          {preferences.order.map((id, index) => {
            const column = RUN_LIST_COLUMNS.find((item) => item.id === id)!;
            const visible = !preferences.hidden.includes(id);
            return (
              <ListItem
                key={id}
                draggable
                onDragStart={() => setDragged(id)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => drop(id)}
                secondaryAction={
                  <Stack direction="row">
                    <IconButton
                      size="small"
                      aria-label={`Move ${column.label} earlier`}
                      disabled={index === 0}
                      onClick={() => move(id, -1)}
                    >
                      <ArrowUpwardIcon fontSize="inherit" />
                    </IconButton>
                    <IconButton
                      size="small"
                      aria-label={`Move ${column.label} later`}
                      disabled={index === preferences.order.length - 1}
                      onClick={() => move(id, 1)}
                    >
                      <ArrowDownwardIcon fontSize="inherit" />
                    </IconButton>
                  </Stack>
                }
              >
                <ListItemIcon sx={{ minWidth: 28, cursor: 'grab' }}>
                  <DragIndicatorIcon fontSize="small" />
                </ListItemIcon>
                <Checkbox
                  edge="start"
                  checked={visible}
                  disabled={id === 'map'}
                  aria-label={`Show ${column.label}`}
                  onChange={() =>
                    update({
                      ...preferences,
                      hidden: visible
                        ? [...preferences.hidden, id]
                        : preferences.hidden.filter((hidden) => hidden !== id),
                    })
                  }
                />
                <ListItemText primary={column.label} />
              </ListItem>
            );
          })}
        </List>
      </Stack>
    </Popover>
  );
}

export function ColumnsButton({
  onOpen,
}: {
  onOpen: (event: React.MouseEvent<HTMLElement>) => void;
}) {
  return (
    <Button size="small" startIcon={<ViewColumnIcon />} onClick={onOpen}>
      Columns
    </Button>
  );
}
