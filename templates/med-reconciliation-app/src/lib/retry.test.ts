import { describe, expect, it, vi } from 'vitest';
import { retryWithBackoff } from './retry';

const noWait = () => Promise.resolve();

describe('retryWithBackoff', () => {
  it('succeeds on the first try with no delay', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await retryWithBackoff(fn, [200, 500, 1000], noWait);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('succeeds on a later try after earlier failures, waiting between each', async () => {
    const waits: number[] = [];
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockResolvedValue('ok');

    const result = await retryWithBackoff(fn, [200, 500, 1000], async (ms) => {
      waits.push(ms);
    });

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
    expect(waits).toEqual([200, 500]);
  });

  it('exhausts all delays and rejects with the last error when every attempt fails', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockRejectedValueOnce(new Error('fail 3'))
      .mockRejectedValueOnce(new Error('final failure'));

    await expect(retryWithBackoff(fn, [200, 500, 1000], noWait)).rejects.toThrow('final failure');
    expect(fn).toHaveBeenCalledTimes(4); // 1 initial + 3 retries — the bound is delaysMs.length
  });
});
