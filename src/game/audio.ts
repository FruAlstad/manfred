export class GameAudio {
  private context: AudioContext | null = null
  private master: GainNode | null = null
  private hum: GainNode | null = null
  private lastStep = 0

  start() {
    if (this.context) return
    const context = new AudioContext()
    this.context = context
    this.master = context.createGain()
    this.master.gain.value = 0.22
    this.master.connect(context.destination)
    this.startHum()
  }

  setHunting(active: boolean) {
    if (!this.hum || !this.context) return
    this.hum.gain.setTargetAtTime(active ? 0.55 : 0.18, this.context.currentTime, 0.4)
  }

  footstep(speed: number) {
    if (!this.context || !this.master || speed < 0.4) return
    const now = this.context.currentTime
    const interval = speed > 3.4 ? 0.32 : 0.48
    if (now - this.lastStep < interval) return
    this.lastStep = now

    const noise = this.context.createBufferSource()
    const buffer = this.context.createBuffer(1, this.context.sampleRate * 0.08, this.context.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length)
    }
    noise.buffer = buffer
    const filter = this.context.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 420
    const gain = this.context.createGain()
    gain.gain.value = 0.35
    noise.connect(filter)
    filter.connect(gain)
    gain.connect(this.master)
    noise.start()
  }

  sting() {
    if (!this.context || !this.master) return
    const osc = this.context.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(90, this.context.currentTime)
    osc.frequency.exponentialRampToValueAtTime(28, this.context.currentTime + 1.2)
    const gain = this.context.createGain()
    gain.gain.setValueAtTime(0.0001, this.context.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.7, this.context.currentTime + 0.04)
    gain.gain.exponentialRampToValueAtTime(0.0001, this.context.currentTime + 1.4)
    osc.connect(gain)
    gain.connect(this.master)
    osc.start()
    osc.stop(this.context.currentTime + 1.5)
  }

  exit() {
    if (!this.context || !this.master) return
    const osc = this.context.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(220, this.context.currentTime)
    osc.frequency.exponentialRampToValueAtTime(880, this.context.currentTime + 1.1)
    const gain = this.context.createGain()
    gain.gain.setValueAtTime(0.0001, this.context.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.25, this.context.currentTime + 0.08)
    gain.gain.exponentialRampToValueAtTime(0.0001, this.context.currentTime + 1.4)
    osc.connect(gain)
    gain.connect(this.master)
    osc.start()
    osc.stop(this.context.currentTime + 1.5)
  }

  private startHum() {
    if (!this.context || !this.master) return
    const makeOsc = (freq: number, type: OscillatorType) => {
      const osc = this.context!.createOscillator()
      osc.type = type
      osc.frequency.value = freq
      osc.start()
      return osc
    }

    this.hum = this.context.createGain()
    this.hum.gain.value = 0.18
    const filter = this.context.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = 110
    filter.Q.value = 0.7

    makeOsc(50, 'sawtooth').connect(filter)
    makeOsc(120, 'square').connect(filter)
    filter.connect(this.hum)
    this.hum.connect(this.master)

    const lfo = makeOsc(0.13, 'sine')
    const lfoGain = this.context.createGain()
    lfoGain.gain.value = 18
    lfo.connect(lfoGain)
    lfoGain.connect(filter.frequency)
  }
}
