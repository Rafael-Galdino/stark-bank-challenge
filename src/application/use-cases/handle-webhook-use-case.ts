import { StarkBankRepository, ParsedWebhookEvent } from '../../domain/repositories/stark-bank-repository';
import { IdempotencyService } from '../services/idempotency-service';
import { TransferService } from '../services/transfer-service';
import { Logger } from '../../infrastructure/logging/logger';

export interface HandleWebhookInput {
  rawBody: string;
  signature: string;
}

export interface HandleWebhookOutput {
  accepted: boolean;
  eventId?: string;
  skipped?: boolean;
  skipReason?: string;
}

export class HandleWebhookUseCase {
  constructor(
    private readonly starkBank: StarkBankRepository,
    private readonly idempotency: IdempotencyService,
    private readonly transfer: TransferService,
    private readonly logger: Logger,
  ) {}

  /**
   * Valida a assinatura ECDSA do webhook e retorna o evento parseado.
   * Lanca erro se a assinatura for invalida (delegado ao StarkBankRepository).
   *
   * Extraido como metodo publico separado para que a camada de apresentacao
   * possa validar a assinatura de forma sincrona (await) ANTES de responder
   * HTTP 200, evitando responder 200 para um payload com assinatura invalida
   * (ver presentation/controllers/webhook-controller.ts).
   */
  async verifySignature(input: HandleWebhookInput): Promise<ParsedWebhookEvent> {
    const event = await this.starkBank.parseWebhookEvent(input.rawBody, input.signature);

    this.logger.info({
      message: 'webhook.received',
      eventId: event.id,
      subscription: event.subscriptionType,
      logType: 'webhook.received',
    });

    return event;
  }

  /**
   * Processa um evento de webhook ja validado/parseado.
   *
   * So logs do tipo "credited" (event.logType) disparam um transfer - os
   * demais tipos e status (ex: invoice criada, paga mas ainda nao repassada,
   * expirada, etc.) sao ruido para esse use case e sao apenas confirmados
   * como recebidos. O claim de idempotencia vem antes de qualquer chamada a
   * Stark Bank para que um evento duplicado nunca chegue a tentar criar um
   * segundo transfer.
   *
   * NOTA: o repasse efetivo do dinheiro e sinalizado por logType === 'credited',
   * NAO por invoice.status (que nunca assume esse valor - ver comentario em
   * ParsedWebhookEvent).
   *
   * IMPORTANTE: Este metodo e chamado em background (fire-and-forget) pelo
   * controller, apos a resposta HTTP 200 ja ter sido enviada - por isso
   * accepted aqui nao significa "transfer concluido", so "webhook aceito".
   */
  async processEvent(event: ParsedWebhookEvent): Promise<HandleWebhookOutput> {
    // Filtra somente logs credited
    if (event.subscriptionType !== 'invoice' || !event.invoice || event.logType !== 'credited') {
      return { accepted: true, eventId: event.id, skipped: true, skipReason: 'not_credited' };
    }

    const { id: invoiceId, amount, fee } = event.invoice;

    this.logger.info({
      message: 'webhook.invoice_credited',
      eventId: event.id,
      invoiceId,
      amount,
      fee,
    });

    // Claim de idempotencia
    const claim = await this.idempotency.claimEvent({
      eventId: event.id,
      invoiceId,
      amount,
      fee,
    });

    if (claim.action === 'skip') {
      this.logger.info({
        message: 'webhook.duplicate_skipped',
        eventId: event.id,
        reason: claim.reason,
      });
      return { accepted: true, eventId: event.id, skipped: true, skipReason: claim.reason };
    }

    // Cria transfer (process ou retry)
    await this.transfer.createTransfer({ eventId: event.id, invoiceId, amount, fee });

    return { accepted: true, eventId: event.id };
  }

  /**
   * Processa um evento de webhook da Stark Bank de ponta a ponta:
   * valida assinatura (verifySignature) e processa (processEvent).
   *
   * Usado diretamente em testes unitarios e como composicao dos dois
   * passos acima. A camada de apresentacao usa os metodos separados
   * para poder responder 400 antes de 200 em caso de assinatura invalida
   * sem incorrer no custo de parsear o payload duas vezes.
   */
  async execute(input: HandleWebhookInput): Promise<HandleWebhookOutput> {
    const event = await this.verifySignature(input);
    return this.processEvent(event);
  }
}
