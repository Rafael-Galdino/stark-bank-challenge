/**
 * scripts/webhook-subscribe.ts
 *
 * Registra (ou substitui) a subscricao de webhook na Stark Bank apontando
 * para o endpoint /webhook do servico implantado.
 *
 * Uso:
 *   npx tsx scripts/webhook-subscribe.ts --url https://meu-servico.run.app/webhook [--replace]
 *
 * Flags:
 *   --url       (obrigatorio) URL publica do endpoint /webhook
 *   --replace   (opcional) remove webhooks existentes com a mesma URL antes de criar um novo,
 *               evitando duplicidade de subscricoes apontando para o mesmo endpoint
 *
 * Variaveis de ambiente necessarias (mesmas do runtime):
 *   STARKBANK_PROJECT_ID, STARKBANK_ENVIRONMENT, STARKBANK_PRIVATE_KEY ou STARKBANK_PRIVATE_KEY_PATH
 *
 * Executado manualmente via scripts/gcp/06a-webhook-subscribe.sh apos o deploy no Cloud Run.
 */
import { readFileSync } from 'node:fs';
import * as starkbank from 'starkbank';

interface Args {
  url: string;
  replace: boolean;
}

function parseArgs(argv: string[]): Args {
  let url: string | undefined;
  let replace = false;

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--url') {
      url = argv[i + 1];
      i++;
    } else if (argv[i] === '--replace') {
      replace = true;
    }
  }

  if (!url) {
    throw new Error('Uso: webhook-subscribe.ts --url <https://.../webhook> [--replace]');
  }

  return { url, replace };
}

async function main() {
  const { url, replace } = parseArgs(process.argv.slice(2));

  const projectId = process.env.STARKBANK_PROJECT_ID;
  if (!projectId) throw new Error('STARKBANK_PROJECT_ID nao definido');

  const environment = (process.env.STARKBANK_ENVIRONMENT ?? 'sandbox') as 'sandbox' | 'production';
  const privateKey =
    process.env.STARKBANK_PRIVATE_KEY ?? readFileSync(process.env.STARKBANK_PRIVATE_KEY_PATH ?? 'privateKey.pem', 'utf8');

  const project = new starkbank.Project({ environment, id: projectId, privateKey });
  starkbank.setUser(project);

  if (replace) {
    // starkbank.webhook.query() e uma funcao async comum que retorna (dentro
    // de uma Promise) um async generator — nao uma Promise<array>. Precisa de
    // dois awaits: um para resolver a Promise externa, outro implicito no
    // for-await-of para consumir o generator. Sem o await externo, o
    // for-await-of recebe a Promise crua, que nao e iteravel.
    for await (const wh of await starkbank.webhook.query({})) {
      if (wh.url === url) {
        await starkbank.webhook.delete(wh.id);
        console.log(`Webhook existente removido: ${wh.id} (${wh.url})`);
      }
    }
  }

  const created = await starkbank.webhook.create({ url, subscriptions: ['invoice'] });
  console.log('Webhook registrado com sucesso:', { id: created.id, url: created.url, subscriptions: created.subscriptions });
}

main().catch((err) => {
  console.error('Falha ao registrar webhook:', err);
  process.exit(1);
});
