import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  ReactNode,
  useEffect,
} from 'react';
import { useLocation } from 'react-router-dom';

type MobileDrawerContextValue = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
};

const MobileDrawerContext = createContext<MobileDrawerContextValue | null>(null);

type MobileDrawerProviderProps = {
  children: ReactNode;
};

export function MobileDrawerProvider({ children }: MobileDrawerProviderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  // Close drawer on route change
  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  const value = useMemo<MobileDrawerContextValue>(
    () => ({ isOpen, open, close, toggle }),
    [isOpen, open, close, toggle]
  );

  return <MobileDrawerContext.Provider value={value}>{children}</MobileDrawerContext.Provider>;
}

export function useMobileDrawer(): MobileDrawerContextValue {
  const ctx = useContext(MobileDrawerContext);
  if (!ctx) {
    throw new Error('useMobileDrawer must be used within MobileDrawerProvider');
  }
  return ctx;
}
