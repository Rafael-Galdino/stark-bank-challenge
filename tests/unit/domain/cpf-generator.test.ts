import { describe, it, expect } from 'vitest';
import { generateCpf } from '../../../src/domain/value-objects/invoice-draft-vo';

function validateCpf(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, '').split('').map(Number);
  if (digits.length !== 11) return false;
  if (digits.every((d) => d === digits[0])) return false;

  let sum = digits.slice(0, 9).reduce((acc, d, i) => acc + d * (10 - i), 0);
  let r = sum % 11;
  if ((r < 2 ? 0 : 11 - r) !== digits[9]) return false;

  sum = digits.slice(0, 10).reduce((acc, d, i) => acc + d * (11 - i), 0);
  r = sum % 11;
  return (r < 2 ? 0 : 11 - r) === digits[10];
}

describe('generateCpf', () => {
  it('gera CPF valido', () => {
    for (let i = 0; i < 100; i++) {
      expect(validateCpf(generateCpf())).toBe(true);
    }
  });
  it('gera CPF no formato XXX.XXX.XXX-XX', () => {
    expect(generateCpf()).toMatch(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/);
  });
});
