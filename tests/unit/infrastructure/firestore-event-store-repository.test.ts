import { describe, it, expect, beforeEach } from 'vitest';
import { Timestamp } from '@google-cloud/firestore';
import { FirestoreEventStoreRepository } from '../../../src/infrastructure/repositories/firestore-event-store-repository';
import { FakeFirestore } from '../../mocks/fake-firestore';

/**
 * Testes da barreira 1 de idempotencia (claim transacional por eventId) e
 * do lock de ciclo do scheduler, exercitados contra a implementacao REAL
 * de producao (FirestoreEventStoreRepository), nao contra o
 * InMemoryEventStore usado nos demais testes. Isso evita que um bug na
 * implementacao real fique mascarado por uma logica equivalente, porem
 * duplicada, no mock usado pelos testes de aplicacao.
 *
 * O Firestore e substituido por um fake em memoria (sem I/O de rede) que
 * implementa o subconjunto da API realmente utilizado pelo repositorio.
 */
describe('FirestoreEventStoreRepository', () => {
  let db: FakeFirestore;
  let repo: FirestoreEventStoreRepository;

  beforeEach(() => {
    db = new FakeFirestore();
    repo = new FirestoreEventStoreRepository(db as unknown as ConstructorParameters<typeof FirestoreEventStoreRepository>[0]);
  });

  describe('claimWebhookEvent', () => {
    it('cria o evento com status processing quando ele nao existe (process)', async () => {
      const result = await repo.claimWebhookEvent({
        eventId: 'evt-1',
        invoiceId: 'inv-1',
        amount: 10000,
        fee: 50,
        netAmount: 9950,
      });
      expect(result).toEqual({ action: 'process' });

      const stored = db.store.get('webhook_events/evt-1');
      expect(stored?.status).toBe('processing');
      expect(stored?.attempts).toBe(1);
    });

    it('retorna skip/completed quando o evento ja esta completed (barreira contra transfer duplicado)', async () => {
      await repo.claimWebhookEvent({ eventId: 'evt-2', invoiceId: 'inv-2', amount: 1000, fee: 10, netAmount: 990 });
      await repo.completeWebhookEvent('evt-2', 'tr-2');

      const result = await repo.claimWebhookEvent({ eventId: 'evt-2', invoiceId: 'inv-2', amount: 1000, fee: 10, netAmount: 990 });
      expect(result).toEqual({ action: 'skip', reason: 'completed' });
    });

    it('retorna skip/processing quando o evento esta processing ha menos de 5min', async () => {
      await repo.claimWebhookEvent({ eventId: 'evt-3', invoiceId: 'inv-3', amount: 1000, fee: 10, netAmount: 990 });

      const result = await repo.claimWebhookEvent({ eventId: 'evt-3', invoiceId: 'inv-3', amount: 1000, fee: 10, netAmount: 990 });
      expect(result).toEqual({ action: 'skip', reason: 'processing' });
    });

    it('retorna retry e incrementa attempts quando o evento esta processing ha mais de 5min (stale)', async () => {
      await repo.claimWebhookEvent({ eventId: 'evt-4', invoiceId: 'inv-4', amount: 1000, fee: 10, netAmount: 990 });

      // Forca o updatedAt para 10 minutos atras (stale)
      const staleDate = new Date(Date.now() - 10 * 60 * 1000);
      const existing = db.store.get('webhook_events/evt-4')!;
      db.store.set('webhook_events/evt-4', { ...existing, updatedAt: Timestamp.fromDate(staleDate) });

      const result = await repo.claimWebhookEvent({ eventId: 'evt-4', invoiceId: 'inv-4', amount: 1000, fee: 10, netAmount: 990 });
      expect(result).toEqual({ action: 'retry' });
      expect(db.store.get('webhook_events/evt-4')?.attempts).toBe(2);
    });

    it('retorna retry imediatamente (sem esperar staleness) quando o evento esta failed, preservando createdAt e lastError', async () => {
      await repo.claimWebhookEvent({ eventId: 'evt-8', invoiceId: 'inv-8', amount: 1000, fee: 10, netAmount: 990 });
      await repo.failWebhookEvent('evt-8', 'stark bank timeout');
      const beforeRetry = db.store.get('webhook_events/evt-8')!;

      const result = await repo.claimWebhookEvent({ eventId: 'evt-8', invoiceId: 'inv-8', amount: 1000, fee: 10, netAmount: 990 });

      expect(result).toEqual({ action: 'retry' });
      const afterRetry = db.store.get('webhook_events/evt-8')!;
      expect(afterRetry.status).toBe('processing');
      expect(afterRetry.attempts).toBe(2);
      expect(afterRetry.createdAt).toEqual(beforeRetry.createdAt);
      expect(afterRetry.lastError).toBe('stark bank timeout');
    });
  });

  describe('completeWebhookEvent / completeWebhookEventNoTransfer / failWebhookEvent', () => {
    it('marca o evento como completed com transferId', async () => {
      await repo.claimWebhookEvent({ eventId: 'evt-5', invoiceId: 'inv-5', amount: 1000, fee: 10, netAmount: 990 });
      await repo.completeWebhookEvent('evt-5', 'tr-5');
      const stored = db.store.get('webhook_events/evt-5');
      expect(stored?.status).toBe('completed');
      expect(stored?.transferId).toBe('tr-5');
    });

    it('marca o evento como completed sem transferId (fee >= amount)', async () => {
      await repo.claimWebhookEvent({ eventId: 'evt-6', invoiceId: 'inv-6', amount: 50, fee: 50, netAmount: 0 });
      await repo.completeWebhookEventNoTransfer('evt-6');
      const stored = db.store.get('webhook_events/evt-6');
      expect(stored?.status).toBe('completed');
      expect(stored?.transferId).toBeNull();
    });

    it('marca o evento como failed com lastError', async () => {
      await repo.claimWebhookEvent({ eventId: 'evt-7', invoiceId: 'inv-7', amount: 1000, fee: 10, netAmount: 990 });
      await repo.failWebhookEvent('evt-7', 'stark bank timeout');
      const stored = db.store.get('webhook_events/evt-7');
      expect(stored?.status).toBe('failed');
      expect(stored?.lastError).toBe('stark bank timeout');
    });
  });

  describe('tryAcquireSchedulerCycle', () => {
    it('adquire o lock quando o ciclo nao existe ainda', async () => {
      const acquired = await repo.tryAcquireSchedulerCycle('cycle-2024-01-15-0');
      expect(acquired).toBe(true);
      expect(db.store.get('scheduler_executions/cycle-2024-01-15-0')?.status).toBe('running');
    });

    it('rejeita o lock quando o ciclo ja existe (segundo disparo do Cloud Scheduler)', async () => {
      await repo.tryAcquireSchedulerCycle('cycle-2024-01-15-0');
      const acquiredAgain = await repo.tryAcquireSchedulerCycle('cycle-2024-01-15-0');
      expect(acquiredAgain).toBe(false);
    });

    it('completeSchedulerCycle marca o ciclo como completed com os invoiceIds', async () => {
      await repo.tryAcquireSchedulerCycle('cycle-2024-01-15-1');
      await repo.completeSchedulerCycle('cycle-2024-01-15-1', ['inv-a', 'inv-b']);
      const stored = db.store.get('scheduler_executions/cycle-2024-01-15-1');
      expect(stored?.status).toBe('completed');
      expect(stored?.invoiceIds).toEqual(['inv-a', 'inv-b']);
      expect(stored?.invoiceCount).toBe(2);
    });

    it('recupera o lock quando o ciclo esta running ha mais de 10min (worker anterior crashou no meio do lote)', async () => {
      await repo.tryAcquireSchedulerCycle('cycle-stale');

      const staleDate = new Date(Date.now() - 11 * 60 * 1000);
      const existing = db.store.get('scheduler_executions/cycle-stale')!;
      db.store.set('scheduler_executions/cycle-stale', { ...existing, updatedAt: Timestamp.fromDate(staleDate) });

      const acquiredAgain = await repo.tryAcquireSchedulerCycle('cycle-stale');
      expect(acquiredAgain).toBe(true);
    });

    it('nunca retenta um ciclo completed, mesmo que o documento seja antigo', async () => {
      await repo.tryAcquireSchedulerCycle('cycle-done');
      await repo.completeSchedulerCycle('cycle-done', ['inv-a']);

      const staleDate = new Date(Date.now() - 60 * 60 * 1000);
      const existing = db.store.get('scheduler_executions/cycle-done')!;
      db.store.set('scheduler_executions/cycle-done', { ...existing, updatedAt: Timestamp.fromDate(staleDate) });

      const acquiredAgain = await repo.tryAcquireSchedulerCycle('cycle-done');
      expect(acquiredAgain).toBe(false);
    });
  });

  describe('getOrInitRunConfig', () => {
    it('cria a config na primeira chamada e reutiliza nas seguintes', async () => {
      const first = await repo.getOrInitRunConfig({
        cycleMinutes: 180,
        totalPeriodMinutes: 1440,
        maxCycles: 8,
      });
      expect(first.maxCycles).toBe(8);
      expect(first.deadlineAt.getTime() - first.startedAt.getTime()).toBe(1440 * 60 * 1000);

      const second = await repo.getOrInitRunConfig({
        cycleMinutes: 999,
        totalPeriodMinutes: 999,
        maxCycles: 999,
      });
      // Reutiliza a config ja persistida, ignora os novos parametros
      expect(second.maxCycles).toBe(8);
      expect(second.startedAt.getTime()).toBe(first.startedAt.getTime());
    });

    it('usa startAt explicito quando fornecido', async () => {
      const startAt = new Date('2024-01-15T09:00:00-03:00');
      const config = await repo.getOrInitRunConfig({
        startAt,
        cycleMinutes: 180,
        totalPeriodMinutes: 1440,
        maxCycles: 8,
      });
      expect(config.startedAt.getTime()).toBe(startAt.getTime());
    });
  });

  describe('countCompletedCycles', () => {
    it('conta apenas os ciclos com status completed', async () => {
      await repo.tryAcquireSchedulerCycle('cycle-a');
      await repo.completeSchedulerCycle('cycle-a', ['inv-1']);
      await repo.tryAcquireSchedulerCycle('cycle-b'); // permanece 'running'

      expect(await repo.countCompletedCycles()).toBe(1);
    });
  });

  describe('findReconciliableEvents', () => {
    it('retorna eventos failed e eventos processing stale, sem duplicatas', async () => {
      await repo.claimWebhookEvent({ eventId: 'evt-failed', invoiceId: 'inv-f', amount: 1000, fee: 10, netAmount: 990 });
      await repo.failWebhookEvent('evt-failed', 'timeout');

      await repo.claimWebhookEvent({ eventId: 'evt-stale', invoiceId: 'inv-s', amount: 1000, fee: 10, netAmount: 990 });
      const staleDate = new Date(Date.now() - 10 * 60 * 1000);
      const existing = db.store.get('webhook_events/evt-stale')!;
      db.store.set('webhook_events/evt-stale', { ...existing, updatedAt: Timestamp.fromDate(staleDate) });

      await repo.claimWebhookEvent({ eventId: 'evt-fresh', invoiceId: 'inv-r', amount: 1000, fee: 10, netAmount: 990 });

      const events = await repo.findReconciliableEvents(5 * 60 * 1000);
      const ids = events.map((e) => e.eventId).sort();
      expect(ids).toEqual(['evt-failed', 'evt-stale']);
    });
  });

  describe('getTransferTarget', () => {
    it('le a conta destino do Firestore', async () => {
      db.store.set('starkbank_challenge_config/transfer_target', {
        bankCode: '20018183',
        branchCode: '0001',
        accountNumber: '6341320293482496',
        name: 'Stark Bank S.A.',
        taxId: '20.018.183/0001-80',
        accountType: 'payment',
      });

      const target = await repo.getTransferTarget();
      expect(target.bankCode).toBe('20018183');
      expect(target.accountNumber).toBe('6341320293482496');
    });

    it('lanca erro quando o documento nao existe', async () => {
      await expect(repo.getTransferTarget()).rejects.toThrow('transfer_target not found in Firestore');
    });
  });
});
