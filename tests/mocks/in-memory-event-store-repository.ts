import {
  EventStoreRepository,
  ClaimResult,
  RunConfig,
  TransferTarget,
} from '../../src/domain/repositories/event-store-repository';
import { WebhookEvent } from '../../src/domain/entities/webhook-event-entity';
import { STALE_THRESHOLD_MS, SCHEDULER_CYCLE_STALE_THRESHOLD_MS } from '../../src/domain/constants';

export class InMemoryEventStore implements EventStoreRepository {
  private events = new Map<string, WebhookEvent>();
  private cycles = new Map<string, { status: 'running' | 'completed'; updatedAt: Date }>();
  private completedCyclesCount = 0;
  private runConfig: RunConfig | null = null;
  private transferTarget: TransferTarget = {
    bankCode: '20018183',
    branchCode: '0001',
    accountNumber: '6341320293482496',
    name: 'Stark Bank S.A.',
    taxId: '20.018.183/0001-80',
    accountType: 'payment',
  };

  async claimWebhookEvent(params: {
    eventId: string;
    invoiceId: string;
    amount: number;
    fee: number;
    netAmount: number;
  }): Promise<ClaimResult> {
    const existing = this.events.get(params.eventId);
    const now = new Date();

    if (existing) {
      if (existing.status === 'completed') return { action: 'skip', reason: 'completed' };
      if (existing.status === 'processing') {
        const age = now.getTime() - existing.updatedAt.getTime();
        if (age < STALE_THRESHOLD_MS) return { action: 'skip', reason: 'processing' };
        this.events.set(params.eventId, { ...existing, attempts: existing.attempts + 1, updatedAt: now });
        return { action: 'retry' };
      }
      if (existing.status === 'failed') {
        this.events.set(params.eventId, {
          ...existing,
          status: 'processing',
          attempts: existing.attempts + 1,
          updatedAt: now,
        });
        return { action: 'retry' };
      }
    }

    this.events.set(params.eventId, {
      eventId: params.eventId,
      invoiceId: params.invoiceId,
      amount: params.amount,
      fee: params.fee,
      netAmount: params.netAmount,
      status: 'processing',
      attempts: 1,
      createdAt: now,
      updatedAt: now,
    });
    return { action: 'process' };
  }

  async completeWebhookEvent(eventId: string, transferId: string): Promise<void> {
    const e = this.events.get(eventId);
    if (e) this.events.set(eventId, { ...e, status: 'completed', transferId, updatedAt: new Date() });
  }

  async completeWebhookEventNoTransfer(eventId: string): Promise<void> {
    const e = this.events.get(eventId);
    if (e) this.events.set(eventId, { ...e, status: 'completed', updatedAt: new Date() });
  }

  async failWebhookEvent(eventId: string, error: string): Promise<void> {
    const e = this.events.get(eventId);
    if (e) this.events.set(eventId, { ...e, status: 'failed', lastError: error, updatedAt: new Date() });
  }

  async findReconciliableEvents(staleThresholdMs: number): Promise<WebhookEvent[]> {
    const now = new Date();
    return Array.from(this.events.values()).filter(
      (e) =>
        e.status === 'failed' ||
        (e.status === 'processing' && now.getTime() - e.updatedAt.getTime() >= staleThresholdMs),
    );
  }

  async tryAcquireSchedulerCycle(cycleId: string): Promise<boolean> {
    const now = new Date();
    const existing = this.cycles.get(cycleId);

    if (existing) {
      if (existing.status === 'running') {
        const age = now.getTime() - existing.updatedAt.getTime();
        if (age < SCHEDULER_CYCLE_STALE_THRESHOLD_MS) return false;

        this.cycles.set(cycleId, { status: 'running', updatedAt: now });
        return true;
      }
      return false; // completed - terminal, nunca retenta
    }

    this.cycles.set(cycleId, { status: 'running', updatedAt: now });
    return true;
  }

  async completeSchedulerCycle(cycleId: string, _invoiceIds: string[]): Promise<void> {
    this.cycles.set(cycleId, { status: 'completed', updatedAt: new Date() });
    this.completedCyclesCount++;
  }

  async getOrInitRunConfig(params: {
    startAt?: Date;
    cycleMinutes: number;
    totalPeriodMinutes: number;
    maxCycles: number;
  }): Promise<RunConfig> {
    if (this.runConfig) return this.runConfig;
    const startedAt = params.startAt ?? new Date();
    const deadlineAt = new Date(startedAt.getTime() + params.totalPeriodMinutes * 60 * 1000);
    this.runConfig = {
      startedAt,
      deadlineAt,
      maxCycles: params.maxCycles,
      cycleMinutes: params.cycleMinutes,
      totalPeriodMinutes: params.totalPeriodMinutes,
    };
    return this.runConfig;
  }

  async countCompletedCycles(): Promise<number> {
    return this.completedCyclesCount;
  }

  async getTransferTarget(): Promise<TransferTarget> {
    return this.transferTarget;
  }

  // Helpers para testes
  getEvent(eventId: string) {
    return this.events.get(eventId);
  }
  setRunConfig(config: RunConfig) {
    this.runConfig = config;
  }
  setCompletedCycles(n: number) {
    this.completedCyclesCount = n;
  }
  forceStalEvent(eventId: string) {
    const e = this.events.get(eventId);
    if (e) this.events.set(eventId, { ...e, updatedAt: new Date(Date.now() - 10 * 60 * 1000) });
  }
  forceStaleSchedulerCycle(cycleId: string) {
    const c = this.cycles.get(cycleId);
    if (c) this.cycles.set(cycleId, { ...c, updatedAt: new Date(Date.now() - (SCHEDULER_CYCLE_STALE_THRESHOLD_MS + 60 * 1000)) });
  }
}
