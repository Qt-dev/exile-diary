// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
require('@testing-library/jest-dom');

if (typeof global.Headers === 'undefined') {
  class Headers {
    constructor(init = {}) {
      this.values = new Map();

      if (Array.isArray(init)) {
        init.forEach(([key, value]) => this.set(key, value));
      } else {
        Object.entries(init).forEach(([key, value]) => this.set(key, value));
      }
    }

    append(key, value) {
      this.set(key, value);
    }

    get(key) {
      return this.values.get(String(key).toLowerCase()) ?? null;
    }

    has(key) {
      return this.values.has(String(key).toLowerCase());
    }

    set(key, value) {
      this.values.set(String(key).toLowerCase(), String(value));
    }
  }

  global.Headers = Headers;
}

if (typeof global.Request === 'undefined') {
  global.Request = class Request {
    constructor(input, init = {}) {
      this.url = String(input);
      this.method = init.method ?? 'GET';
      this.signal = init.signal ?? null;
      this.headers = new global.Headers(init.headers);
    }
  };
}

if (typeof global.Response === 'undefined') {
  global.Response = class Response {
    constructor(body = null, init = {}) {
      this.body = body;
      this.headers = new global.Headers(init.headers);
      this.status = init.status ?? 200;
      this.statusText = init.statusText ?? '';
    }

    text() {
      return Promise.resolve(this.body == null ? '' : String(this.body));
    }
  };
}
