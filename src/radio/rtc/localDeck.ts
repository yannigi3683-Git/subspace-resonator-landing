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
  private repeat = false;

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

  move(fromIdx: number, toIdx: number): void {
    if (fromIdx === toIdx || fromIdx < 0 || toIdx < 0 ||
        fromIdx >= this.queue.length || toIdx >= this.queue.length) return;
    const [track] = this.queue.splice(fromIdx, 1);
    this.queue.splice(toIdx, 0, track);
    if (this.currentIndex === fromIdx) {
      this.currentIndex = toIdx;
    } else if (fromIdx < this.currentIndex && toIdx >= this.currentIndex) {
      this.currentIndex--;
    } else if (fromIdx > this.currentIndex && toIdx <= this.currentIndex) {
      this.currentIndex++;
    }
  }

  setRepeat(v: boolean): void {
    this.repeat = v;
  }

  shuffle(): void {
    if (this.queue.length < 2) return;
    const currentId = this.queue[this.currentIndex]?.id;
    for (let i = this.queue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.queue[i], this.queue[j]] = [this.queue[j], this.queue[i]];
    }
    const idx = this.queue.findIndex((t) => t.id === currentId);
    this.currentIndex = idx === -1 ? 0 : idx;
  }

  advance(): boolean {
    if (this.currentIndex >= this.queue.length - 1) {
      if (this.repeat && this.queue.length > 0) {
        this.currentIndex = 0;
        return true;
      }
      return false;
    }
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
    const nextTrack = this.queue[this.currentIndex + 1];
    if (nextTrack) return nextTrack;
    // At the last track: repeat wraps to the first, but never crossfade a lone track into itself.
    if (this.repeat && this.queue.length > 1) return this.queue[0];
    return null;
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
