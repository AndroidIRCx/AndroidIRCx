import { useEffect, useState } from 'react';
import { layoutService } from '../services/LayoutService';

export const useLayoutConfig = () => {
  const [layoutConfig, setLayoutConfig] = useState(layoutService.getConfig());

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      await layoutService.initialize();
      if (mounted) {
        setLayoutConfig(layoutService.getConfig());
      }
    };

    init();

    const unsubscribe = layoutService.onConfigChange((config) => {
      if (mounted) {
        setLayoutConfig(config);
      }
    });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  return layoutConfig;
};
