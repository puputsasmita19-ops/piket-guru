export class SchoolBellService {
  private static audioCtx: AudioContext | null = null;

  private static getContext(): AudioContext {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioContextClass();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  /**
   * Plays a single musical note with harmonic envelope
   */
  private static playTone(freq: number, startTime: number, duration: number, volume: number = 0.3) {
    const ctx = this.getContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, startTime);

    gain.gain.setValueAtTime(0.001, startTime);
    gain.gain.exponentialRampToValueAtTime(volume, startTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + duration);
  }

  /**
   * Classic Indonesian School Westminster Quarters Chime
   */
  public static playSchoolBell() {
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;

      // Notes: G#4, F#4, E4, B3 (approx frequencies: 415, 370, 330, 247 Hz)
      const notes = [
        { freq: 330, dur: 0.6, delay: 0.0 }, // E4
        { freq: 415, dur: 0.6, delay: 0.7 }, // G#4
        { freq: 370, dur: 0.6, delay: 1.4 }, // F#4
        { freq: 247, dur: 1.2, delay: 2.1 }, // B3
      ];

      notes.forEach((n) => {
        this.playTone(n.freq, now + n.delay, n.dur, 0.4);
      });
    } catch (e) {
      console.warn('Audio Context error playing school bell:', e);
    }
  }

  /**
   * Bell for Period / Class Change (Double Ding-Dong)
   */
  public static playPeriodChangeBell() {
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;

      this.playTone(523.25, now, 0.5, 0.35); // C5
      this.playTone(659.25, now + 0.4, 0.8, 0.4); // E5
    } catch (e) {
      console.warn('Audio Context error:', e);
    }
  }

  /**
   * Bell for Recess / Break Time (Triple Pleasant Chime)
   */
  public static playBreakBell() {
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;

      this.playTone(440.0, now, 0.4, 0.3); // A4
      this.playTone(554.37, now + 0.3, 0.4, 0.3); // C#5
      this.playTone(659.25, now + 0.6, 0.9, 0.35); // E5
    } catch (e) {
      console.warn('Audio Context error:', e);
    }
  }

  /**
   * Bell for School Dismissal / Pulang Sekolah (Complete 4-Tone Melody)
   */
  public static playDismissalBell() {
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;

      const melody = [
        { freq: 247, delay: 0.0 },
        { freq: 370, delay: 0.5 },
        { freq: 415, delay: 1.0 },
        { freq: 330, delay: 1.5 },
      ];

      melody.forEach((m) => {
        this.playTone(m.freq, now + m.delay, 0.8, 0.35);
      });
    } catch (e) {
      console.warn('Audio Context error:', e);
    }
  }

  /**
   * Emergency Alert Siren (Peringatan Bahaya / Siaga 1)
   */
  public static playEmergencyAlarm() {
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      gain.gain.setValueAtTime(0.25, now);

      for (let i = 0; i < 3; i++) {
        const t = now + i * 0.8;
        osc.frequency.setValueAtTime(400, t);
        osc.frequency.exponentialRampToValueAtTime(900, t + 0.4);
        osc.frequency.exponentialRampToValueAtTime(400, t + 0.8);
      }

      gain.gain.setValueAtTime(0.25, now + 2.3);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.4);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 2.4);
    } catch (e) {
      console.warn('Audio Context error:', e);
    }
  }

  /**
   * Earthquake / Seismic Rumble Alarm
   */
  public static playEarthquakeAlarm() {
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.linearRampToValueAtTime(280, now + 1.2);
      osc.frequency.linearRampToValueAtTime(140, now + 2.5);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 3.0);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 3.0);
    } catch (e) {
      console.warn('Audio Context error playing earthquake alarm:', e);
    }
  }

  /**
   * Fire Alarm (Hi-Lo rapid pulsed horn)
   */
  public static playFireAlarm() {
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'square';
      gain.gain.setValueAtTime(0.2, now);

      for (let i = 0; i < 6; i++) {
        const t = now + i * 0.4;
        osc.frequency.setValueAtTime(i % 2 === 0 ? 880 : 587, t);
      }

      gain.gain.exponentialRampToValueAtTime(0.001, now + 2.5);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 2.5);
    } catch (e) {
      console.warn('Audio Context error playing fire alarm:', e);
    }
  }

  /**
   * Plays tone based on tone identifier
   */
  public static playToneByType(toneType: string) {
    switch (toneType) {
      case 'MORNING_IN':
        this.playSchoolBell();
        break;
      case 'PERIOD_CHANGE':
        this.playPeriodChangeBell();
        break;
      case 'BREAK':
        this.playBreakBell();
        break;
      case 'DISMISSAL':
        this.playDismissalBell();
        break;
      case 'EARTHQUAKE':
        this.playEarthquakeAlarm();
        break;
      case 'FIRE':
        this.playFireAlarm();
        break;
      case 'EMERGENCY':
      case 'SECURITY':
      case 'EVACUATION':
        this.playEmergencyAlarm();
        break;
      default:
        this.playPeriodChangeBell();
        break;
    }
  }
}
