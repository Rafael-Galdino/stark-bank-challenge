export type WebhookEventStatus = 'received' | 'processing' | 'completed' | 'failed';

export interface WebhookEvent {
  eventId: string;
  status: WebhookEventStatus;
  invoiceId: string;
  amount: number; // centavos
  fee: number; // centavos
  netAmount: number; // centavos (amount - fee)
  transferId?: string; // preenchido apos transfer bem-sucedido
  attempts: number;
  lastError?: string;
  createdAt: Date;
  updatedAt: Date;
}
