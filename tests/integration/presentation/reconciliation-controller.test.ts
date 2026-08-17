import { describe, it, expect } from 'vitest';
import supertest from 'supertest';
import { MockStarkBankRepository } from '../../mocks/mock-stark-bank-repository';
import { InMemoryEventStore } from '../../mocks/in-memory-event-store-repository';
import { buildTestApp, TEST_TOKEN } from './build-test-app';

describe('POST /internal/reconcile', () => {
  it('retorna 401 sem token', async () => {
    const app = await buildTestApp(new MockStarkBankRepository());
    const res = await supertest(app.server).post('/internal/reconcile');
    expect(res.status).toBe(401);
  });

  it('retorna 200 com token valido e retenta eventos failed', async () => {
    const starkBank = new MockStarkBankRepository();
    starkBank.createTransfer.mockResolvedValue({ id: 'tr-1', amount: 990, externalId: 'invoice-inv-f' });
    const eventStore = new InMemoryEventStore();
    await eventStore.claimWebhookEvent({ eventId: 'evt-f', invoiceId: 'inv-f', amount: 1000, fee: 10, netAmount: 990 });
    await eventStore.failWebhookEvent('evt-f', 'timeout');

    const app = await buildTestApp(starkBank, eventStore);
    const res = await supertest(app.server)
      .post('/internal/reconcile')
      .set('Authorization', `Bearer ${TEST_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ retried: 1, completed: 1, failed: 0 });
  });

  it('retorna contadores zerados quando nao ha eventos elegiveis', async () => {
    const app = await buildTestApp(new MockStarkBankRepository());
    const res = await supertest(app.server)
      .post('/internal/reconcile')
      .set('Authorization', `Bearer ${TEST_TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ retried: 0, completed: 0, failed: 0 });
  });
});
