import { FastifyInstance } from 'fastify';
import { RunSchedulerUseCase } from '../../application/use-cases/run-scheduler-use-case';
import { InternalAuthVerifier } from '../../infrastructure/auth/google-oidc-verifier';
import { Logger } from '../../infrastructure/logging/logger';
import { requireInternalAuth } from '../middleware/internal-auth-middleware';

/**
 * POST /internal/schedule
 *
 * Requer: Authorization: Bearer <oidc-token>
 * Responde: resultado do ciclo (incluindo campos de skip se guard disparou)
 */
export function buildSchedulerRouter(
  useCase: RunSchedulerUseCase,
  authVerifier: InternalAuthVerifier,
  logger: Logger,
) {
  return async function schedulerRouter(app: FastifyInstance) {
    app.post('/internal/schedule', async (request, reply) => {
      const authorized = await requireInternalAuth(request, reply, authVerifier);
      if (!authorized) return;

      try {
        const result = await useCase.execute();
        return reply.status(200).send(result);
      } catch (err) {
        logger.error({
          message: 'scheduler.unexpected_error',
          error: err instanceof Error ? err.message : String(err),
        });
        return reply.status(500).send({ error: 'Internal server error' });
      }
    });
  };
}
