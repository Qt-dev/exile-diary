import DB from './db/rates';
// TODO: Flesh this out later from RatesGetterV2

class RatesManager {
  rates: {
    [key: string]: {
      [key: string]: any;
    };
  } = {};

  async fetchRatesForDay(league: string, date: string): Promise<any> {
    const rates = await DB.getFullRates(league, date);
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

const ratesManager = new RatesManager();

export default ratesManager;
