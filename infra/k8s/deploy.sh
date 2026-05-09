#!/bin/bash
set -e

# Configuration
REGION="${_REGION:-us-central1}"
ZONE="${_ZONE:-us-central1-a}"
PROJECT_ID="$(gcloud config get-value project)"
ENV="${_ENV:-prod}"
APP_NAME="${_APP_NAME:-heard-again}"
NAMESPACE="heard-again"

echo "Deploying to GKE namespace: ${NAMESPACE}"

# Authenticate kubectl against the GKE cluster (self-contained — no prior step needed)
echo "Fetching GKE credentials..."
gcloud container clusters get-credentials "${APP_NAME}-${ENV}-cluster" --zone="${ZONE}" --project="${PROJECT_ID}"

# 1. Create namespace if it doesn't exist
kubectl create namespace ${NAMESPACE} --dry-run=client -o yaml | kubectl apply -f -

# 2. Bootstrap secrets from Secret Manager
echo "Bootstrapping secrets from Secret Manager..."

# Fetch secrets and create K8s secret
CHROMA_CREDENTIALS=$(gcloud secrets versions access latest --secret=${APP_NAME}-${ENV}-chroma-credentials)
TTS_TOKEN=$(gcloud secrets versions access latest --secret=${APP_NAME}-${ENV}-tts-service-token)
DB_PASSWORD=$(gcloud secrets versions access latest --secret=${APP_NAME}-${ENV}-postgres-password)
CHAT_SECRET=$(gcloud secrets versions access latest --secret=${APP_NAME}-${ENV}-chat-service-secret)

# Redis configuration (Memorystore)
REDIS_INSTANCE="${APP_NAME}-${ENV}-redis"
echo "Fetching Redis configuration for ${REDIS_INSTANCE}..."
REDIS_HOST=$(gcloud redis instances describe ${REDIS_INSTANCE} --region=${REGION} --format="value(host)")
REDIS_PORT=$(gcloud redis instances describe ${REDIS_INSTANCE} --region=${REGION} --format="value(port)")
REDIS_AUTH=$(gcloud redis instances get-auth-string ${REDIS_INSTANCE} --region=${REGION} --format="value(authString)")
REDIS_AUTH_ENCODED=$(python3 -c "import urllib.parse, sys; print(urllib.parse.quote(sys.argv[1]))" "${REDIS_AUTH}")
REDIS_URL="rediss://:${REDIS_AUTH_ENCODED}@${REDIS_HOST}:${REDIS_PORT}"

kubectl create secret generic heard-again-secrets \
  --namespace ${NAMESPACE} \
  --from-literal=chroma-credentials="${CHROMA_CREDENTIALS}" \
  --from-literal=tts-service-token="${TTS_TOKEN}" \
  --from-literal=postgres-password="${DB_PASSWORD}" \
  --from-literal=chat-service-secret="${CHAT_SECRET}" \
  --from-literal=redis-url="${REDIS_URL}" \
  --dry-run=client -o yaml | kubectl apply -f -

# 3. Process placeholders in tts.yaml and other files if needed
echo "Processing placeholders in YAML files..."
sed -i "s/REGION/${REGION}/g" infra/k8s/tts.yaml
sed -i "s/PROJECT_ID/${PROJECT_ID}/g" infra/k8s/tts.yaml

# 4. Apply all configurations
echo "Applying K8s manifests..."
kubectl apply -f infra/k8s/

echo "Deployment complete!"
