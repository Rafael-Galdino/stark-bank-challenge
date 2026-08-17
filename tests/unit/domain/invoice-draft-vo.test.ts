import { describe, it, expect } from 'vitest';
import { generateInvoiceDraft } from '../../../src/domain/value-objects/invoice-draft-vo';

describe('generateInvoiceDraft', () => {
  it('amount esta entre 1000 e 50000 centavos', () => {
    for (let i = 0; i < 50; i++) {
      const draft = generateInvoiceDraft();
      expect(draft.amount).toBeGreaterThanOrEqual(1000);
      expect(draft.amount).toBeLessThanOrEqual(50000);
    }
  });
  it('possui name e taxId preenchidos', () => {
    const draft = generateInvoiceDraft();
    expect(draft.name).toBeTruthy();
    expect(draft.taxId).toBeTruthy();
  });
});
