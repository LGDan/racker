"use client";

import React, { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  BarChart3,
  Building2,
  ChevronDown,
  Cpu,
  HardDrive,
  LayoutDashboard,
  Library,
  LogOut,
  Menu,
  Network,
  Server,
  Settings2,
  ShieldCheck,
  ThermometerSnowflake,
  UserCheck,
  Users,
  Zap,
} from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { LocationTree } from "./LocationTree";
import {
  firstRackInRoom,
  InfrastructureProvider,
  roomIdForRack,
  useInfrastructure,
} from "./infrastructure-context";

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

const TREE_COLLAPSED_KEY = "racker.locationTree.collapsed";

export function AppShell({ user, firstRackId, children }: AppShellProps) {
  return (
    <Suspense fallback={null}>
      <InfrastructureProvider role={user.role}>
        <ShellFrame user={user} firstRackId={firstRackId}>
          {children}
        </ShellFrame>
      </InfrastructureProvider>
    </Suspense>
  );
}

function ShellFrame({ user, firstRackId, children }: AppShellProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { sites } = useInfrastructure();
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const spatial = !pathname.startsWith("/admin") && !pathname.startsWith("/catalog");
  const roomQuery = searchParams.get("room") || "";
  const rackMatch = pathname.match(/^\/racks\/([^/]+)/);
  const openRack = rackMatch?.[1] || "";
  const roomFromRack = openRack ? roomIdForRack(sites, openRack) : undefined;
  const floorRoom = roomQuery || roomFromRack || "";
  const rackTarget =
    openRack || (roomQuery ? firstRackInRoom(sites, roomQuery) : undefined) || firstRackId;

  useEffect(() => {
    setCollapsed(window.localStorage.getItem(TREE_COLLAPSED_KEY) === "1");
  }, []);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname, searchParams]);

  function toggleCollapsed() {
    setCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem(TREE_COLLAPSED_KEY, next ? "1" : "0");
      return next;
    });
  }

  const tabs = [
    {
      label: "Overview",
      title: "Executive Overview",
      href: "/",
      icon: LayoutDashboard,
      active: pathname === "/",
    },
    {
      label: "Floor",
      title: "Hierarchy & Floor Plans",
      href: floorRoom ? `/hierarchy?room=${floorRoom}` : "/hierarchy",
      icon: Building2,
      active:
        pathname.startsWith("/hierarchy") ||
        pathname.startsWith("/sites") ||
        pathname.startsWith("/buildings") ||
        pathname.startsWith("/floors") ||
        pathname.startsWith("/rows"),
    },
    {
      label: "Rack",
      title: "Rack Elevation Studio",
      href: rackTarget ? `/racks/${rackTarget}` : "/racks",
      icon: HardDrive,
      active: pathname.startsWith("/racks"),
    },
    {
      label: "Appliances",
      title: "Installed Rack Appliances",
      href: "/appliances",
      icon: Cpu,
      active: pathname.startsWith("/appliances"),
    },
    {
      label: "Catalog",
      title: "Appliance Catalog",
      href: "/catalog",
      icon: Library,
      active: pathname.startsWith("/catalog"),
    },
    {
      label: "Power",
      title: "Electrical Power Chain",
      href: "/power-cooling",
      icon: Zap,
      active: pathname.startsWith("/power-cooling"),
    },
    {
      label: "Cooling",
      title: "Cooling & Thermal Plant",
      href: "/cooling",
      icon: ThermometerSnowflake,
      active: pathname.startsWith("/cooling"),
    },
    {
      label: "Diagrams",
      title: "Layered Diagrams & SLD",
      href: "/diagrams",
      icon: Network,
      active: pathname.startsWith("/diagrams"),
    },
    {
      label: "Reports",
      title: "Capacity & Phase Reports",
      href: "/reports",
      icon: BarChart3,
      active: pathname.startsWith("/reports"),
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b border-slate-800 bg-slate-900/95 px-3 backdrop-blur">
        {spatial && (
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-2 py-1.5 text-xs text-slate-300 lg:hidden"
          >
            <Menu className="h-3.5 w-3.5" />
            Locations
          </button>
        )}
        <Link href="/" className="flex shrink-0 items-center gap-2 pr-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg border border-cyan-500/40 bg-cyan-500/15 text-cyan-400">
            <Server className="h-4 w-4" />
          </span>
          <span className="hidden font-bold tracking-tight text-white sm:block">RACKER</span>
        </Link>
        <nav className="min-w-0 flex-1 overflow-x-auto" aria-label="Sections">
          <div className="flex w-max items-center gap-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <Link
                  key={tab.label}
                  href={tab.href}
                  title={tab.title}
                  aria-current={tab.active ? "page" : undefined}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium ${
                    tab.active
                      ? "border border-cyan-500/30 bg-cyan-500/15 text-cyan-300"
                      : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  {tab.label}
                </Link>
              );
            })}
          </div>
        </nav>
        <ThemeToggle />
        {user.role === "ADMIN" && <AdminMenu pathname={pathname} />}
        <AccountMenu user={user} />
      </header>

      <div className="flex min-h-[calc(100vh-3.5rem)]">
        {spatial && (
          <>
            {drawerOpen && (
              <button
                type="button"
                aria-label="Close locations"
                className="fixed inset-0 top-14 z-30 bg-black/50 lg:hidden"
                onClick={() => setDrawerOpen(false)}
              />
            )}
            <aside
              className={`shrink-0 lg:sticky lg:top-14 lg:z-auto lg:h-[calc(100vh-3.5rem)] lg:self-start ${
                drawerOpen
                  ? "fixed bottom-0 left-0 top-14 z-40 flex lg:sticky"
                  : "hidden lg:flex"
              }`}
            >
              <LocationTree collapsed={collapsed && !drawerOpen} onCollapse={toggleCollapsed} />
            </aside>
          </>
        )}
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}

function AdminMenu({ pathname }: { pathname: string }) {
  const active = pathname.startsWith("/admin");
  return (
    <MenuButton
      label="Admin"
      active={active}
      icon={<Settings2 className="h-3.5 w-3.5" />}
    >
      <MenuLink href="/admin/system" active={pathname.startsWith("/admin/system")}>
        System Management
      </MenuLink>
      <MenuLink href="/admin/users" active={pathname.startsWith("/admin/users")}>
        <Users className="h-3.5 w-3.5" />
        Users & RBAC Audit
      </MenuLink>
    </MenuButton>
  );
}

function AccountMenu({
  user,
}: {
  user: AppShellProps["user"];
}) {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <MenuButton label={user.name}>
      <div className="border-b border-slate-800 px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-xs font-semibold text-white">{user.name}</span>
          {user.role === "ADMIN" ? (
            <span className="inline-flex items-center gap-1 rounded border border-cyan-500/30 bg-cyan-500/20 px-1.5 py-0.5 text-[10px] font-bold text-cyan-300">
              <ShieldCheck className="h-3 w-3" />
              ADMIN
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded border border-emerald-500/30 bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">
              <UserCheck className="h-3 w-3" />
              STANDARD
            </span>
          )}
        </div>
        <div className="mt-1 truncate text-[11px] text-slate-400">{user.email}</div>
        <div className="mt-2 text-[10px] text-slate-500">
          {user.role === "ADMIN"
            ? "Permissions: Full System & Facility Admin"
            : "Permissions: View All • Edit In-Rack Assets"}
        </div>
      </div>
      <button
        type="button"
        onClick={handleLogout}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-slate-300 hover:bg-rose-500/10 hover:text-rose-200"
      >
        <LogOut className="h-3.5 w-3.5" />
        Sign Out
      </button>
    </MenuButton>
  );
}

function MenuButton({
  label,
  active,
  icon,
  children,
}: {
  label: string;
  active?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointer(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, []);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
        className={`inline-flex max-w-[160px] items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium ${
          active || open
            ? "border-cyan-500/30 bg-cyan-500/15 text-cyan-200"
            : "border-slate-700 text-slate-300 hover:bg-slate-800"
        }`}
      >
        {icon}
        <span className="truncate">{label}</span>
        <ChevronDown className="h-3 w-3 shrink-0" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-1 w-64 overflow-hidden rounded-lg border border-slate-700 bg-slate-900 py-1 shadow-xl"
          onClick={() => setOpen(false)}
        >
          {children}
        </div>
      )}
    </div>
  );
}

function MenuLink({
  href,
  active,
  children,
}: {
  href: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      className={`flex items-center gap-2 px-3 py-2 text-xs ${
        active ? "bg-cyan-500/10 text-cyan-200" : "text-slate-300 hover:bg-slate-800"
      }`}
    >
      {children}
    </Link>
  );
}
