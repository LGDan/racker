"use client";

import React, { useCallback, useEffect, useState } from "react";

const SLOTS = [
  { kind: "PHOTO", label: "Photo", empty: "No photo yet." },
  { kind: "MAP", label: "Map", empty: "No map yet." },
  { kind: "FLOORPLAN", label: "Floor plan", empty: "No floor plan yet." },
] as const;

interface MediaItem {
  id: string;
  kind: string;
  fileName: string;
  mimeType: string;
  updatedAt: string;
}

export function LocationMediaGallery({
  ownerType,
  ownerId,
  admin,
}: {
  ownerType: "SITE" | "BUILDING";
  ownerId: string;
  admin: boolean;
}) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyKind, setBusyKind] = useState<string | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ ownerType, ownerId });
    const res = await fetch(`/api/location-media?${params}`);
    if (!res.ok) return;
    const data = await res.json();
    setItems(data.items || []);
  }, [ownerType, ownerId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function upload(kind: string, file: File | undefined) {
    if (!file) return;
    setError(null);
    setBusyKind(kind);
    try {
      const body = new FormData();
      body.set("ownerType", ownerType);
      body.set("ownerId", ownerId);
      body.set("kind", kind);
      body.set("file", file);
      const res = await fetch("/api/location-media", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Upload failed");
        return;
      }
      await load();
    } finally {
      setBusyKind(null);
    }
  }

  async function remove(item: MediaItem) {
    if (!window.confirm(`Remove this ${labelFor(item.kind).toLowerCase()}?`)) return;
    setError(null);
    setBusyKind(item.kind);
    try {
      const res = await fetch(`/api/location-media?id=${encodeURIComponent(item.id)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not remove the file");
        return;
      }
      await load();
    } finally {
      setBusyKind(null);
    }
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-white">Reference files</h2>
      {error && (
        <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          {error}
        </p>
      )}
      <div className="grid gap-3 lg:grid-cols-3">
        {SLOTS.map((slot) => {
          const item = items.find((entry) => entry.kind === slot.kind);
          const busy = busyKind === slot.kind;
          return (
            <article
              key={slot.kind}
              className="flex flex-col rounded-xl border border-slate-800 bg-slate-900/80 p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                  {slot.label}
                </h3>
                {admin && (
                  <div className="flex items-center gap-2">
                    <label className="cursor-pointer text-[11px] font-medium text-cyan-300 hover:text-cyan-200">
                      {item ? "Replace" : "Upload"}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,.jpg,.jpeg,.png,.webp,.gif,.pdf"
                        className="sr-only"
                        disabled={busy}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          event.target.value = "";
                          void upload(slot.kind, file);
                        }}
                      />
                    </label>
                    {item && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void remove(item)}
                        className="text-[11px] text-slate-400 hover:text-rose-300 disabled:opacity-50"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                )}
              </div>
              <div className="mt-3 flex min-h-40 flex-1 items-center justify-center overflow-hidden rounded-lg border border-slate-800 bg-slate-950">
                {item ? (
                  <MediaPreview item={item} label={slot.label} />
                ) : (
                  <p className="px-3 text-center text-xs text-slate-500">{slot.empty}</p>
                )}
              </div>
              {item && (
                <p className="mt-2 truncate text-[11px] text-slate-500" title={item.fileName}>
                  {item.fileName}
                </p>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function MediaPreview({ item, label }: { item: MediaItem; label: string }) {
  const src = `/api/location-media/${item.id}?v=${encodeURIComponent(item.updatedAt)}`;
  if (item.mimeType === "application/pdf") {
    return (
      <div className="flex h-48 w-full flex-col">
        <iframe title={label} src={src} className="min-h-0 w-full flex-1 bg-white" />
        <a
          href={src}
          target="_blank"
          rel="noreferrer"
          className="px-2 py-1 text-center text-[11px] text-cyan-300 hover:text-cyan-200"
        >
          Open PDF
        </a>
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={label} className="max-h-56 w-full object-contain" />
  );
}

function labelFor(kind: string) {
  return SLOTS.find((slot) => slot.kind === kind)?.label || "file";
}
