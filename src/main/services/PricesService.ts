import DB from '../db';
import PriceOverridesRepository, {
  PriceOverrideRow,
} from '../db/repositories/priceOverrides';
import RatesRepository from '../db/repositories/rates';
import RunsRepository from '../db/repositories/run';
import SettingsManager from '../SettingsManager';
import ItemPricer from '../pricing/matching/ItemPricer';
import PoeNinjaClient from '../pricing/poe-ninja/PoeNinjaClient';
import type { SparklinePoint } from '../pricing/poe-ninja/PoeNinjaClient';
export type { SparklinePoint } from '../pricing/poe-ninja/PoeNinjaClient';
import { pricingHistoryStore } from '../pricing/history/PricingHistoryStore';
import { readSnapshotCategories } from '../pricing/snapshots/legacySnapshotAdapter';
import Logger from 'electron-log';
import dayjs from 'dayjs';
import zlib from 'zlib';

const logger = Logger.scope('services/PricesService');

export type CatalogItem = {
  id: string;
  name: string;
  category: string;
  icon?: string;
  unitChaosPrice: number;
  unitDivinePrice: number;
  droppedQuantity: number;
  totalChaosValue: number;
  hasOverride: boolean;
  activeOverride?: {
    price: number;
    currencyType: 'chaos' | 'divine' | 'perChaos';
    inputPrice: number;
    updatedAt: string;
  };
};


export type ItemDropRecord = {
  id: number;
  eventId: number;
  timestamp: string;
  value: number;
  stackSize: number;
  areaName?: string;
};

export type ItemPriceDetails = {
  identifier: string;
  category: string;
  icon?: string;
  unitChaosPrice: number;
  unitDivinePrice: number;
  divineChaosRate: number;
  sparkline: SparklinePoint[];
  sparklineWindowWeeks: 1 | 2 | 3 | 4 | 'all';
  activeOverride?: {
    price: number;
    currencyType: 'chaos' | 'divine' | 'perChaos';
    inputPrice: number;
    updatedAt: string;
  };
  drops: ItemDropRecord[];
  droppedQuantity: number;
  totalChaosValue: number;
};

export type TimeRangePreset = '1h' | '3h' | '6h' | '12h' | '1d' | '1w' | 'all' | 'custom';

export type GetCatalogOptions = {
  timePreset?: TimeRangePreset;
  from?: string;
  to?: string;
  search?: string;
  category?: string;
  league?: string;
};

export type RecalculatePricesOptions = {
  timePreset?: TimeRangePreset;
  relativeHours?: number;
  from?: string;
  to?: string;
  league?: string;
};

class PricesService {
  private async getDivineRate(league: string): Promise<number> {
    try {
      const rate = await ItemPricer.getCurrencyByName('Divine Orb', dayjs().format('YYYYMMDD'), league);
      return rate > 0 ? rate : 150;
    } catch {
      return 150;
    }
  }

  /**
   * Trims a full history array down to the user-configured display window.
   * pricing_history.json accumulates one point per day indefinitely (so old
   * leagues stay browsable via 'all'), but the chart should default to a
   * short recent window rather than always showing the entire league.
   */
  private applyHistoryWindow(sparkline: SparklinePoint[]): SparklinePoint[] {
    const windowSetting = SettingsManager.get('priceHistoryWindowWeeks') ?? 1;
    if (windowSetting === 'all' || sparkline.length === 0) return sparkline;

    const weeks = Number(windowSetting) || 1;
    const cutoff = dayjs().subtract(weeks, 'week');
    const trimmed = sparkline.filter((p) => dayjs(p.time).isAfter(cutoff));

    // Always keep at least the latest point so the chart is never empty.
    return trimmed.length > 0 ? trimmed : [sparkline[sparkline.length - 1]];
  }

  calculateTimeRange(preset?: string, customFrom?: string, customTo?: string): { from?: string; to?: string } {
    const now = dayjs();
    switch (preset) {
      case '1h':
        return { from: now.subtract(1, 'hour').toISOString(), to: now.toISOString() };
      case '3h':
        return { from: now.subtract(3, 'hour').toISOString(), to: now.toISOString() };
      case '6h':
        return { from: now.subtract(6, 'hour').toISOString(), to: now.toISOString() };
      case '12h':
        return { from: now.subtract(12, 'hour').toISOString(), to: now.toISOString() };
      case '1d':
        return { from: now.subtract(1, 'day').toISOString(), to: now.toISOString() };
      case '1w':
        return { from: now.subtract(1, 'week').toISOString(), to: now.toISOString() };
      case 'custom':
        return {
          from: customFrom ? dayjs(customFrom).toISOString() : undefined,
          to: customTo ? dayjs(customTo).toISOString() : undefined,
        };
      case 'all':
      default:
        return {};
    }
  }

  async getCatalog(options: GetCatalogOptions = {}): Promise<CatalogItem[]> {
    const activeProfile = SettingsManager.get('activeProfile');
    const league = options.league || activeProfile?.league || 'Standard';
    const divineRate = await this.getDivineRate(league);

    const { from, to } = this.calculateTimeRange(options.timePreset, options.from, options.to);

    // 1. Get dropped stats from Character DB
    const droppedStatsMap = new Map<
      string,
      { quantity: number; totalValue: number; category?: string; icon?: string }
    >();

    try {
      const droppedQuery = `
        SELECT
          COALESCE(NULLIF(item.name, ''), item.typeline) as item_name,
          item.category,
          item.icon,
          SUM(COALESCE(item.stack_size, 1)) as total_quantity,
          SUM(item.value) as total_value
        FROM item
        JOIN event ON item.event_id = event.id
        WHERE (? IS NULL OR DATETIME(event.timestamp) >= DATETIME(?))
          AND (? IS NULL OR DATETIME(event.timestamp) <= DATETIME(?))
          AND item.ignored = 0
        GROUP BY COALESCE(NULLIF(item.name, ''), item.typeline)
      `;

      const droppedRows = (await DB.all(droppedQuery, [
        from || null,
        from || null,
        to || null,
        to || null,
      ])) as any[];

      if (Array.isArray(droppedRows)) {
        for (const row of droppedRows) {
          if (row.item_name) {
            droppedStatsMap.set(row.item_name, {
              quantity: row.total_quantity || 0,
              totalValue: Number((row.total_value || 0).toFixed(2)),
              category: row.category,
              icon: row.icon,
            });
          }
        }
      }
    } catch (err) {
      logger.error('Error fetching dropped stats for catalog:', err);
    }

    // 2. Get latest fullrates snapshot from League DB and normalize schema
    const today = dayjs().format('YYYYMMDD');
    const rawRates = await RatesRepository.getFullRates(league, today);
    const ratesSnapshot = readSnapshotCategories(rawRates);
    const catalogMap = new Map<string, CatalogItem>();

    // Index from fullrates
    if (ratesSnapshot && typeof ratesSnapshot === 'object') {
      for (const [categoryName, items] of Object.entries(ratesSnapshot)) {
        if (items && typeof items === 'object') {
          for (const [itemName, chaosPrice] of Object.entries(items as Record<string, number>)) {
            const unitChaos = typeof chaosPrice === 'number' ? chaosPrice : 0;
            const dropped = droppedStatsMap.get(itemName);
            const droppedQty = dropped?.quantity || 0;
            const totalVal = dropped?.totalValue || 0;

            catalogMap.set(itemName, {
              id: itemName,
              name: itemName,
              category: categoryName,
              icon: dropped?.icon,
              unitChaosPrice: unitChaos,
              unitDivinePrice: Number((unitChaos / divineRate).toFixed(3)),
              droppedQuantity: droppedQty,
              totalChaosValue: totalVal,
              hasOverride: false,
            });
          }
        }
      }
    }

    // Merge any dropped items not in poe.ninja snapshot
    for (const [droppedName, droppedData] of droppedStatsMap.entries()) {
      const existing = catalogMap.get(droppedName);
      if (existing) {
        if (!existing.icon && droppedData.icon) existing.icon = droppedData.icon;
        if (existing.unitChaosPrice === 0 && droppedData.quantity > 0 && droppedData.totalValue > 0) {
          const unitChaos = Number((droppedData.totalValue / droppedData.quantity).toFixed(2));
          existing.unitChaosPrice = unitChaos;
          existing.unitDivinePrice = Number((unitChaos / divineRate).toFixed(3));
        }
      } else {
        const unitChaos = droppedData.quantity > 0 && droppedData.totalValue > 0
          ? Number((droppedData.totalValue / droppedData.quantity).toFixed(2))
          : 0;
        catalogMap.set(droppedName, {
          id: droppedName,
          name: droppedName,
          category: droppedData.category || 'General',
          icon: droppedData.icon,
          unitChaosPrice: unitChaos,
          unitDivinePrice: Number((unitChaos / divineRate).toFixed(3)),
          droppedQuantity: droppedData.quantity,
          totalChaosValue: droppedData.totalValue,
          hasOverride: false,
        });
      }
    }

    // 3. Apply static overrides from League DB
    try {
      const allOverrides = await PriceOverridesRepository.getAllOverrides(league);
      for (const ov of allOverrides) {
        let entry = catalogMap.get(ov.item_identifier);
        if (!entry) {
          entry = {
            id: ov.item_identifier,
            name: ov.item_identifier,
            category: ov.category || 'Custom',
            unitChaosPrice: 0,
            unitDivinePrice: 0,
            droppedQuantity: 0,
            totalChaosValue: 0,
            hasOverride: false,
          };
          catalogMap.set(ov.item_identifier, entry);
        }

        entry.unitChaosPrice = ov.price;
        entry.unitDivinePrice = Number((ov.price / divineRate).toFixed(3));
        entry.hasOverride = true;
        entry.activeOverride = {
          price: ov.price,
          currencyType: ov.currency_type,
          inputPrice: ov.input_price,
          updatedAt: ov.updated_at,
        };
      }
    } catch (err) {
      logger.error('Error applying overrides to catalog:', err);
    }

    let results = Array.from(catalogMap.values());

    // Search filter
    if (options.search && options.search.trim().length > 0) {
      const q = options.search.toLowerCase().trim();
      results = results.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q)
      );
    }

    // Category filter
    if (options.category && options.category !== 'All') {
      results = results.filter((item) => item.category === options.category);
    }

    return results;
  }

  async getItemPriceDetails(
    itemIdentifier: string,
    leagueParam?: string,
    options: { forceRefresh?: boolean } = {}
  ): Promise<ItemPriceDetails> {
    const activeProfile = SettingsManager.get('activeProfile');
    const league = leagueParam || activeProfile?.league || 'Standard';
    const divineRate = await this.getDivineRate(league);

    // 1. Fetch market trend from file-backed pricing_history cache with delta fetching
    let sparkline: SparklinePoint[] = [];
    let detectedCategory = 'General';

    try {
      sparkline = options.forceRefresh
        ? await pricingHistoryStore.forceRefreshItemHistory(itemIdentifier, league)
        : await pricingHistoryStore.getItemHistory(itemIdentifier, league);
      sparkline = this.applyHistoryWindow(sparkline);
    } catch (err) {
      logger.error(`Error loading market trend for ${itemIdentifier}:`, err);
    }

    // Base market rate from current lookup or latest sparkline point
    const effective = await ItemPricer.getEffectivePrice(itemIdentifier, dayjs().toISOString(), league);
    const baseMarketPrice = effective.price || (sparkline.length > 0 ? sparkline[sparkline.length - 1].price : 0);

    if (sparkline.length === 0 || (sparkline.length === 1 && sparkline[0].price === 0)) {
      sparkline = [
        {
          time: dayjs().toISOString(),
          price: baseMarketPrice,
        },
      ];
    }

    // 2. Static override for this item
    let activeOverride: ItemPriceDetails['activeOverride'] = undefined;
    try {
      const ov = await PriceOverridesRepository.getOverride(league, itemIdentifier);
      if (ov) {
        activeOverride = {
          price: ov.price,
          currencyType: ov.currency_type,
          inputPrice: ov.input_price,
          updatedAt: ov.updated_at,
        };
      }
    } catch (err) {
      logger.error(`Error loading override for ${itemIdentifier}:`, err);
    }

    // 3. Dropped instances from Character DB
    const drops: ItemDropRecord[] = [];
    let totalDroppedQty = 0;
    let totalDroppedChaos = 0;
    let detectedIcon: string | undefined = undefined;

    try {
      const dropsQuery = `
        SELECT
          item.id,
          item.event_id,
          event.timestamp,
          item.value,
          COALESCE(item.stack_size, 1) as stack_size,
          item.icon,
          item.category
        FROM item
        JOIN event ON item.event_id = event.id
        WHERE (item.name = ? OR item.typeline = ?)
        ORDER BY event.timestamp DESC
      `;

      const dropRows = (await DB.all(dropsQuery, [itemIdentifier, itemIdentifier])) as any[];
      if (Array.isArray(dropRows)) {
        for (const r of dropRows) {
          const qty = r.stack_size || 1;
          const val = r.value || 0;
          totalDroppedQty += qty;
          totalDroppedChaos += val;
          if (!detectedIcon && r.icon) detectedIcon = r.icon;
          if (detectedCategory === 'General' && r.category) detectedCategory = r.category;

          drops.push({
            id: r.id,
            eventId: r.event_id,
            timestamp: r.timestamp,
            value: val,
            stackSize: qty,
          });
        }
      }
    } catch (err) {
      logger.error(`Error loading drops for ${itemIdentifier}:`, err);
    }

    const unitChaos = activeOverride ? activeOverride.price : baseMarketPrice;
    const unitDivine = Number((unitChaos / divineRate).toFixed(3));

    return {
      identifier: itemIdentifier,
      category: detectedCategory,
      icon: detectedIcon,
      unitChaosPrice: unitChaos,
      unitDivinePrice: unitDivine,
      divineChaosRate: divineRate,
      sparkline,
      sparklineWindowWeeks: SettingsManager.get('priceHistoryWindowWeeks') ?? 1,
      activeOverride,
      drops,
      droppedQuantity: totalDroppedQty,
      totalChaosValue: Number(totalDroppedChaos.toFixed(2)),
    };
  }

  async setOverride(params: {
    itemIdentifier: string;
    category?: string;
    price: number;
    currencyType?: 'chaos' | 'divine' | 'perChaos';
    inputPrice?: number;
    league?: string;
  }): Promise<PriceOverrideRow | null> {
    const activeProfile = SettingsManager.get('activeProfile');
    const league = params.league || activeProfile?.league || 'Standard';
    const currencyType = params.currencyType || 'chaos';
    const inputPrice = params.inputPrice !== undefined ? params.inputPrice : params.price;

    let chaosPrice = params.price;
    if (currencyType === 'divine' && inputPrice !== null && inputPrice !== undefined) {
      const divineRate = await this.getDivineRate(league);
      chaosPrice = Number((inputPrice * divineRate).toFixed(2));
    } else if (currencyType === 'perChaos' && inputPrice) {
      // "X items per chaos" is the natural way to think about sub-1c items;
      // convert to the underlying per-unit chaos price for storage/display.
      chaosPrice = Number((1 / inputPrice).toFixed(6));
    }

    return await PriceOverridesRepository.setOverride({
      league,
      itemIdentifier: params.itemIdentifier,
      category: params.category,
      price: chaosPrice,
      currencyType,
      inputPrice,
    });
  }

  async deleteOverride(itemIdentifier: string, leagueParam?: string): Promise<boolean> {
    const activeProfile = SettingsManager.get('activeProfile');
    const league = leagueParam || activeProfile?.league || 'Standard';
    return await PriceOverridesRepository.deleteOverride(league, itemIdentifier);
  }

  async recalculatePrices(options: RecalculatePricesOptions = {}): Promise<{ updatedRuns: number; updatedItems: number }> {
    const activeProfile = SettingsManager.get('activeProfile');
    const league = options.league || activeProfile?.league || 'Standard';

    let fromDate: string;
    let toDate: string = dayjs().toISOString();

    if (options.relativeHours && options.relativeHours > 0) {
      fromDate = dayjs().subtract(options.relativeHours, 'hour').toISOString();
    } else if (options.timePreset === '1h') {
      fromDate = dayjs().subtract(1, 'hour').toISOString();
    } else if (options.timePreset === '3h') {
      fromDate = dayjs().subtract(3, 'hour').toISOString();
    } else if (options.timePreset === '6h') {
      fromDate = dayjs().subtract(6, 'hour').toISOString();
    } else if (options.timePreset === '12h') {
      fromDate = dayjs().subtract(12, 'hour').toISOString();
    } else if (options.timePreset === '1d') {
      fromDate = dayjs().subtract(1, 'day').toISOString();
    } else if (options.timePreset === '1w') {
      fromDate = dayjs().subtract(1, 'week').toISOString();
    } else if (options.timePreset === 'custom' && options.from) {
      fromDate = dayjs(options.from).toISOString();
      if (options.to) toDate = dayjs(options.to).toISOString();
    } else {
      // 'all' or default
      fromDate = dayjs.unix(0).toISOString();
    }

    logger.info(`Recalculating item prices from ${fromDate} to ${toDate} (league: ${league})`);

    let updatedRunsCount = 0;
    let updatedItemsCount = 0;

    try {
      const runs = await RunsRepository.getRunsFromDates(fromDate, toDate);
      for (const run of runs) {
        const items = await RunsRepository.getItemsFromRun(run.id);
        const itemsToUpdate: { value: number; originalValue: number; valuation: any; id: number; eventId: number }[] = [];

        for (const item of items) {
          const { value, explanation } = await ItemPricer.price(item, league);

          // Compute market-only price (no overrides) to keep original_value up to date
          const identifier = ItemPricer.extractItemIdentifier(item);
          const itemDate = ItemPricer.extractItemTimestamp(item).slice(0, 8);
          const marketRates = await ItemPricer.getRatesFor(itemDate, league);
          let marketValue = 0;
          if (marketRates) {
            for (const catItems of Object.values(marketRates as Record<string, Record<string, number>>)) {
              if (catItems && typeof catItems === 'object' && catItems[identifier] !== undefined) {
                const stackSize = item.stack_size ?? item.stackSize ?? 1;
                marketValue = Number((catItems[identifier] * stackSize).toFixed(2));
                break;
              }
            }
          }
          // Fall back to value if no market rate found (non-priced items, vendor recipes, etc.)
          const originalValue = marketValue || value;

          if (value !== item.value || originalValue !== item.original_value || JSON.stringify(explanation) !== item.valuation) {
            itemsToUpdate.push({
              value,
              originalValue,
              valuation: explanation,
              id: item.id,
              eventId: item.event_id,
            });
          }
        }

        if (itemsToUpdate.length > 0) {
          await RunsRepository.updateItemValues(itemsToUpdate);
          updatedItemsCount += itemsToUpdate.length;
          updatedRunsCount += 1;
        }
      }
    } catch (err) {
      logger.error('Error during price recalculation:', err);
    }

    return { updatedRuns: updatedRunsCount, updatedItems: updatedItemsCount };
  }
}

const pricesService = new PricesService();
export default pricesService;
