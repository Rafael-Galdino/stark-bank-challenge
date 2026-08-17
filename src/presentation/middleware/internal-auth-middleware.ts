import { FastifyReply, FastifyRequest } from 'fastify';
import { InternalAuthVerifier } from '../../infrastructure/auth/google-oidc-verifier';

/**
 * Helper de autenticacao para endpoints internos (chamados pelo Cloud
 * Scheduler) protegidos por token OIDC Bearer.
 *
 * Se a requisicao nao estiver autorizada, envia HTTP 401 e retorna false.
 * O chamador deve interromper o processamento da rota nesse caso.
 *
 * Uso:
 *   const authorized = await requireInternalAuth(request, reply, authVerifier);
 *   if (!authorized) return;
 */
export async function requireInternalAuth(
  request: FastifyRequest,
  reply: FastifyReply,
  authVerifier: InternalAuthVerifier,
): Promise<boolean> {
  const authorized = await authVerifier.verify(request.headers.authorization);
  if (!authorized) {
    await reply.status(401).send({ error: 'Unauthorized' });
    return false;
  }
  return true;
}
