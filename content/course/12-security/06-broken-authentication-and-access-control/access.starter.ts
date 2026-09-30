export interface Note {
  id: number;
  ownerId: number;
  text: string;
}

export interface Reply {
  status: number;
  note?: Note;
}

export function getNote(userId: number | null, noteId: number, notes: Note[]): Reply {
  if (userId === null) return { status: 401 };
  const note = notes.find((n) => n.id === noteId);
  if (!note) return { status: 404 };
  return { status: 200, note };
}
