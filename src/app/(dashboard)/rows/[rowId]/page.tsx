"use client";

import { useParams } from "next/navigation";
import { RowView } from "@/components/location/views";

export default function RowPage() {
  const params = useParams<{ rowId: string }>();
  return <RowView rowId={String(params.rowId || "")} />;
}
