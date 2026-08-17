#!/bin/bash
#
# scripts/gcp/99-teardown.sh
#
# Desfaz o que os scripts 01-07 provisionaram: Cloud Run, Cloud Scheduler
# jobs, Artifact Registry, Secret Manager secrets, Firestore database e as
# service accounts de runtime (stark-bank-run, stark-bank-scheduler).
#
# NAO apaga (de proposito):
#   - Workload Identity Pool/Provider e a SA stark-bank-deploy (08) - pool
#     WIF tem soft-delete de 30 dias com o MESMO ID, entao deletar e recriar
#     quebraria o deploy automatico do GitHub Actions por ate 30 dias. Fica
#     de fora do teardown porque nao custa nada parado.
#   - assinatura de webhook no lado da Stark Bank (nao e recurso GCP - se
#     recriar o Cloud Run, a URL muda e precisa rodar 06a-webhook-subscribe.sh
#     de novo apontando pra nova URL).
#
# Operacao destrutiva e em boa parte IRREVERSIVEL (Firestore database
# deletado perde todos os dados; SAs deletadas tambem ficam em soft-delete
# por 30 dias com o mesmo email, entao 02-iam-accounts-setup.sh so recria
# stark-bank-run/stark-bank-scheduler sem erro depois desse periodo, ou via
# `iam service-accounts undelete`).
#
# Uso:
#   GCP_PROJECT_ID=seu-projeto ./scripts/gcp/99-teardown.sh --confirm
set -e

PROJECT_ID=${GCP_PROJECT_ID:?'GCP_PROJECT_ID nao definido - defina antes de rodar este script (ex: export GCP_PROJECT_ID=seu-projeto-gcp)'}
REGION=${REGION:-southamerica-east1}

if [[ "$1" != "--confirm" ]]; then
  echo "Operacao destrutiva. Execute novamente com a flag --confirm para prosseguir."
  echo "Isso vai apagar Cloud Run, Scheduler jobs, Artifact Registry, Secrets, Firestore e as SAs de runtime do projeto ${PROJECT_ID}."
  exit 1
fi

echo "== Cloud Scheduler jobs =="
gcloud scheduler jobs delete invoice-batch --location="$REGION" --project="$PROJECT_ID" --quiet || true
gcloud scheduler jobs delete reconciliation --location="$REGION" --project="$PROJECT_ID" --quiet || true

echo "== Cloud Run =="
gcloud run services delete stark-bank-api --region="$REGION" --project="$PROJECT_ID" --quiet || true

echo "== Artifact Registry =="
gcloud artifacts repositories delete stark-bank-repo --location="$REGION" --project="$PROJECT_ID" --quiet || true

echo "== Secret Manager =="
gcloud secrets delete starkbank-private-key --project="$PROJECT_ID" --quiet || true
gcloud secrets delete starkbank-project-id --project="$PROJECT_ID" --quiet || true

echo "== Firestore database =="
# Apaga TODOS os dados permanentemente (webhook_events, scheduler_executions,
# starkbank_challenge_config, etc). Sem volta - nao e so limpar documentos
# como o clear-test-state.ts, e o database inteiro.
gcloud firestore databases delete --database='(default)' --project="$PROJECT_ID" --quiet || true

echo "== Service accounts de runtime =="
# stark-bank-deploy e o WIF pool/provider (08) ficam intactos, de proposito.
gcloud iam service-accounts delete "stark-bank-run@${PROJECT_ID}.iam.gserviceaccount.com" --project="$PROJECT_ID" --quiet || true
gcloud iam service-accounts delete "stark-bank-scheduler@${PROJECT_ID}.iam.gserviceaccount.com" --project="$PROJECT_ID" --quiet || true

echo
echo "Teardown concluido. Bindings de IAM a nivel de projeto que referenciavam"
echo "as SAs deletadas ficam orfaos na policy (inofensivo, o GCP ignora) - se"
echo "quiser a policy 100% limpa, rode 'gcloud projects get-iam-policy ${PROJECT_ID}'"
echo "e remova manualmente as entradas remanescentes."
echo
echo "Pra reprovisionar: rode 01 a 07 na ordem (07 e 06a precisam da nova URL"
echo "do Cloud Run, que so existe depois do 06). 08 nao precisa rodar de novo -"
echo "WIF pool/provider e stark-bank-deploy continuam validos."
