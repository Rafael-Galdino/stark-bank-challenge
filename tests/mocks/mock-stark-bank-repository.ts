import { vi } from 'vitest';
import { StarkBankRepository } from '../../src/domain/repositories/stark-bank-repository';

/**
 * Mock do StarkBankRepository com vi.fn() para controle total de respostas
 * em testes unitarios e de integracao. Nenhuma chamada real e feita a
 * Stark Bank.
 *
 * Uso:
 *   const starkBank = new MockStarkBankRepository();
 *   starkBank.parseWebhookEvent.mockResolvedValue({ ... });
 *   starkBank.createTransfer.mockResolvedValue({ ... });
 */
export class MockStarkBankRepository implements StarkBankRepository {
  parseWebhookEvent = vi.fn<StarkBankRepository['parseWebhookEvent']>();
  createInvoice = vi.fn<StarkBankRepository['createInvoice']>();
  createTransfer = vi.fn<StarkBankRepository['createTransfer']>();
  findTransferByExternalId = vi.fn<StarkBankRepository['findTransferByExternalId']>();
}
