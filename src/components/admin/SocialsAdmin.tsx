import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useSocials, saveContent, DEFAULT_SOCIALS } from '@/lib/siteContent';

const SocialsAdmin = ({ onBack }: { onBack: () => void }) => {
  const socials = useSocials();

  const [urls, setUrls] = useState<Record<string, string>>(
    () => Object.fromEntries(socials.map(s => [s.name, s.url]))
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const updated = DEFAULT_SOCIALS.map(s => ({ name: s.name, url: urls[s.name] ?? s.url }));
      await saveContent({ socials: updated });
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
        <div className="text-[10px] tracking-[0.3em] text-primary uppercase">// SOCIALS</div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {error && <p className="text-[10px] text-destructive">{error}</p>}
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          Paste the full link for each platform. Leave blank to hide that button from the site.
        </p>

        {DEFAULT_SOCIALS.map(s => (
          <div key={s.name} className="space-y-1">
            <label className="text-[10px] tracking-[0.15em] text-muted-foreground uppercase">{s.name}</label>
            <input
              type="url"
              value={urls[s.name] ?? ''}
              onChange={e => setUrls(prev => ({ ...prev, [s.name]: e.target.value }))}
              placeholder={`https://...`}
              className="w-full border border-border bg-transparent px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            />
          </div>
        ))}

        <button
          onClick={save}
          disabled={saving}
          className="w-full border border-primary text-primary py-2 text-[10px] tracking-[0.2em] uppercase hover:bg-primary/10 disabled:opacity-50 mt-2"
        >
          {saving ? 'SAVING...' : saved ? 'SAVED!' : 'SAVE SOCIALS'}
        </button>
      </div>
    </>
  );
};

export default SocialsAdmin;
