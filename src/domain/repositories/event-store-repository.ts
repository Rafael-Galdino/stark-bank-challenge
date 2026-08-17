import { WebhookEvent } from '../entities/webhook-event-entity';

/** Resultado do claim transacional de idempotencia */
export type ClaimResult =
  | { action: 'skip'; reason: 'completed' | 'processing' }
  | { action: 'retry' }
  | { action: 'process' };

/** Configuracao global do run do scheduler */
export interface RunConfig {
  startedAt: Date;
  deadlineAt: Date;
  maxCycles: number;
  cycleMinutes: number;
  totalPeriodMinutes: number;
}

/** Dados da conta destino do transfer */
export interface TransferTarget {
  bankCode: string;
  branchCode: string;
  accountNumber: string;
  name: string;
  taxId: string;
  accountType: string;
}

export interface EventStoreRepository {
  /**
   * Garante que um mesmo eventId de webhook so dispara um transfer, mesmo se
   * a Stark Bank reenviar o webhook ou o processo cair no meio do caminho.
   *
   * O claim precisa ser atomico (transacao Firestore) porque o "ja existe?"
   * e o "cria o registro" tem que acontecer como uma unica operacao -
   * senao dois workers concorrentes poderiam ler "nao existe" ao mesmo
   * tempo e ambos seguirem para criar o transfer. Um evento preso em
   * "processing" por tempo demais (o worker que estava tratando ele
   * provavelmente crashou) e tratado como elegivel para retry em vez de
   * ficar bloqueado para sempre. Um evento "failed" tambem e elegivel para
   * retry - de forma imediata, sem esperar staleness, ja que "failed" so
   * e alcancado depois que a tentativa anterior concluiu (nao ha worker em
   * andamento pra esperar) - e preserva attempts/createdAt/lastError
   * originais em vez de tratar a reentrega como um evento novo.
   */
  claimWebhookEvent(params: {
    eventId: string;
    invoiceId: string;
    amount: number;
    fee: number;
    netAmount: number;
  }): Promise<ClaimResult>;

  /** Marca um evento como completed e registra o transferId */
  completeWebhookEvent(eventId: string, transferId: string): Promise<void>;

  /** Marca um evento como completed sem transferId (fee >= amount) */
  completeWebhookEventNoTransfer(eventId: string): Promise<void>;

  /** Marca um evento como failed e registra a mensagem de erro */
  failWebhookEvent(eventId: string, error: string): Promise<void>;

  /**
   * Busca eventos que precisam de uma nova tentativa: os que ja falharam
   * explicitamente, e os que ficaram travados em "processing" por mais
   * tempo do que um transfer deveria levar (sinal de worker morto).
   */
  findReconciliableEvents(staleThresholdMs: number): Promise<WebhookEvent[]>;

  /**
   * Lock de exclusao mutua para um ciclo do scheduler em
   * scheduler_executions/{cycleId}. Se dois disparos do scheduler (ex: o
   * Cloud Scheduler disparando duas vezes no mesmo horario) coincidirem no
   * mesmo cycleId, so o primeiro consegue o lock e emite invoices.
   *
   * Um ciclo 'running' ha mais tempo que SCHEDULER_CYCLE_STALE_THRESHOLD_MS
   * e tratado como recuperavel (o worker anterior provavelmente crashou no
   * meio do lote de invoices) - o lock e retomado em vez de ficar travado
   * em 'running' para sempre, espelhando o mesmo padrao usado para eventos
   * de webhook presos em 'processing'. Ciclos 'completed'/'partial_failure'
   * sao terminais e nunca retentados.
   */
  tryAcquireSchedulerCycle(cycleId: string): Promise<boolean>;

  /** Marca um ciclo como completed e registra os invoiceIds emitidos */
  completeSchedulerCycle(cycleId: string, invoiceIds: string[]): Promise<void>;

  /**
   * Le o estado global do run (starkbank_challenge_config/run) ou o cria na primeira
   * chamada. O startedAt precisa ser fixado nesse primeiro momento e depois
   * nunca mudar - e ele que ancora a deadline e a contagem de ciclos do
   * desafio inteiro, entao chamadas seguintes so devem retornar o que ja
   * foi persistido em vez de recalcular a partir de "agora".
   */
  getOrInitRunConfig(params: {
    startAt?: Date;
    cycleMinutes: number;
    totalPeriodMinutes: number;
    maxCycles: number;
  }): Promise<RunConfig>;

  /** Conta quantos ciclos ja terminaram, usado pelo scheduler para saber se atingiu maxCycles */
  countCompletedCycles(): Promise<number>;

  /** Le a conta bancaria fixa para onde todo transfer deste desafio e enviado */
  getTransferTarget(): Promise<TransferTarget>;
}
