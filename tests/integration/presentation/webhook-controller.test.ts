import { describe, it, expect } from 'vitest';
import supertest from 'supertest';
import { MockStarkBankRepository } from '../../mocks/mock-stark-bank-repository';
import { InMemoryEventStore } from '../../mocks/in-memory-event-store-repository';
import { InvalidWebhookSignatureError } from '../../../src/domain/errors/invalid-webhook-signature-error';
import { buildTestApp } from './build-test-app';

function tick(ms = 10) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('POST /webhook', () => {
  it('retorna 200 para webhook valido e processa o transfer em background', async () => {
    const starkBank = new MockStarkBankRepository();
    starkBank.parseWebhookEvent.mockResolvedValue({
      id: 'e1',
      subscriptionType: 'invoice',
      logType: 'credited',
      invoice: { id: 'i1', amount: 5000, fee: 50, status: 'paid' },
    });
    starkBank.createTransfer.mockResolvedValue({ id: 'tr1', amount: 4950, externalId: 'invoice-i1' });
    const eventStore = new InMemoryEventStore();

    const app = await buildTestApp(starkBank, eventStore);
    const res = await supertest(app.server)
      .post('/webhook')
      .set('digital-signature', 'valid-sig')
      .set('content-type', 'application/json')
      .send('{"event":"test"}');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true });

    await tick(); // aguarda processamento em background (setImmediate)
    expect(starkBank.createTransfer).toHaveBeenCalledTimes(1);
    expect(eventStore.getEvent('e1')?.status).toBe('completed');
  });

  it('retorna 400 para assinatura invalida, sem responder 200 antes', async () => {
    const starkBank = new MockStarkBankRepository();
    starkBank.parseWebhookEvent.mockRejectedValue(new InvalidWebhookSignatureError('Provided signature and content do not match'));

    const app = await buildTestApp(starkBank);
    const res = await supertest(app.server)
      .post('/webhook')
      .set('digital-signature', 'invalid-sig')
      .set('content-type', 'application/json')
      .send('{"event":"test"}');

    expect(res.status).toBe(400);
    expect(starkBank.createTransfer).not.toHaveBeenCalled();
  });

  it('retorna 5xx (nunca 400) quando a verificacao falha por erro de infraestrutura, nao por assinatura invalida', async () => {
    const starkBank = new MockStarkBankRepository();
    // Erro generico (ex: timeout de rede buscando a chave publica da Stark
    // Bank) - nao e InvalidWebhookSignatureError, entao nao pode responder
    // 400 (a Stark Bank trataria como permanente e nunca retentaria,
    // perdendo o webhook silenciosamente).
    starkBank.parseWebhookEvent.mockRejectedValue(new Error('ETIMEDOUT fetching public key'));

    const app = await buildTestApp(starkBank);
    const res = await supertest(app.server)
      .post('/webhook')
      .set('digital-signature', 'some-sig')
      .set('content-type', 'application/json')
      .send('{"event":"test"}');

    expect(res.status).toBeGreaterThanOrEqual(500);
    expect(starkBank.createTransfer).not.toHaveBeenCalled();
  });

  it('retorna 400 quando o header digital-signature esta ausente', async () => {
    const starkBank = new MockStarkBankRepository();
    const app = await buildTestApp(starkBank);
    const res = await supertest(app.server)
      .post('/webhook')
      .set('content-type', 'application/json')
      .send('{"event":"test"}');

    expect(res.status).toBe(400);
    expect(starkBank.parseWebhookEvent).not.toHaveBeenCalled();
  });

  it('nunca retorna 500 para assinatura genuinamente invalida (nao deve causar retry infinito da Stark Bank)', async () => {
    const starkBank = new MockStarkBankRepository();
    starkBank.parseWebhookEvent.mockRejectedValue(new InvalidWebhookSignatureError('boom'));
    const app = await buildTestApp(starkBank);
    const res = await supertest(app.server)
      .post('/webhook')
      .set('digital-signature', 'bad')
      .set('content-type', 'application/json')
      .send('{}');

    expect(res.status).not.toBe(500);
    expect(res.status).toBe(400);
  });

  it('GET /health retorna 200', async () => {
    const app = await buildTestApp(new MockStarkBankRepository());
    const res = await supertest(app.server).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('rotas fora do escopo /webhook continuam parseando JSON normalmente', async () => {
    const app = await buildTestApp(new MockStarkBankRepository());
    const res = await supertest(app.server)
      .post('/internal/schedule')
      .set('content-type', 'application/json')
      .send({});
    // Sem auth -> 401, mas o body deve ter sido parseado como JSON (nao 400 de parse)
    expect(res.status).toBe(401);
  });
});
