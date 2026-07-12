"use client";
import { useEffect, useState } from "react";

type Active = { id: string; label: string; createdAt: string; expiresAt: string | null };

/** Mint / rotate / revoke the secure who's-on-call share link. The full link is
 * shown once at creation; after that only its status is known. */
export function ShareLinkManager() {
  const [active, setActive] = useState<Active | null>(null);
  const [freshLink, setFreshLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loaded, setLoaded] = useState(false);

  async function refresh() {
    try {
      const r = await fetch("/api/share", { cache: "no-store" });
      const d = await r.json();
      setActive(d.tokens?.[0] ?? null);
    } catch {
      /* ignore */
    } finally {
      setLoaded(true);
    }
  }
  useEffect(() => {
    refresh();
  }, []);

  async function create() {
    setBusy(true);
    setFreshLink(null);
    try {
      const r = await fetch("/api/share", { method: "POST" });
      const d = await r.json();
      if (d.ok) {
        setFreshLink(d.link);
        await refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  async function revoke() {
    setBusy(true);
    try {
      await fetch("/api/share/revoke", { method: "POST" });
      setFreshLink(null);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  function copy() {
    if (!freshLink) return;
    navigator.clipboard?.writeText(freshLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (!loaded) return null;

  return (
    <div className="rounded-r2 border border-border bg-surface px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-[12.5px] font-medium">Shareable link</div>
          <div className="text-[11px] text-muted-foreground">
            A revocable link showing only names, dates, and services — safe to send to operators.
          </div>
        </div>
        {active ? (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] text-status-ok">
              <span className="h-1.5 w-1.5 rounded-full bg-status-ok" /> live
            </span>
            <button onClick={create} disabled={busy} className="rounded-r1 border border-border px-2 py-1 text-[11.5px] text-muted-foreground hover:text-foreground disabled:opacity-50">
              Rotate
            </button>
            <button onClick={revoke} disabled={busy} className="rounded-r1 border border-border px-2 py-1 text-[11.5px] text-status-block hover:opacity-80 disabled:opacity-50">
              Revoke
            </button>
          </div>
        ) : (
          <button onClick={create} disabled={busy} className="rounded-r1 bg-accent px-3 py-1.5 text-[12px] font-medium text-white hover:opacity-90 disabled:opacity-50">
            {busy ? "Creating…" : "Create link"}
          </button>
        )}
      </div>

      {freshLink && (
        <div className="mt-3 rounded-r1 border border-status-ok-bg bg-status-ok-bg/40 px-3 py-2">
          <div className="mb-1 text-[10.5px] font-medium uppercase tracking-wide text-status-ok">
            Copy now — this link is shown only once
          </div>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded bg-surface px-2 py-1 font-mono text-[11px]">{freshLink}</code>
            <button onClick={copy} className="shrink-0 rounded-r1 bg-accent px-2.5 py-1 text-[11.5px] font-medium text-white">
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-faint-foreground">Calendar feed</span>
            <code className="min-w-0 flex-1 truncate rounded bg-surface px-2 py-0.5 font-mono text-[10.5px] text-muted-foreground">
              {freshLink.replace("/p/", "/api/feed/")}
            </code>
          </div>
          <div className="mt-1 text-[10px] text-faint-foreground">
            Subscribe in any calendar app · revoking this link stops the feed too.
          </div>
        </div>
      )}
    </div>
  );
}
