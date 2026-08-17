import { describe, it, expect } from 'vitest';
import { InMemoryEventStore } from '../../mocks/in-memory-event-store-repository';
import { MockStarkBankRepository } from '../../mocks/mock-stark-bank-repository';
import { InvoiceService } from '../../../src/application/services/invoice-service';
import { RunSchedulerUseCase, SchedulerConfig } from '../../../src/application/use-cases/run-scheduler-use-case';
import { buildCycleWindowId } from '../../../src/domain/value-objects/cycle-window-vo';
import { createLogger } from '../../../src/infrastructure/logging/logger';

const logger = createLogger('silent');

const DEFAULT_CONFIG: SchedulerConfig = {
  cycleMinutes: 180,
  totalPeriodMinutes: 1440,
  maxCycles: 8,
};

function makeSchedulerUseCaseWith(
  store: InMemoryEventStore,
  starkBank: MockStarkBankRepository,
  config: SchedulerConfig = DEFAULT_CONFIG,
): RunSchedulerUseCase {
  const invoiceService = new InvoiceService(starkBank);
  return new RunSchedulerUseCase(store, invoiceService, logger, config);
}

function makeSchedulerUseCase(store: InMemoryEventStore, config: SchedulerConfig = DEFAULT_CONFIG): RunSchedulerUseCase {
  return makeSchedulerUseCaseWith(store, new MockStarkBankRepository(), config);
}

describe('RunSchedulerUseCase', () => {
  it('guard period_expired: skipa se agora >= deadline', async () => {
    const store = new InMemoryEventStore();
    const pastDeadline = new Date(Date.now() - 1000);
    store.setRunConfig({
      startedAt: new Date(Date.now() - 1441 * 60 * 1000),
      deadlineAt: pastDeadline,
      maxCycles: 8,
      cycleMinutes: 180,
      totalPeriodMinutes: 1440,
    });
    const useCase = makeSchedulerUseCase(store);
    const result = await useCase.execute();
    expect(result.skipped).toBe(true);
    expect(result.skipReason).toBe('period_expired');
  });

  it('guard max_cycles_reached: skipa se completedCycles >= maxCycles', async () => {
    const store = new InMemoryEventStore();
    store.setRunConfig({
      startedAt: new Date(),
      deadlineAt: new Date(Date.now() + 9999999),
      maxCycles: 8,
      cycleMinutes: 180,
      totalPeriodMinutes: 1440,
    });
    store.setCompletedCycles(8);
    const useCase = makeSchedulerUseCase(store);
    const result = await useCase.execute();
    expect(result.skipped).toBe(true);
    expect(result.skipReason).toBe('max_cycles_reached');
  });

  it('guard duplicate_cycle: skipa se ciclo ja adquirido', async () => {
    const store = new InMemoryEventStore();
    store.setRunConfig({
      startedAt: new Date(),
      deadlineAt: new Date(Date.now() + 9999999),
      maxCycles: 8,
      cycleMinutes: 180,
      totalPeriodMinutes: 1440,
    });
    store.setCompletedCycles(0);
    const starkBank = new MockStarkBankRepository();
    starkBank.createInvoice.mockResolvedValue({ id: 'inv-x', amount: 5000, name: 'Test', taxId: '123' });
    const useCase = makeSchedulerUseCaseWith(store, starkBank);
    await useCase.execute(); // adquire o ciclo
    const result = await useCase.execute(); // segunda execucao (mesmo cycleId)
    expect(result.skipped).toBe(true);
    expect(result.skipReason).toBe('duplicate_cycle');
  });

  it('recupera um ciclo travado em running ha mais de 10min (worker anterior crashou), em vez de skipar para sempre', async () => {
    const store = new InMemoryEventStore();
    store.setRunConfig({
      startedAt: new Date(),
      deadlineAt: new Date(Date.now() + 9999999),
      maxCycles: 8,
      cycleMinutes: 180,
      totalPeriodMinutes: 1440,
    });
    store.setCompletedCycles(0);

    // Simula um worker anterior que adquiriu o lock e crashou no meio do
    // lote de invoices (nunca chamou completeSchedulerCycle) - o cycleId
    // precisa bater exatamente com o que execute() vai calcular para "agora".
    const cycleId = buildCycleWindowId(new Date(), 180);
    await store.tryAcquireSchedulerCycle(cycleId);
    store.forceStaleSchedulerCycle(cycleId);

    const starkBank = new MockStarkBankRepository();
    starkBank.createInvoice.mockResolvedValue({ id: 'inv-x', amount: 5000, name: 'Test', taxId: '123' });
    const useCase = makeSchedulerUseCaseWith(store, starkBank);

    const result = await useCase.execute();
    expect(result.skipped).toBe(false);
    expect(result.status).toBe('completed');
    expect(result.invoiceCount).toBeGreaterThanOrEqual(8);
  });

  it('guards sao verificados na ordem: period_expired > max_cycles_reached > duplicate_cycle', async () => {
    const store = new InMemoryEventStore();
    // period_expired vence sobre max_cycles_reached mesmo se completedCycles >= maxCycles
    store.setRunConfig({
      startedAt: new Date(Date.now() - 2000 * 60 * 1000),
      deadlineAt: new Date(Date.now() - 1000),
      maxCycles: 8,
      cycleMinutes: 180,
      totalPeriodMinutes: 1440,
    });
    store.setCompletedCycles(8);
    const useCase = makeSchedulerUseCase(store);
    const result = await useCase.execute();
    expect(result.skipReason).toBe('period_expired');
  });

  it('emite entre 8 e 12 invoices em ciclo valido', async () => {
    const store = new InMemoryEventStore();
    const starkBank = new MockStarkBankRepository();
    starkBank.createInvoice.mockResolvedValue({ id: 'inv-x', amount: 5000, name: 'Test', taxId: '123' });
    const useCase = makeSchedulerUseCaseWith(store, starkBank);
    const result = await useCase.execute();
    expect(result.skipped).toBe(false);
    expect(result.invoiceCount).toBeGreaterThanOrEqual(8);
    expect(result.invoiceCount).toBeLessThanOrEqual(12);
    expect(result.status).toBe('completed');
  });

  it('marca ciclo como partial_failure quando alguma invoice falha, sem derrubar o lote', async () => {
    const store = new InMemoryEventStore();
    const starkBank = new MockStarkBankRepository();
    starkBank.createInvoice
      .mockResolvedValueOnce({ id: 'inv-1', amount: 5000, name: 'Test', taxId: '123' })
      .mockRejectedValueOnce(new Error('stark bank unavailable'))
      .mockResolvedValue({ id: 'inv-n', amount: 5000, name: 'Test', taxId: '123' });
    const useCase = makeSchedulerUseCaseWith(store, starkBank);
    const result = await useCase.execute();
    expect(result.status).toBe('partial_failure');
    expect(result.invoiceCount).toBeGreaterThanOrEqual(7);
  });
});
