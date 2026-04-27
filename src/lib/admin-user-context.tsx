"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

const ADMIN_PROFILES = [
  { id: "will", name: "Will" },
  { id: "assistant", name: "Assistant" },
];

interface AdminUser {
  id: string;
  name: string;
}

const AdminUserContext = createContext<{
  user: AdminUser | null;
  setUser: (user: AdminUser | null) => void;
  profiles: typeof ADMIN_PROFILES;
}>({ user: null, setUser: () => {}, profiles: ADMIN_PROFILES });

export function useAdminUser() {
  const { user } = useContext(AdminUserContext);
  return user;
}

export function useAdminUserContext() {
  return useContext(AdminUserContext);
}

export function AdminUserProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<AdminUser | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("admin_user");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.id && parsed.name) {
          setUserState(parsed);
        }
      } catch {
        // Invalid stored value
      }
    }
  }, []);

  function setUser(u: AdminUser | null) {
    setUserState(u);
    if (u) {
      localStorage.setItem("admin_user", JSON.stringify(u));
    } else {
      localStorage.removeItem("admin_user");
    }
  }

  return (
    <AdminUserContext.Provider value={{ user, setUser, profiles: ADMIN_PROFILES }}>
      {children}
    </AdminUserContext.Provider>
  );
}
