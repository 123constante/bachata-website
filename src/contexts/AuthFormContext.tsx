import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type EntryRole = "dancer" | "vendor" | "organiser" | "teacher" | "dj" | "videographer";

type AuthFormState = {
  email: string;
  firstName: string;
  surname: string;
  cityId: string;
  cityName: string;
  otpCode: string;
  role: EntryRole | null;
};

type AuthFormContextValue = {
  formState: AuthFormState;
  setFirstName: (value: string) => void;
  setSurname: (value: string) => void;
  setCityId: (value: string) => void;
  setCityName: (value: string) => void;
  setOtpCode: (value: string) => void;
  setRole: (value: EntryRole | null) => void;
  updateEmail: (value: string) => { changed: boolean; normalized: string };
};

const STORAGE_KEY = "auth_form_state_v1";

const defaultState: AuthFormState = {
  email: "",
  firstName: "",
  surname: "",
  cityId: "",
  cityName: "",
  otpCode: "",
  role: null,
};

const normalizeEmail = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/^mailto:/i, "")
    .replace(/^<+|>+$/g, "")
    .replace(/\s+/g, "");

const AuthFormContext = createContext<AuthFormContextValue | null>(null);

export const AuthFormProvider = ({ children }: { children: ReactNode }) => {
  const [formState, setFormState] = useState<AuthFormState>(defaultState);

  useEffect(() => {
    try {
      let nextState: AuthFormState = { ...defaultState };
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<AuthFormState> | null;
        if (parsed && typeof parsed === "object") {
          nextState = { ...nextState, ...parsed };
        }
      }
      const legacyRole = localStorage.getItem("profile_entry_role") as EntryRole | null;
      if (!nextState.role && legacyRole) {
        nextState = { ...nextState, role: legacyRole };
      }
      setFormState((prev) => ({ ...prev, ...nextState }));
    } catch {
      // Ignore storage errors
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(formState));
    } catch {
      // Ignore storage errors
    }
  }, [formState]);

  const setFirstName = (value: string) => setFormState((prev) => ({ ...prev, firstName: value }));
  const setSurname = (value: string) => setFormState((prev) => ({ ...prev, surname: value }));
  const setCityId = (value: string) => setFormState((prev) => ({ ...prev, cityId: value }));
  const setCityName = (value: string) => setFormState((prev) => ({ ...prev, cityName: value }));
  const setOtpCode = (value: string) => setFormState((prev) => ({ ...prev, otpCode: value }));
  const setRole = (value: EntryRole | null) => setFormState((prev) => ({ ...prev, role: value }));

  const updateEmail = (value: string) => {
    const normalized = normalizeEmail(value);
    const prevNormalized = normalizeEmail(formState.email);
    const changed = normalized !== prevNormalized;
    setFormState((prev) => ({ ...prev, email: normalized }));
    return { changed, normalized };
  };

  const value = useMemo<AuthFormContextValue>(
    () => ({
      formState,
      setFirstName,
      setSurname,
      setCityId,
      setCityName,
      setOtpCode,
      setRole,
      updateEmail,
    }),
    [formState]
  );

  return <AuthFormContext.Provider value={value}>{children}</AuthFormContext.Provider>;
};

export const useAuthForm = () => {
  const context = useContext(AuthFormContext);
  if (!context) {
    throw new Error("useAuthForm must be used within AuthFormProvider");
  }
  return context;
};

export type { AuthFormState, EntryRole };
