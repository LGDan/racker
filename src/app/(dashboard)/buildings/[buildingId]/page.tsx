"use client";

import { useParams } from "next/navigation";
import { BuildingView } from "@/components/location/views";

export default function BuildingPage() {
  const params = useParams<{ buildingId: string }>();
  return <BuildingView buildingId={String(params.buildingId || "")} />;
}
