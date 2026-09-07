type AudioState = {
  speed: number;
  danger: number;
  pan: number;
  molting: boolean;
  stamina: number; human?:number; ants?:number; vertical?:number; loss?:boolean;
};

type AudioStatus = 'off' | 'running' | 'suspended' | 'unavailable';

/** Asset-free, deliberately gentle game ambience. It starts only from a user gesture. */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private rain: GainNode | null = null;
  private scratches: GainNode | null = null;
  private wind: GainNode | null = null;
  private heart: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private windPan: StereoPannerNode | null = null;
  private heartbeatPhase = 0;
  private unavailable = false; private lastHuman=0;private nextCreak=0;private nextShell=0;private nextStep=0;private nextNote = 0; private noteIndex = 0; private volume = .8; private lastDanger = 0;

  get status(): AudioStatus {
    if (this.unavailable) return 'unavailable';
    if (!this.ctx) return 'off';
    return this.ctx.state === 'running' ? 'running' : 'suspended';
  }

  get muted(): boolean {
    return this.status !== 'running';
  }

  async start(): Promise<void> {
    if (this.unavailable) return;
    if (this.ctx) {
      try { await this.ctx.resume(); } catch { /* status remains suspended */ }
      return;
    }
    const Ctor = (globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext }).AudioContext
      ?? (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) { this.unavailable = true; return; }

    try {
      const ctx = new Ctor();
      const master = ctx.createGain();
      master.gain.value = this.volume;
      master.connect(ctx.destination);
      this.ctx = ctx;
      this.master = master;
      this.rain = this.noise(0.032, 550, 2800, master);
      this.scratches = this.noise(0, 1500, 5400, master);
      this.wind = ctx.createGain();
      this.wind.gain.value = 0;
      this.windFilter = ctx.createBiquadFilter();
      this.windFilter.type = 'bandpass';
      this.windFilter.frequency.value = 700;
      this.windFilter.Q.value = 0.7;
      this.windPan = typeof ctx.createStereoPanner === 'function' ? ctx.createStereoPanner() : null;
      this.loopingNoise(this.windFilter);
      this.windFilter.connect(this.wind);
      if (this.windPan) this.wind.connect(this.windPan).connect(master);
      else this.wind.connect(master);

      this.heart = ctx.createGain();
      this.heart.gain.value = 0;
      const beat = ctx.createOscillator();
      beat.type = 'sine';
      beat.frequency.value = 76;
      beat.connect(this.heart).connect(master);
      beat.start();
      await ctx.resume();
    } catch {
      this.unavailable = true;
      this.dispose();
    }
  }

  setVolume(value:number):void {this.volume=this.clamp(value);if(this.ctx&&this.master)this.master.gain.setTargetAtTime(this.volume,this.ctx.currentTime,.08);}
  private note(hz:number,at:number,level:number,duration:number):void {
    const ctx=this.ctx!;const osc=ctx.createOscillator(),gain=ctx.createGain();osc.type='triangle';osc.frequency.value=hz;gain.gain.setValueAtTime(.0001,at);gain.gain.exponentialRampToValueAtTime(level,at+.06);gain.gain.exponentialRampToValueAtTime(.0001,at+duration);osc.connect(gain).connect(this.master!);osc.start(at);osc.stop(at+duration+.05);osc.onended=()=>{osc.disconnect();gain.disconnect();};
  }
  async toggle(): Promise<void> {
    if (this.status === 'running') {
      try { await this.ctx?.suspend(); } catch { /* status reports actual context state */ }
    } else {
      await this.start();
    }
  }

  async test(): Promise<void> {
    await this.start();
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const tone = ctx.createOscillator();
    const gain = ctx.createGain();
    tone.frequency.value = 440;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.28);
    tone.connect(gain).connect(ctx.destination);
    tone.start();
    tone.stop(ctx.currentTime + 0.3);
  }

  update(dt: number, data: AudioState): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    if(this.nextNote<now){const melody=[130.81,155.56,196,174.61,130.81,116.54,155.56,98];this.note(melody[this.noteIndex%8],now,data.molting?.018:data.danger>.5?.035:.08,2.3);if(this.noteIndex%4===0&&!data.molting)this.note(65.4,now,.04,3.8);this.noteIndex++;this.nextNote=now+1.7;}
    if(data.danger>=.6&&this.lastDanger<.6){this.note(740,now,.13,.35);this.note(554,now+.28,.1,.45);}this.lastDanger=data.danger;
    const human=data.human||0;
    if(human>.1&&this.lastHuman<=.1){for(let i=0;i<4;i++){this.note(48+i*2,now+i*.6,.2,1.1);this.note(96,now+i*.6,.08,.8);}}
    this.lastHuman=human;
    if(now>this.nextCreak){this.note(180+(this.noteIndex%3)*35,now,.025,1.8);this.nextCreak=now+11;}
    if(data.molting&&now>this.nextShell){this.note(310+(this.noteIndex%4)*40,now,.018,.8);this.nextShell=now+.9;}
    const speed = this.clamp(data.speed);
    if(speed>.05&&now>this.nextStep){this.note(230+(this.noteIndex%3)*19,now,.013,.09);this.nextStep=now+.12/Math.max(.4,speed);}
    const danger = this.clamp(data.danger);
    const stamina = this.clamp(data.stamina);
    this.ramp(this.scratches, speed * (0.025 + (1 - stamina) * 0.03)+(data.ants||0)*.024+(data.molting?.009:0), now, 0.06);
    this.ramp(this.wind, danger * 0.07, now, 0.22);
    if (this.windFilter) this.windFilter.frequency.setTargetAtTime(500 + danger * 1500 + Math.sign(data.vertical||0)*180, now, 0.2);
    if (this.windPan) this.windPan.pan.setTargetAtTime(this.clamp(data.pan, -1, 1) * danger, now, 0.16);
    this.heartbeatPhase += Math.max(0, dt) * (0.8 + (1 - stamina) * 0.7);
    const pulse = data.molting ? Math.pow(Math.max(0, Math.sin(this.heartbeatPhase * Math.PI * 2)), 12) * 0.045 : 0;
    this.ramp(this.heart, pulse, now, 0.07);
  }

  dispose(): void {
    const ctx = this.ctx;
    this.ctx = null;
    this.master = this.rain = this.scratches = this.wind = this.heart = null;
    this.windFilter = null;
    this.windPan = null;
    if (ctx && ctx.state !== 'closed') void ctx.close().catch(() => undefined);
  }

  private noise(level: number, low: number, high: number, output: AudioNode): GainNode {
    const ctx = this.ctx!;
    const gain = ctx.createGain();
    gain.gain.value = level;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = Math.sqrt(low * high);
    filter.Q.value = Math.max(0.35, Math.sqrt(low * high) / (high - low));
    this.loopingNoise(filter);
    filter.connect(gain).connect(output);
    return gain;
  }

  private loopingNoise(output: AudioNode): void {
    const ctx = this.ctx!;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(output);
    source.start();
  }

  private ramp(node: GainNode | null, value: number, now: number, time: number): void {
    node?.gain.setTargetAtTime(this.clamp(value, 0, 0.12), now, time);
  }

  private clamp(value: number, min = 0, max = 1): number {
    return Math.min(max, Math.max(min, Number.isFinite(value) ? value : 0));
  }
}
