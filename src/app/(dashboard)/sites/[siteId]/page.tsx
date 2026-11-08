"use client";

import { useParams } from "next/navigation";
import { SiteView } from "@/components/location/views";

export default function SitePage() {
  const params = useParams<{ siteId: string }>();
  return <SiteView siteId={String(params.siteId || "")} />;
}
