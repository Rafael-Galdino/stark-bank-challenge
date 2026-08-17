import * as starkbank from 'starkbank';
import {
  StarkBankRepository,
  CreateInvoiceParams,
  CreatedInvoice,
  CreateTransferParams,
  CreatedTransfer,
  ParsedWebhookEvent,
} from '../../domain/repositories/stark-bank-repository';
import { InvalidWebhookSignatureError } from '../../domain/errors/invalid-webhook-signature-error';
import { withRetry } from '../http/retry';

export class StarkBankSdkRepository implements StarkBankRepository {
  constructor(private readonly project: starkbank.Project) {}

  /**
   * Valida a assinatura ECDSA e retorna o evento parseado.
   * Usa starkbank.event.parse({ content: rawBody, signature }).
   * Lanca erro se a assinatura for invalida.
   *
   * NOTA: `event.log` e uma uniao de tipos (Log de transfer, invoice, boleto etc.)
   * conforme os tipos oficiais do SDK. So acessamos `.invoice` apos confirmar
   * que `event.subscription === 'invoice'`.
   *
   * IMPORTANTE: o repasse efetivo do dinheiro e sinalizado por `log.type === 'credited'`,
   * NAO por `invoice.status` (que nunca assume o valor "credited" - seus valores possiveis sao
   * canceled/created/expired/overdue/paid/unknown/voided). Por isso `log.type` e mapeado
   * separadamente para `ParsedWebhookEvent.logType`.
   */
  async parseWebhookEvent(rawBody: string, signature: string): Promise<ParsedWebhookEvent> {
    let event: starkbank.Event;
    try {
      event = await starkbank.event.parse({
        content: rawBody,
        signature,
      });
    } catch (err) {
      // Somente starkbank.error.InvalidSignatureError significa "assinatura
      // realmente invalida". Qualquer outro erro (rede/timeout buscando a
      // chave publica, JSON malformado no rawBody) propaga como esta -
      // ver doc de parseWebhookEvent na interface do dominio para o porque
      // disso importar pro caller.
      if (err instanceof starkbank.error.InvalidSignatureError) {
        throw new InvalidWebhookSignatureError(err.message);
      }
      throw err;
    }

    let invoiceData: ParsedWebhookEvent['invoice'];
    let logType: string | undefined;

    if (event.subscription === 'invoice') {
      const log = event.log as starkbank.invoice.Log;
      invoiceData = {
        id: log.invoice.id,
        amount: log.invoice.amount,
        fee: log.invoice.fee ?? 0,
        status: log.invoice.status,
      };
      logType = log.type;
    }

    return {
      id: event.id,
      subscriptionType: event.subscription,
      logType,
      invoice: invoiceData,
    };
  }

  /**
   * Cria uma invoice com retry.
   * Invoice create: maxAttempts=4, baseDelay=2000ms, maxDelay=8000ms
   */
  async createInvoice(params: CreateInvoiceParams): Promise<CreatedInvoice> {
    return withRetry(
      async () => {
        const [invoice] = await starkbank.invoice.create([
          new starkbank.Invoice({
            amount: params.amount,
            name: params.name,
            taxId: params.taxId,
          }),
        ]);
        return { id: invoice.id, amount: invoice.amount, name: invoice.name, taxId: invoice.taxId };
      },
      4,
      2000,
      8000,
    );
  }

  /**
   * Cria um transfer com retry.
   * Transfer create: maxAttempts=3, baseDelay=1000ms, maxDelay=4000ms
   *
   * O externalId garante idempotencia na propria Stark Bank, mas nao do jeito
   * "silencioso" que se poderia esperar: um externalId repetido nao retorna o
   * transfer existente, e sim lanca erro ("Duplicated externalIds will cause
   * failures" - doc do proprio SDK). Por isso esse erro nao pode ser tratado
   * como falha real pelo caller - ver findTransferByExternalId, usado por
   * TransferService para diferenciar "falhou de verdade" de "ja existe".
   */
  async createTransfer(params: CreateTransferParams): Promise<CreatedTransfer> {
    return withRetry(
      async () => {
        const [transfer] = await starkbank.transfer.create([
          new starkbank.Transfer({
            amount: params.amount,
            bankCode: params.bankCode,
            branchCode: params.branchCode,
            accountNumber: params.accountNumber,
            accountType: params.accountType,
            taxId: params.taxId,
            name: params.name,
            externalId: params.externalId,
          }),
        ]);
        return { id: transfer.id, amount: transfer.amount, externalId: transfer.externalId ?? params.externalId };
      },
      3,
      1000,
      4000,
    );
  }

  /**
   * `transfer.query` desta versao do SDK nao aceita filtro por externalId
   * (so limit/after/before/transactionIds/status/taxId/sort/tags/ids) -
   * por isso escaneamos os transfers do taxId de destino (bounded, ja que
   * essa aplicacao so envia para uma conta fixa) e filtramos client-side.
   *
   * NOTA: os tipos do SDK declaram `query` como `Promise<Transfer[]>`, mas
   * em runtime ele retorna `Promise<AsyncGenerator>` (mesmo bug documentado
   * no README para `webhook.query`). `for await...of` funciona corretamente
   * nos dois casos, entao usamos esse padrao aqui de proposito.
   */
  async findTransferByExternalId(externalId: string, taxId: string): Promise<CreatedTransfer | null> {
    const transfers = await starkbank.transfer.query({ taxId });

    for await (const transfer of transfers) {
      if (transfer.externalId === externalId) {
        return { id: transfer.id, amount: transfer.amount, externalId };
      }
    }

    return null;
  }
}
