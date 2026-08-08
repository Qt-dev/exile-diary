import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Divider, LinearProgress, Tab, Tabs, TextField } from '@mui/material';
import MainStats from '../components/Stats/MainStats/MainStats';
import AreaStats from '../components/Stats/AreaStats/AreaStats';
import BossStats from '../components/Stats/BossStats/BossStats';
import LootStats from '../components/Stats/LootStats/LootStats';
import ItemStore from '../stores/itemStore';
import Price from '../components/Pricing/Price';
import { electronService } from '../electron.service';
import type { Strategy, StrategyInput } from '../../shared/strategies';
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

const formatNumber = (value: number) => (Number(value) || 0).toFixed(2);

export default function Strategies() {
  const navigate = useNavigate();
  const { strategyId } = useParams();
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [selected, setSelected] = useState<Strategy | null>(null);
  const [statsResult, setStatsResult] = useState<any>(null);
  const [tab, setTab] = useState(0);
  const [input, setInput] = useState<StrategyInput>(createEmptyInput);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  const itemStore = useMemo(() => new ItemStore([]), []);

  const loadStrategies = async () => {
    const loaded = (await electronService.listStrategies()) ?? [];
    setStrategies(loaded);
    const id = strategyId ? Number(strategyId) : loaded[0]?.id;
    const next = loaded.find((strategy) => strategy.id === id) ?? null;
    setSelected(next);
    if (next) {
      setInput({
        name: next.name,
        description: next.description,
        color: next.color,
        costPerMap: next.costPerMap,
      });
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
    setStatsResult(null);
    void electronService
      .getStrategyStats(selected.id)
      .then(setStatsResult)
      .catch((reason) => setError(String(reason?.message ?? reason)));
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

  const editor = (
    <div className="Strategies__Editor">
      <TextField
        label="Name"
        value={input.name}
        onChange={(event) => setInput({ ...input, name: event.target.value })}
      />
      <TextField
        label="Description"
        value={input.description}
        onChange={(event) => setInput({ ...input, description: event.target.value })}
      />
      <TextField
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
                <div>
                  <h1 style={{ color: selected.color }}>{selected.name}</h1>
                  <p>{selected.description}</p>
                </div>
                <div className="Strategies__Actions">
                  <Button onClick={() => setEditing(!editing)}>
                    {editing ? 'Cancel' : 'Edit'}
                  </Button>
                  <Button color="error" onClick={remove}>
                    Delete
                  </Button>
                </div>
              </div>
              {editing && editor}
              <div className="Strategies__Economics">
                <div>
                  Runs: <strong>{statsResult.economics.completedRunCount}</strong>
                </div>
                <div>
                  Cost / map:{' '}
                  <Price
                    value={formatNumber(selected.costPerMap)}
                    divinePrice={statsResult.stats.divinePrice}
                  />
                </div>
                <div>
                  Gross:{' '}
                  <Price
                    value={formatNumber(statsResult.economics.grossValue)}
                    divinePrice={statsResult.stats.divinePrice}
                  />
                </div>
                <div>
                  Cost:{' '}
                  <Price
                    value={formatNumber(statsResult.economics.totalCost)}
                    divinePrice={statsResult.stats.divinePrice}
                  />
                </div>
                <div>
                  Net:{' '}
                  <Price
                    value={formatNumber(statsResult.economics.netValue)}
                    divinePrice={statsResult.stats.divinePrice}
                  />
                </div>
                <div>
                  Gross / map:{' '}
                  <Price
                    value={formatNumber(statsResult.economics.grossPerMap)}
                    divinePrice={statsResult.stats.divinePrice}
                  />
                </div>
                <div>
                  Gross / hour:{' '}
                  <Price
                    value={formatNumber(statsResult.economics.grossPerHour)}
                    divinePrice={statsResult.stats.divinePrice}
                  />
                </div>
                <div>
                  Net / map:{' '}
                  <Price
                    value={formatNumber(statsResult.economics.netPerMap)}
                    divinePrice={statsResult.stats.divinePrice}
                  />
                </div>
                <div>
                  Net / hour:{' '}
                  <Price
                    value={formatNumber(statsResult.economics.netPerHour)}
                    divinePrice={statsResult.stats.divinePrice}
                  />
                </div>
              </div>
              {statsResult.economics.incompleteRunCount > 0 && (
                <div className="Text--small">
                  {statsResult.economics.incompleteRunCount} incomplete tagged run(s) excluded from
                  results.
                </div>
              )}
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
