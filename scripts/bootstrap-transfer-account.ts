/**
 * scripts/bootstrap-transfer-account.ts
 *
 * Popula o documento starkbank_challenge_config/transfer_target no Firestore com os
 * dados fixos da conta destino do transfer (ver seed/transfer-target.json
 * e SPEC_NODE.md secao 1.2).
 *
 * Uso:
 *   GCP_PROJECT_ID=meu-projeto npx tsx scripts/bootstrap-transfer-account.ts
 *
 * Executado manualmente pelo desenvolvedor via scripts/gcp/03b-firestore-seed.sh
 * apos a criacao do banco Firestore (scripts/gcp/03-firestore-provision.sh).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Firestore } from '@google-cloud/firestore';

const TARGET = JSON.parse(readFileSync(join(__dirname, '../seed/transfer-target.json'), 'utf8'));

async function seed() {
  const projectId = process.env.GCP_PROJECT_ID;
  if (!projectId) {
    throw new Error(
      'GCP_PROJECT_ID nao definido - defina antes de rodar este script (ex: export GCP_PROJECT_ID=seu-projeto-gcp)',
    );
  }

  const db = new Firestore({ projectId });
  await db.collection('starkbank_challenge_config').doc('transfer_target').set(TARGET);
  console.log('transfer_target populado com sucesso:', TARGET);
}

seed().catch((err) => {
  console.error('Falha ao popular transfer_target:', err);
  process.exit(1);
});
