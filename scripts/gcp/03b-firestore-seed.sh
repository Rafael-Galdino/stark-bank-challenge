#!/bin/bash
set -e
PROJECT_ID=${GCP_PROJECT_ID:?'GCP_PROJECT_ID nao definido - defina antes de rodar este script (ex: export GCP_PROJECT_ID=seu-projeto-gcp)'}
export GCP_PROJECT_ID="$PROJECT_ID"
# Usa a Firebase Admin SDK (Node.js) para seed
npx tsx scripts/bootstrap-transfer-account.ts
