import { EventStoreRepository } from '../../domain/repositories/event-store-repository';
import { InvoiceService } from '../services/invoice-service';
import { buildCycleWindowId } from '../../domain/value-objects/cycle-window-vo';
import { Logger } from '../../infrastructure/logging/logger';

export interface SchedulerConfig {
  cycleMinutes: number;
  totalPeriodMinutes: number;
  maxCycles: number;
  startAt?: Date;
  /** Tamanho minimo do lote de invoices por ciclo. Default 8 (regra final do desafio). */
  minInvoicesPerCycle?: number;
  /** Tamanho maximo do lote de invoices por ciclo. Default 12 (regra final do desafio). */
  maxInvoicesPerCycle?: number;
}

export interface RunSchedulerOutput {
  cycleId: string;
  skipped: boolean;
  skipReason?: 'period_expired' | 'max_cycles_reached' | 'duplicate_cycle';
  invoiceCount: number;
  invoiceIds?: string[];
  status: 'completed' | 'partial_failure' | 'skipped';
  completedCycles?: number;
  maxCycles?: number;
  deadlineAt?: Date;
  startedAt?: Date;
}

export class RunSchedulerUseCase {
  constructor(
    private readonly eventStore: EventStoreRepository,
    private readonly invoiceService: InvoiceService,
    private readonly logger: Logger,
    private readonly config: SchedulerConfig,
  ) {}

  /**
   * Executa um ciclo do scheduler, respeitando os limites do desafio antes
   * de emitir qualquer invoice.
   *
   * As tres verificacoes iniciais existem por motivos distintos: a deadline
   * e o cap de ciclos garantem que o desafio nao continue emitindo invoices
   * para sempre (ou alem do numero de ciclos esperado) se o scheduler
   * continuar sendo chamado; ja o lock por cycleId e o que impede que o
   * mesmo ciclo rode duas vezes caso o disparo externo (cron/Cloud
   * Scheduler) dispare em duplicidade. O tamanho do lote e sorteado dentro
   * de uma faixa configuravel (minInvoicesPerCycle..maxInvoicesPerCycle), e
   * uma falha isolada ao emitir uma invoice nao aborta as demais - o ciclo
   * so e marcado como falho parcialmente, nunca perdido por completo.
   */
  async execute(): Promise<RunSchedulerOutput> {
    const now = new Date();
    const { cycleMinutes, totalPeriodMinutes, maxCycles, startAt } = this.config;

    // Inicializa ou le o estado global do run
    const runConfig = await this.eventStore.getOrInitRunConfig({
      startAt,
      cycleMinutes,
      totalPeriodMinutes,
      maxCycles,
    });

    const cycleId = buildCycleWindowId(now, cycleMinutes);
    const completedCycles = await this.eventStore.countCompletedCycles();
    const base = { cycleId, completedCycles, maxCycles, deadlineAt: runConfig.deadlineAt, startedAt: runConfig.startedAt };

    // Guard 1: period_expired
    if (now >= runConfig.deadlineAt) {
      const result = { ...base, skipped: true, skipReason: 'period_expired' as const, invoiceCount: 0, status: 'skipped' as const };
      this.logger.info({ message: 'scheduler.cycle_skipped', ...result });
      return result;
    }

    // Guard 2: max_cycles_reached
    if (completedCycles >= maxCycles) {
      const result = { ...base, skipped: true, skipReason: 'max_cycles_reached' as const, invoiceCount: 0, status: 'skipped' as const };
      this.logger.info({ message: 'scheduler.cycle_skipped', ...result });
      return result;
    }

    // Guard 3: duplicate_cycle
    const acquired = await this.eventStore.tryAcquireSchedulerCycle(cycleId);
    if (!acquired) {
      const result = { ...base, skipped: true, skipReason: 'duplicate_cycle' as const, invoiceCount: 0, status: 'skipped' as const };
      this.logger.info({ message: 'scheduler.cycle_skipped', ...result });
      return result;
    }

    // Emite invoices
    const min = this.config.minInvoicesPerCycle ?? 8;
    const max = this.config.maxInvoicesPerCycle ?? 12;
    const invoiceCount = Math.floor(Math.random() * (max - min + 1)) + min;
    const invoiceIds: string[] = [];
    let hasFailure = false;

    for (let i = 0; i < invoiceCount; i++) {
      try {
        const invoice = await this.invoiceService.createRandomInvoice();
        invoiceIds.push(invoice.id);
      } catch {
        hasFailure = true;
        // Falha isolada nao derruba o lote
      }
    }

    const status = hasFailure ? 'partial_failure' : 'completed';
    await this.eventStore.completeSchedulerCycle(cycleId, invoiceIds);

    const result = {
      ...base,
      skipped: false,
      invoiceCount: invoiceIds.length,
      invoiceIds,
      status: status as 'completed' | 'partial_failure',
    };

    this.logger.info({ message: 'scheduler.cycle_completed', ...result });
    return result;
  }
}
