import type { IOffer } from '../interfaces/IOffer.js';
import type { IOfferProvider } from '../interfaces/IOfferProvider.js';
import { PriceListModel } from '../models/PriceListModel.js';
import type { Availability } from '../types/search.js';
import { config } from '../utils/config.js';
import { sleep } from '../utils/sleep.js';
import { UpstreamError } from '../utils/UpstreamError.js';

export interface UpstreamProviderOptions {
  /** Normal responses take a uniformly random time in [minLatencyMs, maxLatencyMs]. */
  minLatencyMs: number;
  maxLatencyMs: number;
  /** Probability (0–1) that a call is a slow outlier taking ~slowLatencyMs instead. */
  slowRate: number;
  slowLatencyMs: number;
  /** Probability (0–1) that a call fails after its latency has elapsed. */
  failureRate: number;
  /** Injectable for deterministic tests. Must return a number in [0, 1). */
  random: () => number;
}

/**
 * Simulated in-process upstream pricing/availability provider.
 *
 * Behaves like a flaky remote dependency: each call has variable latency,
 * occasional slow outliers and occasional failures. It deliberately has no
 * timeout of its own; callers decide how long they are willing to wait.
 */
export class UpstreamProvider implements IOfferProvider {
  private readonly options: UpstreamProviderOptions;

  constructor(options: Partial<UpstreamProviderOptions> = {}) {
    this.options = { ...config.upstream, random: Math.random, ...options };
  }

  async getOffer(itemId: string): Promise<IOffer> {
    const { random, failureRate } = this.options;

    await sleep(this.latency());

    if (random() < failureRate) {
      throw new UpstreamError('unavailable', `Upstream failed to price item ${itemId}`);
    }

    const entry = PriceListModel.get(itemId);
    if (!entry) {
      throw new UpstreamError('not_found', `Upstream has no price for item ${itemId}`);
    }

    const availability = this.availability();
    return {
      itemId,
      price: entry.price,
      currency: 'ZAR',
      availability,
      // Prep time plus 15–35 minutes of travel.
      deliveryEstimateMinutes: entry.prepMinutes + 15 + Math.floor(random() * 21),
    };
  }

  private latency(): number {
    const { random, minLatencyMs, maxLatencyMs, slowRate, slowLatencyMs } = this.options;
    if (random() < slowRate) {
      // Jitter slow outliers ±20% so they don't all land at once.
      return slowLatencyMs * (0.8 + random() * 0.4);
    }
    return minLatencyMs + random() * (maxLatencyMs - minLatencyMs);
  }

  private availability(): Availability {
    const roll = this.options.random();
    if (roll < 0.08) return 'out_of_stock';
    if (roll < 0.2) return 'low_stock';
    return 'in_stock';
  }
}

export const upstreamProvider = new UpstreamProvider();
