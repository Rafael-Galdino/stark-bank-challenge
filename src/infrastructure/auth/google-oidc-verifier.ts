import { OAuth2Client } from 'google-auth-library';

/**
 * Interface de verificacao de autenticacao de endpoints internos.
 * Duas implementacoes:
 *   - GoogleOidcAuthVerifier: producao (valida JWT Google OIDC)
 *   - FixedTokenAuthVerifier: testes (aceita token estatico)
 */
export interface InternalAuthVerifier {
  verify(authorizationHeader: string | undefined): Promise<boolean>;
}

/**
 * Verificador de producao usando Google Auth Library.
 * Valida token JWT Bearer emitido pelo Cloud Scheduler / Cloud Run.
 *
 * @param audience - URL do servico Cloud Run (ex: https://my-service.run.app)
 *                   Se nao fornecido, pula verificacao de audience.
 */
export class GoogleOidcAuthVerifier implements InternalAuthVerifier {
  private readonly client: OAuth2Client;

  constructor(private readonly audience?: string) {
    this.client = new OAuth2Client();
  }

  async verify(authorizationHeader: string | undefined): Promise<boolean> {
    if (!authorizationHeader?.startsWith('Bearer ')) return false;
    const token = authorizationHeader.slice(7);

    try {
      const ticket = await this.client.verifyIdToken({
        idToken: token,
        audience: this.audience,
      });
      return !!ticket.getPayload();
    } catch {
      return false;
    }
  }
}

/**
 * Verificador para testes.
 * Aceita um token estatico fixo.
 *
 * Uso em testes: new FixedTokenAuthVerifier('test-token')
 * Request: Authorization: Bearer test-token
 */
export class FixedTokenAuthVerifier implements InternalAuthVerifier {
  constructor(private readonly validToken: string) {}

  async verify(authorizationHeader: string | undefined): Promise<boolean> {
    if (!authorizationHeader?.startsWith('Bearer ')) return false;
    return authorizationHeader.slice(7) === this.validToken;
  }
}
