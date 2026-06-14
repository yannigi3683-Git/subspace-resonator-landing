import { useState } from 'react';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { useEvents, saveContent, newId } from '@/lib/siteContent';
import type { EventItem } from '@/lib/siteContent';

const EMPTY_FORM = { date: '', title: '', location: '', link: '' };

const GigsAdmin = ({ onBack }: { onBack: () => void }) => {
  const events = useEvents();
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const set = (k: keyof typeof EMPTY_FORM, v: string) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const addEvent = async () => {
    if (!form.date || !form.title || !form.location) {
      setError('Date, title and location are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const item: EventItem = {
        id: newId('ev'),
        date: form.date,
        title: form.title.trim(),
        location: form.location.trim(),
        link: form.link.trim() || undefined,
      };
      await saveContent({ events: [...events, item] });
      setForm(EMPTY_FORM);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const removeEvent = async (id: string) => {
    setError('');
    try {
      await saveContent({ events: events.filter(ev => ev.id !== id) });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Remove failed');
    }
  };

  const canAdd = form.date && form.title && form.location;

  return (
    <>
      <div className="flex items-center gap-2 border-b border-border p-3">
        <button onClick={onBack} className="p-1 hover:text-primary" aria-label="Back to menu">
          <ArrowLeft size={14} />
        </button>
        <div className="text-[10px] tracking-[0.3em] text-primary uppercase">// GIGS</div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {error && <p className="text-[10px] text-destructive">{error}</p>}

        {/* Add new event */}
        <div className="space-y-2 border border-border p-3">
          <div className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase">Add Upcoming Gig</div>

          <input
            type="date"
            value={form.date}
            onChange={e => set('date', e.target.value)}
            className="w-full border border-border bg-transparent px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none"
          />
          <input
            type="text"
            value={form.title}
            onChange={e => set('title', e.target.value)}
            placeholder="Event name"
            className="w-full border border-border bg-transparent px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
          <input
            type="text"
            value={form.location}
            onChange={e => set('location', e.target.value)}
            placeholder="Venue / city"
            className="w-full border border-border bg-transparent px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
          <input
            type="url"
            value={form.link}
            onChange={e => set('link', e.target.value)}
            placeholder="Ticket link (optional)"
            className="w-full border border-border bg-transparent px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />

          <button
            onClick={addEvent}
            disabled={saving || !canAdd}
            className="w-full border border-primary text-primary py-2 text-[10px] tracking-[0.2em] uppercase hover:bg-primary/10 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Plus size={12} />
            {saving ? 'SAVING...' : saved ? 'ADDED!' : 'ADD GIG'}
          </button>
        </div>

        {/* Existing events */}
        {events.length > 0 ? (
          <div className="space-y-2">
            <div className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase">Upcoming Gigs</div>
            {events.map(ev => (
              <div key={ev.id} className="border border-border p-3 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] text-primary tracking-[0.1em]">{ev.date}</p>
                  <p className="text-xs text-foreground font-medium truncate">{ev.title}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{ev.location}</p>
                  {ev.link && (
                    <a href={ev.link} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:underline truncate block">
                      Ticket link
                    </a>
                  )}
                </div>
                <button
                  onClick={() => removeEvent(ev.id)}
                  className="shrink-0 w-7 h-7 border border-border flex items-center justify-center text-destructive hover:border-destructive"
                  aria-label="Remove gig"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[10px] text-muted-foreground">No upcoming gigs. Add one above.</p>
        )}
      </div>
    </>
  );
};

export default GigsAdmin;
