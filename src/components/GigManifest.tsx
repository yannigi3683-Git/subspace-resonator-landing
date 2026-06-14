import { useEvents } from '@/lib/siteContent';

const GigManifest = () => {
  const events = useEvents();
  if (events.length === 0) return null;

  return (
    <section id="gigs" aria-label="Upcoming Events" className="py-10 md:py-16 border-t border-border">
      <div className="container">
        <h2 className="text-sm tracking-[0.3em] text-primary mb-8 uppercase">
          // UPCOMING EVENTS
        </h2>
        <div className="space-y-1">
          {events.map(ev => (
            <div
              key={ev.id}
              className="section-border px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-6"
            >
              <span className="font-mono text-[11px] text-primary tracking-[0.15em] shrink-0">{ev.date}</span>
              <span className="text-sm text-foreground font-medium flex-1">{ev.title}</span>
              <span className="text-xs text-muted-foreground shrink-0">{ev.location}</span>
              {ev.link && (
                <a
                  href={ev.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] tracking-[0.2em] uppercase border border-primary text-primary px-3 py-1 hover:bg-primary/10 transition-colors shrink-0 self-start sm:self-auto"
                >
                  TICKETS
                </a>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default GigManifest;
