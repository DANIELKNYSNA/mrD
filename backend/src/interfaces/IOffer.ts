import type { Availability } from '../types/search.js';

/** Live data returned by the simulated upstream provider for one item. */
export interface IOffer {
  itemId: string;
  price: number;
  currency: string;
  availability: Availability;
  deliveryEstimateMinutes: number;
}
