import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FixedTokenAuthVerifier, GoogleOidcAuthVerifier } from '../../../src/infrastructure/auth/google-oidc-verifier';

const verifyIdTokenMock = vi.fn();

vi.mock('google-auth-library', () => {
  return {
    OAuth2Client: vi.fn().mockImplementation(() => ({
      verifyIdToken: verifyIdTokenMock,
    })),
  };
});

describe('FixedTokenAuthVerifier', () => {
  const verifier = new FixedTokenAuthVerifier('test-token');

  it('aceita o token estatico correto', async () => {
    expect(await verifier.verify('Bearer test-token')).toBe(true);
  });

  it('rejeita token incorreto', async () => {
    expect(await verifier.verify('Bearer wrong-token')).toBe(false);
  });

  it('rejeita header ausente', async () => {
    expect(await verifier.verify(undefined)).toBe(false);
  });

  it('rejeita header sem prefixo Bearer', async () => {
    expect(await verifier.verify('test-token')).toBe(false);
  });
});

describe('GoogleOidcAuthVerifier', () => {
  beforeEach(() => {
    verifyIdTokenMock.mockReset();
  });

  it('retorna true para token valido com payload', async () => {
    verifyIdTokenMock.mockResolvedValue({ getPayload: () => ({ sub: '123' }) });
    const verifier = new GoogleOidcAuthVerifier('https://my-service.run.app');
    expect(await verifier.verify('Bearer valid-token')).toBe(true);
  });

  it('retorna false quando verifyIdToken lanca erro', async () => {
    verifyIdTokenMock.mockRejectedValue(new Error('invalid token'));
    const verifier = new GoogleOidcAuthVerifier();
    expect(await verifier.verify('Bearer bad-token')).toBe(false);
  });

  it('retorna false quando header nao comeca com Bearer', async () => {
    const verifier = new GoogleOidcAuthVerifier();
    expect(await verifier.verify('Basic abc')).toBe(false);
    expect(verifyIdTokenMock).not.toHaveBeenCalled();
  });

  it('retorna false quando header esta ausente', async () => {
    const verifier = new GoogleOidcAuthVerifier();
    expect(await verifier.verify(undefined)).toBe(false);
  });
});
