import { describe, it, expect, vi } from 'vitest';
import { withRetry } from '../../../src/infrastructure/http/retry';

describe('withRetry', () => {
  it('retorna resultado na primeira tentativa se nao houver erro', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await withRetry(fn, 3, 10, 100);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retenta apos falha e retorna na segunda tentativa', async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error('fail')).mockResolvedValue('ok');
    const result = await withRetry(fn, 3, 1, 10);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('lanca erro apos maxAttempts', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('always fail'));
    await expect(withRetry(fn, 3, 1, 10)).rejects.toThrow('always fail');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('aplica backoff exponencial com limite em maxDelay', async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error('fail once')).mockResolvedValue('ok');
    const start = Date.now();
    await withRetry(fn, 3, 50, 60);
    const elapsed = Date.now() - start;
    // delay = min(50 * 2^0, 60) + jitter(0-100) >= 50ms
    expect(elapsed).toBeGreaterThanOrEqual(45);
  });
});
