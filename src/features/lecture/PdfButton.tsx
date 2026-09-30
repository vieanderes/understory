'use client';

import { Download, LoaderCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { buttonClass } from '@/components/ui/Button';
import { pdfFileName, pdfPath, printPath, type LectureScope } from '@/core/lecture';

/**
 * Downloads the lecture as a PDF. The PDFs are printed at build time (scripts/build-lectures.ts);
 * where a build had no browser to print with, the file is missing, and the button opens the
 * print page instead, where the browser's own "Save as PDF" makes the same document.
 * Without JavaScript it is a plain download link.
 */
export function PdfButton({
  scope,
  title,
  rev,
  variant = 'secondary',
  label = 'Download PDF',
}: {
  scope: LectureScope;
  title: string;
  /** The content revision, so a cached PDF from older content is never served. */
  rev: string;
  variant?: 'primary' | 'secondary' | 'quiet';
  label?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const href = `${pdfPath(scope)}?rev=${rev}`;
  const fileName = pdfFileName(title);

  async function download(event: React.MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const head = await fetch(href, { method: 'HEAD' });
      const isPdf = head.ok && (head.headers.get('content-type') ?? '').includes('pdf');
      if (!isPdf) {
        router.push(`${printPath(scope)}?print=1`);
        return;
      }
      const link = document.createElement('a');
      link.href = href;
      link.download = fileName;
      document.body.append(link);
      link.click();
      link.remove();
    } catch {
      // Offline or a failed request: the print page may still be cached.
      router.push(`${printPath(scope)}?print=1`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <a
      href={href}
      download={fileName}
      onClick={download}
      aria-busy={busy || undefined}
      className={buttonClass(variant, 'md', 'lecture-screen-only shrink-0')}
    >
      {busy ? (
        <LoaderCircle aria-hidden size={16} strokeWidth={2} className="animate-spin" />
      ) : (
        <Download aria-hidden size={16} strokeWidth={2} />
      )}
      {label}
    </a>
  );
}
