#!/bin/bash
set -e
PROJECT_ID=${GCP_PROJECT_ID:?'GCP_PROJECT_ID nao definido - defina antes de rodar este script (ex: export GCP_PROJECT_ID=seu-projeto-gcp)'}
PEM_FILE=${1:-privateKey.pem}
STARKBANK_ID=${2:?'Informe o STARKBANK_PROJECT_ID como segundo argumento'}

# Secret: chave privada ECDSA
gcloud secrets create starkbank-private-key \
  --data-file="$PEM_FILE" \
  --project="$PROJECT_ID"

# Secret: project ID Stark Bank
echo -n "$STARKBANK_ID" | gcloud secrets create starkbank-project-id \
  --data-file=- \
  --project="$PROJECT_ID"

echo "Secrets criados com sucesso."
