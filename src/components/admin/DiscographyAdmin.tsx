import { useState } from 'react';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { useReleases, saveContent, newId } from '@/lib/siteContent';
import type { Release } from '@/lib/siteContent';

const EMPTY_SOLO = { date: '', title: '', kind: 'Single' as 'EP' | 'Single', label: '', trackCount: '', url: '' };
const EMPTY_COMP = { date: '', title: '', label: '', trackName: '', url: '' };

const INPUT = "w-full border border-border bg-transparent px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none";

const DiscographyAdmin = ({ onBack }: { onBack: () => void }) => {
  const releases = useReleases();
  const [soloForm, setSoloForm] = useState(EMPTY_SOLO);
  const [compForm, setCompForm] = useState(EMPTY_COMP);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const flash = () => { setSaved(true); setTimeout(() => setSaved(false), 2500); };

  const setSolo = (k: keyof typeof EMPTY_SOLO, v: string) =>
    setSoloForm(prev => ({ ...prev, [k]: v }));
  const setComp = (k: keyof typeof EMPTY_COMP, v: string) =>
    setCompForm(prev => ({ ...prev, [k]: v }));

  const addSolo = async () => {
    if (!soloForm.date || !soloForm.title || !soloForm.label) {
      setError('Date, title and label are required.');
      return;
    }
    setSaving(true); setError('');
    try {
      const item: Release = {
        id: newId('rel'),
        date: soloForm.date.trim(),
        title: soloForm.title.trim(),
        kind: soloForm.kind,
        label: soloForm.label.trim(),
        trackCount: soloForm.kind === 'EP' && soloForm.trackCount ? Number(soloForm.trackCount) : undefined,
        url: soloForm.url.trim() || undefined,
      };
      await saveContent({ releases: { solo: [...releases.solo, item], compilations: releases.compilations } });
      setSoloForm(EMPTY_SOLO);
      flash();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const addComp = async () => {
    if (!compForm.date || !compForm.title || !compForm.label || !compForm.trackName) {
      setError('Date, compilation title, label and track name are required.');
      return;
    }
    setSaving(true); setError('');
    try {
      const item: Release = {
        id: newId('rel'),
        date: compForm.date.trim(),
        title: compForm.title.trim(),
        kind: 'Compilation',
        label: compForm.label.trim(),
        trackName: compForm.trackName.trim(),
        url: compForm.url.trim() || undefined,
      };
      await saveContent({ releases: { solo: releases.solo, compilations: [...releases.compilations, item] } });
      setCompForm(EMPTY_COMP);
      flash();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const removeSolo = async (id: string) => {
    setError('');
    try {
      await saveContent({ releases: { solo: releases.solo.filter(r => r.id !== id), compilations: releases.compilations } });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Remove failed');
    }
  };

  const removeComp = async (id: string) => {
    setError('');
    try {
      await saveContent({ releases: { solo: releases.solo, compilations: releases.compilations.filter(r => r.id !== id) } });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Remove failed');
    }
  };

  const canAddSolo = soloForm.date && soloForm.title && soloForm.label;
  const canAddComp = compForm.date && compForm.title && compForm.label && compForm.trackName;

  return (
    <>
      <div className="flex items-center gap-2 border-b border-border p-3">
        <button onClick={onBack} className="p-1 hover:text-primary" aria-label="Back to menu">
          <ArrowLeft size={14} />
        </button>
        <div className="text-[10px] tracking-[0.3em] text-primary uppercase">// DISCOGRAPHY</div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {error && <p className="text-[10px] text-destructive">{error}</p>}

        {/* Solo Releases */}
        <div className="space-y-3">
          <div className="text-[10px] tracking-[0.2em] text-primary uppercase">Solo Releases</div>

          {releases.solo.length > 0 && (
            <div className="space-y-1">
              {releases.solo.map(r => (
                <div key={r.id} className="border border-border p-2 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[10px] text-primary tracking-[0.1em]">{r.date}</p>
                    <p className="text-xs text-foreground truncate">{r.title}</p>
                    <p className="text-[10px] text-muted-foreground">{r.kind} · {r.label}</p>
                  </div>
                  <button
                    onClick={() => removeSolo(r.id)}
                    className="shrink-0 w-7 h-7 border border-border flex items-center justify-center text-destructive hover:border-destructive"
                    aria-label={`Remove ${r.title}`}
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="border border-border p-3 space-y-2">
            <div className="text-[10px] tracking-[0.15em] text-muted-foreground uppercase">Add Solo Release</div>
            <input type="text" value={soloForm.title} onChange={e => setSolo('title', e.target.value)} placeholder="Title" className={INPUT} />
            <select value={soloForm.kind} onChange={e => setSolo('kind', e.target.value)} className={INPUT}>
              <option value="Single">Single</option>
              <option value="EP">EP</option>
            </select>
            <input type="text" value={soloForm.label} onChange={e => setSolo('label', e.target.value)} placeholder="Label" className={INPUT} />
            <input type="text" value={soloForm.date} onChange={e => setSolo('date', e.target.value)} placeholder="Date — YYYY or YYYY-MM-DD" className={INPUT} />
            {soloForm.kind === 'EP' && (
              <input type="number" value={soloForm.trackCount} onChange={e => setSolo('trackCount', e.target.value)} placeholder="Track count (optional)" min="1" max="99" className={INPUT} />
            )}
            <input type="url" value={soloForm.url} onChange={e => setSolo('url', e.target.value)} placeholder="Release URL (optional)" className={INPUT} />
            <button
              onClick={addSolo}
              disabled={saving || !canAddSolo}
              className="w-full border border-primary text-primary py-2 text-[10px] tracking-[0.2em] uppercase hover:bg-primary/10 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Plus size={12} />
              {saving ? 'SAVING...' : saved ? 'ADDED!' : 'ADD RELEASE'}
            </button>
          </div>
        </div>

        {/* Compilation Appearances */}
        <div className="space-y-3">
          <div className="text-[10px] tracking-[0.2em] text-primary uppercase">Compilation Appearances</div>

          {releases.compilations.length > 0 && (
            <div className="space-y-1">
              {releases.compilations.map(r => (
                <div key={r.id} className="border border-border p-2 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[10px] text-primary tracking-[0.1em]">{r.date}</p>
                    <p className="text-xs text-foreground truncate">{r.title}</p>
                    <p className="text-[10px] text-muted-foreground truncate">"{r.trackName}" · {r.label}</p>
                  </div>
                  <button
                    onClick={() => removeComp(r.id)}
                    className="shrink-0 w-7 h-7 border border-border flex items-center justify-center text-destructive hover:border-destructive"
                    aria-label={`Remove ${r.title}`}
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="border border-border p-3 space-y-2">
            <div className="text-[10px] tracking-[0.15em] text-muted-foreground uppercase">Add Compilation</div>
            <input type="text" value={compForm.title} onChange={e => setComp('title', e.target.value)} placeholder="Compilation title" className={INPUT} />
            <input type="text" value={compForm.label} onChange={e => setComp('label', e.target.value)} placeholder="Label" className={INPUT} />
            <input type="text" value={compForm.trackName} onChange={e => setComp('trackName', e.target.value)} placeholder="Your track name on this compilation" className={INPUT} />
            <input type="text" value={compForm.date} onChange={e => setComp('date', e.target.value)} placeholder="Date — YYYY or YYYY-MM-DD" className={INPUT} />
            <input type="url" value={compForm.url} onChange={e => setComp('url', e.target.value)} placeholder="Release URL (optional)" className={INPUT} />
            <button
              onClick={addComp}
              disabled={saving || !canAddComp}
              className="w-full border border-primary text-primary py-2 text-[10px] tracking-[0.2em] uppercase hover:bg-primary/10 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Plus size={12} />
              {saving ? 'SAVING...' : saved ? 'ADDED!' : 'ADD COMPILATION'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default DiscographyAdmin;
