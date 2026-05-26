import { argon2id } from 'hash-wasm';

export class Argon2WorkerService {
  static async deriveHex(request: {
    password: string;
    salt: Uint8Array;
    parallelism: number;
    iterations: number;
    memorySize: number;
    hashLength: number;
  }): Promise<string> {
    return argon2id({
      password: request.password,
      salt: request.salt,
      parallelism: request.parallelism,
      iterations: request.iterations,
      memorySize: request.memorySize,
      hashLength: request.hashLength,
      outputType: 'hex',
    }) as Promise<string>;
  }

  static async deriveBinary(request: {
    password: string;
    salt: Uint8Array;
    parallelism: number;
    iterations: number;
    memorySize: number;
    hashLength: number;
  }): Promise<Uint8Array> {
    return argon2id({
      password: request.password,
      salt: request.salt,
      parallelism: request.parallelism,
      iterations: request.iterations,
      memorySize: request.memorySize,
      hashLength: request.hashLength,
      outputType: 'binary',
    }) as Promise<Uint8Array>;
  }
}
