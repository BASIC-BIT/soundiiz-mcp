import { getKeyStore, type KeyStore } from './keyStore.js';
import { logger } from '../infra/logger.js';

class AuthManager {
  private store: KeyStore;
  private memKey: string | null = null;

  constructor() {
    this.store = getKeyStore();
  }

  async init(): Promise<void> {
    try {
      this.memKey = await this.store.load();
      if (this.memKey) {
        logger.debug('Loaded Soundiiz API key', { length: this.memKey.length });
      } else {
        logger.warn(
          'No Soundiiz API key found. Set SOUNDIIZ_API_KEY (env), or use file/keychain key store.'
        );
      }
    } catch (err) {
      logger.warn('Failed to initialize key store', { message: (err as Error).message });
    }
  }

  hasKey(): boolean {
    return Boolean(this.memKey);
  }

  getKey(): string | null {
    return this.memKey;
  }

  async setKey(key: string): Promise<void> {
    const trimmed = key.trim();
    if (!trimmed) throw new Error('Empty API key');
    this.memKey = trimmed;
    await this.store.save(trimmed);
  }

  async clear(): Promise<void> {
    this.memKey = null;
    await this.store.clear();
  }
}

export const authManager = new AuthManager();
