import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Divider, LinearProgress, Tab, Tabs, TextField } from '@mui/material';
import MainStats from '../components/Stats/MainStats/MainStats';
import AreaStats from '../components/Stats/AreaStats/AreaStats';
import BossStats from '../components/Stats/BossStats/BossStats';
import LootStats from '../components/Stats/LootStats/LootStats';
import ItemStore from '../stores/itemStore';
import StrategySummary from '../components/Strategies/StrategySummary';
import { electronService } from '../electron.service';
import type { Strategy, StrategyInput } from '../../shared/strategies';
import { toCanvas } from 'html-to-image';
import dayjs from 'dayjs';
import './Strategies.css';

const randomStrategyColor = () =>
  `#${Math.floor(Math.random() * 0xffffff)
    .toString(16)
    .padStart(6, '0')
    .toUpperCase()}`;

const createEmptyInput = (): StrategyInput => ({
  name: '',
  description: '',
  color: randomStrategyColor(),
  costPerMap: 0,
});

const strategyToInput = (strategy: Strategy): StrategyInput => ({
  name: strategy.name,
  description: strategy.description,
  color: strategy.color,
  costPerMap: strategy.costPerMap,
});

export default function Strategies() {
  const navigate = useNavigate();
  const { strategyId } = useParams();
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [activeProfile, setActiveProfile] = useState<any>(null);
  const [selected, setSelected] = useState<Strategy | null>(null);
  const [statsResult, setStatsResult] = useState<any>(null);
  const [tab, setTab] = useState(0);
  const [input, setInput] = useState<StrategyInput>(createEmptyInput);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);
  const itemStore = useMemo(() => new ItemStore([]), []);

  const loadStrategies = async () => {
    const [loadedStrategies, settings] = await Promise.all([
      electronService.listStrategies(),
      electronService.getSettings(),
    ]);
    const loaded = loadedStrategies ?? [];
    setActiveProfile(settings?.activeProfile ?? null);
    setStrategies(loaded);
    const id = strategyId ? Number(strategyId) : loaded[0]?.id;
    const next = loaded.find((strategy) => strategy.id === id) ?? null;
    setSelected(next);
    if (next) {
      setInput(strategyToInput(next));
      if (String(strategyId) !== String(next.id))
        navigate(`/strategies/${next.id}`, { replace: true });
    }
  };

  useEffect(() => {
    void loadStrategies().catch((reason) => setError(String(reason?.message ?? reason)));
  }, [strategyId]);

  useEffect(() => {
    if (!selected) {
      setStatsResult(null);
      return;
    }
    let cancelled = false;
    setStatsResult(null);
    void electronService
      .getStrategyStats(selected.id)
      .then((result) => {
        if (!cancelled) setStatsResult(result);
      })
      .catch((reason) => {
        if (!cancelled) setError(String(reason?.message ?? reason));
      });
    return () => {
      cancelled = true;
    };
  }, [selected]);

  useEffect(() => {
    const loot = statsResult?.stats?.items?.loot;
    if (Array.isArray(loot)) {
      itemStore.createItems(loot.map((item) => ({ ...item, ...JSON.parse(item.raw_data) })));
    }
  }, [statsResult, itemStore]);

  const save = async () => {
    setError('');
    try {
      const saved =
        editing && selected
          ? await electronService.updateStrategy(selected.id, input)
          : await electronService.createStrategy(input);
      await loadStrategies();
      setEditing(false);
      navigate(`/strategies/${saved.id}`);
    } catch (reason: any) {
      setError(String(reason?.message ?? reason));
    }
  };

  const remove = async () => {
    if (!selected) return;
    const count = selected.assignmentCount ?? 0;
    if (!window.confirm(`Delete ${selected.name}? This will remove its tag from ${count} run(s).`))
      return;
    try {
      await electronService.deleteStrategy(selected.id);
      await loadStrategies();
      const next = strategies.find((strategy) => strategy.id !== selected.id);
      navigate(next ? `/strategies/${next.id}` : '/strategies');
    } catch (reason: any) {
      setError(String(reason?.message ?? reason));
    }
  };

  const selectStrategy = (strategy: Strategy) => navigate(`/strategies/${strategy.id}`);

  const exportSummary = useCallback(async () => {
    if (!summaryRef.current || exporting || !selected) return;
    setExporting(true);
    try {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const canvas = await toCanvas(summaryRef.current, {
        cacheBust: true,
        backgroundColor: '#000000',
        width: 1000,
        canvasWidth: 1000,
        pixelRatio: 1,
        style: {
          backgroundColor: '#000000',
          width: '1000px',
        },
      });
      const safeName = selected.name.replace(/[^a-z0-9-_]+/gi, '-').replace(/^-|-$/g, '') || 'strategy';
      const link = document.createElement('a');
      link.download = `${safeName}-${dayjs().format('YYYY-MM-DD_HH-mm-ss')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (reason: any) {
      setError(String(reason?.message ?? reason));
      electronService.logger.error('Error saving strategy summary', reason);
    } finally {
      setExporting(false);
    }
  }, [exporting, selected]);

  const editor = (
    <div className="Strategies__Editor">
      <TextField
        size="small"
        label="Name"
        value={input.name}
        onChange={(event) => setInput({ ...input, name: event.target.value })}
      />
      <TextField
        size="small"
        label="Description"
        value={input.description}
        onChange={(event) => setInput({ ...input, description: event.target.value })}
      />
      <TextField
        size="small"
        label="Cost per map (chaos)"
        type="number"
        value={input.costPerMap}
        onChange={(event) => setInput({ ...input, costPerMap: Number(event.target.value) })}
      />
      <label>
        Color{' '}
        <input
          type="color"
          value={input.color}
          onChange={(event) => setInput({ ...input, color: event.target.value })}
        />
      </label>
      <Button variant="contained" onClick={save}>
        Save
      </Button>
    </div>
  );

  return (
    <div className="Strategies Page Box">
      <div className="Strategies__Layout">
        <aside className="Strategies__Nav">
          <div className="Page__Title">Strategies</div>
          {strategies.map((strategy) => (
            <button
              className={`Strategies__NavItem ${
                selected?.id === strategy.id ? 'Strategies__NavItem--selected' : ''
              }`}
              key={strategy.id}
              onClick={() => selectStrategy(strategy)}
            >
              <span className="Strategies__Color" style={{ backgroundColor: strategy.color }} />
              <span>{strategy.name}</span>
              <small>{strategy.assignmentCount ?? 0}</small>
            </button>
          ))}
          <Button
            variant="outlined"
            onClick={() => {
              setSelected(null);
              setInput(createEmptyInput());
              setEditing(true);
            }}
          >
            New strategy
          </Button>
        </aside>

        <main className="Strategies__Content">
          {error && <div className="Text--Error">{error}</div>}
          {!selected ? (
            editing ? (
              editor
            ) : (
              <div className="Strategies__Empty">Create a strategy to start tagging runs.</div>
            )
          ) : !statsResult ? (
            <LinearProgress />
          ) : (
            <>
              <div className="Strategies__Header">
                <div className="Strategies__Actions">
                  <Button
                    variant="outlined"
                    onClick={exportSummary}
                    disabled={exporting}
                    aria-label="Export strategy summary as PNG"
                  >
                    {exporting ? 'Exporting...' : 'Export PNG'}
                  </Button>
                  <Button
                    onClick={() => {
                      if (editing) setInput(strategyToInput(selected));
                      setEditing(!editing);
                    }}
                  >
                    {editing ? 'Cancel' : 'Edit'}
                  </Button>
                  <Button color="error" onClick={remove}>
                    Delete
                  </Button>
                </div>
              </div>
              {editing && editor}
              <StrategySummary
                strategy={selected}
                economics={statsResult.economics}
                activity={statsResult.activity}
                stats={statsResult.stats}
                exportRef={summaryRef}
                includeFooter={exporting}
                exporting={exporting}
                characterName={activeProfile?.characterName}
                league={activeProfile?.league}
              />
              <Divider />
              <Tabs value={tab} onChange={(_event, value) => setTab(value)}>
                <Tab label="Main Stats" />
                <Tab label="Area Stats" />
                <Tab label="Boss Stats" />
                <Tab label="Loot Stats" />
              </Tabs>
              {tab === 0 && <MainStats stats={statsResult.stats} />}
              {tab === 1 && <AreaStats stats={statsResult.stats} />}
              {tab === 2 && <BossStats stats={statsResult.stats.bosses} />}
              {tab === 3 && <LootStats stats={statsResult.stats.items} store={itemStore} />}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
