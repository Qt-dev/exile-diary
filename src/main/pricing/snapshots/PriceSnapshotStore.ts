import DB from '../../db/repositories/rates';
import { readSnapshotCategories } from './legacySnapshotAdapter';

class PriceSnapshotStore {
  rates: {
    [key: string]: {
      [key: string]: any;
    };
  } = {};

  async fetchRatesForDay(league: string, date: string): Promise<any> {
    const rates = readSnapshotCategories(await DB.getFullRates(league, date));
    this.rates[date] = this.rates[date] || {};
    this.rates[date][league] = rates;
    return rates;
  }

  async getCurrencyValue(league: string, date: string, currency: string): Promise<number> {
    if (!this.rates[date] || !this.rates[date][league]) {
      await this.fetchRatesForDay(league, date);
    }
    if (
      !this.rates[date] ||
      !this.rates[date][league] ||
      !this.rates[date][league]['Currency'] ||
      !this.rates[date][league]['Currency'][currency]
    ) {
      return 0;
    }
    return this.rates[date][league]['Currency'][currency];
  }
}

const ratesManager = new PriceSnapshotStore();

export default ratesManager;
