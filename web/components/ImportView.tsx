"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ImportIssue, ParseResult } from "@/lib/import-parse";
import { FAMILY_CLASS } from "@/lib/view";
import type { ServiceFamily } from "@/lib/types";

const ISSUE_STYLE: Record<ImportIssue["kind"], string> = {
  unreadable: "text-status-block",
  footnote: "text-status-warn",
  gap: "text-muted-foreground",
};

export function ImportView() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [parse, setParse] = useState<ParseResult | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [busy, setBusy] = useState<"parse" | "commit" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ program: string; fellows: number; callGenerated: boolean } | null>(null);

  async function onFile(f: File) {
    setError(null);
    setParse(null);
    setDone(null);
    setFileName(f.name);
    setBusy("parse");
    try {
      const fd = new FormData();
      fd.append("file", f);
      const r = await fetch("/api/import/parse", { method: "POST", body: fd });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Could not parse the file");
      setParse(data as ParseResult);
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(null);
    }
  }

  async function commit() {
    if (!parse) return;
    setBusy("commit");
    setError(null);
    try {
      const r = await fetch("/api/import/commit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parse),
      });
      const data = await r.json();
      if (!r.ok || !data.ok) throw new Error(data.error ?? "Import failed");
      setDone({ program: data.program, fellows: data.fellows, callGenerated: data.callGenerated });
      setTimeout(() => router.push("/"), 1400);
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-[900px] space-y-4 px-4 py-6">
      <div>
        <h1 className="text-[15px] font-semibold tracking-tight">Import a schedule</h1>
        <p className="text-[12px] text-muted-foreground">
          Upload last year&apos;s block schedule as an Excel file. Atria reads the grid — merged cells,
          footnotes, code legend and all — and shows you exactly what it found before anything is saved.{" "}
          Don&apos;t have one handy?{" "}
          <a href="/api/import/template" download className="text-accent underline underline-offset-2 hover:opacity-80">
            Download a blank template
          </a>
          .
        </p>
      </div>

      {/* dropzone */}
      <div
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files?.[0];
          if (f) onFile(f);
        }}
        className="cursor-pointer rounded-r2 border border-dashed border-border-strong bg-surface px-6 py-8 text-center hover:border-accent"
      >
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
        />
        <div className="text-[13px] font-medium">
          {fileName ? fileName : "Drop an Excel schedule here, or click to choose"}
        </div>
        <div className="mt-0.5 text-[11.5px] text-muted-foreground">
          {busy === "parse" ? "Reading…" : ".xlsx with a “Fellow” column and block columns"}
        </div>
      </div>

      {error && (
        <div className="rounded-r1 border border-status-block-border bg-status-block-bg px-3 py-2 text-[12px] text-status-block">
          {error}
        </div>
      )}

      {done && (
        <div className="rounded-r2 border border-status-ok-bg bg-status-ok-bg/50 px-4 py-3 text-[12.5px] text-status-ok">
          Imported <span className="font-semibold">{done.program}</span> — {done.fellows} fellows
          {done.callGenerated ? ", with a generated call & jeopardy schedule" : " (blocks only)"}. Opening
          the schedule…
        </div>
      )}

      {parse && !done && (
        <div className="space-y-4">
          {/* stats */}
          <div className="flex flex-wrap gap-2">
            <Stat n={parse.stats.fellows} label="fellows" />
            <Stat n={parse.stats.blocks} label="blocks" />
            <Stat n={parse.stats.assignments} label="assignments" />
            <Stat n={parse.stats.issues} label="to review" warn={parse.stats.issues > 0} />
          </div>

          {/* detected rotations */}
          <div>
            <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-faint-foreground">
              Rotations detected
            </div>
            <div className="flex flex-wrap gap-1.5">
              {parse.services.map((s) => (
                <span
                  key={s.code}
                  className={`inline-flex items-center gap-1 rounded-r1 border px-1.5 py-0.5 font-mono text-[10.5px] ${
                    FAMILY_CLASS[s.family as ServiceFamily] ?? FAMILY_CLASS.consult
                  }`}
                >
                  {s.code}
                  <span className="font-sans text-faint-foreground">· {s.name}</span>
                </span>
              ))}
            </div>
          </div>

          {/* roster */}
          <div>
            <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-faint-foreground">
              Roster
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-0.5 sm:grid-cols-3">
              {parse.people.map((p) => (
                <div key={p.id} className="flex items-center gap-2 text-[12px]">
                  <span className="text-[10px] text-faint-foreground tnum">{p.level}</span>
                  <span>{p.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* issues */}
          {parse.issues.length > 0 && (
            <div>
              <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-faint-foreground">
                Needs your eyes · {parse.issues.length}
              </div>
              <ul className="space-y-0.5 rounded-r2 border border-border bg-surface px-3 py-2">
                {parse.issues.slice(0, 10).map((iss, i) => (
                  <li key={i} className={`text-[11.5px] ${ISSUE_STYLE[iss.kind]}`}>
                    {iss.text}
                  </li>
                ))}
                {parse.issues.length > 10 && (
                  <li className="text-[11px] text-faint-foreground">+ {parse.issues.length - 10} more…</li>
                )}
              </ul>
            </div>
          )}

          <div className="flex items-center gap-3 border-t border-border pt-3">
            <button
              onClick={commit}
              disabled={busy === "commit"}
              className="rounded-r1 bg-accent px-3.5 py-1.5 text-[12px] font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {busy === "commit" ? "Building call schedule…" : "Import this program"}
            </button>
            <span className="text-[11px] text-muted-foreground">
              Creates the roster and blocks, then generates a call &amp; jeopardy schedule around them.
              Replaces the current sample program.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ n, label, warn }: { n: number; label: string; warn?: boolean }) {
  return (
    <div className="rounded-r2 border border-border bg-surface px-3 py-1.5">
      <span className={`text-[16px] font-semibold tnum ${warn ? "text-status-warn" : ""}`}>{n}</span>{" "}
      <span className="text-[11.5px] text-muted-foreground">{label}</span>
    </div>
  );
}
