/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { useCallback, useEffect, useRef } from 'react';
import {
  iapConnectionService,
  type IapConnectionLease,
} from '../services/IapConnectionService';

export const useIapConnectionLease = () => {
  const leaseRef = useRef<IapConnectionLease | null>(null);
  const acquiringRef = useRef<Promise<void> | null>(null);
  const generationRef = useRef(0);
  const mountedRef = useRef(true);

  const releaseIapConnection = useCallback(() => {
    generationRef.current += 1;
    const lease = leaseRef.current;
    leaseRef.current = null;
    if (lease) {
      lease.release().catch(error => {
        console.warn('Failed to release IAP connection:', error);
      });
    }
  }, []);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      releaseIapConnection();
    };
  }, [releaseIapConnection]);

  const ensureIapConnection = useCallback(async () => {
    if (leaseRef.current) {
      return;
    }

    if (!acquiringRef.current) {
      const generation = generationRef.current;
      acquiringRef.current = iapConnectionService
        .acquire()
        .then(lease => {
          if (!mountedRef.current || generation !== generationRef.current) {
            lease.release().catch(error => {
              console.warn('Failed to release stale IAP connection:', error);
            });
            return;
          }
          leaseRef.current = lease;
        })
        .finally(() => {
          acquiringRef.current = null;
        });
    }

    await acquiringRef.current;
  }, []);

  return {
    ensureIapConnection,
    releaseIapConnection,
  };
};
