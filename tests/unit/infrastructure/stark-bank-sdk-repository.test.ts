import { describe, it, expect, vi, beforeEach } from 'vitest';

const parseMock = vi.fn();
const invoiceCreateMock = vi.fn();
const transferCreateMock = vi.fn();
const transferQueryMock = vi.fn();

vi.mock('starkbank', () => {
  class InvalidSignatureError extends Error {}

  return {
    Project: vi.fn().mockImplementation((params) => params),
    Invoice: vi.fn().mockImplementation((params) => params),
    Transfer: vi.fn().mockImplementation((params) => params),
    setUser: vi.fn(),
    event: { parse: parseMock },
    invoice: { create: invoiceCreateMock },
    transfer: { create: transferCreateMock, query: transferQueryMock },
    error: { InvalidSignatureError },
  };
});

// Importado apos o mock do modulo 'starkbank'
const starkbank = await import('starkbank');
const { StarkBankSdkRepository } = await import('../../../src/infrastructure/repositories/stark-bank-sdk-repository');
const { InvalidWebhookSignatureError } = await import('../../../src/domain/errors/invalid-webhook-signature-error');

describe('StarkBankSdkRepository', () => {
  let repo: InstanceType<typeof StarkBankSdkRepository>;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new StarkBankSdkRepository({} as never);
  });

  describe('parseWebhookEvent', () => {
    it('extrai os dados da invoice e o logType quando subscription === invoice', async () => {
      parseMock.mockResolvedValue({
        id: 'evt-1',
        subscription: 'invoice',
        log: { type: 'credited', invoice: { id: 'inv-1', amount: 10000, fee: 50, status: 'paid' } },
      });

      const result = await repo.parseWebhookEvent('{"raw":"body"}', 'sig-123');

      expect(parseMock).toHaveBeenCalledWith({ content: '{"raw":"body"}', signature: 'sig-123' });
      expect(result).toEqual({
        id: 'evt-1',
        subscriptionType: 'invoice',
        logType: 'credited',
        invoice: { id: 'inv-1', amount: 10000, fee: 50, status: 'paid' },
      });
    });

    it('nao popula invoice quando subscription e diferente de invoice', async () => {
      parseMock.mockResolvedValue({
        id: 'evt-2',
        subscription: 'transfer',
        log: { transfer: { id: 'tr-1' } },
      });

      const result = await repo.parseWebhookEvent('{}', 'sig');
      expect(result).toEqual({ id: 'evt-2', subscriptionType: 'transfer', invoice: undefined });
    });

    it('trata fee ausente como 0', async () => {
      parseMock.mockResolvedValue({
        id: 'evt-3',
        subscription: 'invoice',
        log: { type: 'credited', invoice: { id: 'inv-3', amount: 5000, status: 'paid' } },
      });

      const result = await repo.parseWebhookEvent('{}', 'sig');
      expect(result.invoice?.fee).toBe(0);
    });

    it('converte starkbank.error.InvalidSignatureError em InvalidWebhookSignatureError (assinatura genuinamente invalida)', async () => {
      parseMock.mockRejectedValue(new starkbank.error.InvalidSignatureError('Provided signature and content do not match'));

      const promise = repo.parseWebhookEvent('{}', 'bad-sig');
      await expect(promise).rejects.toBeInstanceOf(InvalidWebhookSignatureError);
      await expect(promise).rejects.toThrow('Provided signature and content do not match');
    });

    it('propaga qualquer outro erro sem envolver (nao e assinatura invalida - ex: falha de rede buscando a chave publica)', async () => {
      parseMock.mockRejectedValue(new Error('ETIMEDOUT'));

      const promise = repo.parseWebhookEvent('{}', 'sig');
      await expect(promise).rejects.not.toBeInstanceOf(InvalidWebhookSignatureError);
      await expect(promise).rejects.toThrow('ETIMEDOUT');
    });
  });

  describe('createInvoice', () => {
    it('cria a invoice e retorna os dados normalizados', async () => {
      invoiceCreateMock.mockResolvedValue([{ id: 'inv-x', amount: 5000, name: 'Ana Silva', taxId: '123.456.789-09' }]);

      const result = await repo.createInvoice({ amount: 5000, name: 'Ana Silva', taxId: '123.456.789-09' });
      expect(result).toEqual({ id: 'inv-x', amount: 5000, name: 'Ana Silva', taxId: '123.456.789-09' });
      expect(invoiceCreateMock).toHaveBeenCalledTimes(1);
    });

    it('retenta ate 4 vezes e propaga o erro se todas falharem', async () => {
      vi.useFakeTimers();
      try {
        invoiceCreateMock.mockRejectedValue(new Error('stark bank unavailable'));
        const promise = repo.createInvoice({ amount: 5000, name: 'Ana Silva', taxId: '123' });
        const assertion = expect(promise).rejects.toThrow('stark bank unavailable');
        await vi.runAllTimersAsync();
        await assertion;
        expect(invoiceCreateMock).toHaveBeenCalledTimes(4);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('createTransfer', () => {
    it('cria o transfer com o externalId informado', async () => {
      transferCreateMock.mockResolvedValue([{ id: 'tr-x', amount: 9950, externalId: 'invoice-inv-1' }]);

      const result = await repo.createTransfer({
        amount: 9950,
        bankCode: '20018183',
        branchCode: '0001',
        accountNumber: '6341320293482496',
        accountType: 'payment',
        taxId: '20.018.183/0001-80',
        name: 'Stark Bank S.A.',
        externalId: 'invoice-inv-1',
      });

      expect(result).toEqual({ id: 'tr-x', amount: 9950, externalId: 'invoice-inv-1' });
    });

    it('retenta ate 3 vezes e propaga o erro se todas falharem', async () => {
      vi.useFakeTimers();
      try {
        transferCreateMock.mockRejectedValue(new Error('timeout'));
        const promise = repo.createTransfer({
          amount: 9950,
          bankCode: '20018183',
          branchCode: '0001',
          accountNumber: '6341320293482496',
          accountType: 'payment',
          taxId: '20.018.183/0001-80',
          name: 'Stark Bank S.A.',
          externalId: 'invoice-inv-1',
        });
        const assertion = expect(promise).rejects.toThrow('timeout');
        await vi.runAllTimersAsync();
        await assertion;
        expect(transferCreateMock).toHaveBeenCalledTimes(3);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('findTransferByExternalId', () => {
    it('encontra o transfer com o externalId correspondente e passa taxId como filtro', async () => {
      transferQueryMock.mockResolvedValue([
        { id: 'tr-1', amount: 100, externalId: 'invoice-other' },
        { id: 'tr-2', amount: 9950, externalId: 'invoice-inv-1' },
      ]);

      const result = await repo.findTransferByExternalId('invoice-inv-1', '20.018.183/0001-80');

      expect(transferQueryMock).toHaveBeenCalledWith({ taxId: '20.018.183/0001-80' });
      expect(result).toEqual({ id: 'tr-2', amount: 9950, externalId: 'invoice-inv-1' });
    });

    it('retorna null quando nenhum transfer bate com o externalId', async () => {
      transferQueryMock.mockResolvedValue([{ id: 'tr-1', amount: 100, externalId: 'invoice-other' }]);

      const result = await repo.findTransferByExternalId('invoice-inv-1', '20.018.183/0001-80');

      expect(result).toBeNull();
    });

    it('funciona tambem quando query resolve para um async generator (comportamento real do SDK)', async () => {
      async function* generator() {
        yield { id: 'tr-async', amount: 9950, externalId: 'invoice-inv-1' };
      }
      transferQueryMock.mockResolvedValue(generator());

      const result = await repo.findTransferByExternalId('invoice-inv-1', '20.018.183/0001-80');

      expect(result).toEqual({ id: 'tr-async', amount: 9950, externalId: 'invoice-inv-1' });
    });
  });
});
