"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AdminUserProvider, useAdminUserContext } from "@/lib/admin-user-context";

const navItems = [
  { label: "Listings", href: "/admin" },
  { label: "Analytics", href: "/admin/analytics" },
];

function NavContent({
  pathname,
  onNavigate,
  onLogout,
}: {
  pathname: string;
  onNavigate?: () => void;
  onLogout: () => void;
}) {
  const { user, setUser, profiles } = useAdminUserContext();
  return (
    <nav className="flex-1 px-3 py-4 space-y-1 flex flex-col">
      {navItems.map((item) => {
        const isActive =
          item.href === "/admin"
            ? pathname === "/admin" || pathname.startsWith("/admin/listings")
            : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={`block px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              isActive
                ? "bg-gray-100 text-gray-900"
                : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
      <div className="flex-1" />
      <div className="px-3 py-2">
        <label className="block text-xs font-medium text-gray-400 mb-1">Logging as</label>
        <select
          value={user?.id ?? ""}
          onChange={(e) => {
            const profile = profiles.find((p) => p.id === e.target.value);
            setUser(profile ?? null);
          }}
          className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-md text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
        >
          <option value="">Select...</option>
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>
      <button
        onClick={onLogout}
        className="w-full px-3 py-2 text-left text-sm font-medium text-gray-600 rounded-md hover:bg-gray-50 hover:text-gray-900 transition-colors"
      >
        Logout
      </button>
    </nav>
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/admin/login";
  }

  return (
    <AdminUserProvider>
    <div className="min-h-screen bg-white lg:flex">
      {/* Mobile header */}
      <div className="lg:hidden flex items-center gap-3 border-b border-gray-200 px-4 py-3">
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 rounded-md text-gray-600 hover:bg-gray-100 transition-colors"
        >
          {mobileMenuOpen ? (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
        <div>
          <Image src="/logo-horiz-black.png" alt="Aufhammer Homes" width={150} height={56} className="h-7 w-auto" />
          <p className="text-[10px] font-medium text-gray-500 tracking-wide uppercase mt-0.5">Listing Activity Tracker</p>
        </div>
      </div>

      {/* Mobile slide-out menu */}
      {mobileMenuOpen && (
        <>
          <div
            className="lg:hidden fixed inset-0 bg-black/30 z-40"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="lg:hidden fixed inset-y-0 left-0 w-64 bg-white border-r border-gray-200 z-50 flex flex-col">
            <div className="px-6 py-5 border-b border-gray-200 flex items-center justify-between">
              <div>
                <Image src="/logo-horiz-black.png" alt="Aufhammer Homes" width={150} height={56} className="h-7 w-auto" />
                <p className="text-[10px] font-medium text-gray-500 tracking-wide uppercase mt-0.5">Listing Activity Tracker</p>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1 rounded-md text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <NavContent
              pathname={pathname}
              onNavigate={() => setMobileMenuOpen(false)}
              onLogout={handleLogout}
            />
          </div>
        </>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 border-r border-gray-200 flex-col flex-shrink-0">
        <div className="px-6 py-5 border-b border-gray-200">
          <Image src="/logo-horiz-black.png" alt="Aufhammer Homes" width={180} height={67} className="h-8 w-auto" />
          <p className="text-[10px] font-medium text-gray-500 tracking-wide uppercase mt-1">Listing Activity Tracker</p>
        </div>
        <NavContent pathname={pathname} onLogout={handleLogout} />
      </aside>

      {/* Main content */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
    </AdminUserProvider>
  );
}
