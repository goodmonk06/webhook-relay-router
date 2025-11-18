/**
 * エンドツーエンドテストスクリプト
 *
 * Webhook Relay Routerの動作を確認するためのスクリプト
 */

import crypto from 'crypto';
import axios from 'axios';

const ROUTER_URL = process.env.ROUTER_URL || 'http://localhost:3000';
const MOCK_SERVER_URL = process.env.MOCK_SERVER_URL || 'http://localhost:4000';

interface TestResult {
  name: string;
  success: boolean;
  error?: string;
  duration?: number;
}

const results: TestResult[] = [];

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Stripeの署名を生成
 */
function generateStripeSignature(payload: string, secret: string): string {
  const timestamp = Math.floor(Date.now() / 1000);
  const signedPayload = `${timestamp}.${payload}`;
  const signature = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');
  return `t=${timestamp},v1=${signature}`;
}

/**
 * GitHubの署名を生成
 */
function generateGitHubSignature(payload: string, secret: string): string {
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return `sha256=${signature}`;
}

/**
 * テスト1: ヘルスチェック
 */
async function testHealthCheck(): Promise<void> {
  console.log('\n📋 Test 1: Health Check');
  const startTime = Date.now();

  try {
    const response = await axios.get(`${ROUTER_URL}/health`);

    if (response.status === 200 && response.data.status === 'ok') {
      results.push({
        name: 'Health Check',
        success: true,
        duration: Date.now() - startTime,
      });
      console.log('✅ Health check passed');
    } else {
      throw new Error('Invalid health check response');
    }
  } catch (error) {
    results.push({
      name: 'Health Check',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    console.log('❌ Health check failed:', error);
  }
}

/**
 * テスト2: ルート情報の取得
 */
async function testRoutesEndpoint(): Promise<void> {
  console.log('\n📋 Test 2: Routes Endpoint');
  const startTime = Date.now();

  try {
    const response = await axios.get(`${ROUTER_URL}/routes`);

    if (response.status === 200 && Array.isArray(response.data.routes)) {
      results.push({
        name: 'Routes Endpoint',
        success: true,
        duration: Date.now() - startTime,
      });
      console.log('✅ Routes endpoint passed');
      console.log(`   Found ${response.data.routes.length} routes`);
    } else {
      throw new Error('Invalid routes response');
    }
  } catch (error) {
    results.push({
      name: 'Routes Endpoint',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    console.log('❌ Routes endpoint failed:', error);
  }
}

/**
 * テスト3: Stripe Webhook
 */
async function testStripeWebhook(): Promise<void> {
  console.log('\n📋 Test 3: Stripe Webhook');
  const startTime = Date.now();

  try {
    const payload = JSON.stringify({
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_test_123',
          amount: 1000,
          currency: 'usd',
        },
      },
    });

    const signature = generateStripeSignature(payload, 'whsec_test_secret');

    const response = await axios.post(`${ROUTER_URL}/webhook/stripe`, payload, {
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': signature,
      },
    });

    if (response.status === 200 && response.data.success) {
      results.push({
        name: 'Stripe Webhook',
        success: true,
        duration: Date.now() - startTime,
      });
      console.log('✅ Stripe webhook passed');
    } else {
      throw new Error('Invalid response');
    }
  } catch (error) {
    results.push({
      name: 'Stripe Webhook',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    console.log('❌ Stripe webhook failed:', error);
  }
}

/**
 * テスト4: GitHub Webhook
 */
async function testGitHubWebhook(): Promise<void> {
  console.log('\n📋 Test 4: GitHub Webhook');
  const startTime = Date.now();

  try {
    const payload = JSON.stringify({
      action: 'opened',
      pull_request: {
        id: 123,
        title: 'Test PR',
        state: 'open',
      },
    });

    const signature = generateGitHubSignature(payload, 'test_secret');

    const response = await axios.post(`${ROUTER_URL}/webhook/github`, payload, {
      headers: {
        'Content-Type': 'application/json',
        'x-hub-signature-256': signature,
        'x-github-event': 'pull_request',
      },
    });

    if (response.status === 200 && response.data.success) {
      results.push({
        name: 'GitHub Webhook',
        success: true,
        duration: Date.now() - startTime,
      });
      console.log('✅ GitHub webhook passed');
    } else {
      throw new Error('Invalid response');
    }
  } catch (error) {
    results.push({
      name: 'GitHub Webhook',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    console.log('❌ GitHub webhook failed:', error);
  }
}

/**
 * テスト5: Generic Webhook
 */
async function testGenericWebhook(): Promise<void> {
  console.log('\n📋 Test 5: Generic Webhook');
  const startTime = Date.now();

  try {
    const payload = {
      event: 'test',
      timestamp: new Date().toISOString(),
      data: {
        message: 'Hello from test script',
      },
    };

    const response = await axios.post(`${ROUTER_URL}/webhook/generic`, payload, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (response.status === 200 && response.data.success) {
      results.push({
        name: 'Generic Webhook',
        success: true,
        duration: Date.now() - startTime,
      });
      console.log('✅ Generic webhook passed');
    } else {
      throw new Error('Invalid response');
    }
  } catch (error) {
    results.push({
      name: 'Generic Webhook',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    console.log('❌ Generic webhook failed:', error);
  }
}

/**
 * テスト6: 無効な署名でリクエスト
 */
async function testInvalidSignature(): Promise<void> {
  console.log('\n📋 Test 6: Invalid Signature (should fail)');
  const startTime = Date.now();

  try {
    const payload = JSON.stringify({
      type: 'payment_intent.succeeded',
      data: {},
    });

    const response = await axios.post(`${ROUTER_URL}/webhook/stripe`, payload, {
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': 't=123456,v1=invalid_signature',
      },
      validateStatus: () => true, // 全てのステータスを受け入れる
    });

    if (response.status === 401) {
      results.push({
        name: 'Invalid Signature Test',
        success: true,
        duration: Date.now() - startTime,
      });
      console.log('✅ Invalid signature correctly rejected');
    } else {
      throw new Error('Expected 401 status');
    }
  } catch (error) {
    results.push({
      name: 'Invalid Signature Test',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    console.log('❌ Invalid signature test failed:', error);
  }
}

/**
 * テスト7: モックサーバーの確認
 */
async function checkMockServer(): Promise<void> {
  console.log('\n📋 Test 7: Check Mock Server');

  try {
    await sleep(500); // Webhookの転送を待つ

    const response = await axios.get(`${MOCK_SERVER_URL}/webhooks`);

    if (response.status === 200 && response.data.webhooks) {
      console.log('✅ Mock server received webhooks');
      console.log(`   Total webhooks received: ${response.data.count}`);

      if (response.data.count > 0) {
        console.log('\n   Latest webhook:');
        const latest = response.data.webhooks[0];
        console.log(`   - Provider: ${latest.headers['x-webhook-provider']}`);
        console.log(`   - Path: ${latest.path}`);
        console.log(`   - Timestamp: ${latest.timestamp}`);
      }
    } else {
      console.log('⚠️  Mock server returned unexpected response');
    }
  } catch (error) {
    console.log('⚠️  Could not connect to mock server:', error instanceof Error ? error.message : 'Unknown error');
  }
}

/**
 * サマリーを表示
 */
function printSummary(): void {
  console.log('\n========================================');
  console.log('📊 Test Summary');
  console.log('========================================\n');

  const passed = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;
  const total = results.length;

  results.forEach((result) => {
    const icon = result.success ? '✅' : '❌';
    const duration = result.duration ? ` (${result.duration}ms)` : '';
    console.log(`${icon} ${result.name}${duration}`);
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
  });

  console.log('\n========================================');
  console.log(`Total: ${total} | Passed: ${passed} | Failed: ${failed}`);
  console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);
  console.log('========================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

/**
 * メイン実行
 */
async function main(): Promise<void> {
  console.log('========================================');
  console.log('🧪 Webhook Relay Router E2E Test');
  console.log('========================================');
  console.log(`Router URL: ${ROUTER_URL}`);
  console.log(`Mock Server URL: ${MOCK_SERVER_URL}`);

  await testHealthCheck();
  await testRoutesEndpoint();
  await testStripeWebhook();
  await testGitHubWebhook();
  await testGenericWebhook();
  await testInvalidSignature();
  await checkMockServer();

  printSummary();
}

main().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
