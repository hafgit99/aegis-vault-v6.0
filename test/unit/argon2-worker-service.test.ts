import { beforeEach, describe, expect, it, vi } from 'vitest';

const argon2id = vi.hoisted(() => vi.fn());

vi.mock('hash-wasm', () => ({
  argon2id,
}));

import { Argon2WorkerService } from '../../src/lib/Argon2WorkerService';

describe('Argon2WorkerService', () => {
  const request = {
    password: 'master-password',
    salt: new Uint8Array([1, 2, 3, 4]),
    parallelism: 2,
    iterations: 4,
    memorySize: 65536,
    hashLength: 32,
  };

  beforeEach(() => {
    argon2id.mockReset();
  });

  it('derives hex hashes with the expected Argon2id options', async () => {
    argon2id.mockResolvedValue('derived-hex');

    await expect(Argon2WorkerService.deriveHex(request)).resolves.toBe('derived-hex');

    expect(argon2id).toHaveBeenCalledWith({
      ...request,
      outputType: 'hex',
    });
  });

  it('derives binary hashes with the expected Argon2id options', async () => {
    const binary = new Uint8Array([9, 8, 7]);
    argon2id.mockResolvedValue(binary);

    await expect(Argon2WorkerService.deriveBinary(request)).resolves.toBe(binary);

    expect(argon2id).toHaveBeenCalledWith({
      ...request,
      outputType: 'binary',
    });
  });
});
