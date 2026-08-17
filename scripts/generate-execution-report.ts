/**
 * scripts/generate-execution-report.ts
 *
 * Gera o relatorio final de evidencia do ciclo de 24h/8-execucoes exigido
 * pelo desafio, consultando SOMENTE a API da Stark Bank (invoice.query,
 * invoice.log.query com type=credited, transfer.query filtrado pela conta
 * destino) - nao le nada do Firestore. A ideia e que o relatorio seja
 * verificavel de forma independente de qualquer log/estado interno nosso:
 * quem tem acesso Admin ao mesmo Sandbox pode reproduzir os mesmos numeros
 * direto no dashboard da Stark Bank ou rodando este script.
 *
 * Uso:
 *   npx tsx --env-file=.env scripts/generate-execution-report.ts
 *
 * Variaveis de ambiente necessarias (mesmas do runtime):
 *   STARKBANK_PROJECT_ID, STARKBANK_ENVIRONMENT, STARKBANK_PRIVATE_KEY ou STARKBANK_PRIVATE_KEY_PATH
 *
 * Saida: RELATORIO_EXECUCAO.md na raiz do projeto.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import * as starkbank from 'starkbank';

const TARGET = JSON.parse(readFileSync('seed/transfer-target.json', 'utf8')) as { taxId: string };

/**
 * Inicio da execucao oficial de 24h/8-ciclos que conta para o desafio.
 * O Sandbox foi usado em sessoes de desenvolvimento/teste anteriores (dev
 * local, smoke tests pontuais) - essas invoices continuam existindo na
 * Stark Bank mesmo apos recriar toda a infra GCP do zero, porque o
 * Sandbox e um sistema externo, nao afetado pelo nosso teardown/Firestore.
 * REPORT_WINDOW_START marca o primeiro ciclo do deploy final e limpo
 * (o smoke test manual logo apos o ultimo `03-firestore-provision.sh`),
 * para o relatorio nao misturar dado historico de dev com a execucao que
 * de fato conta como entrega. Ajuste via env var se precisar regenerar
 * o relatorio com outro corte.
 */
const REPORT_WINDOW_START = new Date(process.env.REPORT_WINDOW_START ?? '2026-08-17T01:57:00Z');

// Duas invoices sao consideradas do mesmo ciclo se foram criadas com menos
// de 30min de diferenca uma da outra. Ciclos reais ficam ~3h (180min)
// separados e cada lote de 8-12 invoices e criado em segundos - 30min da
// folga enorme sem risco de juntar dois ciclos ou quebrar um em dois.
const CYCLE_GAP_THRESHOLD_MS = 30 * 60 * 1000;

function toDate(v: string | Date): Date {
  return v instanceof Date ? v : new Date(v);
}

function fmt(d: Date): string {
  const utc = d.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  const sp = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).format(d);
  return `${sp} (America/Sao_Paulo) — ${utc}`;
}

function centavosToReais(centavos: number): string {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

interface InvoiceRow {
  id: string;
  name: string;
  amount: number;
  fee: number;
  createdAt: Date;
  creditedAt?: Date;
  transferId?: string;
  transferAmount?: number;
  transferCreatedAt?: Date;
}

async function main() {
  const projectId = process.env.STARKBANK_PROJECT_ID;
  if (!projectId) throw new Error('STARKBANK_PROJECT_ID nao definido');
  const environment = (process.env.STARKBANK_ENVIRONMENT ?? 'sandbox') as 'sandbox' | 'production';
  const privateKey =
    process.env.STARKBANK_PRIVATE_KEY ?? readFileSync(process.env.STARKBANK_PRIVATE_KEY_PATH ?? 'privateKey.pem', 'utf8');
  starkbank.setUser(new starkbank.Project({ environment, id: projectId, privateKey }));

  // NAO usamos o filtro `after` da propria API aqui: ele opera em dia de
  // calendario America/Sao_Paulo (nao UTC nem "ultimas N horas"), o que
  // silenciosamente excluiria invoices criadas ja depois de
  // REPORT_WINDOW_START mas ainda dentro do mesmo dia-calendario anterior
  // em SP (confirmado na pratica: um corte as 01:57 UTC == 22:57 SP do dia
  // anterior excluiu o proprio ciclo que deveria ser o primeiro incluido).
  // Mais simples e correto: busca tudo e filtra no cliente por instante
  // exato, sem depender da semantica de fuso do filtro de data da API.
  console.log(`Consultando invoices (filtro local a partir de ${REPORT_WINDOW_START.toISOString()})...`);
  const invoices: InvoiceRow[] = [];
  for await (const inv of await starkbank.invoice.query({})) {
    const createdAt = toDate(inv.created);
    if (createdAt < REPORT_WINDOW_START) continue;
    invoices.push({ id: inv.id, name: inv.name, amount: inv.amount, fee: inv.fee ?? 0, createdAt });
  }
  invoices.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  console.log('Consultando logs credited...');
  const creditedByInvoiceId = new Map<string, Date>();
  for await (const log of await starkbank.invoice.log.query({ types: ['credited'] })) {
    if (toDate(log.created) < REPORT_WINDOW_START) continue;
    creditedByInvoiceId.set(log.invoice.id, toDate(log.created));
  }

  console.log('Consultando transfers para a conta destino...');
  const transferByInvoiceId = new Map<string, { id: string; amount: number; created: Date }>();
  for await (const tr of await starkbank.transfer.query({ taxId: TARGET.taxId })) {
    if (!tr.externalId?.startsWith('invoice-')) continue;
    const created = toDate(tr.created);
    if (created < REPORT_WINDOW_START) continue;
    const invoiceId = tr.externalId.slice('invoice-'.length);
    transferByInvoiceId.set(invoiceId, { id: tr.id, amount: tr.amount, created });
  }

  // Preenche credited/transfer em cada invoice
  for (const row of invoices) {
    row.creditedAt = creditedByInvoiceId.get(row.id);
    const tr = transferByInvoiceId.get(row.id);
    if (tr) {
      row.transferId = tr.id;
      row.transferAmount = tr.amount;
      row.transferCreatedAt = tr.created;
    }
  }

  // Agrupa em ciclos por gap de criacao
  const cycles: InvoiceRow[][] = [];
  for (const row of invoices) {
    const last = cycles[cycles.length - 1];
    if (last && row.createdAt.getTime() - last[last.length - 1].createdAt.getTime() < CYCLE_GAP_THRESHOLD_MS) {
      last.push(row);
    } else {
      cycles.push([row]);
    }
  }

  const totalCredited = invoices.filter((r) => r.creditedAt).length;
  const totalTransferred = invoices.filter((r) => r.transferId).length;
  const totalTransferredAmount = invoices.reduce((acc, r) => acc + (r.transferAmount ?? 0), 0);

  const lines: string[] = [];
  lines.push('# Relatório de Execução — Ciclo de 24h / 8 execuções');
  lines.push('');
  lines.push(`**Gerado em:** ${fmt(new Date())}`);
  lines.push('');
  lines.push(
    '**Fonte de dados:** exclusivamente a API da Stark Bank (`invoice.query`, `invoice.log.query` com `type=credited`, `transfer.query` filtrado pela conta destino) — nenhum dado vem do Firestore ou de logs internos da aplicação. Reproduzível por qualquer pessoa com acesso Admin a este Sandbox, rodando `npx tsx --env-file=.env scripts/generate-execution-report.ts` ou consultando o próprio dashboard da Stark Bank.',
  );
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## Resumo');
  lines.push('');
  lines.push(
    `- **Janela considerada:** a partir de ${fmt(REPORT_WINDOW_START)} (início do deploy final e limpo desta submissão). Este Sandbox foi usado em sessões de desenvolvimento anteriores, cujas invoices/transfers permanecem na Stark Bank mesmo após recriar a infra GCP do zero (Firestore não afeta o Sandbox) — excluídas deste relatório por não fazerem parte da execução que conta como entrega.`,
  );
  lines.push('');
  lines.push(`- **Ciclos detectados:** ${cycles.length}`);
  lines.push(`- **Invoices emitidas no total:** ${invoices.length}`);
  lines.push(`- **Invoices creditadas (pagas e repassadas):** ${totalCredited}`);
  lines.push(`- **Transfers confirmados para a conta destino:** ${totalTransferred}`);
  lines.push(`- **Valor total transferido:** ${centavosToReais(totalTransferredAmount)}`);
  lines.push(`- **Invoices ainda não pagas pelo sandbox:** ${invoices.length - totalCredited}`);
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## Ciclos');
  lines.push('');

  cycles.forEach((cycle, i) => {
    const start = cycle[0].createdAt;
    lines.push(`### Ciclo ${i + 1} — ${fmt(start)} — ${cycle.length} invoices`);
    lines.push('');
    lines.push('| Invoice ID | Nome | Valor | Status | Creditada em | Transfer ID | Valor líquido |');
    lines.push('|---|---|---|---|---|---|---|');
    cycle.forEach((row) => {
      const status = row.transferId ? 'transferido' : row.creditedAt ? 'creditado' : 'aguardando pagamento';
      const creditedAt = row.creditedAt ? fmt(row.creditedAt) : '—';
      const transferId = row.transferId ?? '—';
      const netAmount = row.transferAmount != null ? centavosToReais(row.transferAmount) : '—';
      lines.push(
        `| \`${row.id}\` | ${row.name} | ${centavosToReais(row.amount)} | ${status} | ${creditedAt} | \`${transferId}\` | ${netAmount} |`,
      );
    });
    lines.push('');
  });

  lines.push('---');
  lines.push('');
  lines.push('## Observações');
  lines.push('');
  lines.push(
    '- O intervalo entre o Ciclo 1 e o Ciclo 2 pode ser menor que 3h se o Ciclo 1 foi disparado manualmente (smoke test pós-deploy) em vez de pelo cron do Cloud Scheduler — os ciclos seguintes, disparados 100% pelo cron (`0 */3 * * *`, `America/Sao_Paulo`), respeitam exatamente 180 minutos entre si.',
  );
  lines.push(
    '- "Creditada" (log `credited` da invoice) é o sinal correto de repasse de fundos — `invoice.status` nunca assume o valor `"credited"` (ver seção de bônus no README).',
  );
  lines.push(
    '- Uma invoice sem transfer correspondente apesar de creditada indicaria falha real; não deve ocorrer dado o design de idempotência com recuperação (ver `REVIEW_CORRECAO_FINANCEIRA.md` no histórico do projeto).',
  );
  lines.push('');

  const output = lines.join('\n');
  writeFileSync('RELATORIO_EXECUCAO.md', output, 'utf8');
  console.log(`\nRelatório gerado: RELATORIO_EXECUCAO.md (${cycles.length} ciclos, ${invoices.length} invoices, ${totalTransferred} transfers)`);
}

main().catch((err) => {
  console.error('Falha ao gerar relatório:', err);
  process.exit(1);
});
