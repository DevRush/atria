/**
 * Excel → structured schedule parser (the onboarding wedge). Reads a coordinator's
 * real block-schedule spreadsheet — merged level cells, footnote markers, a code
 * legend — and produces a confirmable structure, flagging anything it couldn't read
 * (SPEC §4: surface ambiguity, never silently drop a cell). Deterministic, no LLM;
 * an AI parser can slot in later behind the same confirm-before-commit contract.
 */
import ExcelJS from "exceljs";

export type ParsedPerson = { id: string; name: string; level: string };
export type ParsedBlock = { index: number; label: string; dateRange: string };
export type ParsedService = { code: string; name: string; family: string };
export type ParsedAssignment = { personId: string; blockIndex: number; code: string };
export type ImportIssue = { kind: "unreadable" | "footnote" | "gap"; text: string };

export type ParseResult = {
  programName: string;
  people: ParsedPerson[];
  blocks: ParsedBlock[];
  services: ParsedService[];
  assignments: ParsedAssignment[];
  issues: ImportIssue[];
  stats: { fellows: number; blocks: number; assignments: number; issues: number };
};

const FAMILY: Record<string, string> = {
  CATH: "procedural",
  EP: "procedural",
  ECHO: "imaging",
  NUC: "imaging",
  CCU: "inpatient",
  CONSULT: "consult",
  RESEARCH: "ambulatory",
  CLINIC: "ambulatory",
};

const SERVICE_NAME: Record<string, string> = {
  CATH: "Cath Lab",
  ECHO: "Echo Lab",
  CCU: "CCU",
  CONSULT: "Consults",
  EP: "EP",
  NUC: "Nuclear Cardiology",
  RESEARCH: "Research",
};

function cellText(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "object" && v !== null && "richText" in v) {
    return (v as { richText: { text: string }[] }).richText.map((t) => t.text).join("");
  }
  if (typeof v === "object" && v !== null && "text" in v) return String((v as { text: string }).text);
  if (typeof v === "object" && v !== null && "result" in v) return String((v as { result: unknown }).result);
  return String(v).trim();
}

function personId(name: string, taken: Set<string>): string {
  const last = name.trim().split(/\s+/).pop() ?? name;
  let base = "p_" + last.toLowerCase().replace(/[^a-z0-9]/g, "");
  let id = base;
  let i = 2;
  while (taken.has(id)) id = `${base}${i++}`;
  taken.add(id);
  return id;
}

export async function parseScheduleWorkbook(buffer: ArrayBuffer): Promise<ParseResult> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as never);

  // 1) find the sheet + header row containing a "Fellow" column
  let sheet: ExcelJS.Worksheet | undefined;
  let headerRow = -1;
  let fellowCol = -1;
  for (const ws of wb.worksheets) {
    for (let r = 1; r <= Math.min(ws.rowCount, 12); r++) {
      for (let c = 1; c <= Math.min(ws.columnCount, 12); c++) {
        if (cellText(ws.getCell(r, c).value).toLowerCase() === "fellow") {
          sheet = ws;
          headerRow = r;
          fellowCol = c;
          break;
        }
      }
      if (sheet) break;
    }
    if (sheet) break;
  }
  if (!sheet || headerRow < 0) {
    throw new Error("Could not find a schedule grid — expected a column headed “Fellow”.");
  }

  const levelCol = fellowCol > 1 ? fellowCol - 1 : -1;
  const programName = cellText(sheet.getCell(1, 1).value) || sheet.name;

  // 2) block columns = header cells after "Fellow" that look like a block
  // ("B1", "Block 2", …). Anything else (a "Notes" column, etc.) is ignored.
  const blocks: ParsedBlock[] = [];
  const blockCols: number[] = [];
  const blockRe = /^(b|block)\s*\d+/i;
  const ignoredCols: string[] = [];
  for (let c = fellowCol + 1; c <= sheet.columnCount; c++) {
    const raw = cellText(sheet.getCell(headerRow, c).value);
    if (!raw) continue;
    const [label, dateRange] = raw.split(/\n/).map((s) => s.trim());
    if (!blockRe.test(label)) {
      ignoredCols.push(label);
      continue;
    }
    blocks.push({ index: blocks.length + 1, label, dateRange: dateRange ?? "" });
    blockCols.push(c);
  }

  // 3) walk data rows
  const people: ParsedPerson[] = [];
  const assignments: ParsedAssignment[] = [];
  const issues: ImportIssue[] = [];
  const serviceCodes = new Set<string>();
  const taken = new Set<string>();
  let lastLevel = "";

  for (let r = headerRow + 1; r <= sheet.rowCount; r++) {
    let name = cellText(sheet.getCell(r, fellowCol).value);
    if (!name) continue;
    if (/[*†‡]/.test(name)) {
      const clean = name.replace(/[*†‡]/g, "").trim();
      issues.push({ kind: "footnote", text: `“${clean}” (row ${r}) has a footnote marker — please confirm any special condition.` });
      name = clean;
    }
    const levelRaw = levelCol > 0 ? cellText(sheet.getCell(r, levelCol).value) : "";
    const level = levelRaw || lastLevel || "F1";
    lastLevel = level;

    const id = personId(name, taken);
    people.push({ id, name, level });

    blocks.forEach((b, i) => {
      const col = blockCols[i];
      const code = cellText(sheet.getCell(r, col).value).toUpperCase().replace(/[*†‡]/g, "").trim();
      if (!code) {
        issues.push({ kind: "gap", text: `${name} · ${b.label}: blank cell (no rotation).` });
        return;
      }
      if (!(code in SERVICE_NAME) && !(code in FAMILY)) {
        // flagged for the coordinator to map; not imported as a real assignment
        issues.push({ kind: "unreadable", text: `${name} · ${b.label}: “${code}” isn’t a known rotation — needs mapping.` });
        return;
      }
      serviceCodes.add(code);
      assignments.push({ personId: id, blockIndex: b.index, code });
    });
  }

  if (ignoredCols.length) {
    issues.push({ kind: "gap", text: `Ignored non-block column(s): ${ignoredCols.join(", ")}.` });
  }

  const services: ParsedService[] = [...serviceCodes].sort().map((code) => ({
    code,
    name: SERVICE_NAME[code] ?? code,
    family: FAMILY[code] ?? "consult",
  }));

  return {
    programName,
    people,
    blocks,
    services,
    assignments,
    issues,
    stats: { fellows: people.length, blocks: blocks.length, assignments: assignments.length, issues: issues.length },
  };
}
