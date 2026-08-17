import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { HandleWebhookUseCase } from '../../application/use-cases/handle-webhook-use-case';
import { InvalidWebhookSignatureError } from '../../domain/errors/invalid-webhook-signature-error';
import { Logger } from '../../infrastructure/logging/logger';

/**
 * POST /webhook
 *
 * Comportamento:
 *   1. Extrai o header "digital-signature"
 *   2. Obtem o raw body como string (ja preservado pelo content-type parser
 *      do escopo isolado registrado em presentation/app.ts)
 *   3. Valida a assinatura ECDSA de forma SINCRONA (await) ANTES de responder
 *      - Assinatura genuinamente invalida (InvalidWebhookSignatureError) ->
 *        HTTP 400 imediatamente (Stark Bank trata como erro permanente e
 *        interrompe o retry - correto, ja que retentar nao muda o resultado)
 *      - Qualquer outro erro nesse passo (rede/timeout buscando a chave
 *        publica da Stark Bank, corpo malformado) -> HTTP 5xx, NUNCA 400.
 *        Um erro de infraestrutura nao e uma assinatura invalida; responder
 *        400 faria a Stark Bank desistir da entrega e o transfer da invoice
 *        paga seria perdido silenciosamente (a idempotencia so comeca
 *        depois que a assinatura passa).
 *   4. Assinatura valida -> responde HTTP 200 IMEDIATAMENTE (fire-and-forget)
 *   5. Processa o evento em background com setImmediate (filtragem,
 *      idempotencia e criacao do transfer), sem reparsear o payload
 *
 * DECISAO DE DESIGN (spec secao 7.2 apresentava duas abordagens
 * alternativas; a primeira - responder 200 e so entao validar dentro do
 * bloco try - nunca captura o erro de assinatura de forma sincrona porque
 * o parse e assincrono e ocorre depois do reply.send(), entao o catch()
 * nunca dispara e o endpoint sempre responderia 200 mesmo para assinaturas
 * invalidas. Adotamos a segunda abordagem descrita na spec: validar antes
 * de responder. Para nao pagar o custo de parsear o payload duas vezes,
 * HandleWebhookUseCase foi dividido em `verifySignature` (parse + valida
 * assinatura) e `processEvent` (logica de negocio), reaproveitando o
 * evento ja parseado no processamento em background.
 *
 * CRITICO: O corpo da requisicao DEVE ser recebido como string pura.
 * Nao usar request.body parsed - usar request.body diretamente como string.
 */
export function buildWebhookRouter(useCase: HandleWebhookUseCase, logger: Logger) {
  return async function webhookRouter(app: FastifyInstance) {
    app.post('/webhook', async (request: FastifyRequest, reply: FastifyReply) => {
      const signature = request.headers['digital-signature'] as string | undefined;
      const rawBody = request.body as string;

      if (!signature) {
        return reply.status(400).send({ error: 'Missing digital-signature header' });
      }

      let event;
      try {
        event = await useCase.verifySignature({ rawBody, signature });
      } catch (err) {
        if (err instanceof InvalidWebhookSignatureError) {
          logger.warn({
            message: 'webhook.invalid_signature',
            error: err.message,
          });
          return reply.status(400).send({ error: 'Invalid signature' });
        }

        logger.error({
          message: 'webhook.signature_verification_infra_error',
          error: err instanceof Error ? err.message : String(err),
        });
        return reply.status(503).send({ error: 'Temporarily unable to verify signature' });
      }

      // Assinatura valida: responde 200 imediatamente e processa em background
      reply.status(200).send({ received: true });

      setImmediate(() => {
        useCase.processEvent(event).catch((err) => {
          logger.error({
            message: 'webhook.background_error',
            eventId: event.id,
            error: err instanceof Error ? err.message : String(err),
          });
        });
      });
    });
  };
}
