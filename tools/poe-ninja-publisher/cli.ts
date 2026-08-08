#!/usr/bin/env node
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import {
  assertPriceSnapshot,
  assertPricingManifest,
  assertSnapshotHash,
  type PricingLeagueIndex,
} from '../../src/shared/pricing';
import { LocalFilesystemStorage, createR2StorageFromEnvironment } from './storage';
import { PoeNinjaRequester } from './requester';
import { PricingPublisher } from './publisher';

type Arguments = {
  command: 'generate' | 'publish' | 'validate' | 'serve';
  dryRun: boolean;
  forceFullRefresh: boolean;
  rollbackSnapshotId?: string;
  leagues: string[];
};

function parseBoolean(value: string | undefined): boolean {
  return value === 'true' || value === '1';
}

function parseArguments(argv: string[]): Arguments {
  const [rawCommand = 'generate', ...rest] = argv;
  if (!['generate', 'publish', 'validate', 'serve'].includes(rawCommand)) {
    throw new Error('Usage: cli.ts <generate|publish|validate|serve> [--dry-run] [--league=<id>] [--force-full-refresh] [--rollback-snapshot-id=<id>]');
  }
  const values: Arguments = {
    command: rawCommand as Arguments['command'],
    dryRun: false,
    forceFullRefresh: false,
    leagues: [],
  };
  for (const arg of rest) {
    if (arg.startsWith('--dry-run=')) values.dryRun = parseBoolean(arg.slice('--dry-run='.length));
    else if (arg === '--dry-run') values.dryRun = true;
    else if (arg.startsWith('--league=')) {
      const league = arg.slice('--league='.length);
      if (league) values.leagues.push(league);
    } else if (arg.startsWith('--force-full-refresh=')) values.forceFullRefresh = parseBoolean(arg.slice('--force-full-refresh='.length));
    else if (arg === '--force-full-refresh') values.forceFullRefresh = true;
    else if (arg.startsWith('--rollback-snapshot-id=')) values.rollbackSnapshotId = arg.slice('--rollback-snapshot-id='.length) || undefined;
    else if (!arg.startsWith('--')) values.leagues.push(arg);
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return values;
}

async function validateOutput(root: string) {
  const index = JSON.parse(await readFile(join(root, 'v1', 'poe1', 'leagues.json'), 'utf8')) as PricingLeagueIndex;
  if (index.protocolVersion !== 1 || !Array.isArray(index.leagues)) throw new Error('Invalid pricing league index');
  for (const league of index.leagues) {
    const manifest = JSON.parse(await readFile(join(root, league.manifestPath.replace(/^\//, '')), 'utf8'));
    assertPricingManifest(manifest, league.id);
    const snapshotBytes = await readFile(join(root, manifest.snapshot.path.replace(/^\//, '')));
    const serialized = gunzipSync(snapshotBytes).toString('utf8');
    assertSnapshotHash(serialized, manifest.snapshot.sha256);
    assertPriceSnapshot(JSON.parse(serialized), league.id);
  }
  return { leagues: index.leagues.length };
}

async function serveOutput(root: string) {
  const port = Number(process.env.PRICING_PORT ?? 8787);
  const server = createServer(async (request, response) => {
    if (!request.url || !['GET', 'HEAD'].includes(request.method ?? 'GET') || request.url.includes('?')) {
      response.writeHead(405).end();
      return;
    }
    const key = request.url.replace(/^\//, '');
    if (!key.startsWith('v1/') || key.split('/').includes('..')) {
      response.writeHead(404).end();
      return;
    }
    try {
      const bytes = await readFile(join(root, key));
      const snapshot = key.includes('/snapshots/');
      response.writeHead(200, {
        'Content-Type': 'application/json',
        ...(snapshot ? { 'Content-Encoding': 'gzip', 'Cache-Control': 'public, max-age=31536000, immutable' } : { 'Cache-Control': key.endsWith('current.json') ? 'public, max-age=300' : 'public, max-age=3600' }),
      });
      response.end(request.method === 'HEAD' ? undefined : bytes);
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise<void>((resolve) => server.listen(port, '127.0.0.1', resolve));
  process.stdout.write(`Pricing fixture server listening at http://127.0.0.1:${port}/v1\n`);
}

async function main() {
  const args = parseArguments(process.argv.slice(2));
  const outputRoot = resolve(process.env.PRICING_OUTPUT_DIR ?? '.tmp/pricing-proxy');
  if (args.command === 'validate') {
    process.stdout.write(`${JSON.stringify(await validateOutput(outputRoot), null, 2)}\n`);
    return;
  }
  if (args.command === 'serve') {
    await serveOutput(outputRoot);
    return;
  }
  const storage = args.command === 'publish' && !args.dryRun
    ? await createR2StorageFromEnvironment()
    : new LocalFilesystemStorage(outputRoot);
  if (args.rollbackSnapshotId) {
    if (args.command !== 'publish' || args.leagues.length !== 1) {
      throw new Error('Rollback requires publish mode and exactly one --league value.');
    }
    const result = await new PricingPublisher(storage, PoeNinjaRequester.fromEnvironment()).rollbackLeague(args.leagues[0], args.rollbackSnapshotId);
    process.stdout.write(`${JSON.stringify({ command: args.command, rollback: true, ...result }, null, 2)}\n`);
    return;
  }
  const requester = PoeNinjaRequester.fromEnvironment();
  const leagues = args.leagues.length ? args.leagues : await requester.getLeagues();
  const result = await new PricingPublisher(storage, requester).publishLeagues(
    leagues,
    args.forceFullRefresh,
    args.leagues.length === 0
  );
  process.stdout.write(`${JSON.stringify({ command: args.command, dryRun: args.dryRun, ...result }, null, 2)}\n`);
  if (result.failed.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
