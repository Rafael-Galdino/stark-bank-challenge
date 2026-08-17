import { Firestore, Timestamp } from '@google-cloud/firestore';
import {
  EventStoreRepository,
  ClaimResult,
  RunConfig,
  TransferTarget,
} from '../../domain/repositories/event-store-repository';
import { WebhookEvent } from '../../domain/entities/webhook-event-entity';
import { STALE_THRESHOLD_MS, SCHEDULER_CYCLE_STALE_THRESHOLD_MS } from '../../domain/constants';

export class FirestoreEventStoreRepository implements EventStoreRepository {
  constructor(private readonly db: Firestore) {}

  async claimWebhookEvent(params: {
    eventId: string;
    invoiceId: string;
    amount: number;
    fee: number;
    netAmount: number;
  }): Promise<ClaimResult> {
    const ref = this.db.collection('webhook_events').doc(params.eventId);

    return this.db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const now = new Date();

      if (snap.exists) {
        const data = snap.data()!;

        if (data.status === 'completed') {
          return { action: 'skip', reason: 'completed' };
        }

        if (data.status === 'processing') {
          const updatedAt: Date = data.updatedAt?.toDate?.() ?? new Date(data.updatedAt);
          const age = now.getTime() - updatedAt.getTime();

          if (age < STALE_THRESHOLD_MS) {
            return { action: 'skip', reason: 'processing' };
          }

          // Stale - retenta
          tx.update(ref, {
            attempts: (data.attempts ?? 0) + 1,
            updatedAt: Timestamp.fromDate(now),
          });
          return { action: 'retry' };
        }

        if (data.status === 'failed') {
          // Ao contrario de 'processing' stale, um evento 'failed' ja
          // concluiu sua tentativa anterior (nao ha worker em andamento pra
          // esperar) - por isso retenta imediatamente, sem checar staleness.
          // update() (nao set()) preserva createdAt e lastError originais -
          // esse era exatamente o historico de auditoria que o fallthrough
          // pro caminho de "evento novo" estava destruindo.
          tx.update(ref, {
            status: 'processing',
            attempts: (data.attempts ?? 0) + 1,
            updatedAt: Timestamp.fromDate(now),
          });
          return { action: 'retry' };
        }
      }

      // Novo evento
      tx.set(ref, {
        eventId: params.eventId,
        invoiceId: params.invoiceId,
        amount: params.amount,
        fee: params.fee,
        netAmount: params.netAmount,
        status: 'processing',
        attempts: 1,
        transferId: null,
        lastError: null,
        createdAt: Timestamp.fromDate(now),
        updatedAt: Timestamp.fromDate(now),
      });
      return { action: 'process' };
    });
  }

  async completeWebhookEvent(eventId: string, transferId: string): Promise<void> {
    await this.db.collection('webhook_events').doc(eventId).update({
      status: 'completed',
      transferId,
      updatedAt: Timestamp.fromDate(new Date()),
    });
  }

  async completeWebhookEventNoTransfer(eventId: string): Promise<void> {
    await this.db.collection('webhook_events').doc(eventId).update({
      status: 'completed',
      updatedAt: Timestamp.fromDate(new Date()),
    });
  }

  async failWebhookEvent(eventId: string, error: string): Promise<void> {
    await this.db.collection('webhook_events').doc(eventId).update({
      status: 'failed',
      lastError: error,
      updatedAt: Timestamp.fromDate(new Date()),
    });
  }

  async findReconciliableEvents(staleThresholdMs: number): Promise<WebhookEvent[]> {
    const now = new Date();
    const staleDate = new Date(now.getTime() - staleThresholdMs);
    const col = this.db.collection('webhook_events');

    const [failedSnap, staleSnap] = await Promise.all([
      col.where('status', '==', 'failed').get(),
      col
        .where('status', '==', 'processing')
        .where('updatedAt', '<', Timestamp.fromDate(staleDate))
        .get(),
    ]);

    const toEvent = (doc: FirebaseFirestore.QueryDocumentSnapshot): WebhookEvent => {
      const d = doc.data();
      return {
        eventId: d.eventId,
        status: d.status,
        invoiceId: d.invoiceId,
        amount: d.amount,
        fee: d.fee,
        netAmount: d.netAmount,
        transferId: d.transferId ?? undefined,
        attempts: d.attempts ?? 0,
        lastError: d.lastError ?? undefined,
        createdAt: d.createdAt?.toDate?.() ?? new Date(d.createdAt),
        updatedAt: d.updatedAt?.toDate?.() ?? new Date(d.updatedAt),
      };
    };

    // Dedup por eventId (caso apareca nas duas queries)
    const eventsMap = new Map<string, WebhookEvent>();
    [...failedSnap.docs, ...staleSnap.docs].forEach((doc) => {
      const e = toEvent(doc);
      eventsMap.set(e.eventId, e);
    });

    return Array.from(eventsMap.values());
  }

  async tryAcquireSchedulerCycle(cycleId: string): Promise<boolean> {
    const ref = this.db.collection('scheduler_executions').doc(cycleId);

    return this.db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const now = new Date();

      if (snap.exists) {
        const data = snap.data()!;

        if (data.status === 'running') {
          const updatedAt: Date = data.updatedAt?.toDate?.() ?? new Date(data.updatedAt);
          const age = now.getTime() - updatedAt.getTime();

          if (age < SCHEDULER_CYCLE_STALE_THRESHOLD_MS) {
            return false;
          }

          // Running ha tempo demais - o worker anterior provavelmente
          // crashou no meio do lote de invoices. Retoma o lock em vez de
          // deixar o ciclo travado em 'running' para sempre.
          tx.update(ref, { updatedAt: Timestamp.fromDate(now) });
          return true;
        }

        // completed / partial_failure - ciclo ja concluido, nunca retenta.
        return false;
      }

      tx.set(ref, {
        cycleId,
        status: 'running',
        invoiceIds: [],
        invoiceCount: 0,
        createdAt: Timestamp.fromDate(now),
        updatedAt: Timestamp.fromDate(now),
      });
      return true;
    });
  }

  async completeSchedulerCycle(cycleId: string, invoiceIds: string[]): Promise<void> {
    await this.db.collection('scheduler_executions').doc(cycleId).update({
      status: 'completed',
      invoiceIds,
      invoiceCount: invoiceIds.length,
      updatedAt: Timestamp.fromDate(new Date()),
    });
  }

  async getOrInitRunConfig(params: {
    startAt?: Date;
    cycleMinutes: number;
    totalPeriodMinutes: number;
    maxCycles: number;
  }): Promise<RunConfig> {
    const ref = this.db.collection('starkbank_challenge_config').doc('execution');
    const snap = await ref.get();

    if (snap.exists) {
      const d = snap.data()!;
      return {
        startedAt: d.startedAt?.toDate?.() ?? new Date(d.startedAt),
        deadlineAt: d.deadlineAt?.toDate?.() ?? new Date(d.deadlineAt),
        maxCycles: d.maxCycles,
        cycleMinutes: d.cycleMinutes,
        totalPeriodMinutes: d.totalPeriodMinutes,
      };
    }

    const now = new Date();
    const startedAt = params.startAt ?? now;
    const deadlineAt = new Date(startedAt.getTime() + params.totalPeriodMinutes * 60 * 1000);

    const config: RunConfig = {
      startedAt,
      deadlineAt,
      maxCycles: params.maxCycles,
      cycleMinutes: params.cycleMinutes,
      totalPeriodMinutes: params.totalPeriodMinutes,
    };

    await ref.set({
      ...config,
      startedAt: Timestamp.fromDate(startedAt),
      deadlineAt: Timestamp.fromDate(deadlineAt),
    });

    return config;
  }

  async countCompletedCycles(): Promise<number> {
    const snap = await this.db
      .collection('scheduler_executions')
      .where('status', '==', 'completed')
      .count()
      .get();
    return snap.data().count;
  }

  async getTransferTarget(): Promise<TransferTarget> {
    const snap = await this.db.collection('starkbank_challenge_config').doc('transfer_target').get();
    if (!snap.exists) throw new Error('transfer_target not found in Firestore');
    const d = snap.data()!;
    return {
      bankCode: d.bankCode,
      branchCode: d.branchCode,
      accountNumber: d.accountNumber,
      name: d.name,
      taxId: d.taxId,
      accountType: d.accountType,
    };
  }
}
