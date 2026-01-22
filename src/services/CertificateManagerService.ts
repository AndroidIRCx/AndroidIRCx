/**
 * Certificate Manager Service
 *
 * Manages RSA-2048 X.509 self-signed certificates for IRC SASL EXTERNAL authentication.
 * - Generates certificates with node-forge
 * - Stores certificates in secure storage (Keychain)
 * - Computes SHA-256 fingerprints
 * - Formats fingerprints for IRC services
 */

import * as forge from 'node-forge';
import { secureStorageService } from './SecureStorageService';
import {
  CertificateInfo,
  CertificateMetadata,
  GenerateCertificateOptions,
  CertificateValidation,
  FingerprintFormat,
} from '../types/certificate';

// Storage keys
const CERT_INDEX_KEY = 'certs:index';
const CERT_KEY_PREFIX = 'cert:';

class CertificateManagerService {
  /**
   * Generate a new RSA-2048 self-signed X.509 certificate
   */
  async generateCertificate(
    options: GenerateCertificateOptions
  ): Promise<CertificateInfo> {
    const { name, commonName, validityYears = 1 } = options;

    // Validate inputs
    if (!name || name.trim().length === 0) {
      throw new Error('Certificate name is required');
    }
    if (!commonName || commonName.trim().length === 0) {
      throw new Error('Common Name (CN) is required');
    }
    if (validityYears < 1 || validityYears > 10) {
      throw new Error('Validity period must be between 1 and 10 years');
    }

    try {
      console.log('CertificateManager: Generating RSA-2048 keypair...');

      // Generate RSA-2048 keypair
      const keys = forge.pki.rsa.generateKeyPair({ bits: 2048, workers: -1 });

      // Create certificate
      const cert = forge.pki.createCertificate();
      cert.publicKey = keys.publicKey;
      cert.serialNumber = this.generateSerialNumber();

      // Set validity period
      const now = new Date();
      cert.validity.notBefore = now;
      const notAfter = new Date();
      notAfter.setFullYear(now.getFullYear() + validityYears);
      cert.validity.notAfter = notAfter;

      // Set subject (who the cert is issued to)
      const attrs = [
        {
          name: 'commonName',
          value: commonName.trim(),
        },
        {
          name: 'organizationName',
          value: 'AndroidIRCX',
        },
        {
          shortName: 'OU',
          value: 'IRC Client Certificate',
        },
      ];
      cert.setSubject(attrs);

      // Set issuer (same as subject for self-signed)
      cert.setIssuer(attrs);

      // Add extensions
      cert.setExtensions([
        {
          name: 'basicConstraints',
          cA: false,
        },
        {
          name: 'keyUsage',
          digitalSignature: true,
          keyEncipherment: true,
        },
        {
          name: 'extKeyUsage',
          clientAuth: true,
        },
      ]);

      // Self-sign with SHA-256
      cert.sign(keys.privateKey, forge.md.sha256.create());

      console.log('CertificateManager: Certificate generated successfully');

      // Convert to PEM format
      const pemCert = forge.pki.certificateToPem(cert);
      const pemKey = forge.pki.privateKeyToPem(keys.privateKey);

      // Calculate fingerprint
      const fingerprint = this.getFingerprint(pemCert);

      // Create certificate info
      const id = this.generateUUID();
      const certInfo: CertificateInfo = {
        id,
        name: name.trim(),
        commonName: commonName.trim(),
        fingerprint,
        validFrom: cert.validity.notBefore,
        validTo: cert.validity.notAfter,
        pemCert,
        pemKey,
        createdAt: new Date(),
      };

      // Save to secure storage
      await this.saveCertificate(certInfo);

      console.log(
        `CertificateManager: Certificate saved with ID: ${id}, fingerprint: ${fingerprint}`
      );

      return certInfo;
    } catch (error) {
      console.error('CertificateManager: Failed to generate certificate:', error);
      throw new Error(`Failed to generate certificate: ${error}`);
    }
  }

  /**
   * List all certificates (metadata only, no private keys)
   */
  async listCertificates(): Promise<CertificateMetadata[]> {
    try {
      const indexJson = await secureStorageService.getSecret(CERT_INDEX_KEY);
      if (!indexJson) {
        return [];
      }

      const index: CertificateMetadata[] = JSON.parse(indexJson);

      // Parse dates (JSON serialization converts them to strings)
      return index.map(cert => ({
        ...cert,
        validFrom: new Date(cert.validFrom),
        validTo: new Date(cert.validTo),
        createdAt: new Date(cert.createdAt),
      }));
    } catch (error) {
      console.error('CertificateManager: Failed to list certificates:', error);
      return [];
    }
  }

  /**
   * Get full certificate by ID (including private key)
   */
  async getCertificate(id: string): Promise<CertificateInfo | null> {
    try {
      const certJson = await secureStorageService.getSecret(`${CERT_KEY_PREFIX}${id}`);
      if (!certJson) {
        return null;
      }

      const cert: CertificateInfo = JSON.parse(certJson);

      // Parse dates
      return {
        ...cert,
        validFrom: new Date(cert.validFrom),
        validTo: new Date(cert.validTo),
        createdAt: new Date(cert.createdAt),
      };
    } catch (error) {
      console.error(`CertificateManager: Failed to get certificate ${id}:`, error);
      return null;
    }
  }

  /**
   * Delete certificate
   */
  async deleteCertificate(id: string): Promise<void> {
    try {
      // Remove from index
      const index = await this.listCertificates();
      const updatedIndex = index.filter(cert => cert.id !== id);
      await secureStorageService.setSecret(CERT_INDEX_KEY, JSON.stringify(updatedIndex));

      // Remove certificate data
      await secureStorageService.removeSecret(`${CERT_KEY_PREFIX}${id}`);

      console.log(`CertificateManager: Certificate ${id} deleted`);
    } catch (error) {
      console.error(`CertificateManager: Failed to delete certificate ${id}:`, error);
      throw new Error(`Failed to delete certificate: ${error}`);
    }
  }

  /**
   * Get SHA-256 fingerprint for certificate
   * @returns fingerprint hex string, or null if PEM is invalid
   */
  getFingerprint(pemCert: string): string | null {
    try {
      // Validate input
      if (!pemCert || typeof pemCert !== 'string' || !pemCert.trim()) {
        console.warn('CertificateManager: Empty or invalid PEM input');
        return null;
      }

      // Check for basic PEM structure
      if (!pemCert.includes('-----BEGIN CERTIFICATE-----') ||
          !pemCert.includes('-----END CERTIFICATE-----')) {
        console.warn('CertificateManager: PEM does not contain certificate markers');
        return null;
      }

      // Parse PEM certificate
      const cert = forge.pki.certificateFromPem(pemCert);

      // Get DER-encoded certificate
      const derBytes = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();

      // Calculate SHA-256 hash
      const md = forge.md.sha256.create();
      md.update(derBytes);
      const digest = md.digest();

      // Convert to hex (lowercase, no colons)
      return digest.toHex();
    } catch (error) {
      console.error('CertificateManager: Failed to calculate fingerprint:', error);
      return null;
    }
  }

  /**
   * Format fingerprint according to specified format
   */
  formatFingerprint(
    fingerprint: string,
    format: FingerprintFormat = FingerprintFormat.COLON_SEPARATED_UPPER
  ): string {
    // Remove any existing colons
    const clean = fingerprint.replace(/:/g, '');

    let formatted = clean;

    // Apply case transformation
    if (
      format === FingerprintFormat.COLON_SEPARATED_UPPER ||
      format === FingerprintFormat.NO_COLON_UPPER
    ) {
      formatted = formatted.toUpperCase();
    } else {
      formatted = formatted.toLowerCase();
    }

    // Add colons if needed
    if (
      format === FingerprintFormat.COLON_SEPARATED_UPPER ||
      format === FingerprintFormat.COLON_SEPARATED_LOWER
    ) {
      // Insert colon every 2 characters
      formatted = formatted.match(/.{1,2}/g)?.join(':') || formatted;
    }

    return formatted;
  }

  /**
   * Validate certificate
   */
  validateCertificate(cert: CertificateInfo | CertificateMetadata): CertificateValidation {
    const now = new Date();
    const validTo = new Date(cert.validTo);
    const isExpired = now > validTo;
    const isValid = !isExpired && now >= new Date(cert.validFrom);

    const msPerDay = 24 * 60 * 60 * 1000;
    const daysUntilExpiry = Math.floor((validTo.getTime() - now.getTime()) / msPerDay);

    return {
      isValid,
      isExpired,
      daysUntilExpiry,
      error: isExpired ? 'Certificate has expired' : undefined,
    };
  }

  /**
   * Extract fingerprint from existing PEM certificate
   * @returns fingerprint hex string, or null if PEM is invalid
   */
  extractFingerprintFromPem(pemCert: string): string | null {
    return this.getFingerprint(pemCert);
  }

  // Private helper methods

  /**
   * Save certificate to secure storage
   */
  private async saveCertificate(cert: CertificateInfo): Promise<void> {
    // Save full certificate data
    await secureStorageService.setSecret(
      `${CERT_KEY_PREFIX}${cert.id}`,
      JSON.stringify(cert)
    );

    // Update index (metadata only, no private key)
    const index = await this.listCertificates();
    const metadata: CertificateMetadata = {
      id: cert.id,
      name: cert.name,
      commonName: cert.commonName,
      fingerprint: cert.fingerprint,
      validFrom: cert.validFrom,
      validTo: cert.validTo,
      createdAt: cert.createdAt,
    };
    index.push(metadata);
    await secureStorageService.setSecret(CERT_INDEX_KEY, JSON.stringify(index));
  }

  /**
   * Generate UUID v4
   */
  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /**
   * Generate certificate serial number (random 64-bit positive integer)
   */
  private generateSerialNumber(): string {
    const bytes = forge.random.getBytesSync(8);
    const hex = forge.util.bytesToHex(bytes);
    // Ensure positive by setting first bit to 0
    const serial = '0' + hex.substring(1);
    return serial;
  }
}

export const certificateManager = new CertificateManagerService();
export default certificateManager;
