import { EventStoreRepository, ClaimResult } from '../../domain/repositories/event-store-repository';
import { calculateNetAmount } from '../../domain/value-objects/net-amount-vo';

export interface ClaimParams {
  eventId: string;
  invoiceId: string;
  amount: number;
  fee: number;
}

export class IdempotencyService {
  constructor(private readonly eventStore: EventStoreRepository) {}

  /**
   * Tenta adquirir o claim de um evento de webhook.
   * Calcula o netAmount internamente e delega ao EventStore.
   *
   * @returns ClaimResult - process | retry | skip
   */
  async claimEvent(params: ClaimParams): Promise<ClaimResult> {
    const netAmount = calculateNetAmount(params.amount, params.fee) ?? 0;
    return this.eventStore.claimWebhookEvent({
      ...params,
      netAmount,
    });
  }
}
