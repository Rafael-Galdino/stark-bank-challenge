import { FastifyInstance } from 'fastify';
import { RunReconciliationUseCase } from '../../application/use-cases/run-reconciliation-use-case';
import { InternalAuthVerifier } from '../../infrastructure/auth/google-oidc-verifier';
import { Logger } from '../../infrastructure/logging/logger';
import { requireInternalAuth } from '../middleware/internal-auth-middleware';

/**
 * POST /internal/reconcile
 *
 * Requer: Authorization: Bearer <oidc-token>
 * Responde: { retried, completed, failed }
 */
export function buildReconciliationRouter(
  useCase: RunReconciliationUseCase,
  authVerifier: InternalAuthVerifier,
  logger: Logger,
) {
  return async function reconciliationRouter(app: FastifyInstance) {
    app.post('/internal/reconcile', async (request, reply) => {
      const authorized = await requireInternalAuth(request, reply, authVerifier);
      if (!authorized) return;

      try {
        const result = await useCase.execute();
        return reply.status(200).send(result);
      } catch (err) {
        logger.error({
          message: 'reconciliation.unexpected_error',
          error: err instanceof Error ? err.message : String(err),
        });
        return reply.status(500).send({ error: 'Internal server error' });
      }
    });
  };
}
