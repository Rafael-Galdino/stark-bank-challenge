#!/bin/bash
set -e
PROJECT_ID=${GCP_PROJECT_ID:?'GCP_PROJECT_ID nao definido - defina antes de rodar este script (ex: export GCP_PROJECT_ID=seu-projeto-gcp)'}
REPO=${1:?'Informe o repo GitHub no formato owner/repo (ex: Rafael-Galdino/stark-bank-challenge)'}
POOL_ID="github-pool"
PROVIDER_ID="github-provider"
DEPLOY_SA="stark-bank-deploy"

gcloud services enable iamcredentials.googleapis.com sts.googleapis.com \
  --project="$PROJECT_ID"

PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')

# Service account que o GitHub Actions vai impersonar (sem chave estatica -
# a troca de identidade acontece via OIDC token do job, nunca um JSON key
# baixado). Permissoes minimas pra buildar/publicar imagem e fazer deploy.
gcloud iam service-accounts create "$DEPLOY_SA" \
  --display-name="GitHub Actions Deploy SA" \
  --project="$PROJECT_ID"

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${DEPLOY_SA}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.writer"

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${DEPLOY_SA}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/run.admin"

# Precisa poder "vestir" a SA de runtime (stark-bank-run) pra fazer o
# `gcloud run deploy --service-account=stark-bank-run@...` - sem isso o
# deploy falha com "iam.serviceaccounts.actAs" negado. Escopo na SA
# especifica, nao no projeto inteiro.
gcloud iam service-accounts add-iam-policy-binding \
  "stark-bank-run@${PROJECT_ID}.iam.gserviceaccount.com" \
  --member="serviceAccount:${DEPLOY_SA}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser" \
  --project="$PROJECT_ID"

# Pool + provider OIDC que confia nos tokens que o GitHub Actions emite
# pra cada job (token.actions.githubusercontent.com). Nao existe chave de
# longa duracao envolvida - o STS troca o token do job por credenciais
# de curta duracao no momento do `google-github-actions/auth`.
gcloud iam workload-identity-pools create "$POOL_ID" \
  --location="global" \
  --display-name="GitHub Actions Pool" \
  --project="$PROJECT_ID"

gcloud iam workload-identity-pools providers create-oidc "$PROVIDER_ID" \
  --location="global" \
  --workload-identity-pool="$POOL_ID" \
  --display-name="GitHub Actions Provider" \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
  --attribute-condition="assertion.repository == '${REPO}'" \
  --project="$PROJECT_ID"

# So workflows RODANDO NESSE REPO especifico (attribute-condition acima
# ja filtra, este binding e a segunda camada) podem se passar pela SA de
# deploy - nenhum outro repo/fork consegue mintar token pra ela.
gcloud iam service-accounts add-iam-policy-binding \
  "${DEPLOY_SA}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_ID}/attribute.repository/${REPO}" \
  --project="$PROJECT_ID"

echo "WIF configurado com sucesso."
echo
echo "GCP_DEPLOY_SA_EMAIL:"
echo "  ${DEPLOY_SA}@${PROJECT_ID}.iam.gserviceaccount.com"
echo
echo "GCP_WORKLOAD_IDENTITY_PROVIDER:"
echo "  projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_ID}/providers/${PROVIDER_ID}"
echo
echo "Cole os dois valores acima como secrets no repo GitHub."
