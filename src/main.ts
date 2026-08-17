import { Firestore } from '@google-cloud/firestore';
import * as starkbank from 'starkbank';
import { createLogger } from './infrastructure/logging/logger';
import { FirestoreEventStoreRepository } from './infrastructure/repositories/firestore-event-store-repository';
import { StarkBankSdkRepository } from './infrastructure/repositories/stark-bank-sdk-repository';
import { GoogleOidcAuthVerifier } from './infrastructure/auth/google-oidc-verifier';
import { IdempotencyService } from './application/services/idempotency-service';
import { TransferService } from './application/services/transfer-service';
import { InvoiceService } from './application/services/invoice-service';
import { HandleWebhookUseCase } from './application/use-cases/handle-webhook-use-case';
import { RunSchedulerUseCase } from './application/use-cases/run-scheduler-use-case';
import { RunReconciliationUseCase } from './application/use-cases/run-reconciliation-use-case';
import { buildApp } from './presentation/app';
import { loadEnv } from './config/env';

async function main() {
  const env = loadEnv();
  const logger = createLogger(env.LOG_LEVEL);

  // Inicializa SDK Stark Bank (chave privada ja resolvida por loadEnv)
  const project = new starkbank.Project({
    environment: env.STARKBANK_ENVIRONMENT,
    id: env.STARKBANK_PROJECT_ID,
    privateKey: env.STARKBANK_PRIVATE_KEY,
  });
  starkbank.setUser(project);

  // Infrastructure
  const db = new Firestore({ projectId: env.GCP_PROJECT_ID });
  const eventStore = new FirestoreEventStoreRepository(db);
  const starkBankRepo = new StarkBankSdkRepository(project);
  const authVerifier = new GoogleOidcAuthVerifier(env.INTERNAL_AUTH_AUDIENCE);

  // Application services
  const idempotency = new IdempotencyService(eventStore);
  const transfer = new TransferService(eventStore, starkBankRepo, logger);
  const invoiceService = new InvoiceService(starkBankRepo);

  // Calcula maxCycles
  const maxCycles = Math.floor(env.SCHEDULER_TOTAL_PERIOD / env.SCHEDULER_CYCLE_MINUTES);

  // Use cases
  const handleWebhook = new HandleWebhookUseCase(starkBankRepo, idempotency, transfer, logger);
  const runScheduler = new RunSchedulerUseCase(eventStore, invoiceService, logger, {
    cycleMinutes: env.SCHEDULER_CYCLE_MINUTES,
    totalPeriodMinutes: env.SCHEDULER_TOTAL_PERIOD,
    maxCycles,
    startAt: env.SCHEDULER_START_AT ? new Date(env.SCHEDULER_START_AT) : undefined,
    minInvoicesPerCycle: env.SCHEDULER_MIN_INVOICES,
    maxInvoicesPerCycle: env.SCHEDULER_MAX_INVOICES,
  });
  const runReconciliation = new RunReconciliationUseCase(eventStore, idempotency, transfer, logger);

  // HTTP app
  const app = buildApp({
    handleWebhookUseCase: handleWebhook,
    runSchedulerUseCase: runScheduler,
    runReconciliationUseCase: runReconciliation,
    authVerifier,
    logger,
  });

  await app.listen({ port: env.PORT, host: '0.0.0.0' });
  logger.info({ message: 'server.started', port: env.PORT });

  // Diagnostico temporario: loga o IP de saida desta instancia, para
  // declarar na allowlist de IP da Stark Bank (permissao Admin exige IP
  // fixo). Fire-and-forget, nao atrasa o healthcheck de startup.
  fetch('https://api.ipify.org?format=json')
    .then((res) => res.json())
    .then((data) => logger.info({ message: 'diagnostic.egress_ip', ip: (data as { ip: string }).ip }))
    .catch((err) => logger.warn({ message: 'diagnostic.egress_ip_failed', error: err instanceof Error ? err.message : String(err) }));
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
