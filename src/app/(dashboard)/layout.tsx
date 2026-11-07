import React from "react";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AppShell } from "@/components/layout/AppShell";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  const firstRack = await prisma.rack.findFirst({
    orderBy: { code: "asc" },
    select: { id: true },
  });

  return (
    <AppShell user={user} firstRackId={firstRack?.id}>
      {children}
    </AppShell>
  );
}
