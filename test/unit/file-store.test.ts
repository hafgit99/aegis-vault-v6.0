import { beforeEach, describe, expect, it, vi } from 'vitest';

type RequestHandler = (() => void) | null;

class FakeIDBRequest<T = unknown> {
  error: Error | null = null;
  result: T | undefined;
  onsuccess: RequestHandler = null;
  onerror: RequestHandler = null;
  onupgradeneeded: RequestHandler = null;
}

function finish<T>(request: FakeIDBRequest<T>, result: T): FakeIDBRequest<T> {
  request.result = result;
  queueMicrotask(() => request.onsuccess?.());
  return request;
}

function fail<T>(request: FakeIDBRequest<T>, error: Error): FakeIDBRequest<T> {
  request.error = error;
  queueMicrotask(() => request.onerror?.());
  return request;
}

function installIndexedDB(options: {
  openError?: Error;
  operationError?: Error;
  hasStore?: boolean;
} = {}) {
  const records = new Map<string, Blob>();
  const createObjectStore = vi.fn();
  const objectStore = {
    put: vi.fn((data: Blob, id: string) => {
      const request = new FakeIDBRequest<IDBValidKey>();
      if (options.operationError) return fail(request, options.operationError);
      records.set(id, data);
      return finish(request, id);
    }),
    get: vi.fn((id: string) => {
      const request = new FakeIDBRequest<Blob | undefined>();
      if (options.operationError) return fail(request, options.operationError);
      return finish(request, records.get(id));
    }),
    delete: vi.fn((id: string) => {
      const request = new FakeIDBRequest<undefined>();
      if (options.operationError) return fail(request, options.operationError);
      records.delete(id);
      return finish(request, undefined);
    }),
  };
  const transaction = vi.fn(() => ({ objectStore: vi.fn(() => objectStore) }));
  const db = {
    objectStoreNames: {
      contains: vi.fn(() => options.hasStore ?? false),
    },
    createObjectStore,
    transaction,
  };
  const open = vi.fn(() => {
    const request = new FakeIDBRequest<typeof db>();
    if (options.openError) {
      queueMicrotask(() => fail(request, options.openError!));
      return request;
    }

    request.result = db;
    queueMicrotask(() => {
      request.onupgradeneeded?.();
      request.onsuccess?.();
    });
    return request;
  });

  vi.stubGlobal('indexedDB', { open });

  return { open, records, createObjectStore, objectStore, transaction };
}

async function loadFileStore() {
  vi.resetModules();
  return import('../../src/lib/fileStore');
}

describe('fileStore', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('creates the encrypted file store on first IndexedDB upgrade', async () => {
    const indexedDB = installIndexedDB();
    const { saveEncryptedFile } = await loadFileStore();

    await saveEncryptedFile('attachment-1', new Blob(['secret']));

    expect(indexedDB.open).toHaveBeenCalledWith('AegisVaultFS', 1);
    expect(indexedDB.createObjectStore).toHaveBeenCalledWith('encrypted_files');
    expect(indexedDB.transaction).toHaveBeenCalledWith('encrypted_files', 'readwrite');
  });

  it('saves, reads, deletes, and reuses the opened database connection', async () => {
    const indexedDB = installIndexedDB({ hasStore: true });
    const { deleteEncryptedFile, getEncryptedFile, saveEncryptedFile } = await loadFileStore();
    const blob = new Blob(['encrypted payload'], { type: 'application/octet-stream' });

    await saveEncryptedFile('attachment-1', blob);
    await expect(getEncryptedFile('attachment-1')).resolves.toBe(blob);
    await deleteEncryptedFile('attachment-1');
    await expect(getEncryptedFile('attachment-1')).resolves.toBeNull();

    expect(indexedDB.open).toHaveBeenCalledTimes(1);
    expect(indexedDB.createObjectStore).not.toHaveBeenCalled();
    expect(indexedDB.objectStore.put).toHaveBeenCalledWith(blob, 'attachment-1');
    expect(indexedDB.objectStore.get).toHaveBeenCalledWith('attachment-1');
    expect(indexedDB.objectStore.delete).toHaveBeenCalledWith('attachment-1');
  });

  it('rejects when IndexedDB cannot be opened', async () => {
    const openError = new Error('indexeddb unavailable');
    installIndexedDB({ openError });
    const { getEncryptedFile } = await loadFileStore();

    await expect(getEncryptedFile('missing')).rejects.toBe(openError);
  });

  it('rejects write operations when the object store request fails', async () => {
    const operationError = new Error('write failed');
    installIndexedDB({ hasStore: true, operationError });
    const { saveEncryptedFile } = await loadFileStore();

    await expect(saveEncryptedFile('attachment-1', new Blob(['secret']))).rejects.toBe(operationError);
  });
});
