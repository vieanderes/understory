import { redirect } from 'next/navigation';

/** The old interview fast track became the paths. */
export default function FastTrackPage() {
  redirect('/paths');
}
