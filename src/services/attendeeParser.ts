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
 * Parse an EMS attendee CSV file into structured attendee records.
 * Expected columns: First name, Last name, Email, Executive assistant email,
 * Company, Job title, Role, Temperature, Attending remotely, Attending as partner,
 * Attendee type, Alias
 */
export function parseAttendeeCSV(csvText: string): AttendeeFromCSV[] {
  const lines = csvText.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];

  // Skip header row
  return lines.slice(1).map(line => {
    const values = parseCSVLine(line);
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

function parseCSVLine(line: string): string[] {
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
    } else if (char === ',' && !inQuotes) {
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
