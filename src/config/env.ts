import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { z } from 'zod';

export class EnvValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EnvValidationError';
  }
}

// Credenciais e ambiente StarkBank
const starkBankSchema = z.object({
  STARKBANK_PROJECT_ID: z.string().min(1),
  STARKBANK_PRIVATE_KEY: z.string().optional(),
  STARKBANK_PRIVATE_KEY_PATH: z.string().default('privateKey.pem'),
  STARKBANK_ENVIRONMENT: z.enum(['sandbox', 'production']).default('sandbox'),
});

// Infraestrutura (GCP, HTTP, logging, auth interno)
const infraSchema = z.object({
  GCP_PROJECT_ID: z.string().default('unset-gcp-project-id'),
  PORT: z.coerce.number().int().positive().default(8080),
  LOG_LEVEL: z.string().default('info'),
  INTERNAL_AUTH_AUDIENCE: z.string().optional(),
});

// Agendamento de cobrancas
// Regra final do desafio: 8 a 12 invoices por ciclo. Parametrizavel para
// permitir testes com lotes/intervalos menores sem mudar codigo.
const schedulerSchema = z.object({
  SCHEDULER_CYCLE_MINUTES: z.coerce.number().int().positive().default(180),
  SCHEDULER_TOTAL_PERIOD: z.coerce.number().int().positive().default(1440),
  SCHEDULER_START_AT: z.string().optional(),
  SCHEDULER_DEADLINE_GRACE_MINUTES: z.coerce.number().int().min(0).default(1),
  SCHEDULER_MIN_INVOICES: z.coerce.number().int().positive().default(8),
  SCHEDULER_MAX_INVOICES: z.coerce.number().int().positive().default(12),
});

const EnvSchema = starkBankSchema
  .merge(infraSchema)
  .merge(schedulerSchema)
  .refine((data) => data.SCHEDULER_TOTAL_PERIOD >= data.SCHEDULER_CYCLE_MINUTES, {
    message: 'SCHEDULER_TOTAL_PERIOD must be >= SCHEDULER_CYCLE_MINUTES',
  })
  .refine((data) => data.SCHEDULER_MIN_INVOICES <= data.SCHEDULER_MAX_INVOICES, {
    message: 'SCHEDULER_MIN_INVOICES must be <= SCHEDULER_MAX_INVOICES',
  });

type ParsedEnv = z.infer<typeof EnvSchema>;

export type Env = Omit<ParsedEnv, 'STARKBANK_PRIVATE_KEY'> & {
  STARKBANK_PRIVATE_KEY: string;
};

function loadPrivateKey(rawKey: string | undefined, keyPath: string): string {
  const inline = rawKey?.trim();
  if (inline) {
    return inline.replaceAll('\\n', '\n');
  }

  const resolvedPath = isAbsolute(keyPath) ? keyPath : resolve(process.cwd(), keyPath);
  if (!existsSync(resolvedPath)) {
    throw new EnvValidationError(
      `Private key file not found at "${resolvedPath}". Set STARKBANK_PRIVATE_KEY or STARKBANK_PRIVATE_KEY_PATH.`,
    );
  }

  return readFileSync(resolvedPath, 'utf8');
}

export function loadEnv(): Env {
  const parsed = EnvSchema.parse(process.env);

  return {
    ...parsed,
    STARKBANK_PRIVATE_KEY: loadPrivateKey(parsed.STARKBANK_PRIVATE_KEY, parsed.STARKBANK_PRIVATE_KEY_PATH),
  };
}
