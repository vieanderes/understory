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
  // Copies the vendor's text across. Dates, flags and codes stay as the vendor wrote them.
  return {
    remoteId: raw.PupilID ?? '',
    name: raw.Name ?? '',
    born: raw.DOB ?? null,
    status: (raw.Status as Status | undefined) ?? null,
    freeMeals: raw.FreeMeals === 'Y',
    country: raw.Country ?? null,
  };
}
