#!/usr/bin/env bash

###
# 1) Require MEZMO_API_KEY
###
if [ -z "$MEZMO_API_KEY" ]; then
  echo "❌ ERROR: MEZMO_API_KEY environment variable is not set."
  echo "Set it first, e.g.:"
  echo "  export MEZMO_API_KEY=your_ingestion_key"
  exit 1
fi

###
# 2) Require PROJECT_ID
###
if [ -z "$PROJECT_ID" ]; then
  echo "❌ ERROR: PROJECT_ID environment variable is not set."
  echo "Set it first, e.g.:"
  echo "  export PROJECT_ID=visibl-rtdb-dev"
  exit 1
fi

###
# 3) Validate gcloud's active project
###
CURRENT_PROJECT=$(gcloud config get-value project 2>/dev/null)

if [ "$CURRENT_PROJECT" != "$PROJECT_ID" ]; then
  echo "❌ ERROR: Your active gcloud project ($CURRENT_PROJECT) does not match PROJECT_ID ($PROJECT_ID)."
  echo "Fix by running:"
  echo "  gcloud config set project $PROJECT_ID"
  echo "Or by exporting the correct env var:"
  echo "  export PROJECT_ID=$CURRENT_PROJECT"
  exit 1
fi

###
# 4) Configurable values
###
REGION="europe-west1"
TOPIC="logs-to-mezmo"
FUNCTION_NAME="mezmoForwarder"
MEZMO_URL="https://logs.logdna.com/logs/ingest?hostname=gcp"

echo "✅ Using project: $PROJECT_ID"
echo "✅ Using region:  $REGION"
echo "✅ Using topic:   $TOPIC"
echo "✅ Deploying function: $FUNCTION_NAME"
echo "✅ MEZMO_URL: $MEZMO_URL"

###
# 5) Deploy
###
gcloud functions deploy "$FUNCTION_NAME" \
  --project "$PROJECT_ID" \
  --gen2 \
  --runtime nodejs20 \
  --region "$REGION" \
  --entry-point forwardToMezmo \
  --trigger-topic "$TOPIC" \
  --set-env-vars "MEZMO_KEY=$MEZMO_API_KEY,MEZMO_URL=$MEZMO_URL" \
  --memory=256Mi \
  --timeout=60s

echo "✅ Deployment complete (if no errors were printed)."