#!/bin/bash
set -e
PROJECT_ID=${GCP_PROJECT_ID:?'GCP_PROJECT_ID nao definido - defina antes de rodar este script (ex: export GCP_PROJECT_ID=seu-projeto-gcp)'}
REGION=${REGION:-southamerica-east1}
IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/stark-bank-repo/stark-bank-api:latest"

# Build e push da imagem
# --platform=linux/amd64 e obrigatorio: Cloud Run so executa amd64, e o
# `docker build` builda para a arquitetura do host por padrao. Sem essa
# flag, buildar em Mac Apple Silicon (arm64) gera uma imagem que falha no
# Cloud Run com "exec format error" (o binario nao roda na arquitetura do
# runtime, mesmo com o build/push tendo sucesso).
docker build --platform=linux/amd64 -t "$IMAGE" .
docker push "$IMAGE"

# Deploy no Cloud Run
#
# NOTA DE SEGURANCA: o servico e implantado com --allow-unauthenticated
# (ingress publico) porque o Cloud Run so permite IAM auth (OIDC do Google)
# em nivel de SERVICO INTEIRO, nao por rota. O endpoint POST /webhook e
# chamado pela Stark Bank, que nao envia tokens OIDC do Google - ela envia
# um header "digital-signature" (ECDSA) proprio. Se o servico fosse
# implantado com --no-allow-unauthenticated, a Stark Bank jamais
# conseguiria alcancar /webhook (o IAM do Cloud Run rejeitaria a requisicao
# com 403 antes mesmo dela chegar ao codigo da aplicacao).
#
# A autenticacao e portanto feita em nivel de aplicacao, por rota:
#   - POST /webhook            -> validacao de assinatura ECDSA (SDK Stark Bank)
#   - POST /internal/schedule  -> validacao de token OIDC Bearer do Google (Cloud Scheduler)
#   - POST /internal/reconcile -> validacao de token OIDC Bearer do Google (Cloud Scheduler)
# Ver src/infrastructure/auth/google-oidc-verifier.ts e
# src/presentation/controllers/webhook-controller.ts.
gcloud run deploy stark-bank-api \
  --image="$IMAGE" \
  --platform=managed \
  --region="$REGION" \
  --service-account="stark-bank-run@${PROJECT_ID}.iam.gserviceaccount.com" \
  --min-instances=1 \
  --max-instances=10 \
  --timeout=60s \
  --set-env-vars="GCP_PROJECT_ID=${PROJECT_ID},STARKBANK_ENVIRONMENT=sandbox" \
  --set-secrets="STARKBANK_PRIVATE_KEY=starkbank-private-key:latest,STARKBANK_PROJECT_ID=starkbank-project-id:latest" \
  --allow-unauthenticated \
  --project="$PROJECT_ID"

echo "Deploy concluido. URL do servico:"
gcloud run services describe stark-bank-api \
  --region="$REGION" \
  --format='value(status.url)' \
  --project="$PROJECT_ID"
