import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadEnv, EnvValidationError } from '../../../src/config/env';

const ORIGINAL_ENV = { ...process.env };

function resetEnv(overrides: Record<string, string | undefined>) {
  process.env = { ...ORIGINAL_ENV };
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

describe('loadEnv', () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('carrega com sucesso quando STARKBANK_PROJECT_ID esta definido', () => {
    resetEnv({ STARKBANK_PROJECT_ID: 'proj-123' });
    const env = loadEnv();
    expect(env.STARKBANK_PROJECT_ID).toBe('proj-123');
    expect(env.STARKBANK_ENVIRONMENT).toBe('sandbox');
    expect(env.PORT).toBe(8080);
    expect(env.SCHEDULER_CYCLE_MINUTES).toBe(180);
    expect(env.SCHEDULER_TOTAL_PERIOD).toBe(1440);
  });

  it('lanca erro quando STARKBANK_PROJECT_ID esta ausente', () => {
    resetEnv({ STARKBANK_PROJECT_ID: undefined });
    expect(() => loadEnv()).toThrow();
  });

  it('lanca erro quando SCHEDULER_TOTAL_PERIOD < SCHEDULER_CYCLE_MINUTES', () => {
    resetEnv({
      STARKBANK_PROJECT_ID: 'proj-123',
      SCHEDULER_CYCLE_MINUTES: '180',
      SCHEDULER_TOTAL_PERIOD: '60',
    });
    expect(() => loadEnv()).toThrow();
  });

  it('aceita STARKBANK_ENVIRONMENT=production', () => {
    resetEnv({ STARKBANK_PROJECT_ID: 'proj-123', STARKBANK_ENVIRONMENT: 'production' });
    expect(loadEnv().STARKBANK_ENVIRONMENT).toBe('production');
  });

  it('rejeita STARKBANK_ENVIRONMENT invalido', () => {
    resetEnv({ STARKBANK_PROJECT_ID: 'proj-123', STARKBANK_ENVIRONMENT: 'staging' });
    expect(() => loadEnv()).toThrow();
  });

  it('faz coerce de PORT para numero', () => {
    resetEnv({ STARKBANK_PROJECT_ID: 'proj-123', PORT: '3000' });
    expect(loadEnv().PORT).toBe(3000);
  });

  it('usa a chave inline quando STARKBANK_PRIVATE_KEY esta definida', () => {
    resetEnv({ STARKBANK_PROJECT_ID: 'proj-123', STARKBANK_PRIVATE_KEY: 'inline-pem' });
    expect(loadEnv().STARKBANK_PRIVATE_KEY).toBe('inline-pem');
  });

  it('expande \\n escapado na chave inline', () => {
    resetEnv({ STARKBANK_PROJECT_ID: 'proj-123', STARKBANK_PRIVATE_KEY: 'linha1\\nlinha2' });
    expect(loadEnv().STARKBANK_PRIVATE_KEY).toBe('linha1\nlinha2');
  });

  it('le a chave de STARKBANK_PRIVATE_KEY_PATH quando nao ha chave inline', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'stark-env-'));
    const keyPath = join(tempDir, 'key.pem');
    writeFileSync(keyPath, 'pem-do-arquivo');
    try {
      resetEnv({
        STARKBANK_PROJECT_ID: 'proj-123',
        STARKBANK_PRIVATE_KEY: undefined,
        STARKBANK_PRIVATE_KEY_PATH: keyPath,
      });
      expect(loadEnv().STARKBANK_PRIVATE_KEY).toBe('pem-do-arquivo');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('lanca EnvValidationError quando arquivo de chave nao existe', () => {
    resetEnv({
      STARKBANK_PROJECT_ID: 'proj-123',
      STARKBANK_PRIVATE_KEY: undefined,
      STARKBANK_PRIVATE_KEY_PATH: join(tmpdir(), 'stark-env-missing-key.pem'),
    });
    expect(() => loadEnv()).toThrow(EnvValidationError);
  });

  it('rejeita SCHEDULER_CYCLE_MINUTES nao inteiro ou negativo', () => {
    resetEnv({
      STARKBANK_PROJECT_ID: 'proj-123',
      STARKBANK_PRIVATE_KEY: 'inline-pem',
      SCHEDULER_CYCLE_MINUTES: '-5',
    });
    expect(() => loadEnv()).toThrow();
  });

  it('rejeita SCHEDULER_MIN_INVOICES maior que SCHEDULER_MAX_INVOICES', () => {
    resetEnv({
      STARKBANK_PROJECT_ID: 'proj-123',
      STARKBANK_PRIVATE_KEY: 'inline-pem',
      SCHEDULER_MIN_INVOICES: '20',
      SCHEDULER_MAX_INVOICES: '10',
    });
    expect(() => loadEnv()).toThrow();
  });
});
