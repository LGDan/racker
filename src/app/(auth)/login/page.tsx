"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Server,
  ShieldCheck,
  UserCheck,
  Lock,
  Mail,
  ArrowRight,
  Zap,
  Layers,
  ThermometerSnowflake,
} from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@racker.local");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Sign in failed");
        setLoading(false);
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("Network error while signing in.");
      setLoading(false);
    }
  }

  function fillDemo(role: "ADMIN" | "STANDARD") {
    if (role === "ADMIN") {
      setEmail("admin@racker.local");
      setPassword("admin123");
    } else {
      setEmail("operator@racker.local");
      setPassword("operator123");
    }
    setError(null);
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col lg:flex-row">
      {/* Left Branding & Telemetry Showcase */}
      <div className="lg:w-7/12 p-8 lg:p-16 flex flex-col justify-between bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 border-b lg:border-b-0 lg:border-r border-slate-800 relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-8">
            <div className="h-11 w-11 rounded-xl bg-cyan-500/15 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-lg shadow-cyan-500/10">
              <Server className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight text-white">
                RACKER
              </span>
              <span className="ml-2 text-xs font-semibold uppercase tracking-widest px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                DCIM v2.4
              </span>
            </div>
          </div>

          <h1 className="text-3xl lg:text-5xl font-bold text-white tracking-tight leading-tight max-w-2xl">
            Full-Spectrum Datacenter Infrastructure & Power Chain Control.
          </h1>
          <p className="mt-4 text-slate-400 text-base lg:text-lg max-w-xl leading-relaxed">
            Document sites, buildings, floors, data halls, rows, and racks.
            Interactively patch server PSUs to zero-U PDUs, trace 3-phase L1/L2/L3
            breaker loads to upstream UPS & generators, and monitor real-time
            thermal headroom.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-10 max-w-2xl">
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
              <Zap className="w-5 h-5 text-amber-400 mb-2" />
              <div className="text-sm font-semibold text-white">
                End-to-End Power Chain
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Generators, ATS, Dual-Bus UPS, 3-Phase Panels, Floor Sockets &
                PDUs.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
              <Layers className="w-5 h-5 text-cyan-400 mb-2" />
              <div className="text-sm font-semibold text-white">
                Interactive Rack Studio
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Visual U-slot elevation, point-and-click PSU cord & switch port
                patching.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
              <ThermometerSnowflake className="w-5 h-5 text-emerald-400 mb-2" />
              <div className="text-sm font-semibold text-white">
                Capacity & Thermal SLD
              </div>
              <p className="text-xs text-slate-400 mt-1">
                N+1 CRAC/CRAH cooling margins, phase balance & failure blast
                radius.
              </p>
            </div>
          </div>
        </div>

        <div className="relative z-10 mt-12 pt-6 border-t border-slate-800/80 flex flex-wrap items-center justify-between text-xs text-slate-500 gap-4">
          <span>Multi-User Role-Based Access Control (Admin & Standard)</span>
          <span>LON-DC1 • IAD-DC2 Active Telemetry</span>
        </div>
      </div>

      {/* Right Sign-In Form */}
      <div className="lg:w-5/12 p-8 lg:p-16 flex items-center justify-center">
        <div className="w-full max-w-md space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-white">
              Sign in to Racker Console
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Select a role profile below or enter your operator credentials.
            </p>
          </div>

          {/* Quick Role Switcher Cards */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => fillDemo("ADMIN")}
              className={`p-3.5 rounded-xl border text-left transition-all ${
                email === "admin@racker.local"
                  ? "bg-cyan-500/10 border-cyan-500/60 text-white shadow-sm"
                  : "bg-slate-900/70 border-slate-800 text-slate-300 hover:border-slate-700"
              }`}
            >
              <div className="flex items-center justify-between">
                <ShieldCheck className="w-4 h-4 text-cyan-400" />
                <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300">
                  ADMIN
                </span>
              </div>
              <div className="text-xs font-semibold mt-2">Alex Mercer</div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Full facility, power, cooling & user admin
              </div>
            </button>

            <button
              type="button"
              onClick={() => fillDemo("STANDARD")}
              className={`p-3.5 rounded-xl border text-left transition-all ${
                email === "operator@racker.local"
                  ? "bg-emerald-500/10 border-emerald-500/60 text-white shadow-sm"
                  : "bg-slate-900/70 border-slate-800 text-slate-300 hover:border-slate-700"
              }`}
            >
              <div className="flex items-center justify-between">
                <UserCheck className="w-4 h-4 text-emerald-400" />
                <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                  STANDARD
                </span>
              </div>
              <div className="text-xs font-semibold mt-2">Sam Chen</div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                View all layers; edit in-rack devices & cables
              </div>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-rose-500/15 border border-rose-500/40 text-xs text-rose-200">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="operator-email" className="block text-xs font-medium text-slate-300 mb-1.5">
                Operator Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  id="operator-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
                  placeholder="admin@racker.local"
                />
              </div>
            </div>

            <div>
              <label htmlFor="operator-password" className="block text-xs font-medium text-slate-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  id="operator-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-semibold text-sm flex items-center justify-center gap-2 transition-colors shadow-lg shadow-cyan-500/20"
            >
              {loading ? "Authenticating..." : "Launch DCIM Workspace"}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="p-3.5 rounded-lg bg-slate-900/60 border border-slate-800/80 text-xs text-slate-400 space-y-1">
            <div className="font-medium text-slate-300">
              RBAC Policy Summary:
            </div>
            <div>
              • <strong className="text-cyan-300">Admin</strong>{" "}
              (admin@racker.local / admin123): Full control of sites, rooms,
              upstream generators/UPS/panels, racks, and users.
            </div>
            <div>
              • <strong className="text-emerald-300">Standard</strong>{" "}
              (operator@racker.local / operator123): Full read visibility across
              all facilities; write access scoped to rack devices, PDUs, PSU
              power cords, and switch patching.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
