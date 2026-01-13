/**
 * Client Certificate Management Types
 *
 * Types for managing RSA-2048 X.509 self-signed certificates
 * used for IRC SASL EXTERNAL authentication.
 */

/**
 * Complete certificate information including private key.
 * Used when generating or retrieving full certificate details.
 */
export interface CertificateInfo {
  /** Unique identifier (UUID) */
  id: string;

  /** User-friendly display name (e.g., "My IRC Certificate") */
  name: string;

  /** Common Name (CN) field from certificate (e.g., "user@irc.network") */
  commonName: string;

  /** SHA-256 fingerprint in hex format (lowercase, no colons) */
  fingerprint: string;

  /** Certificate validity start date */
  validFrom: Date;

  /** Certificate validity end date */
  validTo: Date;

  /** PEM-encoded X.509 certificate (public) */
  pemCert: string;

  /** PEM-encoded RSA private key */
  pemKey: string;

  /** Timestamp when certificate was generated */
  createdAt: Date;
}

/**
 * Certificate metadata without private key.
 * Used for listing certificates without exposing private keys.
 */
export interface CertificateMetadata {
  /** Unique identifier (UUID) */
  id: string;

  /** User-friendly display name */
  name: string;

  /** Common Name (CN) field from certificate */
  commonName: string;

  /** SHA-256 fingerprint in hex format (lowercase, no colons) */
  fingerprint: string;

  /** Certificate validity start date */
  validFrom: Date;

  /** Certificate validity end date */
  validTo: Date;

  /** Timestamp when certificate was generated */
  createdAt: Date;
}

/**
 * Options for generating a new certificate
 */
export interface GenerateCertificateOptions {
  /** User-friendly display name */
  name: string;

  /** Common Name (CN) field (e.g., "nick@network" or "username") */
  commonName: string;

  /** Validity period in years (default: 1, max: 10) */
  validityYears?: number;
}

/**
 * Certificate validation status
 */
export interface CertificateValidation {
  /** Whether the certificate is currently valid */
  isValid: boolean;

  /** Whether the certificate has expired */
  isExpired: boolean;

  /** Days until expiration (negative if expired) */
  daysUntilExpiry: number;

  /** Validation error message if invalid */
  error?: string;
}

/**
 * IRC service types that support CertFP
 */
export enum IRCService {
  NICKSERV = 'NickServ',
  CERTFP = 'CertFP',
  HOSTSERV = 'HostServ',
}

/**
 * Fingerprint format options
 */
export enum FingerprintFormat {
  /** Uppercase hex with colons: AA:BB:CC:DD... */
  COLON_SEPARATED_UPPER = 'colon-upper',

  /** Lowercase hex with colons: aa:bb:cc:dd... */
  COLON_SEPARATED_LOWER = 'colon-lower',

  /** Uppercase hex without colons: AABBCCDD... */
  NO_COLON_UPPER = 'no-colon-upper',

  /** Lowercase hex without colons: aabbccdd... */
  NO_COLON_LOWER = 'no-colon-lower',
}
