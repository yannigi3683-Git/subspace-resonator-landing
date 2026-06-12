import gallery01 from "@/assets/gallery-01.webp";
import gallery02 from "@/assets/gallery-02.webp";
import gallery03 from "@/assets/gallery-03.webp";
import gallery04 from "@/assets/gallery-04.webp";
import gallery05 from "@/assets/gallery-05.webp";
import gallery06 from "@/assets/gallery-06.webp";
import gallery07 from "@/assets/gallery-07.webp";
import gallery08 from "@/assets/gallery-08.webp";
import gallery09 from "@/assets/gallery-09.webp";
import gallery11 from "@/assets/gallery-11.webp";
import gallery12 from "@/assets/gallery-12.webp";
import gallery13 from "@/assets/gallery-13.webp";
import gallery14 from "@/assets/gallery-14.webp";
import gallery15 from "@/assets/gallery-15.webp";
import gallery16 from "@/assets/gallery-16.webp";
import gallery17 from "@/assets/gallery-17.webp";
import gallery18 from "@/assets/gallery-18.webp";
import gallery20 from "@/assets/gallery-20.webp";
import gallery21 from "@/assets/gallery-21.webp";
import gallery22 from "@/assets/gallery-22.webp";
import gallery23 from "@/assets/gallery-23.webp";
import liveAlpha from "@/assets/live-alpha.webp";

export type GalleryItem = { id: string; src: string; alt: string };

export const DEFAULT_GALLERY: GalleryItem[] = [
  { id: "g1",         src: gallery01,  alt: "Hindi Goa — UV night stage" },
  { id: "g2",         src: gallery02,  alt: "Hindi Goa — crowd daytime" },
  { id: "g4",         src: gallery04,  alt: "Hindi Goa — crowd energy" },
  { id: "g23",        src: gallery23,  alt: "UV stage — night banner glow" },
  { id: "g18",        src: gallery18,  alt: "Unleash Your Mind — hands up to the crowd" },
  { id: "live-alpha", src: liveAlpha,  alt: "Live performance — outdoor stage" },
  { id: "g3",         src: gallery03,  alt: "Yanni DJing — Hindi Goa" },
  { id: "g17",        src: gallery17,  alt: "Yanni mixing — Pioneer DJ outdoor set" },
  { id: "g5",         src: gallery05,  alt: "Behind the decks — psytrance backdrop" },
  { id: "g13",        src: gallery13,  alt: "Yanni mixing — night session" },
  { id: "g14",        src: gallery14,  alt: "Yanni on Pioneer DJ — golden hour" },
  { id: "g8",         src: gallery08,  alt: "Yanni live — Subspace Resonator hoodie" },
  { id: "g6",         src: gallery06,  alt: "Yanni backstage" },
  { id: "g7",         src: gallery07,  alt: "Yanni & Ido — behind the scenes" },
  { id: "g9",         src: gallery09,  alt: "Yanni & fan — forest party" },
  { id: "g11",        src: gallery11,  alt: "Yanni with fan — Subspace Resonator flyer" },
  { id: "g12",        src: gallery12,  alt: "Backstage with fellow DJ" },
  { id: "g20",        src: gallery20,  alt: "Yanni & friend — forest gathering selfie" },
  { id: "g21",        src: gallery21,  alt: "Jungle Sounds — b2b mixing session" },
  { id: "g22",        src: gallery22,  alt: "Crew selfie — Subspace Resonator tee" },
  { id: "g15",        src: gallery15,  alt: "Jungle Sounds — full crew photo" },
  { id: "g16",        src: gallery16,  alt: "Yanni with artists — outdoor stage" },
];

export function useGallery(): GalleryItem[] {
  return DEFAULT_GALLERY;
}
