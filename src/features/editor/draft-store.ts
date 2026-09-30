/*
 * The learner's unfinished code, per step, for as long as the tab lives. A draft is not
 * a fact, so it stays out of the event log: it goes to sessionStorage, which a private
 * window or a full quota may refuse. Every access is therefore allowed to fail quietly;
 * the worst case is a draft that does not survive a reload.
 */

const PREFIX = 'understory:draft:';

export function draftKey(lessonId: string, stepId: string): string {
  return `${PREFIX}${lessonId}#${stepId}`;
}

export function readDraft(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeDraft(key: string, code: string): void {
  try {
    window.sessionStorage.setItem(key, code);
  } catch {
    // Nothing to do: the code is still in the editor.
  }
}

export function clearDraft(key: string): void {
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // As above.
  }
}
