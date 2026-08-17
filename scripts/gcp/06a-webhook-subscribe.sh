#!/bin/bash
set -e
CLOUD_RUN_URL=${1:?'Informe a URL do Cloud Run como primeiro argumento'}
npx tsx --env-file=.env scripts/webhook-subscribe.ts --url "${CLOUD_RUN_URL}/webhook" --replace
