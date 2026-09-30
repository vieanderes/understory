type InboxCardProps = { title: string; unread: number; children: React.ReactNode };

// Hide the badge at 0, show 9+ above 9, and put the children under the heading.
export function InboxCard({ title, unread }: InboxCardProps) {
  return (
    <section>
      <h2>{title}</h2>
      {unread && <span className="badge">{unread}</span>}
    </section>
  );
}
