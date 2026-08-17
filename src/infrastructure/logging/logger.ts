import pino from 'pino';

export type Logger = pino.Logger;

/**
 * Cria um logger pino com saida JSON estruturada.
 * O nivel e configuravel via variavel de ambiente LOG_LEVEL.
 *
 * Uso: logger.info({ message: 'transfer.created', eventId, ... })
 *
 * Todos os campos de negocio sao passados como objeto - o pino
 * os serializa como campos de primeiro nivel no JSON.
 */
export function createLogger(level = 'info'): Logger {
  return pino({ level });
}
