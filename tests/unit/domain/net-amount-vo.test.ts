import { describe, it, expect } from 'vitest';
import { calculateNetAmount } from '../../../src/domain/value-objects/net-amount-vo';

describe('calculateNetAmount', () => {
  it('retorna amount - fee quando fee < amount', () => {
    expect(calculateNetAmount(10000, 50)).toBe(9950);
  });
  it('retorna null quando fee === amount', () => {
    expect(calculateNetAmount(50, 50)).toBeNull();
  });
  it('retorna null quando fee > amount', () => {
    expect(calculateNetAmount(30, 50)).toBeNull();
  });
  it('retorna amount quando fee === 0', () => {
    expect(calculateNetAmount(1000, 0)).toBe(1000);
  });
});
