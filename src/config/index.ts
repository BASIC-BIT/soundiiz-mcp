import { readFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { z } from 'zod';
import pkg from '../../package.json' with { type: 'json' };
import defaultsJson from './defaults.json' with { type: 'json' };

const ConfigBaseSchema = z
  .object({
    api: z
      .object({
        baseUrl: z.string().min(1),
        userAgent: z.string().min(1),
        timeoutMs: z.number().int().positive(),
      })
      .strict(),
    auth: z
      .object({
        keyStore: z.enum(['env', 'file', 'keychain']),
        keyFile: z.string(),
      })
      .strict(),
    writes: z
      .object({
        allow: z.boolean(),
        confirmDestructive: z.boolean(),
        confirmTtlMs: z.number().int().positive(),
      })
      .strict(),
    syncs: z
      .object({
        allowlist: z.array(z.number().int()),
      })
      .strict(),
    smartlinks: z
      .object({
        allowlist: z.array(z.number().int()),
      })
      .strict(),
    rateLimit: z
      .object({
        perMinute: z.number().int().positive(),
      })
      .strict(),
    cache: z
      .object({
        enabled: z.boolean(),
        ttls: z
          .object({
            me: z.number().int().positive(),
            syncsList: z.number().int().positive(),
            syncDetail: z.number().int().positive(),
            smartlinksList: z.number().int().positive(),
            smartlinkDetail: z.number().int().positive(),
          })
          .strict(),
      })
      .strict(),
    rawTools: z
      .object({
        enabled: z.boolean(),
      })
      .strict(),
    generatedTools: z
      .object({
        read: z.boolean(),
        write: z.boolean(),
      })
      .strict(),
    logging: z
      .object({
        level: z.enum(['debug', 'info', 'warn', 'error']),
      })
      .strict(),
  })
  .strict();

const ConfigSchema = ConfigBaseSchema.transform((config) => {
  const next = structuredClone(config);
  next.api.userAgent = next.api.userAgent.replace('{version}', pkg.version ?? '0.0.0');
  next.auth.keyFile = expandHome(next.auth.keyFile);
  return next;
});

export type Config = z.output<typeof ConfigSchema>;
type ConfigBase = z.infer<typeof ConfigBaseSchema>;
type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends (infer U)[] ? U[] : T[K] extends object ? DeepPartial<T[K]> : T[K];
};

const defaults: Config = ConfigSchema.parse(defaultsJson);

const EnvString = z.preprocess((value) => {
  if (typeof value !== 'string') return value;
  return value.trim();
}, z.string().min(1).optional());

const EnvLevel = z.preprocess((value) => {
  if (typeof value !== 'string') return value;
  return value.trim().toLowerCase();
}, z.enum(['debug', 'info', 'warn', 'error']).optional());

const EnvKeyStore = z.preprocess((value) => {
  if (typeof value !== 'string') return value;
  return value.trim().toLowerCase();
}, z.enum(['env', 'file', 'keychain']).optional());

const EnvBoolean = z.preprocess((value) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(trimmed)) return true;
  if (['0', 'false', 'no', 'off'].includes(trimmed)) return false;
  return value;
}, z.boolean().optional());

const EnvPositiveInt = z.preprocess((value) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return Number(trimmed);
}, z.number().int().positive().optional());

const EnvIntList = z.preprocess((value) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return [];
  return trimmed
    .split(/[,\s]+/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => Number(entry));
}, z.array(z.number().int()).optional());

const EnvSchema = z
  .object({
    SOUNDIIZ_MCP_API_BASE: EnvString,
    SOUNDIIZ_MCP_USER_AGENT: EnvString,
    SOUNDIIZ_MCP_LOG_LEVEL: EnvLevel,
    SOUNDIIZ_MCP_KEY_STORE: EnvKeyStore,
    SOUNDIIZ_MCP_KEY_FILE: EnvString,
    SOUNDIIZ_MCP_ALLOW_WRITES: EnvBoolean,
    SOUNDIIZ_MCP_CONFIRM_DESTRUCTIVE: EnvBoolean,
    SOUNDIIZ_MCP_SYNC_ALLOWLIST: EnvIntList,
    SOUNDIIZ_MCP_SMARTLINK_ALLOWLIST: EnvIntList,
    SOUNDIIZ_MCP_RATE_LIMIT_PER_MINUTE: EnvPositiveInt,
    SOUNDIIZ_MCP_CACHE_ENABLED: EnvBoolean,
    SOUNDIIZ_MCP_ENABLE_RAW_CALL: EnvBoolean,
    SOUNDIIZ_MCP_DISABLE_GENERATED_READ_TOOLS: EnvBoolean,
    SOUNDIIZ_MCP_DISABLE_GENERATED_WRITE_TOOLS: EnvBoolean,
  })
  .strict();

type EnvValues = z.infer<typeof EnvSchema>;
const ENV_KEYS = Object.keys(EnvSchema.shape) as (keyof EnvValues)[];

let cachedBase: ConfigBase | null = null;
let cachedConfigPath: string | null = null;

function expandHome(value: string): string {
  if (!value) return value;
  if (value === '~') return os.homedir();
  if (value.startsWith('~/') || value.startsWith('~\\')) {
    return path.join(os.homedir(), value.slice(2));
  }
  return value;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function resolveConfigFilePath(): string | null {
  const raw = process.env.SOUNDIIZ_MCP_CONFIG_FILE;
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return path.isAbsolute(trimmed) ? trimmed : path.resolve(process.cwd(), trimmed);
}

function readConfigFile(filePath: string | null): DeepPartial<ConfigBase> {
  if (!filePath) return {};
  try {
    const content = readFileSync(filePath, 'utf8');
    const parsed: unknown = JSON.parse(content);
    if (!isPlainObject(parsed)) {
      throw new Error('Config file must contain a JSON object.');
    }
    return parsed as DeepPartial<ConfigBase>;
  } catch (err) {
    if ((err as { code?: string }).code === 'ENOENT') return {};
    throw err;
  }
}

function mergeConfig<T>(base: T, override: DeepPartial<T>): T {
  if (!isPlainObject(base) || !isPlainObject(override)) {
    return (override ?? base) as T;
  }
  const result: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (value === undefined) continue;
    const existing = (base as Record<string, unknown>)[key];
    if (Array.isArray(value)) {
      result[key] = value.slice();
    } else if (isPlainObject(value) && isPlainObject(existing)) {
      result[key] = mergeConfig(existing, value);
    } else {
      result[key] = value;
    }
  }
  return result as T;
}

function readEnv(): EnvValues {
  const envInput: Partial<Record<keyof EnvValues, string | undefined>> = {};
  for (const key of ENV_KEYS) envInput[key] = process.env[key];
  try {
    return EnvSchema.parse(envInput);
  } catch (err) {
    if (err instanceof z.ZodError) {
      const issues = err.issues.map((issue) => issue.path.join('.') || 'env');
      throw new Error(`Invalid environment variables: ${issues.join(', ')}`);
    }
    throw err;
  }
}

function envOverrides(env: EnvValues): DeepPartial<ConfigBase> {
  const o: DeepPartial<ConfigBase> = {};
  if (env.SOUNDIIZ_MCP_API_BASE) o.api = { ...o.api, baseUrl: env.SOUNDIIZ_MCP_API_BASE };
  if (env.SOUNDIIZ_MCP_USER_AGENT) o.api = { ...o.api, userAgent: env.SOUNDIIZ_MCP_USER_AGENT };
  if (env.SOUNDIIZ_MCP_LOG_LEVEL) o.logging = { level: env.SOUNDIIZ_MCP_LOG_LEVEL };
  if (env.SOUNDIIZ_MCP_KEY_STORE) o.auth = { ...o.auth, keyStore: env.SOUNDIIZ_MCP_KEY_STORE };
  if (env.SOUNDIIZ_MCP_KEY_FILE) o.auth = { ...o.auth, keyFile: env.SOUNDIIZ_MCP_KEY_FILE };
  if (env.SOUNDIIZ_MCP_ALLOW_WRITES !== undefined) {
    o.writes = { ...o.writes, allow: env.SOUNDIIZ_MCP_ALLOW_WRITES };
  }
  if (env.SOUNDIIZ_MCP_CONFIRM_DESTRUCTIVE !== undefined) {
    o.writes = { ...o.writes, confirmDestructive: env.SOUNDIIZ_MCP_CONFIRM_DESTRUCTIVE };
  }
  if (env.SOUNDIIZ_MCP_SYNC_ALLOWLIST !== undefined) {
    o.syncs = { allowlist: env.SOUNDIIZ_MCP_SYNC_ALLOWLIST };
  }
  if (env.SOUNDIIZ_MCP_SMARTLINK_ALLOWLIST !== undefined) {
    o.smartlinks = { allowlist: env.SOUNDIIZ_MCP_SMARTLINK_ALLOWLIST };
  }
  if (env.SOUNDIIZ_MCP_RATE_LIMIT_PER_MINUTE !== undefined) {
    o.rateLimit = { perMinute: env.SOUNDIIZ_MCP_RATE_LIMIT_PER_MINUTE };
  }
  if (env.SOUNDIIZ_MCP_CACHE_ENABLED !== undefined) {
    o.cache = { ...o.cache, enabled: env.SOUNDIIZ_MCP_CACHE_ENABLED };
  }
  if (env.SOUNDIIZ_MCP_ENABLE_RAW_CALL !== undefined) {
    o.rawTools = { enabled: env.SOUNDIIZ_MCP_ENABLE_RAW_CALL };
  }
  if (env.SOUNDIIZ_MCP_DISABLE_GENERATED_READ_TOOLS !== undefined) {
    o.generatedTools = {
      ...o.generatedTools,
      read: !env.SOUNDIIZ_MCP_DISABLE_GENERATED_READ_TOOLS,
    };
  }
  if (env.SOUNDIIZ_MCP_DISABLE_GENERATED_WRITE_TOOLS !== undefined) {
    o.generatedTools = {
      ...o.generatedTools,
      write: !env.SOUNDIIZ_MCP_DISABLE_GENERATED_WRITE_TOOLS,
    };
  }
  return o;
}

function loadBaseConfig(): ConfigBase {
  const configPath = resolveConfigFilePath();
  if (cachedBase && cachedConfigPath === configPath) return cachedBase;
  const fileConfig = readConfigFile(configPath);
  cachedBase = mergeConfig(defaults, fileConfig);
  cachedConfigPath = configPath;
  return cachedBase;
}

export function getConfig(): Config {
  const base = loadBaseConfig();
  const env = readEnv();
  const merged = mergeConfig(base, envOverrides(env));
  return ConfigSchema.parse(merged);
}

export function resetConfigCacheForTest(): void {
  cachedBase = null;
  cachedConfigPath = null;
}
