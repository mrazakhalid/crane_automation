import 'dotenv/config';
import * as z from 'zod';

/**
 * Validated, typed environment configuration.
 *
 * Purpose: Single source of truth for runtime config; fails fast at boot if
 *   any required variable is missing or malformed (no silent bad config).
 * Returns: A frozen `env` object with parsed, typed values.
 * Raises: Exits the process (code 1) when validation fails.
 */
// Use z.object (not strictObject): process.env carries hundreds of OS/npm keys we
// must ignore. Reject-unknown-fields applies to client request bodies, not the env.
const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  CORS_ORIGIN: z.string().min(1).default('http://localhost:5173'),

  // Data layer. STORAGE_DRIVER selects the backend: 'mongo' for the web
  // deployment (default) or 'sqlite' for the offline desktop build. Only the
  // selected driver is loaded at boot (see storage/index.ts), so a web install
  // never needs the SQLite native module and vice-versa.
  STORAGE_DRIVER: z.enum(['mongo', 'sqlite']).default('mongo'),

  // Mongo driver. When MONGODB_URI is empty in dev/test, an in-memory MongoDB is
  // spun up automatically (see storage/mongo/client.ts) so the app runs with zero setup.
  MONGODB_URI: z.string().default(''),
  MONGODB_DB: z.string().min(1).default('crane_automation'),

  // SQLite driver. SQLITE_PATH is the database file path; empty → `data/crane.db`
  // under the process cwd. Use ':memory:' for hermetic tests. The desktop app
  // points this at a file in the OS user-data directory.
  SQLITE_PATH: z.string().default(''),

  // When set, the API also serves the built frontend (SPA) from this directory —
  // used by the packaged desktop app so one process serves UI + API.
  CLIENT_DIR: z.string().default(''),

  // Auth. JWT_SECRET must be long/random in production — never commit a real one.
  JWT_SECRET: z.string().min(16).default('dev-only-insecure-secret-change-me'),
  JWT_EXPIRES_IN: z.string().min(1).default('12h'),

  // Bootstrap super-admin, seeded once if absent (charter: "admin / admin").
  SEED_ADMIN_USERNAME: z.string().min(3).default('admin'),
  SEED_ADMIN_PASSWORD: z.string().min(3).default('admin'),

  // PLC / OPC UA. These are only *default* pre-fills for the PLC page — the running
  // endpoint and NodeIds are chosen live in the UI (the only swap point: OpenPLC v4
  // now → the physical S7-1500 later, with no code change). Set the node defaults to
  // the NodeIds of the variables/tags you exposed on the OPC UA server.
  OPCUA_ENDPOINT: z.string().min(1).default('opc.tcp://localhost:4840'),
  OPCUA_READ_NODE: z.string().min(1).default('ns=1;s=ReadVar'),
  OPCUA_WRITE_NODE: z.string().min(1).default('ns=1;s=WriteVar'),

  // OPC UA security the client requests when opening a session. A real PLC (Siemens
  // S7-1500, hardened OpenPLC) typically exposes ONLY secured endpoints and NO `None`
  // endpoint, so the client MUST match one it advertises — otherwise node-opcua throws
  // "End point must exist … securityMode = None". Default `None` for the local POC.
  OPCUA_SECURITY_MODE: z.enum(['None', 'Sign', 'SignAndEncrypt']).default('None'),
  OPCUA_SECURITY_POLICY: z
    .enum(['None', 'Basic128Rsa15', 'Basic256', 'Basic256Sha256', 'Aes128_Sha256_RsaOaep', 'Aes256_Sha256_RsaPss'])
    .default('None'),
  // Folder for the client's own application certificate + the server certs it trusts.
  // Persisted so once the PLC trusts our cert it stays trusted. Empty → `pki/` under cwd.
  OPCUA_PKI_DIR: z.string().default(''),

  // Line-4 crane batch target: the DB name + namespace used to build the per-task
  // NodeIds when the manager clicks "Send to PLC" — e.g.
  // ns=3;s="Line4Data"."tasks[1]"."station". Namespace 3 = the SIMATIC address space
  // on an S7-1500; the DB name must match the global DB you created in TIA. Change
  // these (not code) if you rename the DB or move to a server with a different index.
  OPCUA_BATCH_NAMESPACE: z.coerce.number().int().min(0).max(65535).default(3),
  OPCUA_BATCH_DB: z.string().min(1).default('Line4Data'),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:\n', z.treeifyError(parsed.error));
  process.exit(1);
}

export const env = Object.freeze(parsed.data);
