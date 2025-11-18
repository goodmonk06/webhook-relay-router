#!/bin/bash

# Webhook送信テストスクリプト

ROUTER_URL="${ROUTER_URL:-http://localhost:3000}"
PROVIDER="${1:-stripe}"

echo "========================================="
echo "Webhook Test Script"
echo "========================================="
echo "Router URL: $ROUTER_URL"
echo "Provider: $PROVIDER"
echo ""

case "$PROVIDER" in
  stripe)
    echo "Testing Stripe Webhook..."
    TIMESTAMP=$(date +%s)
    PAYLOAD='{"type":"payment_intent.succeeded","data":{"object":{"id":"pi_test_123","amount":1000,"currency":"usd"}}}'

    # Stripe署名を生成（簡易版）
    SECRET="whsec_test_secret"
    SIGNED_PAYLOAD="${TIMESTAMP}.${PAYLOAD}"
    SIGNATURE=$(echo -n "$SIGNED_PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" -binary | xxd -p -c 256)

    curl -X POST "${ROUTER_URL}/webhook/stripe" \
      -H "Content-Type: application/json" \
      -H "stripe-signature: t=${TIMESTAMP},v1=${SIGNATURE}" \
      -d "$PAYLOAD" \
      -w "\nHTTP Status: %{http_code}\n" \
      -v
    ;;

  github)
    echo "Testing GitHub Webhook..."
    PAYLOAD='{"action":"opened","pull_request":{"id":123,"title":"Test PR","state":"open"}}'

    # GitHub署名を生成
    SECRET="test_secret"
    SIGNATURE="sha256=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" -binary | xxd -p -c 256)"

    curl -X POST "${ROUTER_URL}/webhook/github" \
      -H "Content-Type: application/json" \
      -H "x-hub-signature-256: ${SIGNATURE}" \
      -H "x-github-event: pull_request" \
      -d "$PAYLOAD" \
      -w "\nHTTP Status: %{http_code}\n" \
      -v
    ;;

  generic)
    echo "Testing Generic Webhook..."
    PAYLOAD='{"event":"test","timestamp":"'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'","data":{"message":"Hello from test script"}}'

    curl -X POST "${ROUTER_URL}/webhook/generic" \
      -H "Content-Type: application/json" \
      -d "$PAYLOAD" \
      -w "\nHTTP Status: %{http_code}\n" \
      -v
    ;;

  *)
    echo "Unknown provider: $PROVIDER"
    echo "Usage: $0 [stripe|github|generic]"
    exit 1
    ;;
esac

echo ""
echo "========================================="
echo "Check the mock server logs to see if the webhook was received!"
echo "Or visit: http://localhost:4000/webhooks"
echo "========================================="
