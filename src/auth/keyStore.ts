import { promises as fs } from 'node:fs';
import path from 'node:path';
import { getConfig } from '../config/index.js';
import { logger } from '../infra/logger.js';

export interface KeyStore {
  load(): Promise<string | null>;
  save(key: string): Promise<void>;
  clear(): Promise<void>;
}

class EnvStore implements KeyStore {
  load(): Promise<string | null> {
    const v = process.env.SOUNDIIZ_API_KEY?.trim();
    return Promise.resolve(v ? v : null);
  }
  save(): Promise<void> {
    logger.warn('keyStore=env: save() is a no-op; set SOUNDIIZ_API_KEY in your environment.');
    return Promise.resolve();
  }
  clear(): Promise<void> {
    logger.warn('keyStore=env: clear() is a no-op; unset SOUNDIIZ_API_KEY in your environment.');
    return Promise.resolve();
  }
}

class FileStore implements KeyStore {
  constructor(private filePath: string) {}

  async load(): Promise<string | null> {
    try {
      const content = await fs.readFile(this.filePath, 'utf8');
      const trimmed = content.trim();
      return trimmed || null;
    } catch (err) {
      if ((err as { code?: string }).code === 'ENOENT') return null;
      logger.warn('Failed to load key file', { message: (err as Error).message });
      return null;
    }
  }

  async save(key: string): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, key, { encoding: 'utf8', mode: 0o600 });
    if (process.platform !== 'win32') {
      await fs.chmod(this.filePath, 0o600);
    }
  }

  async clear(): Promise<void> {
    try {
      await fs.unlink(this.filePath);
    } catch (err) {
      if ((err as { code?: string }).code !== 'ENOENT') {
        logger.warn('Failed to delete key file', { message: (err as Error).message });
      }
    }
  }
}

class KeychainStore implements KeyStore {
  private service = 'soundiiz-mcp';
  private account = 'default';
  private keytar: {
    getPassword: (service: string, account: string) => Promise<string | null>;
    setPassword: (service: string, account: string, password: string) => Promise<void>;
    deletePassword: (service: string, account: string) => Promise<boolean>;
  } | null = null;

  private async ensureKeytar(): Promise<KeychainStore['keytar']> {
    if (this.keytar) return this.keytar;
    try {
      const mod = await import('keytar');
      this.keytar = (mod.default ?? (mod as any)) as KeychainStore['keytar'];
      return this.keytar;
    } catch (err) {
      logger.warn('keytar not available; OS keychain disabled', {
        message: (err as Error).message,
      });
      return null;
    }
  }

  async load(): Promise<string | null> {
    const keytar = await this.ensureKeytar();
    if (!keytar) return null;
    const v = (await keytar.getPassword(this.service, this.account))?.trim();
    return v ? v : null;
  }

  async save(key: string): Promise<void> {
    const keytar = await this.ensureKeytar();
    if (!keytar) {
      throw new Error('keytar is not available; cannot save to OS keychain');
    }
    await keytar.setPassword(this.service, this.account, key);
  }

  async clear(): Promise<void> {
    const keytar = await this.ensureKeytar();
    if (!keytar) return;
    await keytar.deletePassword(this.service, this.account);
  }
}

export function getKeyStore(): KeyStore {
  const config = getConfig();
  const mode = config.auth.keyStore;
  if (mode === 'file') return new FileStore(path.resolve(config.auth.keyFile));
  if (mode === 'keychain') return new KeychainStore();
  return new EnvStore();
}
