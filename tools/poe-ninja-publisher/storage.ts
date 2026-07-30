import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

export type StoredObject = { bytes: Uint8Array; contentType?: string; contentEncoding?: string; cacheControl?: string };
export type PutObject = StoredObject & { ifNoneMatch?: '*' };

/** Small common surface; it intentionally does not depend on an AWS SDK. */
export interface PublisherStorage {
  get(key: string): Promise<StoredObject | undefined>;
  put(key: string, object: PutObject): Promise<void>;
}

function normalizedKey(key: string): string { return key.replace(/^\/+/, ''); }

export class LocalFilesystemStorage implements PublisherStorage {
  constructor(private readonly root: string) {}
  private path(key: string): string { return join(resolve(this.root), normalizedKey(key)); }
  async get(key: string): Promise<StoredObject | undefined> { try { return { bytes: await readFile(this.path(key)) }; } catch (error: any) { if (error?.code === 'ENOENT') return undefined; throw error; } }
  async put(key: string, object: PutObject): Promise<void> {
    const path = this.path(key);
    if (object.ifNoneMatch === '*' && await this.get(key)) throw new Error(`Object already exists: ${key}`);
    await mkdir(dirname(path), { recursive: true });
    const temporary = `${path}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(temporary, object.bytes);
    await rename(temporary, path);
  }
}

export type S3LikeClient = {
  send(command: unknown): Promise<unknown>;
};

export type R2StorageOptions = {
  client: S3LikeClient;
  bucket: string;
  commandFactory: {
    GetObjectCommand(input: Record<string, unknown>): unknown;
    PutObjectCommand(input: Record<string, unknown>): unknown;
  };
};

/** R2 is S3 compatible. Consumers inject the AWS SDK client, keeping this package dependency-free. */
export class R2StorageTarget implements PublisherStorage {
  constructor(private readonly options: R2StorageOptions) {}
  async get(key: string): Promise<StoredObject | undefined> {
    try {
      const output: any = await this.options.client.send(this.options.commandFactory.GetObjectCommand({ Bucket: this.options.bucket, Key: normalizedKey(key) }));
      if (!output?.Body) return undefined;
      const bytes = output.Body.transformToByteArray ? await output.Body.transformToByteArray() : new Uint8Array(await output.Body);
      return { bytes, contentType: output.ContentType, contentEncoding: output.ContentEncoding, cacheControl: output.CacheControl };
    } catch (error: any) { if (error?.name === 'NoSuchKey' || error?.$metadata?.httpStatusCode === 404) return undefined; throw error; }
  }
  async put(key: string, object: PutObject): Promise<void> {
    await this.options.client.send(this.options.commandFactory.PutObjectCommand({ Bucket: this.options.bucket, Key: normalizedKey(key), Body: object.bytes, ContentType: object.contentType, ContentEncoding: object.contentEncoding, CacheControl: object.cacheControl, IfNoneMatch: object.ifNoneMatch }));
  }
}

export async function createR2StorageFromEnvironment(): Promise<PublisherStorage> {
  const accountId = process.env.CF_ACCOUNT_ID;
  const bucket = process.env.R2_BUCKET;
  if (!accountId || !bucket || !process.env.CF_R2_ACCESS_KEY_ID || !process.env.CF_R2_SECRET_ACCESS_KEY) throw new Error('R2 publishing requires CF_ACCOUNT_ID, R2_BUCKET, CF_R2_ACCESS_KEY_ID and CF_R2_SECRET_ACCESS_KEY');
  let sdk: any;
  try { sdk = await (new Function('moduleName', 'return import(moduleName)')('@aws-sdk/client-s3')); } catch { throw new Error('Install @aws-sdk/client-s3 in the publishing environment, or inject an R2StorageTarget client.'); }
  return new R2StorageTarget({ client: new sdk.S3Client({ region: 'auto', endpoint: `https://${accountId}.r2.cloudflarestorage.com`, credentials: { accessKeyId: process.env.CF_R2_ACCESS_KEY_ID, secretAccessKey: process.env.CF_R2_SECRET_ACCESS_KEY } }), bucket, commandFactory: sdk });
}
