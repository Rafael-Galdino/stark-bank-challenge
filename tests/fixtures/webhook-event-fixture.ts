import { WebhookEvent } from '../../src/domain/entities/webhook-event-entity';
import { ParsedWebhookEvent } from '../../src/domain/repositories/stark-bank-repository';

export function makeWebhookEvent(overrides: Partial<WebhookEvent> = {}): WebhookEvent {
  const now = new Date();
  return {
    eventId: 'evt-fixture-1',
    status: 'processing',
    invoiceId: 'inv-fixture-1',
    amount: 10000,
    fee: 50,
    netAmount: 9950,
    attempts: 1,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function makeParsedWebhookEvent(overrides: Partial<ParsedWebhookEvent> = {}): ParsedWebhookEvent {
  return {
    id: 'evt-fixture-1',
    subscriptionType: 'invoice',
    logType: 'credited',
    invoice: {
      id: 'inv-fixture-1',
      amount: 10000,
      fee: 50,
      status: 'paid',
    },
    ...overrides,
  };
}
