import priceListData from './priceList.json' with { type: 'json' };

/** Merchant-side pricing data, owned by the (simulated) upstream system rather than our catalog. */
export interface IPriceListEntry {
  price: number;
  prepMinutes: number;
}

const priceList: Readonly<Record<string, IPriceListEntry>> = Object.freeze(priceListData);

export const PriceListModel = {
  get(itemId: string): IPriceListEntry | undefined {
    return priceList[itemId];
  },
};
