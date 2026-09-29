import * as XLSX from 'xlsx';
import type { Attendee } from '../types';

export interface AttendeeFromCSV {
  firstName: string;
  lastName: string;
  email: string;
  company: string;
  jobTitle: string;
  role: string; // "CxO (tech)", "Director (tech)", "Other (tech)", etc.
  temperature: string; // "Positive", "Neutral", "Negative"
  attendeeType: string; // "external", "internal"
}

/**
 * File extensions we accept for attendee uploads. Keep this in sync with the
 * `accept` attribute on the attendee upload input in App.tsx.
 *
 * Two families:
 *  - Tabular:  .csv, .tsv, .xlsx, .xls  → columns map directly to fields.
 *  - Document: .txt, .doc, .docx, .pdf  → text is extracted then parsed
 *              heuristically (embedded tables or "Name - Title" lines).
 */
export const ATTENDEE_FILE_EXTENSIONS = [
  '.csv', '.tsv', '.xlsx', '.xls', '.txt', '.doc', '.docx', '.pdf',
] as const;

/** True if a filename looks like an Excel workbook (binary, needs ArrayBuffer). */
export function isExcelFile(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return lower.endsWith('.xlsx') || lower.endsWith('.xls');
}

/** True for plain-text tabular/text formats that can be read as UTF-8 text. */
export function isPlainTextFile(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return lower.endsWith('.csv') || lower.endsWith('.tsv') || lower.endsWith('.txt');
}

/**
 * True for rich-document formats (.doc/.docx/.pdf). These are read as a binary
 * string, run through extractTextFromDocument(), then parsed as free text.
 */
export function isDocumentFile(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return lower.endsWith('.doc') || lower.endsWith('.docx') || lower.endsWith('.pdf');
}

/**
 * Parse an EMS attendee CSV file into structured attendee records.
 * Expected columns: First name, Last name, Email, Executive assistant email,
 * Company, Job title, Role, Temperature, Attending remotely, Attending as partner,
 * Attendee type, Alias
 */
export function parseAttendeeCSV(csvText: string): AttendeeFromCSV[] {
  const lines = csvText.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];

  // Detect the delimiter from the header row so tab-separated (.tsv) exports
  // work too. Default to comma.
  const header = lines[0];
  const delimiter = header.includes('\t') && !header.includes(',') ? '\t' : ',';

  // Skip header row
  return lines.slice(1).map(line => {
    const values = parseCSVLine(line, delimiter);
    return {
      firstName: values[0] || '',
      lastName: values[1] || '',
      email: values[2] || '',
      company: values[4] || '',
      jobTitle: values[5] || '',
      role: values[6] || '',
      temperature: values[7] || '',
      attendeeType: values[10] || '',
    };
  }).filter(a => a.firstName && a.lastName);
}

function parseCSVLine(line: string, delimiter: string = ','): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Extract readable text from a rich document (.docx / .doc / .pdf) read as a
 * binary string via FileReader.readAsBinaryString.
 *
 * This mirrors the lightweight, dependency-free extraction the Documents upload
 * uses: for .docx we pull the text runs out of the WordprocessingML (<w:t> tags);
 * for everything else we strip non-printable bytes and collapse whitespace. It
 * won't perfectly reconstruct every PDF/legacy .doc, but it recovers enough text
 * to find "Name - Title" lines and embedded tables.
 */
export function extractTextFromDocument(fileName: string, raw: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.docx')) {
    const matches = raw.match(/<w:t[^>]*>([^<]+)<\/w:t>/g) || [];
    if (matches.length > 0) {
      // Word puts each paragraph in a <w:p>; approximate line breaks from those.
      return raw
        .replace(/<\/w:p>/g, '\n')
        .match(/<w:t[^>]*>([^<]+)<\/w:t>/g)!
        .map(m => m.replace(/<[^>]+>/g, ''))
        .join(' ');
    }
  }
  // .pdf, legacy .doc, or a .docx we couldn't parse: strip binary noise.
  return raw
    .replace(/[^\x20-\x7E\n\r\t]/g, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
}

// A name is roughly 1-4 capitalized words (allowing hyphens, apostrophes, dots).
const NAME_RE = /^[A-Z][A-Za-z'.-]+(?:\s+[A-Z][A-Za-z'.-]+){0,3}$/;

/** Split a full name into first / last, putting middle names on the first name. */
function splitName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return {
    firstName: parts.slice(0, -1).join(' '),
    lastName: parts[parts.length - 1],
  };
}

/**
 * Parse attendees out of free-form / unstructured text (from .txt, .doc, .docx,
 * .pdf). Tries two strategies in order:
 *
 *  1. Embedded delimited table — if the text contains lines separated by a
 *     consistent delimiter (comma / tab / pipe / semicolon) with a header row
 *     that names columns we recognize, parse it with the same header mapper used
 *     for CSV/Excel.
 *  2. Line-based "Name - Title" patterns — each non-empty line is checked for a
 *     "Name <sep> Title" shape (sep = -, –, —, |, :, tab, or comma), or a bare
 *     capitalized name on its own line. A trailing email is captured if present.
 *
 * Rows without a usable first name are dropped, matching the other parsers.
 */
export function parseAttendeeText(text: string): AttendeeFromCSV[] {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  // --- Strategy 1: embedded delimited table -------------------------------
  const headerIdx = lines.findIndex(l =>
    /(first\s*name|last\s*name|full\s*name|\bname\b)/i.test(l) &&
    /[,\t|;]/.test(l)
  );
  if (headerIdx !== -1) {
    const delimiter = pickDelimiter(lines[headerIdx]);
    const headers = splitByDelimiter(lines[headerIdx], delimiter);
    const rows: AttendeeFromCSV[] = [];
    for (let i = headerIdx + 1; i < lines.length; i++) {
      if (!lines[i].includes(delimiter)) continue; // stop treating as table row
      const cells = splitByDelimiter(lines[i], delimiter);
      if (cells.every(c => !c)) continue;
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => { row[h] = cells[idx] ?? ''; });
      const attendee = rowToAttendee(row);
      // A "full name" column won't have split first/last — handle that.
      if (!attendee.firstName) {
        const fullName = headers.reduce<string>((acc, h, idx) =>
          acc || (/full\s*name|^name$/i.test(h) ? (cells[idx] ?? '') : ''), '');
        if (fullName) Object.assign(attendee, splitName(fullName));
      }
      if (attendee.firstName) rows.push(attendee);
    }
    if (rows.length > 0) return rows;
  }

  // --- Strategy 2: line-based "Name <sep> Title" --------------------------
  const emailRe = /[\w.+-]+@[\w-]+\.[\w.-]+/;
  const results: AttendeeFromCSV[] = [];
  for (const line of lines) {
    const email = line.match(emailRe)?.[0] || '';
    // Remove the email from the line before splitting name/title.
    const cleaned = line.replace(emailRe, '').replace(/[<>()]/g, '').trim();
    if (!cleaned) continue;

    // Split on the first strong separator between name and title.
    const sepMatch = cleaned.match(/\s*[-–—|:\t]\s+|\s{2,}|,\s+/);
    let namePart = cleaned;
    let titlePart = '';
    if (sepMatch && sepMatch.index !== undefined) {
      namePart = cleaned.slice(0, sepMatch.index).trim();
      titlePart = cleaned.slice(sepMatch.index + sepMatch[0].length).trim();
    }

    if (!NAME_RE.test(namePart)) continue; // not a plausible person name

    // Guard against section headings ("EBC Attendees", "Meeting Roster", etc.)
    // being mistaken for names. Accept a line only if it carries corroborating
    // evidence that it's a real attendee: an email, a job title after a
    // separator, or a name that doesn't contain heading-ish words.
    const hasEvidence = Boolean(email) || Boolean(titlePart);
    if (!hasEvidence && looksLikeHeading(namePart)) continue;

    const { firstName, lastName } = splitName(namePart);
    if (!firstName) continue;

    results.push({
      firstName,
      lastName,
      email,
      company: '',
      jobTitle: titlePart,
      role: titlePart, // let persona mapping infer from the title text
      temperature: '',
      attendeeType: '',
    });
  }
  return results;
}

// Words that signal a line is a heading/label, not a person's name.
const HEADING_WORDS = /\b(attendee|attendees|roster|agenda|meeting|briefing|list|participants?|guests?|invitees?|team|executive|summary|overview|contents?|page|section)\b/i;

/** Heuristic: does this bare capitalized phrase look like a section heading? */
function looksLikeHeading(text: string): boolean {
  return HEADING_WORDS.test(text);
}

/** Choose the most likely column delimiter present in a header line. */
function pickDelimiter(line: string): string {
  const candidates = ['\t', '|', ';', ','];
  let best = ',';
  let bestCount = 0;
  for (const d of candidates) {
    const count = line.split(d).length - 1;
    if (count > bestCount) { best = d; bestCount = count; }
  }
  return best;
}

/** Split a line by a delimiter, honoring quotes when the delimiter is a comma. */
function splitByDelimiter(line: string, delimiter: string): string[] {
  return delimiter === ',' ? parseCSVLine(line, ',') : line.split(delimiter).map(c => c.trim());
}

/**
 * Normalize a header/column name for fuzzy matching: lowercase, strip anything
 * that isn't a letter or number. So "Job Title", "job_title" and "JobTitle"
 * all collapse to "jobtitle".
 */
function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Candidate header names (normalized) for each field we care about. Excel
// exports don't always match the positional EMS CSV order, so we match by name.
const FIELD_ALIASES: Record<keyof AttendeeFromCSV, string[]> = {
  firstName: ['firstname', 'first', 'givenname', 'fname'],
  lastName: ['lastname', 'last', 'surname', 'familyname', 'lname'],
  email: ['email', 'emailaddress', 'mail'],
  company: ['company', 'companyname', 'organization', 'organisation', 'account', 'accountname'],
  jobTitle: ['jobtitle', 'title', 'position', 'role_title'],
  role: ['role'],
  temperature: ['temperature', 'temp', 'sentiment'],
  attendeeType: ['attendeetype', 'type', 'attendeetyp'],
};

/**
 * Build one AttendeeFromCSV from a header-keyed row (as produced by SheetJS or a
 * CSV with headers). Matches columns by normalized name rather than position, so
 * it tolerates reordered / renamed columns and extra columns.
 */
function rowToAttendee(row: Record<string, unknown>): AttendeeFromCSV {
  // Pre-normalize the row's keys once so lookups are cheap.
  const normalized: Record<string, string> = {};
  for (const [k, v] of Object.entries(row)) {
    normalized[normalizeKey(k)] = v == null ? '' : String(v).trim();
  }

  const pick = (field: keyof AttendeeFromCSV): string => {
    for (const alias of FIELD_ALIASES[field]) {
      if (normalized[alias]) return normalized[alias];
    }
    return '';
  };

  return {
    firstName: pick('firstName'),
    lastName: pick('lastName'),
    email: pick('email'),
    company: pick('company'),
    jobTitle: pick('jobTitle'),
    role: pick('role'),
    temperature: pick('temperature'),
    attendeeType: pick('attendeeType'),
  };
}

/**
 * Parse an Excel workbook (.xlsx / .xls) into structured attendee records.
 * Reads the first sheet, treats the first row as headers, and maps columns to
 * fields by (fuzzy) name — see FIELD_ALIASES. If a row has no first/last name it
 * is dropped, matching the CSV parser's behavior.
 *
 * @param data Raw file bytes from FileReader.readAsArrayBuffer.
 */
export function parseAttendeeXLSX(data: ArrayBuffer): AttendeeFromCSV[] {
  const workbook = XLSX.read(data, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

  const attendees = rows.map(rowToAttendee).filter(a => a.firstName && a.lastName);
  if (attendees.length > 0) return attendees;

  // Fallback: the sheet may not have recognizable headers (e.g. it matches the
  // positional EMS layout with generic headers). Re-read as raw rows and use the
  // same positional mapping as the CSV parser.
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });
  return matrix.slice(1).map(cells => {
    const v = (i: number) => (cells[i] == null ? '' : String(cells[i]).trim());
    return {
      firstName: v(0),
      lastName: v(1),
      email: v(2),
      company: v(4),
      jobTitle: v(5),
      role: v(6),
      temperature: v(7),
      attendeeType: v(10),
    };
  }).filter(a => a.firstName && a.lastName);
}

/**
 * Map the EMS "Role" field + job title to the app's persona type.
 */
function mapRoleToPersona(role: string, jobTitle: string): Attendee['persona'] {
  const titleLower = jobTitle.toLowerCase();
  const roleLower = role.toLowerCase();

  if (roleLower.includes('cxo')) {
    if (titleLower.includes('ceo') || titleLower.includes('chief executive')) return 'CEO';
    if (titleLower.includes('cto') || titleLower.includes('technology')) return 'CTO';
    if (titleLower.includes('cfo') || titleLower.includes('financial')) return 'CFO';
    if (titleLower.includes('cio') || titleLower.includes('information')) return 'CIO';
    if (titleLower.includes('cdo') || titleLower.includes('delivery') || titleLower.includes('data')) return 'CTO';
    if (titleLower.includes('chro') || titleLower.includes('hr') || titleLower.includes('people') || titleLower.includes('human')) return 'CHRO';
    // Default CxO to CEO if we can't determine
    return 'CEO';
  }

  if (roleLower.includes('director')) {
    if (titleLower.includes('technology') || titleLower.includes('engineering') || titleLower.includes('tech')) return 'CTO';
    if (titleLower.includes('finance') || titleLower.includes('financial')) return 'CFO';
    if (titleLower.includes('people') || titleLower.includes('hr') || titleLower.includes('human')) return 'CHRO';
    return 'CTO'; // Default for tech directors
  }

  // Fallback: text/PDF/Word/table uploads usually have no EMS "Role" field, so
  // infer the persona straight from the job title text.
  return personaFromTitle(jobTitle);
}

/**
 * Infer a persona from a free-text job title alone (no EMS "Role" field).
 * Used for document/plain-text attendee sources where the title is the only
 * signal. Checks C-suite titles first, then director/VP-level tech/finance/HR.
 */
function personaFromTitle(jobTitle: string): Attendee['persona'] {
  const t = jobTitle.toLowerCase();
  if (!t) return 'Other';

  // C-suite — acronyms or spelled-out "chief ... officer".
  if (/\bceo\b/.test(t) || t.includes('chief executive')) return 'CEO';
  if (/\bcfo\b/.test(t) || t.includes('chief financial')) return 'CFO';
  if (/\bcio\b/.test(t) || t.includes('chief information')) return 'CIO';
  if (/\bcto\b/.test(t) || t.includes('chief technology')) return 'CTO';
  if (/\bcdo\b/.test(t) || t.includes('chief data') || t.includes('chief digital') || t.includes('chief delivery')) return 'CTO';
  if (/\bch?ro\b/.test(t) || t.includes('chief human') || t.includes('chief people')) return 'CHRO';

  // Director / VP / Head-of level — classify by domain.
  const seniorish = /\b(director|vp|vice president|head of|svp|evp)\b/.test(t);
  if (seniorish || t.includes('manager') || t.includes('lead')) {
    if (t.includes('technology') || t.includes('engineering') || t.includes('tech') || t.includes('data') || t.includes('cloud') || t.includes('platform')) return 'CTO';
    if (t.includes('finance') || t.includes('financial')) return 'CFO';
    if (t.includes('information') || t.includes('it ') || t.endsWith(' it')) return 'CIO';
    if (t.includes('people') || t.includes('hr') || t.includes('human') || t.includes('talent')) return 'CHRO';
  }

  return 'Other';
}

/**
 * Convert parsed CSV attendees to the app's Attendee type format.
 */
export function attendeesToPersonas(attendees: AttendeeFromCSV[]): Attendee[] {
  return attendees.map(a => ({
    name: `${a.firstName} ${a.lastName}`,
    title: a.jobTitle,
    persona: mapRoleToPersona(a.role, a.jobTitle),
  }));
}
