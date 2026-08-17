import { CreatedInvoice } from '../../src/domain/repositories/stark-bank-repository';

export function makeCreatedInvoice(overrides: Partial<CreatedInvoice> = {}): CreatedInvoice {
  return {
    id: 'inv-fixture-1',
    amount: 10000,
    name: 'Ana Silva',
    taxId: '123.456.789-09',
    ...overrides,
  };
}
