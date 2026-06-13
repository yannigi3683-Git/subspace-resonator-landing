import { useState, useRef } from 'react';
import { Upload, Trash2, ArrowLeft, EyeOff, Eye, Play, Plus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useGalleryOverrides, saveContent, newId, DEFAULT_GALLERY } from '@/lib/siteContent';
import type { GalleryItem } from '@/lib/siteContent';

function ytEmbed(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return m ? `https://www.youtube.com/embed/${m[1]}?autoplay=1` : null;
}

function ytThumb(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return m ? `https://img.youtube.com/vi/${m[1]}/hqdefault.jpg` : null;
}

const GalleryAdmin = ({ onBack }: { onBack: () => void }) => {
  const [uploading, setUploading] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const videoFileRef = useRef<HTMLInputElement>(null);
  const overrides = useGalleryOverrides();

  const upload = async (file: File) => {
    if (!supabase) return;
    setUploading(true);
    setError('');
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${newId('photo')}.${ext}`;
      const { error: upErr } = await supabase.storage.from('gallery').upload(path, file);
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from('gallery').getPublicUrl(path);
      const item: GalleryItem = { id: path, src: publicUrl, alt: file.name.replace(/\.[^/.]+$/, ''), mediaType: 'image' };
      await saveContent({ gallery: { ...overrides, added: [...overrides.added, item] } });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const addVideo = async () => {
    const url = videoUrl.trim();
    if (!url) return;
    setError('');
    try {
      const embedUrl = ytEmbed(url) || url;
      const thumb = ytThumb(url) || '';
      const item: GalleryItem = { id: newId('vid'), src: thumb, alt: 'Video', mediaType: 'video', videoEmbedUrl: embedUrl };
      await saveContent({ gallery: { ...overrides, added: [...overrides.added, item] } });
      setVideoUrl('');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to add video');
    }
  };

  const uploadVideoFile = async (file: File) => {
    if (!supabase) return;
    if (file.size > 200 * 1024 * 1024) {
      setError('Video is too large (200 MB max). Use a YouTube link instead for big videos.');
      return;
    }
    setUploadingVideo(true);
    setError('');
    try {
      const ext = file.name.split('.').pop() || 'mp4';
      const path = `${newId('vid')}.${ext}`;
      const { error: upErr } = await supabase.storage.from('gallery').upload(path, file);
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from('gallery').getPublicUrl(path);
      const item: GalleryItem = { id: path, src: '', alt: file.name.replace(/\.[^/.]+$/, ''), mediaType: 'video', videoEmbedUrl: publicUrl };
      await saveContent({ gallery: { ...overrides, added: [...overrides.added, item] } });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploadingVideo(false);
    }
  };

  const removeAdded = async (item: GalleryItem) => {
    if (!supabase) return;
    setError('');
    try {
      await supabase.storage.from('gallery').remove([item.id]);
      await saveContent({ gallery: { ...overrides, added: overrides.added.filter(a => a.id !== item.id) } });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Remove failed');
    }
  };

  const toggleHide = async (id: string) => {
    const hidden = overrides.deleted.includes(id);
    const deleted = hidden ? overrides.deleted.filter(d => d !== id) : [...overrides.deleted, id];
    await saveContent({ gallery: { ...overrides, deleted } });
  };

  return (
    <>
      <div className="flex items-center gap-2 border-b border-border p-3">
        <button onClick={onBack} className="p-1 hover:text-primary" aria-label="Back to menu">
          <ArrowLeft size={14} />
        </button>
        <div className="text-[10px] tracking-[0.3em] text-primary uppercase">// GALLERY</div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {error && <p className="text-[10px] text-destructive">{error}</p>}

        {/* Upload photo */}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }}
        />
        <input
          ref={videoFileRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadVideoFile(f); e.target.value = ''; }}
        />
        <div className="flex gap-2">
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading || uploadingVideo}
            className="flex-1 border border-primary text-primary py-2 text-[10px] tracking-[0.2em] uppercase hover:bg-primary/10 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Upload size={12} />
            {uploading ? 'UPLOADING...' : 'UPLOAD PHOTO'}
          </button>
          <button
            onClick={() => videoFileRef.current?.click()}
            disabled={uploading || uploadingVideo}
            className="flex-1 border border-border text-foreground py-2 text-[10px] tracking-[0.2em] uppercase hover:border-primary hover:text-primary disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Play size={12} />
            {uploadingVideo ? 'UPLOADING...' : 'UPLOAD VIDEO'}
          </button>
        </div>

        {/* Add video */}
        <div className="space-y-2">
          <div className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase">Add Video</div>
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            Paste a YouTube link. For Google Photos videos, share them to YouTube first, then paste the YouTube link here.
          </p>
          <div className="flex gap-2">
            <input
              type="url"
              value={videoUrl}
              onChange={e => setVideoUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addVideo()}
              placeholder="https://youtube.com/watch?v=..."
              className="flex-1 border border-border bg-transparent px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            />
            <button
              onClick={addVideo}
              disabled={!videoUrl.trim()}
              className="border border-primary text-primary px-3 py-2 text-[10px] hover:bg-primary/10 disabled:opacity-50 flex items-center gap-1"
            >
              <Plus size={12} />
            </button>
          </div>
        </div>

        {/* Uploaded / added items */}
        {overrides.added.length > 0 && (
          <div className="space-y-2">
            <div className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase">Your uploads</div>
            <div className="grid grid-cols-2 gap-2">
              {overrides.added.map(item => (
                <div key={item.id} className="relative group border border-border overflow-hidden">
                  {item.src ? (
                    <img src={item.src} alt={item.alt} className="w-full h-24 object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-24 bg-border/20 flex items-center justify-center">
                      <Play size={20} className="text-primary" />
                    </div>
                  )}
                  {item.mediaType === 'video' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/40 pointer-events-none">
                      <Play size={16} className="text-primary" fill="currentColor" />
                    </div>
                  )}
                  <button
                    onClick={() => removeAdded(item)}
                    className="absolute top-1 right-1 w-7 h-7 bg-background/90 border border-border flex items-center justify-center text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="Remove"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Static photos */}
        <div className="space-y-2">
          <div className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase">Site photos — click eye to hide/show</div>
          <div className="grid grid-cols-2 gap-2">
            {DEFAULT_GALLERY.map(item => {
              const hidden = overrides.deleted.includes(item.id);
              return (
                <div key={item.id} className={`relative group border border-border overflow-hidden ${hidden ? 'opacity-40' : ''}`}>
                  <img src={item.src} alt={item.alt} className="w-full h-24 object-cover" loading="lazy" />
                  <button
                    onClick={() => toggleHide(item.id)}
                    className="absolute top-1 right-1 w-7 h-7 bg-background/90 border border-border flex items-center justify-center text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label={hidden ? 'Show photo' : 'Hide photo'}
                  >
                    {hidden ? <Eye size={11} /> : <EyeOff size={11} />}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
};

export default GalleryAdmin;
