import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});

// jsdom does not implement ResizeObserver, which Recharts' ResponsiveContainer
// relies on. Provide a no-op stub so charts can mount in tests.
global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// matchMedia stub (used by some animation libs).
if (!window.matchMedia) {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

// Give ResponsiveContainer a non-zero size so SVG charts render.
Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, value: 800 });
Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, value: 600 });

// Ensure a localStorage implementation exists (the auth slice persists to it).
if (typeof globalThis.localStorage === 'undefined') {
  let storeMap = {};
  globalThis.localStorage = {
    getItem: (k) => (k in storeMap ? storeMap[k] : null),
    setItem: (k, v) => {
      storeMap[k] = String(v);
    },
    removeItem: (k) => {
      delete storeMap[k];
    },
    clear: () => {
      storeMap = {};
    },
  };
}

// jsdom's native Request validates `signal` against its own AbortSignal class
// and rejects RTK Query's (cross-realm) signal. Replace Request with a lenient
// passthrough that just records url + init so fetchBaseQuery can build it and
// our fetch mock can read `.url`.
global.Request = class Request {
  constructor(input, init = {}) {
    this.url = typeof input === 'string' ? input : input?.url || '';
    this.method = init.method || 'GET';
    this.headers = init.headers || {};
    this.signal = init.signal;
    this._init = init;
  }
  clone() {
    return new Request(this.url, this._init);
  }
};

// Default fetch mock: simulate an unreachable backend. Individual tests
// override this with mockFetchRoutes(...) to provide real API data.
beforeEach(() => {
  global.fetch = vi.fn(() => Promise.reject(new Error('network disabled in tests')));
});
