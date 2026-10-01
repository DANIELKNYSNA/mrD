import type { IOffer } from './IOffer.js';

/** Anything that can price an item. Lets tests swap in a fake upstream. */
export interface IOfferProvider {
  getOffer(itemId: string): Promise<IOffer>;
}
