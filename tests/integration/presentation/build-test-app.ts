import { FastifyInstance } from 'fastify';
import { buildApp } from '../../../src/presentation/app';
import { InMemoryEventStore } from '../../mocks/in-memory-event-store-repository';
import { MockStarkBankRepository } from '../../mocks/mock-stark-bank-repository';
import { IdempotencyService } from '../../../src/application/services/idempotency-service';
import { TransferService } from '../../../src/application/services/transfer-service';
import { InvoiceService } from '../../../src/application/services/invoice-service';
import { HandleWebhookUseCase } from '../../../src/application/use-cases/handle-webhook-use-case';
import { RunSchedulerUseCase, SchedulerConfig } from '../../../src/application/use-cases/run-scheduler-use-case';
import { RunReconciliationUseCase } from '../../../src/application/use-cases/run-reconciliation-use-case';
import { FixedTokenAuthVerifier } from '../../../src/infrastructure/auth/google-oidc-verifier';
import { createLogger } from '../../../src/infrastructure/logging/logger';

const logger = createLogger('silent');

export const TEST_TOKEN = 'test-token';

const DEFAULT_SCHEDULER_CONFIG: SchedulerConfig = {
  cycleMinutes: 180,
  totalPeriodMinutes: 1440,
  maxCycles: 8,
};

/**
 * Monta uma instancia completa do Fastify app com todas as dependencias
 * substituidas por implementacoes in-memory/mock, para testes de
 * integracao via supertest. Nenhuma chamada real e feita a Firestore ou
 * Stark Bank.
 */
export async function buildTestApp(
  starkBank: MockStarkBankRepository = new MockStarkBankRepository(),
  eventStore: InMemoryEventStore = new InMemoryEventStore(),
  schedulerConfig: SchedulerConfig = DEFAULT_SCHEDULER_CONFIG,
): Promise<FastifyInstance> {
  const idempotency = new IdempotencyService(eventStore);
  const transfer = new TransferService(eventStore, starkBank, logger);
  const invoiceService = new InvoiceService(starkBank);

  const handleWebhookUseCase = new HandleWebhookUseCase(starkBank, idempotency, transfer, logger);
  const runSchedulerUseCase = new RunSchedulerUseCase(eventStore, invoiceService, logger, schedulerConfig);
  const runReconciliationUseCase = new RunReconciliationUseCase(eventStore, idempotency, transfer, logger);
  const authVerifier = new FixedTokenAuthVerifier(TEST_TOKEN);

  const app = buildApp({
    handleWebhookUseCase,
    runSchedulerUseCase,
    runReconciliationUseCase,
    authVerifier,
    logger,
  });

  // Aguarda o carregamento completo dos plugins/rotas assincronas (ex: o
  // escopo isolado do webhook) antes de expor `app.server` para o
  // supertest, evitando requisicoes disparadas contra rotas ainda nao
  // registradas.
  await app.ready();

  return app;
}
