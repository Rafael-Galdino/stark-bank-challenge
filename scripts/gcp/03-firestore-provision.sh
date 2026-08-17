#!/bin/bash
set -e
PROJECT_ID=${GCP_PROJECT_ID:?'GCP_PROJECT_ID nao definido - defina antes de rodar este script (ex: export GCP_PROJECT_ID=seu-projeto-gcp)'}
gcloud firestore databases create \
  --location=southamerica-east1 \
  --project="$PROJECT_ID"
echo "Firestore criado com sucesso."
