import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useBooking, saveContent } from '@/lib/siteContent';

const BookingAdmin = ({ onBack }: { onBack: () => void }) => {
  const booking = useBooking();
  const [email, setEmail] = useState(booking.email);
  const [phone, setPhone] = useState(booking.phone);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await saveContent({ booking: { email: email.trim(), phone: phone.trim() } });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-2 border-b border-border p-3">
        <button onClick={onBack} className="p-1 hover:text-primary" aria-label="Back to menu">
          <ArrowLeft size={14} />
        </button>
        <div className="text-[10px] tracking-[0.3em] text-primary uppercase">// BOOKING</div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {error && <p className="text-[10px] text-destructive">{error}</p>}

        <div className="space-y-1">
          <label className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase">Booking Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full border border-border bg-transparent px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            placeholder="your@email.com"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase">Phone (with country code)</label>
          <input
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            className="w-full border border-border bg-transparent px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            placeholder="+972507974184"
          />
          <p className="text-[10px] text-muted-foreground">Used for Call and WhatsApp buttons on the site.</p>
        </div>

        <button
          onClick={save}
          disabled={saving}
          className="w-full border border-primary text-primary py-2 text-[10px] tracking-[0.2em] uppercase hover:bg-primary/10 disabled:opacity-50"
        >
          {saving ? 'SAVING...' : saved ? 'SAVED!' : 'SAVE BOOKING'}
        </button>
      </div>
    </>
  );
};

export default BookingAdmin;
