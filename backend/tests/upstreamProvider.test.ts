import { describe, expect, it } from 'vitest';
import { UpstreamProvider } from '../src/services/upstreamProvider.js';
import { UpstreamError } from '../src/utils/UpstreamError.js';

const instant = { minLatencyMs: 0, maxLatencyMs: 0, slowRate: 0 };

describe('UpstreamProvider', () => {
  it('returns an offer from the price list', async () => {
    const provider = new UpstreamProvider({ ...instant, failureRate: 0, random: () => 0.5 });
    const offer = await provider.getOffer('itm-001');

    expect(offer).toEqual({
      itemId: 'itm-001',
      price: 109.9,
      currency: 'ZAR',
      availability: 'in_stock',
      deliveryEstimateMinutes: 15 + 15 + 10,
    });
  });

  it('fails with reason "unavailable" when the failure roll hits', async () => {
    const provider = new UpstreamProvider({ ...instant, failureRate: 1 });
    await expect(provider.getOffer('itm-001')).rejects.toMatchObject({
      name: 'UpstreamError',
      reason: 'unavailable',
    });
  });

  it('fails with reason "not_found" for an unknown item', async () => {
    const provider = new UpstreamProvider({ ...instant, failureRate: 0 });
    const error = await provider.getOffer('nope').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(UpstreamError);
    expect((error as UpstreamError).reason).toBe('not_found');
  });

  it('applies slow-outlier latency', async () => {
    const provider = new UpstreamProvider({ ...instant, slowRate: 1, slowLatencyMs: 50, failureRate: 0, random: () => 0.5 });
    const started = performance.now();
    await provider.getOffer('itm-001');
    // 50ms * (0.8 + 0.5 * 0.4) = 50ms; allow for timer imprecision.
    expect(performance.now() - started).toBeGreaterThanOrEqual(45);
  });

  it('produces a mix of outcomes under default-style settings', async () => {
    const provider = new UpstreamProvider({ ...instant, failureRate: 0.3 });
    const results = await Promise.allSettled(Array.from({ length: 200 }, () => provider.getOffer('itm-001')));
    const failures = results.filter((r) => r.status === 'rejected').length;
    expect(failures).toBeGreaterThan(20);
    expect(failures).toBeLessThan(110);
  });
});
