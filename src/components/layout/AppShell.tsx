"use client";

import React, { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  BarChart3,
  Building2,
  ChevronDown,
  Cpu,
  GitBranch,
  HardDrive,
  LayoutDashboard,
  Library,
  LogOut,
  Menu,
  Network,
  Plus,
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
  type PlanSummary,
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
  const { sites, activePlan, plans, refresh } = useInfrastructure();
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const planMode = Boolean(activePlan);
  const spatial =
    !pathname.startsWith("/admin") &&
    !pathname.startsWith("/catalog") &&
    !pathname.startsWith("/plans");
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
    {
      label: "Plans",
      title: "Infrastructure Plans",
      href: "/plans",
      icon: GitBranch,
      active: pathname.startsWith("/plans"),
    },
  ];

  const headerOffset = planMode ? "6.25rem" : "3.5rem";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-900/95 backdrop-blur">
        <div className="flex h-14 items-center gap-2 px-3">
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
          <ModeSwitcher
            activePlan={activePlan}
            plans={plans}
            open={modeMenuOpen}
            onOpenChange={setModeMenuOpen}
            onChanged={refresh}
          />
          <ThemeToggle />
          {user.role === "ADMIN" && <AdminMenu pathname={pathname} />}
          <AccountMenu user={user} />
        </div>
        {activePlan && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-violet-500/30 bg-violet-500/10 px-3 py-2">
            <p className="text-xs text-violet-100">
              <span className="font-semibold">Plan Mode Active:</span> Editing “{activePlan.name}”
              — changes are isolated from Ops Mode
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/plans?compare=${activePlan.id}`}
                className="inline-flex items-center rounded-md border border-violet-400/40 bg-violet-500/20 px-2.5 py-1 text-[11px] font-semibold text-violet-100 hover:bg-violet-500/30"
              >
                Compare with Ops
              </Link>
              <button
                type="button"
                onClick={() => setModeMenuOpen(true)}
                className="inline-flex items-center rounded-md border border-violet-400/40 bg-violet-500/20 px-2.5 py-1 text-[11px] font-semibold text-violet-100 hover:bg-violet-500/30"
              >
                Switch Plan
              </button>
              <ExitPlanButton onChanged={refresh} />
            </div>
          </div>
        )}
      </header>

      <div className="flex" style={{ minHeight: `calc(100vh - ${headerOffset})` }}>
        {spatial && (
          <>
            {drawerOpen && (
              <button
                type="button"
                aria-label="Close locations"
                className="fixed inset-0 z-30 bg-black/50 lg:hidden"
                style={{ top: headerOffset }}
                onClick={() => setDrawerOpen(false)}
              />
            )}
            <aside
              className={`shrink-0 lg:sticky lg:z-auto lg:self-start ${
                drawerOpen
                  ? "fixed bottom-0 left-0 z-40 flex lg:sticky"
                  : "hidden lg:flex"
              }`}
              style={{
                top: headerOffset,
                height: `calc(100vh - ${headerOffset})`,
              }}
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

async function postPlanAction(body: Record<string, unknown>) {
  const res = await fetch("/api/plans", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "Plan action failed");
  }
  return data;
}

function ModeSwitcher({
  activePlan,
  plans,
  open,
  onOpenChange,
  onChanged,
}: {
  activePlan: PlanSummary | null;
  plans: PlanSummary[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: () => Promise<void>;
}) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const drafts = plans.filter((plan) => plan.status === "DRAFT");

  useEffect(() => {
    function onPointer(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) onOpenChange(false);
    }
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [onOpenChange]);

  async function activate(planId: string | null) {
    await postPlanAction(
      planId ? { action: "ACTIVATE", planId } : { action: "EXIT_PLAN" }
    );
    onOpenChange(false);
    await onChanged();
    router.refresh();
  }

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => onOpenChange(!open)}
        className={`inline-flex max-w-[220px] items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wide ${
          activePlan
            ? "border-violet-400/50 bg-violet-500/20 text-violet-100"
            : "border-emerald-500/40 bg-emerald-500/15 text-emerald-200"
        }`}
      >
        <GitBranch className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">
          {activePlan ? `PLAN MODE · ${activePlan.name}` : "OPS MODE · Production"}
        </span>
        <ChevronDown className="h-3 w-3 shrink-0" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-1 w-72 overflow-hidden rounded-lg border border-slate-700 bg-slate-900 py-1 shadow-xl"
        >
          <div className="border-b border-slate-800 px-3 py-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Workspace mode
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              {activePlan
                ? `Editing isolated plan “${activePlan.name}”.`
                : "You are on the live Ops production source of truth."}
            </p>
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={() => activate(null)}
            className={`flex w-full items-center justify-between px-3 py-2 text-left text-xs ${
              !activePlan
                ? "bg-emerald-500/10 text-emerald-200"
                : "text-slate-300 hover:bg-slate-800"
            }`}
          >
            <span>Ops Mode · Production</span>
            {!activePlan && <span className="text-[10px] font-bold">ACTIVE</span>}
          </button>
          {drafts.length === 0 && (
            <div className="px-3 py-2 text-[11px] text-slate-500">
              No draft plans yet. Create one to start isolated what-if edits.
            </div>
          )}
          {drafts.map((plan) => (
            <button
              key={plan.id}
              type="button"
              role="menuitem"
              onClick={() => activate(plan.id)}
              className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs ${
                activePlan?.id === plan.id
                  ? "bg-violet-500/15 text-violet-100"
                  : "text-slate-300 hover:bg-slate-800"
              }`}
            >
              <span className="truncate">{plan.name}</span>
              {activePlan?.id === plan.id && (
                <span className="shrink-0 text-[10px] font-bold">ACTIVE</span>
              )}
            </button>
          ))}
          <div className="border-t border-slate-800">
            <Link
              href="/plans?new=1"
              role="menuitem"
              onClick={() => onOpenChange(false)}
              className="flex w-full items-center gap-2 px-3 py-2 text-xs text-cyan-300 hover:bg-slate-800"
            >
              <Plus className="h-3.5 w-3.5" />
              New Plan
            </Link>
            <Link
              href="/plans"
              role="menuitem"
              onClick={() => onOpenChange(false)}
              className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800"
            >
              <GitBranch className="h-3.5 w-3.5" />
              Manage plans
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function ExitPlanButton({ onChanged }: { onChanged: () => Promise<void> }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function exit() {
    setSaving(true);
    try {
      await postPlanAction({ action: "EXIT_PLAN" });
      await onChanged();
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <button
      type="button"
      onClick={exit}
      disabled={saving}
      className="inline-flex items-center rounded-md border border-emerald-400/40 bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-100 hover:bg-emerald-500/25 disabled:opacity-50"
    >
      {saving ? "Switching…" : "Exit to Ops Mode"}
    </button>
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
