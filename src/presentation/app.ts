import Fastify, { FastifyInstance } from 'fastify';
import { HandleWebhookUseCase } from '../application/use-cases/handle-webhook-use-case';
import { RunSchedulerUseCase } from '../application/use-cases/run-scheduler-use-case';
import { RunReconciliationUseCase } from '../application/use-cases/run-reconciliation-use-case';
import { InternalAuthVerifier } from '../infrastructure/auth/google-oidc-verifier';
import { Logger } from '../infrastructure/logging/logger';
import { buildWebhookRouter } from './controllers/webhook-controller';
import { buildSchedulerRouter } from './controllers/scheduler-controller';
import { buildReconciliationRouter } from './controllers/reconciliation-controller';

export interface AppDependencies {
  handleWebhookUseCase: HandleWebhookUseCase;
  runSchedulerUseCase: RunSchedulerUseCase;
  runReconciliationUseCase: RunReconciliationUseCase;
  authVerifier: InternalAuthVerifier;
  logger: Logger;
}

/**
 * Cria e configura a instancia Fastify.
 *
 * ATENCAO - Raw body para ECDSA:
 * O Fastify NAO deve parsear o body de /webhook como JSON. A rota /webhook
 * e registrada dentro de um plugin Fastify proprio (encapsulado), com um
 * content-type parser customizado que preserva o body como string pura -
 * necessario para a validacao da assinatura ECDSA pelo SDK da Stark Bank.
 *
 * Usamos o mecanismo de encapsulamento de plugins do Fastify (em vez de
 * inspecionar a URL da requisicao dentro de um parser global) porque os
 * content-type parsers registrados em um plugin encapsulado se aplicam
 * apenas as rotas daquele plugin e de seus filhos, nunca ao escopo pai.
 * Isso evita depender de propriedades internas da request (como
 * `routeOptions`) que podem nao estar totalmente populadas no momento em
 * que o parser roda.
 *
 * Para as demais rotas (fora do plugin do webhook), o body e parseado
 * normalmente como JSON pelo parser padrao embutido do Fastify (nenhuma
 * customizacao e necessaria nessas rotas).
 */
export function buildApp(deps: AppDependencies): FastifyInstance {
  const app = Fastify({ logger: false }); // usa pino externo

  // NAO registramos um parser customizado de 'application/json' no escopo
  // raiz: o Fastify ja possui um parser JSON padrao embutido (via
  // secure-json-parse) que atende as rotas fora do webhook. Registrar um
  // parser customizado aqui, alem de redundante, impediria o plugin do
  // webhook de sobrescrever 'application/json' no seu proprio escopo
  // encapsulado (Fastify lanca FST_ERR_CTP_ALREADY_PRESENT ao tentar
  // registrar novamente um content-type cujo parser ja foi customizado em
  // um escopo ancestral).

  // Health check (sem auth)
  app.get('/health', async () => ({ status: 'ok' }));

  // Escopo isolado para o webhook: preserva o body como string pura
  app.register(async function webhookScope(instance) {
    instance.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body, done) => {
      done(null, body);
    });
    await instance.register(buildWebhookRouter(deps.handleWebhookUseCase, deps.logger));
  });

  // Demais rotas internas (JSON normal, herdado do escopo raiz)
  app.register(buildSchedulerRouter(deps.runSchedulerUseCase, deps.authVerifier, deps.logger));
  app.register(buildReconciliationRouter(deps.runReconciliationUseCase, deps.authVerifier, deps.logger));

  return app;
}
