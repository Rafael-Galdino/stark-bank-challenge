import { StarkBankRepository, CreatedInvoice } from '../../domain/repositories/stark-bank-repository';
import { generateInvoiceDraft } from '../../domain/value-objects/invoice-draft-vo';

export class InvoiceService {
  constructor(private readonly starkBank: StarkBankRepository) {}

  /**
   * Cria uma invoice com dados aleatorios.
   * O retry e tratado pelo StarkBankSdkRepository internamente.
   */
  async createRandomInvoice(): Promise<CreatedInvoice> {
    const draft = generateInvoiceDraft();
    return this.starkBank.createInvoice(draft);
  }
}
