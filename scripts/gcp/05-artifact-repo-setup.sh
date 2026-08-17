#!/bin/bash
set -e
PROJECT_ID=${GCP_PROJECT_ID:?'GCP_PROJECT_ID nao definido - defina antes de rodar este script (ex: export GCP_PROJECT_ID=seu-projeto-gcp)'}
REGION=${REGION:-southamerica-east1}
gcloud artifacts repositories create stark-bank-repo \
  --repository-format=docker \
  --location="$REGION" \
  --project="$PROJECT_ID"
echo "Artifact Registry criado com sucesso."
