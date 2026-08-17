export interface CreateInvoiceParams {
  amount: number; // centavos
  name: string;
  taxId: string; // CPF formatado
}

export interface CreatedInvoice {
  id: string;
  amount: number;
  name: string;
  taxId: string;
}

export interface CreateTransferParams {
  amount: number; // centavos (netAmount)
  bankCode: string;
  branchCode: string;
  accountNumber: string;
  accountType: string;
  taxId: string;
  name: string;
  externalId: string; // "invoice-{invoiceId}"
}

export interface CreatedTransfer {
  id: string;
  amount: number;
  externalId: string;
}

export interface ParsedWebhookEvent {
  id: string; // event.id (usado para idempotencia)
  subscriptionType: string; // ex: "invoice"
  // Tipo do log que disparou o evento (event.log.type na Stark Bank), ex: "created" | "paid" | "credited".
  // NAO confundir com invoice.status: o pagamento efetivo (dinheiro repassado) e sinalizado
  // por logType === 'credited', nao por um valor de invoice.status (que nunca assume "credited").
  logType?: string;
  invoice?: {
    id: string;
    amount: number;
    fee: number;
    status: string; // ex: "paid", "overdue", "canceled" (nunca "credited" - ver logType acima)
  };
}

export interface StarkBankRepository {
  /**
   * Confirma que o webhook realmente veio da Stark Bank antes de confiarmos
   * em qualquer dado dele. O body precisa chegar como string crua (nao
   * JSON.parse'ado) porque a assinatura ECDSA e calculada sobre os bytes
   * exatos que a Stark Bank enviou - reserializar o JSON poderia mudar
   * espacamento/ordem de chaves e invalidar a verificacao. Rejeita
   * lancando erro, para que o caller nunca trate um payload nao verificado
   * como um evento legitimo.
   *
   * IMPORTANTE - dois tipos de erro distintos:
   * - Assinatura genuinamente invalida -> lanca InvalidWebhookSignatureError
   *   (ver src/domain/errors). O caller deve responder HTTP 400 (permanente,
   *   a Stark Bank nao retenta).
   * - Qualquer outro erro (rede/timeout ao buscar a chave publica, corpo
   *   malformado) -> propaga o erro original, sem envolver em
   *   InvalidWebhookSignatureError. O caller deve responder 5xx para que a
   *   Stark Bank retente, em vez de perder o webhook silenciosamente.
   *
   * @param rawBody   - body da requisicao como string pura (nao parsed)
   * @param signature - valor do header "digital-signature"
   */
  parseWebhookEvent(rawBody: string, signature: string): Promise<ParsedWebhookEvent>;

  /**
   * Cria uma invoice na Stark Bank. A emissao de invoice tolera mais
   * tentativas com espera maior entre elas porque nao ha janela de tempo
   * critica (o scheduler roda em background) e falhar significa perder
   * uma invoice do ciclo, nao travar um pagamento.
   */
  createInvoice(params: CreateInvoiceParams): Promise<CreatedInvoice>;

  /**
   * Cria um transfer na Stark Bank. Usa menos tentativas e espera menor que
   * createInvoice porque esta chamada acontece no caminho do webhook, onde
   * queremos falhar rapido e deixar a reconciliacao (que ja tem sua propria
   * logica de retry via Firestore) assumir o trabalho, em vez de segurar a
   * requisicao por muito tempo.
   */
  createTransfer(params: CreateTransferParams): Promise<CreatedTransfer>;

  /**
   * Busca um transfer ja existente pelo externalId. A Stark Bank rejeita
   * createTransfer com um externalId repetido ("Duplicated externalIds will
   * cause failures"), e essa rejeicao e indistinguivel, do ponto de vista do
   * caller, de uma janela de crash em que o transfer foi criado com sucesso
   * mas o processo caiu antes de persistir isso no Firestore. Em ambos os
   * casos o transfer ja existe - este metodo e o unico jeito de descobrir
   * isso e recuperar em vez de marcar um transfer bem-sucedido como falho.
   *
   * taxId bounda a busca ao destino fixo desta aplicacao (necessario porque
   * a API nao filtra transfers por externalId diretamente).
   *
   * @returns o transfer encontrado, ou null se nenhum existir para esse externalId.
   */
  findTransferByExternalId(externalId: string, taxId: string): Promise<CreatedTransfer | null>;
}
