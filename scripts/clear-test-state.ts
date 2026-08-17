/**
 * scripts/clear-test-state.ts
 *
 * Reseta o estado do desafio no Firestore para permitir uma nova execucao
 * limpa do teste de 24h (scheduler + webhook + reconciliation), sem afetar
 * a configuracao fixa da conta destino (starkbank_challenge_config/transfer_target).
 *
 * Remove:
 *   - starkbank_challenge_config/execution    (forca um novo startedAt/deadlineAt)
 *   - todos os documentos em scheduler_executions
 *   - todos os documentos em webhook_events
 *
 * NAO remove:
 *   - starkbank_challenge_config/transfer_target (dados fixos da conta destino)
 *
 * Uso:
 *   GCP_PROJECT_ID=meu-projeto npx tsx scripts/clear-test-state.ts --confirm
 *
 * A flag --confirm e obrigatoria como salvaguarda contra execucao acidental,
 * ja que esta operacao e destrutiva e irreversivel.
 */
import { Firestore } from '@google-cloud/firestore';

async function deleteCollection(db: Firestore, collectionName: string): Promise<number> {
  const snap = await db.collection(collectionName).get();
  if (snap.empty) return 0;

  const batch = db.batch();
  snap.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
  return snap.size;
}

async function main() {
  if (!process.argv.includes('--confirm')) {
    console.error('Operacao destrutiva. Execute novamente com a flag --confirm para prosseguir.');
    process.exit(1);
  }

  const projectId = process.env.GCP_PROJECT_ID;
  if (!projectId) {
    throw new Error(
      'GCP_PROJECT_ID nao definido - defina antes de rodar este script (ex: export GCP_PROJECT_ID=seu-projeto-gcp)',
    );
  }

  const db = new Firestore({ projectId });

  const [webhookEventsDeleted, schedulerExecutionsDeleted] = await Promise.all([
    deleteCollection(db, 'webhook_events'),
    deleteCollection(db, 'scheduler_executions'),
  ]);

  await db.collection('starkbank_challenge_config').doc('execution').delete();

  console.log('Estado do smoke test resetado com sucesso:', {
    webhookEventsDeleted,
    schedulerExecutionsDeleted,
    executionConfigDeleted: true,
  });
  console.log('starkbank_challenge_config/transfer_target foi preservado.');
}

main().catch((err) => {
  console.error('Falha ao resetar o estado:', err);
  process.exit(1);
});
