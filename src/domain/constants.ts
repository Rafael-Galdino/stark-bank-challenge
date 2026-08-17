/**
 * Limiar de obsolescencia para eventos presos em `processing`.
 * Compartilhado entre o repositorio (decide quando um claim pode ser
 * retentado) e a reconciliacao (decide quais eventos varrer) para que
 * as duas leituras da regra nunca divirjam.
 */
export const STALE_THRESHOLD_MS = 5 * 60 * 1000;

/**
 * Limiar de obsolescencia para um ciclo do scheduler preso em `running`.
 * Maior que STALE_THRESHOLD_MS de proposito: um ciclo emite ate 12 invoices
 * em sequencia, cada createInvoice com ate 4 tentativas e backoff de ate
 * 8s (pior caso ~22s por invoice) - entao um ciclo legitimo em andamento
 * pode levar alguns minutos, e nao pode ser confundido com um worker morto.
 * 10min da folga confortavel sobre o pior caso (~4-5min) sem deixar um
 * ciclo travado por tempo demais dentro da janela de 3h entre ciclos.
 */
export const SCHEDULER_CYCLE_STALE_THRESHOLD_MS = 10 * 60 * 1000;
