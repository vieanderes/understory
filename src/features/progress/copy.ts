import { formatMinutes, type WorkItem } from '@/core/insight';

export interface WorkCopy {
  title: string;
  detail: string;
  action: string;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

const list = (names: readonly string[], count: number) => {
  const shown = names.join(', ');
  return count > names.length ? `${shown} and ${count - names.length} more` : shown;
};

/** What each kind of thing to work on says. The domain decides what; this says why. */
export function workCopy(item: WorkItem): WorkCopy {
  switch (item.kind) {
    case 'gaps':
      return {
        title: item.count === 1 ? `Bring back ${item.title}` : `Bring back ${item.count ?? 0} gaps`,
        detail: `You held ${item.count === 1 ? 'it' : 'these'} once and ${
          item.count === 1 ? 'it is' : 'they are'
        } fading. ${list(item.names ?? [], item.count ?? 0)}.`,
        action: 'Practise',
      };
    case 'due':
      return {
        title: `${plural(item.count ?? 0, 'concept', 'concepts')} due for review`,
        detail: 'A short session now keeps them.',
        action: 'Review',
      };
    case 'lesson':
      return {
        title: item.title,
        detail: `${item.first ? 'First lesson' : 'Next lesson'} · ${formatMinutes(item.minutes ?? 0)}`,
        action: item.first ? 'Start' : 'Continue',
      };
    case 'exam':
      return {
        title: `Sit the ${item.title} exam`,
        detail: 'Every lesson is done. 80% earns the certificate.',
        action: 'Sit exam',
      };
    case 'checkpoint':
      return {
        title: `Checkpoint: ${item.title}`,
        detail: 'Every lesson is done. A mixed review of the whole part settles it.',
        action: 'Start',
      };
    case 'weak':
      return {
        title: `Firm up ${item.title}`,
        detail: `Mastery ${Math.round((item.mastery ?? 0) * 100)}%. Go over it once more.`,
        action: 'Revisit',
      };
    case 'retest':
      return {
        title: `Sit ${item.title} again`,
        detail: `Best so far ${item.best ?? 0}%.`,
        action: 'Sit again',
      };
    case 'test':
      return { title: `Sit ${item.title}`, detail: 'Not sat yet.', action: 'Sit test' };
    case 'chapter':
      return {
        title: `Start ${item.title}`,
        detail: `Not started · about ${formatMinutes(item.minutes ?? 0)}`,
        action: 'Start',
      };
  }
}
