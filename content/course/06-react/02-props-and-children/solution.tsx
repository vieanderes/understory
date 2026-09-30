type InboxCardProps = { title: string; unread: number; children: React.ReactNode };

export function InboxCard({ title, unread, children }: InboxCardProps) {
  return (
    <section>
      <h2>{title}</h2>
      {/* A comparison, not `unread &&`: a bare 0 would show up on the page. */}
      {unread > 0 && <span className="badge">{unread > 9 ? '9+' : unread}</span>}
      {children}
    </section>
  );
}
