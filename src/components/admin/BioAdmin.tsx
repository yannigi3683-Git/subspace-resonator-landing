import { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useBio, saveContent } from '@/lib/siteContent';

const BioAdmin = ({ onBack }: { onBack: () => void }) => {
  const bio = useBio();
  const [signal,      setSignal]      = useState(bio.signal);
  const [reactivation,setReactivation]= useState(bio.reactivation);
  const [mission,     setMission]     = useState(bio.mission);
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [error,  setError]  = useState('');

  useEffect(() => {
    setSignal(bio.signal);
    setReactivation(bio.reactivation);
    setMission(bio.mission);
  }, [bio.signal, bio.reactivation, bio.mission]);

  const save = async () => {
    setSaving(true);
    setSaved(false);
    setError('');
    try {
      await saveContent({ bio: { signal, reactivation, mission } });
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
        <div className="text-[10px] tracking-[0.3em] text-primary uppercase">// BIO</div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {error && <p className="text-[10px] text-destructive">{error}</p>}

        <div className="space-y-1">
          <label className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase">Signal</label>
          <textarea
            value={signal}
            onChange={e => setSignal(e.target.value)}
            rows={4}
            className="w-full border border-border bg-transparent px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none resize-none leading-relaxed"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase">Reactivation</label>
          <textarea
            value={reactivation}
            onChange={e => setReactivation(e.target.value)}
            rows={4}
            className="w-full border border-border bg-transparent px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none resize-none leading-relaxed"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase">Mission</label>
          <textarea
            value={mission}
            onChange={e => setMission(e.target.value)}
            rows={4}
            className="w-full border border-border bg-transparent px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none resize-none leading-relaxed"
          />
        </div>
      </div>

      <div className="border-t border-border p-3">
        <button
          onClick={save}
          disabled={saving}
          className="w-full border border-primary text-primary py-2 text-[10px] tracking-[0.2em] uppercase hover:bg-primary/10 disabled:opacity-50"
        >
          {saving ? 'SAVING...' : saved ? 'SAVED' : 'SAVE BIO'}
        </button>
      </div>
    </>
  );
};

export default BioAdmin;
