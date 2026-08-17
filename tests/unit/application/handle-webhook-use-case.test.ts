import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryEventStore } from '../../mocks/in-memory-event-store-repository';
import { MockStarkBankRepository } from '../../mocks/mock-stark-bank-repository';
import { IdempotencyService } from '../../../src/application/services/idempotency-service';
import { TransferService } from '../../../src/application/services/transfer-service';
import { HandleWebhookUseCase } from '../../../src/application/use-cases/handle-webhook-use-case';
import { createLogger } from '../../../src/infrastructure/logging/logger';

const logger = createLogger('silent');

describe('HandleWebhookUseCase', () => {
  let eventStore: InMemoryEventStore;
  let starkBank: MockStarkBankRepository;
  let useCase: HandleWebhookUseCase;

  beforeEach(() => {
    eventStore = new InMemoryEventStore();
    starkBank = new MockStarkBankRepository();
    const idempotency = new IdempotencyService(eventStore);
    const transfer = new TransferService(eventStore, starkBank, logger);
    useCase = new HandleWebhookUseCase(starkBank, idempotency, transfer, logger);
  });

  it('cria transfer para invoice credited', async () => {
    starkBank.parseWebhookEvent.mockResolvedValue({
      id: 'evt-1',
      subscriptionType: 'invoice',
      logType: 'credited',
      invoice: { id: 'inv-1', amount: 10000, fee: 50, status: 'paid' },
    });
    starkBank.createTransfer.mockResolvedValue({ id: 'tr-1', amount: 9950, externalId: 'invoice-inv-1' });

    const result = await useCase.execute({ rawBody: '{}', signature: 'sig' });

    expect(result.accepted).toBe(true);
    expect(result.skipped).toBeFalsy();
    expect(starkBank.createTransfer).toHaveBeenCalledWith(
      expect.objectContaining({ externalId: 'invoice-inv-1', amount: 9950 }),
    );
    expect(eventStore.getEvent('evt-1')?.status).toBe('completed');
  });

  it('skipa evento ja completed (idempotencia)', async () => {
    starkBank.parseWebhookEvent.mockResolvedValue({
      id: 'evt-1',
      subscriptionType: 'invoice',
      logType: 'credited',
      invoice: { id: 'inv-1', amount: 10000, fee: 50, status: 'paid' },
    });
    // Primeiro processamento
    starkBank.createTransfer.mockResolvedValue({ id: 'tr-1', amount: 9950, externalId: 'invoice-inv-1' });
    await useCase.execute({ rawBody: '{}', signature: 'sig' });
    // Segundo processamento (duplicata)
    const result = await useCase.execute({ rawBody: '{}', signature: 'sig' });

    expect(result.skipped).toBe(true);
    expect(starkBank.createTransfer).toHaveBeenCalledTimes(1); // nao chama segunda vez
  });

  it('skipa evento em processing ha menos de 5min (webhook retentado em paralelo)', async () => {
    starkBank.parseWebhookEvent.mockResolvedValue({
      id: 'evt-parallel',
      subscriptionType: 'invoice',
      logType: 'credited',
      invoice: { id: 'inv-parallel', amount: 10000, fee: 50, status: 'paid' },
    });
    // Nao resolve createTransfer ainda -> simula processamento em andamento
    let resolveTransfer: (value: { id: string; amount: number; externalId: string }) => void;
    starkBank.createTransfer.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveTransfer = resolve;
        }),
    );

    const firstCall = useCase.execute({ rawBody: '{}', signature: 'sig' });
    // Aguarda o claim do primeiro acontecer antes de disparar o segundo
    await new Promise((resolve) => setImmediate(resolve));

    const second = await useCase.execute({ rawBody: '{}', signature: 'sig' });
    expect(second.skipped).toBe(true);
    expect(second.skipReason).toBe('processing');

    resolveTransfer!({ id: 'tr-parallel', amount: 9950, externalId: 'invoice-inv-parallel' });
    await firstCall;
    expect(starkBank.createTransfer).toHaveBeenCalledTimes(1);
  });

  it('retorna skipped para invoice nao-credited', async () => {
    starkBank.parseWebhookEvent.mockResolvedValue({
      id: 'evt-2',
      subscriptionType: 'invoice',
      logType: 'overdue',
      invoice: { id: 'inv-2', amount: 5000, fee: 20, status: 'overdue' },
    });
    const result = await useCase.execute({ rawBody: '{}', signature: 'sig' });
    expect(result.skipped).toBe(true);
    expect(starkBank.createTransfer).not.toHaveBeenCalled();
  });

  it('retorna skipped para invoice paga mas ainda nao credited (logType=paid)', async () => {
    // Regressao do bug: invoice.status='paid' e logType='paid' (repasse ainda nao ocorreu).
    // Antes da correcao, a condicao antiga (`invoice.status !== 'credited'`) era sempre
    // verdadeira e nenhum transfer era criado; a condicao correta (`logType !== 'credited'`)
    // precisa distinguir 'paid' de 'credited' para nao disparar transfer cedo demais.
    starkBank.parseWebhookEvent.mockResolvedValue({
      id: 'evt-paid-not-credited',
      subscriptionType: 'invoice',
      logType: 'paid',
      invoice: { id: 'inv-paid-not-credited', amount: 10000, fee: 50, status: 'paid' },
    });
    const result = await useCase.execute({ rawBody: '{}', signature: 'sig' });
    expect(result.skipped).toBe(true);
    expect(result.skipReason).toBe('not_credited');
    expect(starkBank.createTransfer).not.toHaveBeenCalled();
  });

  it('retorna skipped para subscriptionType diferente de invoice', async () => {
    starkBank.parseWebhookEvent.mockResolvedValue({
      id: 'evt-transfer',
      subscriptionType: 'transfer',
    });
    const result = await useCase.execute({ rawBody: '{}', signature: 'sig' });
    expect(result.skipped).toBe(true);
    expect(result.skipReason).toBe('not_credited');
    expect(starkBank.createTransfer).not.toHaveBeenCalled();
  });

  it('nao cria transfer quando fee >= amount', async () => {
    starkBank.parseWebhookEvent.mockResolvedValue({
      id: 'evt-3',
      subscriptionType: 'invoice',
      logType: 'credited',
      invoice: { id: 'inv-3', amount: 50, fee: 50, status: 'paid' },
    });
    const result = await useCase.execute({ rawBody: '{}', signature: 'sig' });
    expect(result.skipped).toBeFalsy();
    expect(starkBank.createTransfer).not.toHaveBeenCalled();
    expect(eventStore.getEvent('evt-3')?.status).toBe('completed');
  });

  it('lanca erro para assinatura invalida', async () => {
    starkBank.parseWebhookEvent.mockRejectedValue(new Error('InvalidSignature'));
    await expect(useCase.execute({ rawBody: '{}', signature: 'bad' })).rejects.toThrow();
  });

  it('propaga erro de transfer.createTransfer (para que o caller registre failed)', async () => {
    starkBank.parseWebhookEvent.mockResolvedValue({
      id: 'evt-4',
      subscriptionType: 'invoice',
      logType: 'credited',
      invoice: { id: 'inv-4', amount: 10000, fee: 50, status: 'paid' },
    });
    starkBank.createTransfer.mockRejectedValue(new Error('stark bank unavailable'));

    await expect(useCase.execute({ rawBody: '{}', signature: 'sig' })).rejects.toThrow('stark bank unavailable');
    expect(eventStore.getEvent('evt-4')?.status).toBe('failed');
  });
});
