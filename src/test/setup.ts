import '@testing-library/jest-dom/vitest'

if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map<string, string>()
  const memoryStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, String(value))
    },
    removeItem: (key: string) => {
      store.delete(key)
    },
    clear: () => store.clear(),
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size
    },
  }

  Object.defineProperty(globalThis, 'localStorage', { value: memoryStorage, configurable: true })
  if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'localStorage', { value: memoryStorage, configurable: true })
  }
}
