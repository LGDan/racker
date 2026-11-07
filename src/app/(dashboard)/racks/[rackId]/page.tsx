"use client";

import { useParams } from "next/navigation";
import { RackElevationStudio } from "@/components/rack/RackElevationStudio";

export default function RackStudioPage() {
  const params = useParams<{ rackId: string }>();
  const rackId = String(params.rackId || "");
  if (!rackId) return null;
  return <RackElevationStudio rackId={rackId} />;
}
