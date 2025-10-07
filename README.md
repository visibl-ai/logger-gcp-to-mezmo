
# Mezmo Log Forwarder for Google Cloud (Cloud Functions Gen2)

This forwards all GCP logs (from Cloud Run + Cloud Functions) to Mezmo (LogDNA) using Pub/Sub + a tiny Node.js forwarder.
It preserves the full nested GCP log structure under meta.gcp.

## 1. Prerequisites

Make sure you have:
	•	gcloud CLI installed and authenticated
	•	A GCP project with Cloud Functions + Pub/Sub enabled
	•	A Mezmo ingestion key

## 2. Files Needed

Just two source files:

index.js
package.json

And one deployment script:

deploy.sh

Nothing else required.

## 3. Environment Setup

Export the required environment variables:

export PROJECT_ID=visibl-rtdb-dev        # or your project
export MEZMO_API_KEY=your-mezmo-key-here

## 4. Ensure Pub/Sub Topic Exists

Create (or verify) the topic your sink uses:

gcloud pubsub topics create logs-to-mezmo --project $PROJECT_ID

## 5. Create / Update Log Sink

Use this inclusion filter:

resource.type = "cloud_run_revision" OR resource.type = "cloud_function"

Add an exclusion to prevent recursion:

resource.labels.function_name = "mezmoForwarder" OR resource.labels.service_name = "mezmoForwarder"

Set the sink destination to:

Pub/Sub topic: logs-to-mezmo

## 6. Deploy the Forwarder


`PROJECT_ID={project} MEZMO_API_KEY={key} ./deploy.sh`

The script:
	•	Verifies PROJECT_ID + MEZMO_API_KEY
	•	Checks your active gcloud project
	•	Deploys the function on Gen2
	•	Sets the correct memory, region, env vars