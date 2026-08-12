import React, { useMemo } from 'react';
import dayjs from 'dayjs';
import type { Strategy, StrategyActivityStats, StrategyEconomics } from '../../../shared/strategies';
import Price from '../Pricing/Price';

type Props = {
  strategy: Strategy;
  economics: StrategyEconomics;
  activity?: StrategyActivityStats;
  stats: any;
  exportRef: React.RefObject<HTMLDivElement>;
  includeFooter: boolean;
  exporting: boolean;
  characterName?: string;
  league?: string;
};

const format = (value: number, digits = 2) => (Number(value) || 0).toLocaleString('en-US', {
  minimumFractionDigits: digits,
  maximumFractionDigits: digits,
});
const priceFormat = (value: number) => (Number(value) || 0).toFixed(2);
const formatDuration = (value: number) => {
  const totalSeconds = Math.max(0, Math.round(Number(value) || 0));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':');
};
const formatLootTime = (value?: string | null) => {
  const timestamp = dayjs(value);
  return value && timestamp.isValid() ? timestamp.format('YYYY-MM-DD HH:mm:ss') : 'Unknown time';
};
const mapsPerHour = (completedRunCount: number, totalTimeSeconds: number) =>
  totalTimeSeconds > 0 ? completedRunCount / (totalTimeSeconds / 3600) : 0;

const normalizeLoot = (row: any) => {
  let item = row;
  try { item = { ...row, ...JSON.parse(row.raw_data ?? '{}') }; } catch { /* use row */ }
  const type = item.hybrid?.baseTypeName ?? item.typeLine ?? item.name ?? 'Unknown item';
  const name = item.name || item.secretName;
  return {
    name: name ? `${type} (${name})` : type,
    quantity: Number(item.maxStackSize)
      ? Number(item.pickupStackSize ?? item.stackSize ?? 1)
      : 1,
    totalValue: Number(row.value ?? item.value) || 0,
    lootedAt: row.drop_timestamp ?? item.drop_timestamp ?? null,
  };
};

const groupedLoot = (loot: any[] = []) => {
  const groups = new Map<string, { name: string; quantity: number; totalValue: number }>();
  for (const row of loot) {
    const item = normalizeLoot(row);
    const group = groups.get(item.name) ?? { name: item.name, quantity: 0, totalValue: 0 };
    group.quantity += item.quantity;
    group.totalValue += item.totalValue;
    groups.set(item.name, group);
  }
  return [...groups.values()].sort((a, b) => b.totalValue - a.totalValue || a.name.localeCompare(b.name)).slice(0, 5);
};

const priciestDrops = (loot: any[] = []) =>
  loot
    .map(normalizeLoot)
    .sort((a, b) => b.totalValue - a.totalValue || a.name.localeCompare(b.name))
    .slice(0, 3);

const Metric = ({ label, value, detail, tone }: { label: string; value: React.ReactNode; detail?: React.ReactNode; tone?: 'positive' | 'negative' }) => (
  <div className="Strategies__SummaryMetric">
    <span>{label}</span>
    <strong>{tone ? <span className={tone}>{value}</span> : value}</strong>
    {detail && <small className="Strategies__SummaryMetricDetail">{detail}</small>}
  </div>
);

export default function StrategySummary({ strategy, economics, activity, stats, exportRef, includeFooter, exporting, characterName, league }: Props) {
  const safeActivity = activity ?? { totalXp: 0, xpPerMap: 0, xpPerHour: 0, totalDeaths: 0, deathsPerMap: 0, deathsPerHour: 0 };
  const loot = useMemo(() => groupedLoot(stats?.items?.loot), [stats?.items?.loot]);
  const drops = useMemo(() => priciestDrops(stats?.items?.loot), [stats?.items?.loot]);
  const divinePrice = stats?.divinePrice ?? stats?.items?.divinePrice ?? 0;
  const price = (value: number) => <Price value={priceFormat(value)} divinePrice={divinePrice} compact />;
  return (
    <div
      ref={exportRef}
      className={`Strategies__SummaryCard${
        exporting ? ' Strategies__SummaryCard--exporting' : ''
      }`}
    >
      {includeFooter && (
        <div className="Strategies__SummaryProfile">
          Stats for <span className="Text--Legendary">{characterName || 'Unknown character'}</span>{' '}
          in the <span className="Text--Legendary">{league || 'Unknown'}</span> League
        </div>
      )}
      <header className="Strategies__SummaryHeader"><div><h1 style={{ color: strategy.color }}>{strategy.name}</h1>{strategy.description && <p>{strategy.description}</p>}</div><div className="Strategies__SummaryRuns"><strong>{economics.completedRunCount.toLocaleString('en-US')}</strong><span>completed runs</span></div></header>
      <div className="Strategies__SummaryGrid">
        <section className="Strategies__SummarySection"><h2>Economics</h2><div className="Strategies__SummaryMetrics">
          <Metric label="Cost / map" value={price(strategy.costPerMap)} />
          <Metric label="Total Cost" value={price(economics.totalCost)} />
          <Metric label="Gross / hour" value={price(economics.grossPerHour)} detail={<><span>{price(economics.grossValue)} total</span><span>{price(economics.grossPerMap)} / map</span></>} />
          <Metric label="Net / hour" value={price(economics.netPerHour)} detail={<><span>{price(economics.netValue)} total</span><span>{price(economics.netPerMap)} / map</span></>} />
        </div></section>
        <section className="Strategies__SummarySection"><h2>Progress</h2><div className="Strategies__SummaryMetrics">
          <Metric
            label="Time spent"
            value={formatDuration(economics.totalTimeSeconds)}
            detail={`${formatDuration(
              economics.completedRunCount > 0
              ? economics.totalTimeSeconds / economics.completedRunCount
                : 0
              )} / map`}
          />
          <Metric
            label="Maps per hour"
            value={format(mapsPerHour(economics.completedRunCount, economics.totalTimeSeconds))}
          />
          <Metric
            label="XP / hour"
            value={format(safeActivity.xpPerHour, 0)}
            detail={<><span><span className="positive">{format(safeActivity.totalXp, 0)}</span> total</span><span><span className="positive">{format(safeActivity.xpPerMap, 0)}</span> / map</span></>}
            tone="positive"
          />
          <Metric
            label="Deaths / hour"
            value={format(safeActivity.deathsPerHour)}
            detail={<><span><span className="negative">{format(safeActivity.totalDeaths, 0)}</span> total</span><span><span className="negative">{format(safeActivity.deathsPerMap)}</span> / map</span></>}
            tone="negative"
          />
        </div></section>
        <section className="Strategies__SummarySection Strategies__SummaryLoot"><h2>Top loot</h2>{loot.length === 0 ? <p className="Text--small">No loot recorded.</p> : <ol>{loot.map((item) => <li key={item.name}><span>{item.name} x {item.quantity.toLocaleString('en-US')}</span><strong>{price(item.totalValue)}</strong></li>)}</ol>}</section>
        <section className="Strategies__SummarySection Strategies__SummaryLoot"><h2>Priciest drops</h2>{drops.length === 0 ? <p className="Text--small">No loot recorded.</p> : <ol>{drops.map((item, index) => <li key={`${item.name}-${index}`}><span className="Strategies__SummaryLootDetails"><span>{item.name}{item.quantity > 1 ? ` x ${item.quantity.toLocaleString('en-US')}` : ''}</span><small>Looted {formatLootTime(item.lootedAt)}</small></span><strong>{price(item.totalValue)}</strong></li>)}</ol>}</section>
      </div>
      {economics.incompleteRunCount > 0 && <p className="Text--small">{economics.incompleteRunCount} incomplete tagged run(s) excluded from results.</p>}
      {includeFooter && <footer className="Strategies__SummaryFooter">
              Generated by <span className="Text--Legendary">Exile Diary Reborn</span>. Find out
              more on <span className="Text--Magic">https://exilediary.com</span>
            </footer>}
    </div>
  );
}

export { formatDuration, formatLootTime, groupedLoot, mapsPerHour, priciestDrops };
