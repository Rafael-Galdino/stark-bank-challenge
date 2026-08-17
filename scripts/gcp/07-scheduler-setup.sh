#!/bin/bash
set -e
PROJECT_ID=${GCP_PROJECT_ID:?'GCP_PROJECT_ID nao definido - defina antes de rodar este script (ex: export GCP_PROJECT_ID=seu-projeto-gcp)'}
REGION=${REGION:-southamerica-east1}
CLOUD_RUN_URL=${1:?'Informe a URL do Cloud Run como primeiro argumento'}
SCHEDULER_SA="stark-bank-scheduler@${PROJECT_ID}.iam.gserviceaccount.com"

# Job de invoice batch (a cada 3 horas)
gcloud scheduler jobs create http invoice-batch \
  --location="$REGION" \
  --schedule="0 */3 * * *" \
  --time-zone="America/Sao_Paulo" \
  --uri="${CLOUD_RUN_URL}/internal/schedule" \
  --http-method=POST \
  --oidc-service-account-email="$SCHEDULER_SA" \
  --oidc-token-audience="$CLOUD_RUN_URL" \
  --project="$PROJECT_ID"

# Job de reconciliacao (a cada 15 minutos)
gcloud scheduler jobs create http reconciliation \
  --location="$REGION" \
  --schedule="*/15 * * * *" \
  --time-zone="UTC" \
  --uri="${CLOUD_RUN_URL}/internal/reconcile" \
  --http-method=POST \
  --oidc-service-account-email="$SCHEDULER_SA" \
  --oidc-token-audience="$CLOUD_RUN_URL" \
  --project="$PROJECT_ID"

echo "Scheduler jobs criados com sucesso."
