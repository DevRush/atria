/** Route-transition loader — shown automatically while a page's data loads, so
 * moving between screens reads as a smooth, intentional "thinking" beat. */
export default function Loading() {
  return (
    <div className="grid min-h-[70vh] place-items-center">
      <div className="bp-fade-in flex flex-col items-center gap-3">
        <div className="relative h-11 w-11">
          <div className="absolute inset-0 rounded-full border-2 border-border" />
          <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-accent" />
          <div className="absolute inset-0 grid place-items-center">
            <svg width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden>
              <path d="M9 4.2 12.4 13H10.9L9 7.6 7.1 13H5.6L9 4.2Z" fill="var(--accent)" />
            </svg>
          </div>
        </div>
        <div className="text-[12px] text-muted-foreground">Preparing your schedule…</div>
      </div>
    </div>
  );
}
