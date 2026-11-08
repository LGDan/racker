"use client";

import { useParams } from "next/navigation";
import { FloorView } from "@/components/location/views";

export default function FloorPage() {
  const params = useParams<{ floorId: string }>();
  return <FloorView floorId={String(params.floorId || "")} />;
}
