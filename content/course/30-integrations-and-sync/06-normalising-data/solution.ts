export type Status = 'enrolled' | 'left' | 'applicant';

export interface Pupil {
  remoteId: string;
  name: string;
  born: string | null;
  status: Status | null;
  freeMeals: boolean | null;
  country: string | null;
}

export interface Settings {
  dateOrder: 'DMY' | 'MDY';
}

export type RawRow = Record<string, string | undefined>;
export type Warn = (field: string, value: string) => void;

// Two vendor codes can mean the same thing to you.
const STATUSES: Record<string, Status> = { ACT: 'enrolled', ONR: 'enrolled', LFT: 'left', APP: 'applicant' };
const YES: readonly string[] = ['y', 'yes', 'true', '1', 'x'];
const NO: readonly string[] = ['n', 'no', 'false', '0'];
const EMPTY: readonly string[] = ['', 'n/a', '-'];

export function toPupil(raw: RawRow, settings: Settings, warn: Warn): Pupil {
  // Every spelling of "nothing" becomes null before any other rule sees it.
  const clean = (value: string | undefined): string | null => {
    if (value === undefined) return null;
    const trimmed = value.trim();
    return EMPTY.includes(trimmed.toLowerCase()) ? null : trimmed;
  };

  // A pure date stays text. Going through Date would turn it into an instant.
  const toIsoDate = (text: string): string => {
    const [first = '', second = '', year = ''] = text.split('/');
    const [day, month] = settings.dateOrder === 'DMY' ? [first, second] : [second, first];
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  };

  const status = clean(raw.Status);
  const mappedStatus = status === null ? null : (STATUSES[status.toUpperCase()] ?? null);
  // An unknown code is reported, never guessed and never fatal to the run.
  if (status !== null && mappedStatus === null) warn('Status', status);

  const flag = clean(raw.FreeMeals);
  let freeMeals: boolean | null = null;
  if (flag !== null) {
    if (YES.includes(flag.toLowerCase())) freeMeals = true;
    else if (NO.includes(flag.toLowerCase())) freeMeals = false;
    else warn('FreeMeals', flag);
  }

  const born = clean(raw.DOB);
  const country = clean(raw.Country);
  return {
    remoteId: clean(raw.PupilID) ?? '',
    name: clean(raw.Name) ?? '',
    born: born === null ? null : toIsoDate(born),
    status: mappedStatus,
    freeMeals,
    country: country === null ? null : country.toUpperCase(),
  };
}
