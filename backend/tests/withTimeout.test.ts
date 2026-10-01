import { describe, expect, it } from 'vitest';
import { sleep } from '../src/utils/sleep.js';
import { TimeoutError, withTimeout } from '../src/utils/withTimeout.js';

describe('withTimeout', () => {
  it('resolves when the promise settles in time', async () => {
    await expect(withTimeout(sleep(5).then(() => 'done'), 100)).resolves.toBe('done');
  });

  it('rejects with TimeoutError when the promise is too slow', async () => {
    await expect(withTimeout(sleep(100), 10)).rejects.toBeInstanceOf(TimeoutError);
  });

  it('passes through the original rejection', async () => {
    await expect(withTimeout(Promise.reject(new Error('boom')), 100)).rejects.toThrow('boom');
  });
});
