import { describe, it, expect, vi } from 'vitest';
import { InMemoryEventStore } from '../../mocks/in-memory-event-store-repository';
import { MockStarkBankRepository } from '../../mocks/mock-stark-bank-repository';
import { IdempotencyService } from '../../../src/application/services/idempotency-service';
import { TransferService } from '../../../src/application/services/transfer-service';
import { RunReconciliationUseCase } from '../../../src/application/use-cases/run-reconciliation-use-case';
import { createLogger } from '../../../src/infrastructure/logging/logger';

const logger = createLogger('silent');

function makeReconciliationUseCase(store: InMemoryEventStore, starkBank: MockStarkBankRepository) {
  const idempotency = new IdempotencyService(store);
  const transfer = new TransferService(store, starkBank, logger);
  return new RunReconciliationUseCase(store, idempotency, transfer, logger);
}

describe('RunReconciliationUseCase', () => {
  it('retenta eventos failed', async () => {
    const store = new InMemoryEventStore();
    // Insere evento failed diretamente
    await store.claimWebhookEvent({ eventId: 'evt-f', invoiceId: 'inv-f', amount: 1000, fee: 10, netAmount: 990 });
    await store.failWebhookEvent('evt-f', 'timeout');

    const starkBank = new MockStarkBankRepository();
    starkBank.createTransfer.mockResolvedValue({ id: 'tr-r', amount: 990, externalId: 'invoice-inv-f' });
    const useCase = makeReconciliationUseCase(store, starkBank);

    const result = await useCase.execute();
    expect(result.retried).toBe(1);
    expect(result.completed).toBe(1);
    expect(result.failed).toBe(0);
    expect(store.getEvent('evt-f')?.status).toBe('completed');
  });

  it('retenta eventos stale (processing > 5min)', async () => {
    const store = new InMemoryEventStore();
    await store.claimWebhookEvent({ eventId: 'evt-s', invoiceId: 'inv-s', amount: 2000, fee: 20, netAmount: 1980 });
    store.forceStalEvent('evt-s'); // simula updatedAt = 10min atras

    const starkBank = new MockStarkBankRepository();
    starkBank.createTransfer.mockResolvedValue({ id: 'tr-s', amount: 1980, externalId: 'invoice-inv-s' });
    const useCase = makeReconciliationUseCase(store, starkBank);

    const result = await useCase.execute();
    expect(result.retried).toBe(1);
    expect(result.completed).toBe(1);
  });

  it('nao retenta eventos processing recentes (< 5min)', async () => {
    const store = new InMemoryEventStore();
    await store.claimWebhookEvent({ eventId: 'evt-recent', invoiceId: 'inv-r', amount: 2000, fee: 20, netAmount: 1980 });

    const starkBank = new MockStarkBankRepository();
    const useCase = makeReconciliationUseCase(store, starkBank);

    const result = await useCase.execute();
    expect(result.retried).toBe(0);
    expect(starkBank.createTransfer).not.toHaveBeenCalled();
  });

  it('contabiliza falha individual sem interromper a reconciliacao', async () => {
    const store = new InMemoryEventStore();
    await store.claimWebhookEvent({ eventId: 'evt-a', invoiceId: 'inv-a', amount: 1000, fee: 10, netAmount: 990 });
    await store.failWebhookEvent('evt-a', 'timeout');
    await store.claimWebhookEvent({ eventId: 'evt-b', invoiceId: 'inv-b', amount: 2000, fee: 10, netAmount: 1990 });
    await store.failWebhookEvent('evt-b', 'timeout');

    const starkBank = new MockStarkBankRepository();
    starkBank.createTransfer
      .mockRejectedValueOnce(new Error('still failing'))
      .mockResolvedValueOnce({ id: 'tr-b', amount: 1990, externalId: 'invoice-inv-b' });
    const useCase = makeReconciliationUseCase(store, starkBank);

    const result = await useCase.execute();
    expect(result.retried).toBe(2);
    expect(result.completed).toBe(1);
    expect(result.failed).toBe(1);
  });

  it('re-adquire o claim via idempotency antes de chamar transfer, e pula sem chamar a Stark Bank quando o claim e perdido', async () => {
    const store = new InMemoryEventStore();
    await store.claimWebhookEvent({ eventId: 'evt-race', invoiceId: 'inv-race', amount: 1000, fee: 10, netAmount: 990 });
    await store.failWebhookEvent('evt-race', 'timeout');

    const starkBank = new MockStarkBankRepository();
    // Simula uma execucao concorrente (outro disparo do Cloud Scheduler, ou
    // uma reentrega de webhook) que ja adquiriu o claim para este evento -
    // o claim transacional deve fazer esta reconciliacao recuar sem chamar
    // a Stark Bank, em vez de competir pelo mesmo externalId.
    const idempotency = { claimEvent: vi.fn().mockResolvedValue({ action: 'skip', reason: 'processing' }) };
    const transfer = new TransferService(store, starkBank, logger);
    const useCase = new RunReconciliationUseCase(store, idempotency as never, transfer, logger);

    const result = await useCase.execute();

    expect(idempotency.claimEvent).toHaveBeenCalledWith({
      eventId: 'evt-race',
      invoiceId: 'inv-race',
      amount: 1000,
      fee: 10,
    });
    expect(starkBank.createTransfer).not.toHaveBeenCalled();
    expect(result).toEqual({ retried: 1, completed: 0, failed: 0 });
  });
});
