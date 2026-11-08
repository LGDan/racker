import { PrismaClient } from "@prisma/client";
import { cookies } from "next/headers";

export const ACTIVE_PLAN_COOKIE = "racker_active_plan";

const GLOBAL_MODELS = new Set([
  "user",
  "auditLog",
  "infrastructurePlan",
  "locationMedia",
]);

const globalForPrisma = globalThis as unknown as {
  publicPrisma: PrismaClient | undefined;
  planClients: Map<string, PrismaClient> | undefined;
};

export const publicPrisma =
  globalForPrisma.publicPrisma ??
  new PrismaClient({
    log: ["error"],
  });

const planClients =
  globalForPrisma.planClients ?? new Map<string, PrismaClient>();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.publicPrisma = publicPrisma;
  globalForPrisma.planClients = planClients;
}

export function schemaUrl(schemaName: string): string {
  const base =
    process.env.DATABASE_URL ||
    "postgresql://racker:racker@db:5432/racker?schema=public";
  try {
    const parsed = new URL(base);
    parsed.searchParams.set("schema", schemaName);
    return parsed.toString();
  } catch {
    if (base.includes("schema=")) {
      return base.replace(/schema=[^&]+/, `schema=${schemaName}`);
    }
    const sep = base.includes("?") ? "&" : "?";
    return `${base}${sep}schema=${schemaName}`;
  }
}

export function getPrismaForSchema(schemaName: string): PrismaClient {
  if (!schemaName || schemaName === "public") return publicPrisma;
  if (!/^plan_[a-z0-9_]+$/i.test(schemaName)) return publicPrisma;
  const cached = planClients.get(schemaName);
  if (cached) return cached;
  const client = new PrismaClient({
    datasources: { db: { url: schemaUrl(schemaName) } },
    log: ["error"],
  });
  planClients.set(schemaName, client);
  return client;
}

export async function disconnectPlanSchema(schemaName: string) {
  const cached = planClients.get(schemaName);
  if (cached) {
    planClients.delete(schemaName);
    await cached.$disconnect().catch(() => {});
  }
}

export function getActivePlanSchemaFromCookie(): string | null {
  try {
    const store = cookies();
    const raw = store.get(ACTIVE_PLAN_COOKIE)?.value?.trim() || "";
    if (!raw) return null;
    const schemaName = raw.startsWith("plan_") ? raw : `plan_${raw}`;
    if (!/^plan_[a-z0-9_]+$/i.test(schemaName)) return null;
    return schemaName;
  } catch {
    return null;
  }
}

export function getActivePlanIdFromCookie(): string | null {
  try {
    const store = cookies();
    const raw = store.get(ACTIVE_PLAN_COOKIE)?.value?.trim() || "";
    if (!raw) return null;
    return raw.replace(/^plan_/, "");
  } catch {
    return null;
  }
}

export function getActivePrismaClient(): PrismaClient {
  const schemaName = getActivePlanSchemaFromCookie();
  if (!schemaName) return publicPrisma;
  return getPrismaForSchema(schemaName);
}

export const prisma: PrismaClient = new Proxy(publicPrisma, {
  get(_target, prop, receiver) {
    if (typeof prop === "string" && GLOBAL_MODELS.has(prop)) {
      const value = Reflect.get(publicPrisma, prop, receiver);
      return typeof value === "function" ? value.bind(publicPrisma) : value;
    }
    const active = getActivePrismaClient();
    const value = Reflect.get(active, prop, active);
    return typeof value === "function" ? value.bind(active) : value;
  },
});
