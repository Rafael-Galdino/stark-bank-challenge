/**
 * Deriva o externalId de um transfer a partir do invoiceId que o originou.
 *
 * Isso funciona como uma segunda camada de idempotencia, independente do
 * nosso proprio controle no Firestore: como o mesmo invoiceId sempre produz
 * o mesmo externalId, se por algum motivo o mesmo evento de webhook for
 * reprocessado (retry nosso, redelivery da Stark Bank, etc.), a propria
 * Stark Bank rejeita o segundo transfer com esse externalId em vez de
 * mover o dinheiro duas vezes.
 *
 * @param invoiceId - ID da invoice na Stark Bank
 * @returns externalId no formato "invoice-{invoiceId}"
 */
export function buildExternalId(invoiceId: string): string {
  return `invoice-${invoiceId}`;
}
