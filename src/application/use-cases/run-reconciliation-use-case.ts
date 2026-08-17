import { EventStoreRepository } from '../../domain/repositories/event-store-repository';
import { IdempotencyService } from '../services/idempotency-service';
import { TransferService } from '../services/transfer-service';
import { Logger } from '../../infrastructure/logging/logger';
import { STALE_THRESHOLD_MS } from '../../domain/constants';

export interface ReconciliationOutput {
  retried: number;
  completed: number;
  failed: number;
}

export class RunReconciliationUseCase {
  constructor(
    private readonly eventStore: EventStoreRepository,
    private readonly idempotency: IdempotencyService,
    private readonly transfer: TransferService,
    private readonly logger: Logger,
  ) {}

  /**
   * Job periodico que retenta os transfers que nao foram concluidos na
   * primeira tentativa (webhook falhou, ou o processo caiu no meio do
   * claim). A elegibilidade em si vive no EventStoreRepository; aqui so
   * importa iterar sobre o resultado e nao deixar que a falha de um evento
   * individual impeca os outros de serem tentados - por isso os erros sao
   * capturados por evento em vez de deixar propagar e abortar o lote.
   *
   * Antes de chamar TransferService, cada evento passa de novo pelo claim
   * transacional do Firestore (idempotency.claimEvent). Sem isso, a unica
   * defesa contra duas execucoes concorrentes de reconciliacao (Cloud
   * Scheduler pode disparar duas vezes) - ou reconciliacao competindo com
   * uma reentrega de webhook para o mesmo evento - seria a unicidade de
   * externalId do lado da Stark Bank, e nao a barreira do Firestore que o
   * resto do sistema usa como primeira linha de defesa. Re-adquirir o claim
   * aqui restaura essa barreira tambem no caminho de retry.
   */
  async execute(): Promise<ReconciliationOutput> {
    const events = await this.eventStore.findReconciliableEvents(STALE_THRESHOLD_MS);
    let completed = 0;
    let failed = 0;

    for (const event of events) {
      const claim = await this.idempotency.claimEvent({
        eventId: event.eventId,
        invoiceId: event.invoiceId,
        amount: event.amount,
        fee: event.fee,
      });

      if (claim.action === 'skip') {
        this.logger.info({
          message: 'reconciliation.claim_skipped',
          eventId: event.eventId,
          reason: claim.reason,
        });
        continue;
      }

      try {
        await this.transfer.createTransfer({
          eventId: event.eventId,
          invoiceId: event.invoiceId,
          amount: event.amount,
          fee: event.fee,
        });
        completed++;
      } catch {
        failed++;
      }
    }

    const result: ReconciliationOutput = { retried: events.length, completed, failed };
    this.logger.info({ message: 'reconciliation.run_completed', ...result });
    return result;
  }
}
