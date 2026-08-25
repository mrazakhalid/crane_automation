import path from 'node:path';
import { MessageSecurityMode, OPCUACertificateManager, SecurityPolicy } from 'node-opcua';
import type { OPCUAClientOptions } from 'node-opcua';
import { env } from '../../config/env.js';

/**
 * OPC UA security helper (protocol-only; HTTP- and business-logic-ignorant).
 *
 * Purpose: Translate our string security mode/policy into node-opcua client
 *   options, and own the persistent PKI store that holds our client's own
 *   application certificate plus the server certs we trust. A real PLC exposes
 *   only *secured* endpoints, so the client must present a certificate; keeping
 *   the PKI on disk means once the PLC trusts our cert it stays trusted.
 */

/** Security modes we support (mirrors node-opcua's `MessageSecurityMode` names). */
export type SecurityModeName = 'None' | 'Sign' | 'SignAndEncrypt';

/** Security policies we support (subset of node-opcua's `SecurityPolicy` names). */
export type SecurityPolicyName =
  | 'None'
  | 'Basic128Rsa15'
  | 'Basic256'
  | 'Basic256Sha256'
  | 'Aes128_Sha256_RsaOaep'
  | 'Aes256_Sha256_RsaPss';

/** Root of the on-disk PKI (own cert + trusted/rejected server certs). */
export const pkiDir = path.resolve(env.OPCUA_PKI_DIR || 'pki');
/** Path to our client's own application certificate — share this with the PLC to trust. */
export const clientCertificateFile = path.join(pkiDir, 'own', 'certs', 'client_certificate.pem');
const privateKeyFile = path.join(pkiDir, 'own', 'private', 'private_key.pem');

let manager: OPCUACertificateManager | null = null;

/** Lazily build + initialise the persistent client certificate manager (memoised). */
async function getCertificateManager(): Promise<OPCUACertificateManager> {
  if (manager) return manager;
  const m = new OPCUACertificateManager({
    rootFolder: pkiDir,
    // Trust the PLC's own certificate on first sight (trust-on-first-use). The
    // reverse — the PLC trusting OUR cert — is a one-time manual step on the PLC
    // (move our cert from its "rejected" to its "trusted" store).
    automaticallyAcceptUnknownCertificate: true,
  });
  await m.initialize();
  manager = m;
  return m;
}

/**
 * Build node-opcua client options for a given security mode/policy.
 * Args: mode/policy — the security to request (must match one the server advertises).
 * Returns: partial `OPCUAClientOptions`; `None` needs no certificate, so the PKI
 *   store is only spun up for secured connections.
 */
export async function securityOptions(
  mode: SecurityModeName,
  policy: SecurityPolicyName,
): Promise<Partial<OPCUAClientOptions>> {
  if (mode === 'None' || policy === 'None') {
    return { securityMode: MessageSecurityMode.None, securityPolicy: SecurityPolicy.None };
  }
  return {
    securityMode: MessageSecurityMode[mode],
    securityPolicy: SecurityPolicy[policy],
    clientCertificateManager: await getCertificateManager(),
    certificateFile: clientCertificateFile,
    privateKeyFile,
  };
}
