import matchers from '@testing-library/jest-dom/matchers';
import { expect } from 'vitest';

expect.extend(matchers);

if (typeof globalThis.Headers === 'undefined') {
  class TestHeaders {
    private values = new Map<string, string>();

    constructor(init: Record<string, string> | Array<[string, string]> = {}) {
      const entries = Array.isArray(init) ? init : Object.entries(init);
      entries.forEach(([key, value]) => this.set(key, value));
    }

    append(key: string, value: string) {
      this.set(key, value);
    }

    get(key: string) {
      return this.values.get(String(key).toLowerCase()) ?? null;
    }

    has(key: string) {
      return this.values.has(String(key).toLowerCase());
    }

    set(key: string, value: string) {
      this.values.set(String(key).toLowerCase(), String(value));
    }
  }

  globalThis.Headers = TestHeaders as unknown as typeof Headers;
}

if (typeof globalThis.Request === 'undefined') {
  globalThis.Request = class TestRequest {
    url: string;
    method: string;
    signal: AbortSignal | null;
    headers: Headers;

    constructor(input: RequestInfo | URL, init: RequestInit = {}) {
      this.url = String(input);
      this.method = init.method ?? 'GET';
      this.signal = init.signal ?? null;
      this.headers = new Headers(init.headers);
    }
  } as typeof Request;
}

if (typeof globalThis.Response === 'undefined') {
  globalThis.Response = class TestResponse {
    body: BodyInit | null;
    headers: Headers;
    status: number;
    statusText: string;

    constructor(body: BodyInit | null = null, init: ResponseInit = {}) {
      this.body = body;
      this.headers = new Headers(init.headers);
      this.status = init.status ?? 200;
      this.statusText = init.statusText ?? '';
    }

    text() {
      return Promise.resolve(this.body == null ? '' : String(this.body));
    }
  } as typeof Response;
}
