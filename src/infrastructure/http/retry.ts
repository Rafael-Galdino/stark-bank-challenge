/**
 * Executa uma funcao assincrona com retry e exponential backoff com jitter.
 *
 * Algoritmo de delay entre tentativas:
 *   delay = min(baseDelay * 2^(attempt - 1), maxDelay) + random(0, 100)
 *
 * @param fn          - funcao a executar (pode lancar erro)
 * @param maxAttempts - numero maximo de tentativas (incluindo a primeira)
 * @param baseDelay   - delay base em ms para a segunda tentativa
 * @param maxDelay    - delay maximo em ms
 *
 * Lanca o ultimo erro se todas as tentativas falharem.
 *
 * Configuracoes por operacao:
 *   Invoice create:  maxAttempts=4, baseDelay=2000, maxDelay=8000
 *   Transfer create: maxAttempts=3, baseDelay=1000, maxDelay=4000
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts: number,
  baseDelay: number,
  maxDelay: number,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt === maxAttempts) break;

      const exponential = baseDelay * Math.pow(2, attempt - 1);
      // Math.random() aqui e so jitter de timing (evita retries sincronizados
      // entre chamadas concorrentes) - nao produz segredo, token ou decisao
      // de seguranca, entao um PRNG nao-criptografico e apropriado.
      const delay = Math.min(exponential, maxDelay) + Math.floor(Math.random() * 100);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
