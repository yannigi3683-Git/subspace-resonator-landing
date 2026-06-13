export interface DeckTrack {
  readonly id: string;
  readonly file: File;
  readonly url: string;
  readonly name: string;
}

export interface DeckState {
  readonly queue: readonly DeckTrack[];
  readonly currentIndex: number;
}

function makeName(file: File): string {
  return file.name
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]+/g, ' ');
}

export class LocalDeck {
  private queue: DeckTrack[] = [];
  private currentIndex = 0;
  private idCounter = 0;

  constructor(
    private readonly createUrl: (file: File) => string = (f) => URL.createObjectURL(f),
  ) {}

  add(files: FileList | File[]): void {
    const arr = Array.from(files);
    for (const file of arr) {
      const id = String(++this.idCounter);
      this.queue.push({ id, file, url: this.createUrl(file), name: makeName(file) });
    }
  }

  remove(id: string): void {
    const idx = this.queue.findIndex((t) => t.id === id);
    if (idx === -1) return;
    URL.revokeObjectURL(this.queue[idx].url);
    this.queue.splice(idx, 1);
    if (idx < this.currentIndex) {
      this.currentIndex--;
    } else if (this.currentIndex >= this.queue.length && this.queue.length > 0) {
      this.currentIndex = this.queue.length - 1;
    }
  }

  advance(): boolean {
    if (this.currentIndex >= this.queue.length - 1) return false;
    this.currentIndex++;
    return true;
  }

  previous(): boolean {
    if (this.currentIndex <= 0) return false;
    this.currentIndex--;
    return true;
  }

  jumpTo(id: string): boolean {
    const idx = this.queue.findIndex((t) => t.id === id);
    if (idx === -1) return false;
    this.currentIndex = idx;
    return true;
  }

  clear(): void {
    for (const t of this.queue) URL.revokeObjectURL(t.url);
    this.queue = [];
    this.currentIndex = 0;
  }

  get current(): DeckTrack | null {
    return this.queue[this.currentIndex] ?? null;
  }

  get next(): DeckTrack | null {
    return this.queue[this.currentIndex + 1] ?? null;
  }

  get state(): DeckState {
    return { queue: [...this.queue], currentIndex: this.currentIndex };
  }

  get length(): number {
    return this.queue.length;
  }

  get isEmpty(): boolean {
    return this.queue.length === 0;
  }
}
