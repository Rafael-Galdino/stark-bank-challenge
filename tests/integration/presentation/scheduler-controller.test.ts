import { describe, it, expect } from 'vitest';
import supertest from 'supertest';
import { MockStarkBankRepository } from '../../mocks/mock-stark-bank-repository';
import { buildTestApp, TEST_TOKEN } from './build-test-app';

describe('POST /internal/schedule', () => {
  it('retorna 401 sem token', async () => {
    const app = await buildTestApp(new MockStarkBankRepository());
    const res = await supertest(app.server).post('/internal/schedule');
    expect(res.status).toBe(401);
  });

  it('retorna 401 com token invalido', async () => {
    const app = await buildTestApp(new MockStarkBankRepository());
    const res = await supertest(app.server).post('/internal/schedule').set('Authorization', 'Bearer wrong-token');
    expect(res.status).toBe(401);
  });

  it('retorna 200 com token valido e executa o ciclo', async () => {
    const starkBank = new MockStarkBankRepository();
    starkBank.createInvoice.mockResolvedValue({ id: 'inv-x', amount: 5000, name: 'Test', taxId: '123' });
    const app = await buildTestApp(starkBank);
    const res = await supertest(app.server)
      .post('/internal/schedule')
      .set('Authorization', `Bearer ${TEST_TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.skipped).toBe(false);
    expect(res.body.invoiceCount).toBeGreaterThanOrEqual(8);
    expect(res.body.invoiceCount).toBeLessThanOrEqual(12);
  });

  it('segunda chamada no mesmo ciclo retorna skipped=true por duplicate_cycle', async () => {
    const starkBank = new MockStarkBankRepository();
    starkBank.createInvoice.mockResolvedValue({ id: 'inv-x', amount: 5000, name: 'Test', taxId: '123' });
    const app = await buildTestApp(starkBank);

    await supertest(app.server).post('/internal/schedule').set('Authorization', `Bearer ${TEST_TOKEN}`);
    const res = await supertest(app.server).post('/internal/schedule').set('Authorization', `Bearer ${TEST_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.skipped).toBe(true);
    expect(res.body.skipReason).toBe('duplicate_cycle');
  });
});
