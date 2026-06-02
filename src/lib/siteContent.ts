const galleryImages = import.meta.glob('../assets/gallery-*.jpg', {
  eager: true,
  import: 'default',
}) as Record<string, string>;

export const useGallery = () =>
  Object.entries(galleryImages)
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
    .map(([, src], i) => ({
      src,
      alt: `Subspace Resonator — photo ${i + 1}`,
    }));
