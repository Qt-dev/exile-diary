import DB from '../index';
import Logger from 'electron-log';

const logger = Logger.scope('db/priceOverrides');

export type PriceOverrideRow = {
  item_identifier: string;
  category?: string | null;
  price: number;
  currency_type: 'chaos' | 'divine' | 'perChaos';
  input_price: number;
  updated_at: string;
};

export type SetOverrideParams = {
  league: string;
  itemIdentifier: string;
  category?: string;
  price: number;
  currencyType?: 'chaos' | 'divine' | 'perChaos';
  inputPrice?: number;
};

async function ensureLeagueDb(league: string) {
  await DB.initLeagueDB(league, '');
}

const priceOverrides = {
  setOverride: async (params: SetOverrideParams): Promise<PriceOverrideRow | null> => {
    const {
      league,
      itemIdentifier,
      category = '',
      price,
      currencyType = 'chaos',
      inputPrice = price,
    } = params;

    logger.info(
      `Setting static price override for "${itemIdentifier}" (league: ${league}, price: ${price} ${currencyType})`
    );

    const query = `
      INSERT INTO price_overrides (
        item_identifier,
        category,
        price,
        currency_type,
        input_price,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(item_identifier) DO UPDATE SET
        price = excluded.price,
        category = coalesce(excluded.category, price_overrides.category),
        currency_type = excluded.currency_type,
        input_price = excluded.input_price,
        updated_at = datetime('now')
    `;

    try {
      await ensureLeagueDb(league);
      await DB.run(
        query,
        [itemIdentifier, category, price, currencyType, inputPrice],
        league
      );

      return await priceOverrides.getOverride(league, itemIdentifier);
    } catch (err) {
      logger.error(
        `Error setting price override for ${itemIdentifier} (league: ${league}): ${JSON.stringify(err)}`
      );
      return null;
    }
  },

  getOverride: async (
    league: string,
    itemIdentifier: string
  ): Promise<PriceOverrideRow | null> => {
    const query = `
      SELECT * FROM price_overrides
      WHERE item_identifier = ?
      LIMIT 1
    `;

    try {
      await ensureLeagueDb(league);
      const rows = (await DB.all(query, [itemIdentifier], league)) as
        | PriceOverrideRow[]
        | null;
      return rows?.[0] ?? null;
    } catch (err) {
      logger.error(
        `Error getting price override for ${itemIdentifier} (league: ${league}): ${JSON.stringify(err)}`
      );
      return null;
    }
  },

  getAllOverrides: async (league: string): Promise<PriceOverrideRow[]> => {
    const query = `
      SELECT * FROM price_overrides
      ORDER BY updated_at DESC
    `;

    try {
      await ensureLeagueDb(league);
      const rows = (await DB.all(query, [], league)) as PriceOverrideRow[];
      return rows || [];
    } catch (err) {
      logger.error(
        `Error getting all price overrides (league: ${league}): ${JSON.stringify(err)}`
      );
      return [];
    }
  },

  deleteOverride: async (league: string, itemIdentifier: string): Promise<boolean> => {
    logger.info(`Deleting price override for "${itemIdentifier}" (league: ${league})`);
    const query = 'DELETE FROM price_overrides WHERE item_identifier = ?';

    try {
      await ensureLeagueDb(league);
      await DB.run(query, [itemIdentifier], league);
      return true;
    } catch (err) {
      logger.error(`Error deleting price override for ${itemIdentifier}: ${JSON.stringify(err)}`);
      return false;
    }
  },

  getAllOverrideIdentities: async (league: string): Promise<string[]> => {
    const query = 'SELECT item_identifier FROM price_overrides';
    try {
      await ensureLeagueDb(league);
      const rows = (await DB.all(query, [], league)) as { item_identifier: string }[];
      return rows?.map((r) => r.item_identifier) || [];
    } catch (err) {
      logger.error(`Error getting override identities: ${JSON.stringify(err)}`);
      return [];
    }
  },
};

export default priceOverrides;
