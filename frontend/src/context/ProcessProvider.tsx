import { createContext, useContext, type ReactNode } from 'react';
import { useProcess } from '../hooks/useProcess.js';

/**
 * App-level process context.
 *
 * Purpose: Keep the recipe → divide → run state (and its 1 s status poll) ALIVE
 *   across page navigation. `useProcess` used to live inside `ProcessWorkspace`,
 *   so leaving the Dashboard unmounted it and reset the run. Mounting this
 *   provider once in the persistent `AppLayout` shell means the run keeps ticking
 *   while you visit Plant / Crane View / etc., and returning shows it still there.
 */
type ProcessContextValue = ReturnType<typeof useProcess>;

const ProcessContext = createContext<ProcessContextValue | null>(null);

export function ProcessProvider({ children }: { children: ReactNode }) {
  const value = useProcess();
  return <ProcessContext.Provider value={value}>{children}</ProcessContext.Provider>;
}

/** Read the shared process state. Throws if used outside the provider. */
export function useProcessContext(): ProcessContextValue {
  const value = useContext(ProcessContext);
  if (!value) throw new Error('useProcessContext must be used within a ProcessProvider');
  return value;
}
