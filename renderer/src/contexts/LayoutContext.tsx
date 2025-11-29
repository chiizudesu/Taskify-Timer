import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type LayoutMode = 'horizontal' | 'vertical';

interface LayoutContextType {
  layout: LayoutMode;
  setLayout: (layout: LayoutMode) => void;
}

const LayoutContext = createContext<LayoutContextType | undefined>(undefined);

const LAYOUT_STORAGE_KEY = 'time-logger-layout';

export const LayoutProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [layout, setLayoutState] = useState<LayoutMode>(() => {
    // Load from localStorage on mount
    const saved = localStorage.getItem(LAYOUT_STORAGE_KEY);
    return (saved === 'horizontal' || saved === 'vertical') ? saved : 'horizontal';
  });

  const setLayout = (newLayout: LayoutMode) => {
    setLayoutState(newLayout);
    localStorage.setItem(LAYOUT_STORAGE_KEY, newLayout);
    // Also notify main process to resize window
    (window.electronAPI as any)?.windowSetLayout?.(newLayout);
  };

  // Sync with main process on mount
  useEffect(() => {
    const syncLayout = async () => {
      try {
        const config = await (window.electronAPI as any)?.getConfig?.();
        if (config?.layout && (config.layout === 'horizontal' || config.layout === 'vertical')) {
          setLayoutState(config.layout);
          localStorage.setItem(LAYOUT_STORAGE_KEY, config.layout);
        }
      } catch (error) {
        console.error('Failed to sync layout from config:', error);
      }
    };
    syncLayout();
  }, []);

  return (
    <LayoutContext.Provider value={{ layout, setLayout }}>
      {children}
    </LayoutContext.Provider>
  );
};

export const useLayout = (): LayoutContextType => {
  const context = useContext(LayoutContext);
  if (!context) {
    throw new Error('useLayout must be used within a LayoutProvider');
  }
  return context;
};

