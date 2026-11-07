import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function RacksIndexRedirectPage() {
  const firstRack = await prisma.rack.findFirst({
    orderBy: { code: "asc" },
    select: { id: true },
  });

  if (firstRack) {
    redirect(`/racks/${firstRack.id}`);
  }
  redirect("/hierarchy");
}
