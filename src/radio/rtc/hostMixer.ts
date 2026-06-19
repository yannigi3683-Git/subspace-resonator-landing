// FR-4 constraints for getUserMedia sources (music mode, no voice processing)
const FR4_AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: false,
  autoGainControl: false,
  noiseSuppression: false,
  channelCount: 2,
  sampleRate: 48_000,
};

export interface SourceEntry {
  readonly id: string;
  kind: 'device' | 'file' | 'mic';
  gain: number;
}

export interface MixerAnalysis {
  /** Frequency-domain float array from the master AnalyserNode */
  getFrequencyData(): Float32Array;
  /** Time-domain float array (waveform) */
  getTimeDomainData(): Float32Array;
}

export class HostMixer {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private destination: MediaStreamAudioDestinationNode | null = null;

  private sources = new Map<
    string,
    { node: AudioNode; gain: GainNode; stream?: MediaStream }
  >();
  private sourceEntries: SourceEntry[] = [];
  private idCounter = 0;

  // AudioContext factory is injectable so tests can pass a mock.
  constructor(
    private readonly createContext: () => AudioContext = () => new AudioContext(),
  ) {}

  // Must be called from within a user-gesture handler on iOS.
  // Returns the mixed MediaStream that Publisher.connect() should receive.
  async start(): Promise<MediaStream> {
    this.ctx = this.createContext();

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 1;

    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;

    this.destination = this.ctx.createMediaStreamDestination();

    this.masterGain.connect(this.analyser);
    this.analyser.connect(this.destination);

    if (this.ctx.state === 'suspended') await this.ctx.resume();

    return this.destination.stream;
  }

  // Add a hardware audio input (Traktor/Rekordbox virtual device, or mic).
  // kind='device' for line-in/virtual device; kind='mic' for microphone.
  async addAudioDevice(deviceId: string, kind: 'device' | 'mic' = 'device'): Promise<string> {
    if (!this.ctx) throw new Error('HostMixer: call start() first');
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { ...FR4_AUDIO_CONSTRAINTS, deviceId: { exact: deviceId } },
    });
    return this.addStream(stream, kind);
  }

  // Add a file source. Pass an HTMLAudioElement whose .src is already set
  // (LocalDeck manages file URLs). The same element can be reused — just
  // swap its .src and call this again to replace it.
  addFileElement(audioEl: HTMLAudioElement): string {
    if (!this.ctx) throw new Error('HostMixer: call start() first');
    const sourceNode = this.ctx.createMediaElementSource(audioEl);
    return this.mountSource(sourceNode, 'file');
  }

  setGain(id: string, value: number): void {
    const entry = this.sources.get(id);
    if (!entry) return;
    entry.gain.gain.value = Math.max(0, Math.min(2, value));
    const se = this.sourceEntries.find((e) => e.id === id);
    if (se) se.gain = value;
  }

  // Smoothly ramp a source's gain to a target over durationSec (used for auto-mix
  // crossfades). Falls back to an instant set if AudioParam scheduling is unavailable.
  rampGain(id: string, target: number, durationSec: number): void {
    const entry = this.sources.get(id);
    if (!entry || !this.ctx) return;
    const clamped = Math.max(0, Math.min(2, target));
    const param = entry.gain.gain;
    const now = this.ctx.currentTime;
    const dur = Math.max(0.01, durationSec);
    if (typeof param.cancelScheduledValues === 'function') {
      param.cancelScheduledValues(now);
      param.setValueAtTime(param.value, now);
      param.linearRampToValueAtTime(clamped, now + dur);
    } else {
      param.value = clamped;
    }
    const se = this.sourceEntries.find((e) => e.id === id);
    if (se) se.gain = clamped;
  }

  removeSource(id: string): void {
    const entry = this.sources.get(id);
    if (!entry) return;
    entry.gain.disconnect();
    entry.node.disconnect();
    if (entry.stream) {
      for (const track of entry.stream.getTracks()) track.stop();
    }
    this.sources.delete(id);
    this.sourceEntries = this.sourceEntries.filter((e) => e.id !== id);
  }

  get analysis(): MixerAnalysis | null {
    if (!this.analyser) return null;
    const a = this.analyser;
    return {
      getFrequencyData() {
        const data = new Float32Array(a.frequencyBinCount);
        a.getFloatFrequencyData(data);
        return data;
      },
      getTimeDomainData() {
        const data = new Float32Array(a.fftSize);
        a.getFloatTimeDomainData(data);
        return data;
      },
    };
  }

  get entries(): readonly SourceEntry[] {
    return this.sourceEntries;
  }

  stop(): void {
    for (const [id] of this.sources) this.removeSource(id);
    this.ctx?.close().catch(() => {});
    this.ctx = null;
    this.masterGain = null;
    this.analyser = null;
    this.destination = null;
  }

  private addStream(stream: MediaStream, kind: 'device' | 'mic'): string {
    const sourceNode = this.ctx!.createMediaStreamSource(stream);
    return this.mountSource(sourceNode, kind, stream);
  }

  private mountSource(
    node: AudioNode,
    kind: SourceEntry['kind'],
    stream?: MediaStream,
  ): string {
    const id = String(++this.idCounter);
    const gainNode = this.ctx!.createGain();
    gainNode.gain.value = 1;
    node.connect(gainNode);
    gainNode.connect(this.masterGain!);
    this.sources.set(id, { node, gain: gainNode, stream });
    this.sourceEntries.push({ id, kind, gain: 1 });
    return id;
  }
}
