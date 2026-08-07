import { v4 as uuidv4 } from 'uuid';

export interface SignedLicense {
  client_id: string;
  machine_fingerprint: string;
  node_role: string;
  allowed_pos_count: number;
  valid_until: string;
  grace_period_days: number;
  features: string[];
  signature?: string;
}

export class LicenseService {
  /**
   * Generates a deterministic device fingerprint hash
   */
  static getMachineFingerprint(): string {
    const rawId = [
      navigator.userAgent,
      navigator.hardwareConcurrency || '4',
      screen.width + 'x' + screen.height,
      navigator.language
    ].join('|');

    let hash = 0;
    for (let i = 0; i < rawId.length; i++) {
      const char = rawId.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return 'HW-' + Math.abs(hash).toString(16).toUpperCase();
  }

  /**
   * Verifies the local license file payload & expiration date
   */
  static verifyLicense(licensePayload: SignedLicense): {
    isValid: boolean;
    reason?: string;
    daysRemaining: number;
    isInGracePeriod: boolean;
  } {
    const now = new Date();
    const expiryDate = new Date(licensePayload.valid_until);
    const timeDiffMs = expiryDate.getTime() - now.getTime();
    const daysRemaining = Math.ceil(timeDiffMs / (1000 * 60 * 60 * 24));

    // Hardware fingerprint check
    const currentFingerprint = this.getMachineFingerprint();
    if (licensePayload.machine_fingerprint !== '*' && licensePayload.machine_fingerprint !== currentFingerprint) {
      return {
        isValid: false,
        reason: 'Hardware fingerprint mismatch. This license is bound to another device.',
        daysRemaining: 0,
        isInGracePeriod: false
      };
    }

    if (daysRemaining < -licensePayload.grace_period_days) {
      return {
        isValid: false,
        reason: 'Subscription expired and grace period elapsed.',
        daysRemaining,
        isInGracePeriod: false
      };
    }

    const isInGracePeriod = daysRemaining <= 0 && daysRemaining >= -licensePayload.grace_period_days;

    return {
      isValid: true,
      daysRemaining,
      isInGracePeriod
    };
  }
}
