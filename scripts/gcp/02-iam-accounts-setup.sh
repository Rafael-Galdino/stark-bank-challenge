#!/bin/bash
set -e
PROJECT_ID=${GCP_PROJECT_ID:?'GCP_PROJECT_ID nao definido - defina antes de rodar este script (ex: export GCP_PROJECT_ID=seu-projeto-gcp)'}

# Service account do Cloud Run
gcloud iam service-accounts create stark-bank-run \
  --display-name="Stark Bank Cloud Run SA" \
  --project="$PROJECT_ID"

# Permissoes: Firestore, Secret Manager
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:stark-bank-run@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/datastore.user"

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:stark-bank-run@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# Service account do Cloud Scheduler
gcloud iam service-accounts create stark-bank-scheduler \
  --display-name="Stark Bank Scheduler SA" \
  --project="$PROJECT_ID"

# Permissao para invocar Cloud Run
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:stark-bank-scheduler@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/run.invoker"

# Permissao para o Cloud Scheduler mintar tokens OIDC como stark-bank-scheduler.
#
# Sem isso, o job do Cloud Scheduler nunca chega a chamar o Cloud Run: o
# agente de servico do Cloud Scheduler (service-{PROJECT_NUMBER}@gcp-sa-cloudscheduler.iam.gserviceaccount.com)
# precisa de roles/iam.serviceAccountTokenCreator NA PROPRIA service account
# stark-bank-scheduler para poder gerar o token OIDC anexado a requisicao.
# O role/run.invoker acima nao cobre isso - ele so autoriza a service
# account a *invocar* o Cloud Run depois de ja ter um token; nao autoriza o
# Cloud Scheduler a *mintar* esse token em nome dela. Sem este binding, o
# job falha silenciosamente antes mesmo de gerar a requisicao HTTP (visivel
# como AttemptStarted sem AttemptFinished nos logs do Cloud Scheduler, e
# nenhuma requisicao chega ao Cloud Run).
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')
gcloud iam service-accounts add-iam-policy-binding \
  "stark-bank-scheduler@${PROJECT_ID}.iam.gserviceaccount.com" \
  --member="serviceAccount:service-${PROJECT_NUMBER}@gcp-sa-cloudscheduler.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountTokenCreator" \
  --project="$PROJECT_ID"

echo "Service accounts criadas com sucesso."
