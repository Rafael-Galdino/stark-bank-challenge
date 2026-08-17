import { EventStoreRepository, TransferTarget } from '../../domain/repositories/event-store-repository';
import { StarkBankRepository } from '../../domain/repositories/stark-bank-repository';
import { calculateNetAmount } from '../../domain/value-objects/net-amount-vo';
import { buildExternalId } from '../../domain/value-objects/external-id-vo';
import { Logger } from '../../infrastructure/logging/logger';

export interface TransferParams {
  eventId: string;
  invoiceId: string;
  amount: number;
  fee: number;
}

export interface TransferResult {
  transferId?: string;
  skipped: boolean;
  skipReason?: 'fee_gte_amount';
}

export class TransferService {
  constructor(
    private readonly eventStore: EventStoreRepository,
    private readonly starkBank: StarkBankRepository,
    private readonly logger: Logger,
  ) {}

  /**
   * Envia para a conta destino o valor liquido de uma invoice ja creditada.
   *
   * O evento so e marcado como completed depois que a Stark Bank confirma a
   * criacao do transfer - nunca antes -, para que uma falha de rede ou uma
   * queda do processo entre essas duas chamadas deixe o evento em um estado
   * (processing/failed) que a reconciliacao consegue detectar e retentar,
   * em vez de dar como resolvido algo que na verdade nao aconteceu.
   * O caso fee >= amount e resolvido aqui mesmo, sem chamar a Stark Bank,
   * porque nao existe transfer valido para esse valor.
   * Em caso de erro, o erro original e relancado para quem chamou depois
   * de registrado, para que o caller (webhook handler ou reconciliacao)
   * decida como reagir.
   */
  async createTransfer(params: TransferParams): Promise<TransferResult> {
    const { eventId, invoiceId, amount, fee } = params;
    const netAmount = calculateNetAmount(amount, fee);

    if (netAmount === null) {
      this.logger.warn({
        message: 'transfer.skipped_fee_gte_amount',
        eventId,
        invoiceId,
        amount,
        fee,
      });
      await this.eventStore.completeWebhookEventNoTransfer(eventId);
      return { skipped: true, skipReason: 'fee_gte_amount' };
    }

    const target: TransferTarget = await this.eventStore.getTransferTarget();
    const externalId = buildExternalId(invoiceId);
    const start = Date.now();

    try {
      const transfer = await this.starkBank.createTransfer({
        amount: netAmount,
        bankCode: target.bankCode,
        branchCode: target.branchCode,
        accountNumber: target.accountNumber,
        accountType: target.accountType,
        taxId: target.taxId,
        name: target.name,
        externalId,
      });

      await this.eventStore.completeWebhookEvent(eventId, transfer.id);

      this.logger.info({
        message: 'transfer.created',
        eventId,
        invoiceId,
        transferId: transfer.id,
        amount,
        fee,
        netAmount,
        durationMs: Date.now() - start,
      });

      return { transferId: transfer.id, skipped: false };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);

      // Antes de declarar falha, confirma que o transfer realmente nao
      // aconteceu. Cobre dois casos que sao indistinguiveis por HTTP status:
      // (1) a Stark Bank rejeitou por externalId duplicado porque uma
      // tentativa anterior ja teve sucesso, e (2) o processo caiu entre a
      // Stark Bank confirmar o transfer e completeWebhookEvent persistir.
      // Em ambos, o transfer ja existe - marcar como failed aqui rotularia
      // permanentemente um pagamento bem-sucedido como falho.
      const existing = await this.findExistingTransfer(externalId, target.taxId);

      if (existing) {
        await this.eventStore.completeWebhookEvent(eventId, existing.id);

        this.logger.info({
          message: 'transfer.recovered_from_duplicate',
          eventId,
          invoiceId,
          transferId: existing.id,
          amount,
          fee,
          netAmount,
          originalError: errorMessage,
        });

        return { transferId: existing.id, skipped: false };
      }

      await this.eventStore.failWebhookEvent(eventId, errorMessage);

      this.logger.error({
        message: 'transfer.failed',
        eventId,
        invoiceId,
        error: errorMessage,
      });

      throw err;
    }
  }

  /**
   * A propria checagem de recuperacao nao pode derrubar o fluxo original:
   * se a busca falhar (ex: erro de rede), trata como "nao encontrado" para
   * que o erro original de createTransfer seja o que prevalece.
   */
  private async findExistingTransfer(externalId: string, taxId: string) {
    try {
      return await this.starkBank.findTransferByExternalId(externalId, taxId);
    } catch {
      return null;
    }
  }
}
