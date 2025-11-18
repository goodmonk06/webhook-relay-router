#!/usr/bin/env node
/**
 * Webhook Relay Router CLI
 *
 * Command-line tool for managing webhook router
 */

import { program } from 'commander';
import { loadConfig } from '../config/loader';
import { WebhookEventStore } from '../lib/webhook-store';
import { VerifierFactory } from '../core/verifier';
import { WebhookEventStatus } from '../domain/webhook-event';

program
  .name('relay-cli')
  .description('Webhook Relay Router CLI')
  .version('1.0.0');

// Config validation
program
  .command('validate-config')
  .description('Validate configuration file')
  .option('-c, --config <path>', 'Config file path')
  .action(async (options) => {
    try {
      const config = loadConfig(options.config);
      console.log('✅ Configuration is valid');
      console.log(`Found ${config.routes.length} routes:`);
      config.routes.forEach((route) => {
        console.log(`  - ${route.provider}: ${route.path} -> ${route.forwardUrl}`);
      });
    } catch (error) {
      console.error('❌ Configuration error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// List providers
program
  .command('providers')
  .description('List supported providers')
  .action(() => {
    const providers = VerifierFactory.getAllProviders();
    console.log('Supported providers:');
    providers.forEach((provider) => {
      console.log(`  - ${provider}`);
    });
  });

// Query webhook history
program
  .command('history')
  .description('Query webhook history')
  .option('-p, --provider <provider>', 'Filter by provider')
  .option('-s, --status <status>', 'Filter by status')
  .option('-l, --limit <number>', 'Limit results', '20')
  .option('--from <date>', 'From date (ISO format)')
  .option('--to <date>', 'To date (ISO format)')
  .action(async (options) => {
    const store = new WebhookEventStore();

    const query = {
      provider: options.provider,
      status: options.status as WebhookEventStatus | undefined,
      fromDate: options.from ? new Date(options.from) : undefined,
      toDate: options.to ? new Date(options.to) : undefined,
      limit: parseInt(options.limit, 10),
    };

    const events = await store.query(query);

    console.log(`Found ${events.length} webhook events:\n`);
    events.forEach((event) => {
      console.log(`ID: ${event.id}`);
      console.log(`  Provider: ${event.provider}`);
      console.log(`  Status: ${event.status}`);
      console.log(`  Received: ${event.receivedAt.toISOString()}`);
      if (event.forwardUrl) {
        console.log(`  Forward URL: ${event.forwardUrl}`);
      }
      if (event.forwardStatusCode) {
        console.log(`  Forward Status: ${event.forwardStatusCode}`);
      }
      console.log('');
    });
  });

// Get statistics
program
  .command('stats')
  .description('Get webhook statistics')
  .option('-p, --provider <provider>', 'Filter by provider')
  .option('--from <date>', 'From date (ISO format)')
  .option('--to <date>', 'To date (ISO format)')
  .action(async (options) => {
    const store = new WebhookEventStore();

    const query = {
      provider: options.provider,
      fromDate: options.from ? new Date(options.from) : undefined,
      toDate: options.to ? new Date(options.to) : undefined,
    };

    const stats = await store.getStats(query);

    console.log('Webhook Statistics:');
    console.log(`  Total Events: ${stats.totalEvents}`);
    console.log(`  Success Rate: ${(stats.successRate * 100).toFixed(2)}%`);
    if (stats.avgProcessingDuration) {
      console.log(`  Avg Processing Time: ${stats.avgProcessingDuration.toFixed(2)}ms`);
    }

    console.log('\nBy Provider:');
    Object.entries(stats.byProvider)
      .sort(([, a], [, b]) => b - a)
      .forEach(([provider, count]) => {
        console.log(`  ${provider}: ${count}`);
      });

    console.log('\nBy Status:');
    Object.entries(stats.byStatus)
      .sort(([, a], [, b]) => b - a)
      .forEach(([status, count]) => {
        console.log(`  ${status}: ${count}`);
      });
  });

// Replay webhook
program
  .command('replay <id>')
  .description('Replay a webhook event by ID')
  .action(async (id) => {
    const store = new WebhookEventStore();
    const event = await store.findById(id);

    if (!event) {
      console.error(`❌ Event not found: ${id}`);
      process.exit(1);
    }

    console.log('Replaying webhook event:');
    console.log(`  ID: ${event.id}`);
    console.log(`  Provider: ${event.provider}`);
    console.log(`  Path: ${event.path}`);
    console.log(`  Forward URL: ${event.forwardUrl}`);
    console.log('\n⚠️  Note: Replay functionality requires server to be running');
    console.log('TODO: Implement replay via HTTP API');
  });

// Cleanup old events
program
  .command('cleanup')
  .description('Delete old webhook events')
  .option('-d, --days <number>', 'Retention days', '30')
  .action(async (options) => {
    const store = new WebhookEventStore();
    const days = parseInt(options.days, 10);

    console.log(`Cleaning up events older than ${days} days...`);
    const deleted = await store.cleanup(days);
    console.log(`✅ Deleted ${deleted} old event files`);
  });

program.parse();
