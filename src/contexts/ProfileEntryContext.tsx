import { createContext, useContext, useMemo, useState } from "react";

const ProfileEntryContext = createContext<{
  isOpen: boolean;
  open: () => void;
  close: () => void;
} | null>(null);

type ProfileEntryProviderProps = {
  children: React.ReactNode;
};

export const ProfileEntryProvider = ({ children }: ProfileEntryProviderProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const value = useMemo(
    () => ({
      isOpen,
      open: () => setIsOpen(true),
      close: () => setIsOpen(false),
    }),
    [isOpen]
  );

  return (
    <ProfileEntryContext.Provider value={value}>
      {children}
    </ProfileEntryContext.Provider>
  );
};

export const useProfileEntryOverlay = () => {
  const context = useContext(ProfileEntryContext);
  if (!context) {
    throw new Error("useProfileEntryOverlay must be used within ProfileEntryProvider");
  }
  return context;
};
