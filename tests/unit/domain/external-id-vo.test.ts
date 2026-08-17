import { describe, it, expect } from 'vitest';
import { buildExternalId } from '../../../src/domain/value-objects/external-id-vo';

describe('buildExternalId', () => {
  it('gera externalId no formato invoice-{invoiceId}', () => {
    expect(buildExternalId('inv-123')).toBe('invoice-inv-123');
  });

  it('preserva o invoiceId original sem transformacao', () => {
    expect(buildExternalId('ABC-999')).toBe('invoice-ABC-999');
  });
});
