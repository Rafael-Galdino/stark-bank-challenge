/**
 * Sinaliza que a assinatura ECDSA de um webhook e genuinamente invalida -
 * nao bate com a chave publica da Stark Bank, ou o header de assinatura
 * esta malformado. Distinto de propósito de qualquer outro erro que possa
 * ocorrer durante a verificacao (rede/timeout/DNS ao buscar a chave publica,
 * JSON malformado no corpo) - esses NAO significam assinatura invalida, e
 * tratar os dois casos da mesma forma faz o caller (webhook-controller)
 * responder 400 para uma falha transitoria, que a Stark Bank trata como
 * erro permanente e nunca retenta, perdendo o webhook silenciosamente.
 *
 * Lancado por StarkBankSdkRepository.parseWebhookEvent ao capturar
 * especificamente starkbank.error.InvalidSignatureError do SDK.
 */
export class InvalidWebhookSignatureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidWebhookSignatureError';
  }
}
