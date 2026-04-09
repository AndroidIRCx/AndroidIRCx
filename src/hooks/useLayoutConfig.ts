/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { useEffect, useState } from 'react';
import { layoutService } from '../services/LayoutService';

export const useLayoutConfig = () => {
  const [layoutConfig, setLayoutConfig] = useState(layoutService.getConfig());

  useEffect(() => {
    let mounted = true;
    let receivedChange = false;

    const unsubscribe = layoutService.onConfigChange(config => {
      if (mounted) {
        receivedChange = true;
        setLayoutConfig(config);
      }
    });

    const init = async () => {
      await layoutService.initialize();
      if (mounted && !receivedChange) {
        setLayoutConfig(layoutService.getConfig());
      }
    };

    init();

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  return layoutConfig;
};
