import { createHash } from 'node:crypto';
import { CURRENT_PRICE_SNAPSHOT_SCHEMA, PRICING_PROTOCOL_VERSION, type PriceSnapshot, type PricingLeague, type PricingLeagueIndex, type PricingSnapshotManifest } from './types';
export * from './types';
export * from './catalog';
export * from './adapters';

export function leagueKey(leagueId: string): string { return Buffer.from(leagueId, 'utf8').toString('base64url'); }
export function snapshotPath(leagueId: string, snapshotId: string): string { return `/v1/poe1/leagues/${leagueKey(leagueId)}/snapshots/${snapshotId}.json`; }
export function manifestPath(leagueId: string): string { return `/v1/poe1/leagues/${leagueKey(leagueId)}/current.json`; }
export function canonicalJson(value: unknown): string { return JSON.stringify(sortValue(value)); }
function sortValue(value: any): any { if (Array.isArray(value)) return value.map(sortValue); if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortValue(value[key])])); return value; }
export function sha256(value: string | Uint8Array): string { return createHash('sha256').update(value).digest('hex'); }
export function createLeague(leagueId: string): PricingLeague { const id = leagueId.trim(); return { id, name: id, key: leagueKey(id), manifestPath: manifestPath(id) }; }
export function createLeagueIndex(leagues: PricingLeague[], generatedAt: string): PricingLeagueIndex { return { protocolVersion: PRICING_PROTOCOL_VERSION, generatedAt, leagues: [...leagues].sort((a, b) => a.id.localeCompare(b.id)) }; }
export function createManifest(snapshot: PriceSnapshot, publishedAt: string, id: string, hash: string, sizeBytes: number): PricingSnapshotManifest { return { protocolVersion: PRICING_PROTOCOL_VERSION, leagueId: snapshot.leagueId, publishedAt, snapshot: { id, path: snapshotPath(snapshot.leagueId, id), schemaVersion: CURRENT_PRICE_SNAPSHOT_SCHEMA, catalogRevision: snapshot.catalogRevision, fetchedAt: snapshot.fetchedAt, sha256: hash, sizeBytes } }; }
