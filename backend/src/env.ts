import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must contain at least 32 characters'),
  BOOTSTRAP_TOKEN: z.string().min(24, 'BOOTSTRAP_TOKEN must contain at least 24 characters'),
  PORT: z.coerce.number().int().positive().default(8000),
  HOST: z.string().default('0.0.0.0'),
  WEB_ORIGIN: z.string().url().default('http://localhost:3000'),
  TRUSTED_PROXIES: z.string().default(''),
  TOKEN_MINUTES: z.coerce.number().int().positive().max(120).default(30),
  BLOCKCHAIN_RPC_URL: z.string().default(''),
  BLOCKCHAIN_PRIVATE_KEY: z.string().default(''),
  ANCHOR_CONTRACT_ADDRESS: z.string().default(''),
});

export const env = schema.parse(process.env);
