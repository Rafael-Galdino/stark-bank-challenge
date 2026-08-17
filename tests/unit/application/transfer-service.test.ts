import { describe, it, expect, beforeEach } from 'vitest';
import { TransferService } from '../../../src/application/services/transfer-service';
import { InMemoryEventStore } from '../../mocks/in-memory-event-store-repository';
import { MockStarkBankRepository } from '../../mocks/mock-stark-bank-repository';
import { createLogger } from '../../../src/infrastructure/logging/logger';

const silentLogger = createLogger('silent');

describe('TransferService', () => {
  let eventStore: InMemoryEventStore;
  let starkBank: MockStarkBankRepository;
  let service: TransferService;

  beforeEach(async () => {
    eventStore = new InMemoryEventStore();
    starkBank = new MockStarkBankRepository();
    service = new TransferService(eventStore, starkBank, silentLogger);

    await eventStore.claimWebhookEvent({
      eventId: 'evt-1',
      invoiceId: 'inv-1',
      amount: 10000,
      fee: 50,
      netAmount: 9950,
    });
  });

  it('completa o evento e retorna o transferId quando a Stark Bank cria o transfer com sucesso', async () => {
    starkBank.createTransfer.mockResolvedValue({ id: 'tr-1', amount: 9950, externalId: 'invoice-inv-1' });

    const result = await service.createTransfer({ eventId: 'evt-1', invoiceId: 'inv-1', amount: 10000, fee: 50 });

    expect(result).toEqual({ transferId: 'tr-1', skipped: false });
    expect(eventStore.getEvent('evt-1')?.status).toBe('completed');
    expect(eventStore.getEvent('evt-1')?.transferId).toBe('tr-1');
  });

  it('pula sem chamar a Stark Bank quando fee >= amount', async () => {
    await eventStore.claimWebhookEvent({
      eventId: 'evt-fee',
      invoiceId: 'inv-fee',
      amount: 100,
      fee: 100,
      netAmount: 0,
    });

    const result = await service.createTransfer({ eventId: 'evt-fee', invoiceId: 'inv-fee', amount: 100, fee: 100 });

    expect(result).toEqual({ skipped: true, skipReason: 'fee_gte_amount' });
    expect(starkBank.createTransfer).not.toHaveBeenCalled();
    expect(eventStore.getEvent('evt-fee')?.status).toBe('completed');
  });

  it('recupera como sucesso quando createTransfer falha por externalId duplicado mas o transfer ja existe', async () => {
    starkBank.createTransfer.mockRejectedValue(new Error('Duplicated externalIds will cause failures'));
    starkBank.findTransferByExternalId.mockResolvedValue({
      id: 'tr-existing',
      amount: 9950,
      externalId: 'invoice-inv-1',
    });

    const result = await service.createTransfer({ eventId: 'evt-1', invoiceId: 'inv-1', amount: 10000, fee: 50 });

    expect(result).toEqual({ transferId: 'tr-existing', skipped: false });
    expect(eventStore.getEvent('evt-1')?.status).toBe('completed');
    expect(eventStore.getEvent('evt-1')?.transferId).toBe('tr-existing');
    expect(starkBank.findTransferByExternalId).toHaveBeenCalledWith('invoice-inv-1', '20.018.183/0001-80');
  });

  it('marca como failed e relanca quando createTransfer falha e nenhum transfer existente e encontrado', async () => {
    starkBank.createTransfer.mockRejectedValue(new Error('stark bank unavailable'));
    starkBank.findTransferByExternalId.mockResolvedValue(null);

    await expect(
      service.createTransfer({ eventId: 'evt-1', invoiceId: 'inv-1', amount: 10000, fee: 50 }),
    ).rejects.toThrow('stark bank unavailable');

    expect(eventStore.getEvent('evt-1')?.status).toBe('failed');
    expect(eventStore.getEvent('evt-1')?.lastError).toBe('stark bank unavailable');
  });

  it('marca como failed usando o erro original quando a propria busca de recuperacao falha', async () => {
    starkBank.createTransfer.mockRejectedValue(new Error('stark bank unavailable'));
    starkBank.findTransferByExternalId.mockRejectedValue(new Error('network error during lookup'));

    await expect(
      service.createTransfer({ eventId: 'evt-1', invoiceId: 'inv-1', amount: 10000, fee: 50 }),
    ).rejects.toThrow('stark bank unavailable');

    expect(eventStore.getEvent('evt-1')?.status).toBe('failed');
    expect(eventStore.getEvent('evt-1')?.lastError).toBe('stark bank unavailable');
  });
});
