"use client";

/** Print / Save-as-PDF trigger. Hidden on paper via the print:hidden utility. */
export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="print:hidden rounded-r1 bg-accent px-3 py-1.5 text-[12px] font-medium text-white hover:opacity-90"
    >
      Print / Save as PDF
    </button>
  );
}
