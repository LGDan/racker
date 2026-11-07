"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Server,
  LayoutDashboard,
  Building2,
  Zap,
  Network,
  BarChart3,
  Users,
  LogOut,
  ShieldCheck,
  UserCheck,
  HardDrive,
} from "lucide-react";

interface AppShellProps {
  user: {
    id: string;
    name: string;
    email: string;
    role: "ADMIN" | "STANDARD";
  };
  firstRackId?: string;
  children: React.ReactNode;
}

export function AppShell({ user, firstRackId, children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();

  const navItems = [
    {
      label: "Executive Overview",
      href: "/",
      icon: LayoutDashboard,
      active: pathname === "/",
    },
    {
      label: "Hierarchy & Floor Plans",
      href: "/hierarchy",
      icon: Building2,
      active: pathname.startsWith("/hierarchy"),
    },
    {
      label: "Rack Elevation Studio",
      href: firstRackId ? `/racks/${firstRackId}` : "/racks",
      icon: HardDrive,
      active: pathname.startsWith("/racks"),
    },
    {
      label: "Power Chain & Cooling",
      href: "/power-cooling",
      icon: Zap,
      active: pathname.startsWith("/power-cooling"),
    },
    {
      label: "Layered Diagrams & SLD",
      href: "/diagrams",
      icon: Network,
      active: pathname.startsWith("/diagrams"),
    },
    {
      label: "Capacity & Phase Reports",
      href: "/reports",
      icon: BarChart3,
      active: pathname.startsWith("/reports"),
    },
  ];

  if (user.role === "ADMIN") {
    navItems.push({
      label: "Users & RBAC Audit",
      href: "/admin/users",
      icon: Users,
      active: pathname.startsWith("/admin/users"),
    });
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900/90 border-r border-slate-800 flex flex-col justify-between shrink-0 sticky top-0 h-screen">
        <div>
          {/* Logo Header */}
          <div className="h-16 px-5 flex items-center gap-3 border-b border-slate-800">
            <div className="h-9 w-9 rounded-lg bg-cyan-500/15 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold tracking-tight text-white leading-none">
                RACKER
              </div>
              <div className="text-[10px] text-cyan-400 font-semibold tracking-widest uppercase mt-1">
                DCIM Control Plane
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                    item.active
                      ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 shadow-sm"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User Profile & Role Indicator */}
        <div className="p-3 border-t border-slate-800 space-y-2">
          <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800/90">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-white truncate max-w-[130px]">
                {user.name}
              </span>
              {user.role === "ADMIN" ? (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  <ShieldCheck className="w-3 h-3" />
                  ADMIN
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <UserCheck className="w-3 h-3" />
                  STANDARD
                </span>
              )}
            </div>
            <div className="text-[11px] text-slate-400 truncate">
              {user.email}
            </div>
            <div className="mt-2 pt-2 border-t border-slate-800/80 text-[10px] text-slate-500">
              {user.role === "ADMIN"
                ? "Permissions: Full System & Facility Admin"
                : "Permissions: View All • Edit In-Rack Assets"}
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-rose-300 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 overflow-x-hidden">{children}</main>
    </div>
  );
}
