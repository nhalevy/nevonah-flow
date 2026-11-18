"use client";

import { createContext, useContext, useState } from "react";

// "Which task is open" lives apart from the main store, so opening the panel
// re-renders only the panel — not every list on the screen.

const OpenIdContext = createContext<string | null>(null);
const SetOpenContext = createContext<(id: string | null) => void>(() => {});

export function OpenTaskProvider({ children }: { children: React.ReactNode }) {
  const [id, setId] = useState<string | null>(null);
  return (
    <SetOpenContext.Provider value={setId}>
      <OpenIdContext.Provider value={id}>{children}</OpenIdContext.Provider>
    </SetOpenContext.Provider>
  );
}

export const useOpenTaskId = () => useContext(OpenIdContext);
export const useOpenTask = () => useContext(SetOpenContext);
