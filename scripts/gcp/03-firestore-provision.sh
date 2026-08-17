#!/bin/bash
set -e
PROJECT_ID=${GCP_PROJECT_ID:?'GCP_PROJECT_ID nao definido - defina antes de rodar este script (ex: export GCP_PROJECT_ID=seu-projeto-gcp)'}
gcloud firestore databases create \
  --location=southamerica-east1 \
  --project="$PROJECT_ID"
echo "Firestore criado com sucesso."

# findReconciliableEvents (firestore-event-store-repository.ts) faz
# where('status','==','processing').where('updatedAt','<',...) - Firestore
# exige indice composto explicito pra query com igualdade + desigualdade em
# campos diferentes. Sem isso, /internal/reconcile (chamado a cada 15min
# pelo Cloud Scheduler) falha com FAILED_PRECONDITION em toda execucao ate
# alguem criar o indice manualmente. Criando aqui pra nao depender de
# ninguem lembrar disso depois de um teardown/reprovisionamento.
gcloud firestore indexes composite create \
  --collection-group=webhook_events \
  --field-config=field-path=status,order=ascending \
  --field-config=field-path=updatedAt,order=ascending \
  --project="$PROJECT_ID"
echo "Indice composto de webhook_events criado com sucesso (pode levar alguns minutos para ficar pronto para uso)."
