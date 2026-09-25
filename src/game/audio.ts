export class GameAudio {
  private context: AudioContext | null = null
  private master: GainNode | null = null

  start() {
    if (this.context) {
      void this.context.resume()
      return
    }
    const context = new AudioContext()
    this.context = context
    this.master = context.createGain()
    this.master.gain.value = 0.28
    this.master.connect(context.destination)
  }

  async ensureRunning() {
    this.start()
    if (this.context?.state === 'suspended') {
      await this.context.resume()
    }
  }

  setHunting(_active: boolean) {
    // ambient hunting hum removed — it caused lag
  }

  footstep(_speed: number) {
    // footsteps removed — they caused lag
  }

  swing() {
    this.start()
    if (!this.context || !this.master) return
    void this.context.resume()
    const now = this.context.currentTime
    const whoosh = this.context.createBufferSource()
    const buffer = this.context.createBuffer(1, this.context.sampleRate * 0.18, this.context.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 1.5)
    }
    whoosh.buffer = buffer
    const filter = this.context.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = 900
    const gain = this.context.createGain()
    gain.gain.value = 0.55
    whoosh.connect(filter)
    filter.connect(gain)
    gain.connect(this.master)
    whoosh.start(now)
  }

  hit() {
    this.start()
    if (!this.context || !this.master) return
    void this.context.resume()
    const now = this.context.currentTime

    const thud = this.context.createOscillator()
    thud.type = 'sine'
    thud.frequency.setValueAtTime(120, now)
    thud.frequency.exponentialRampToValueAtTime(40, now + 0.2)
    const thudGain = this.context.createGain()
    thudGain.gain.setValueAtTime(0.0001, now)
    thudGain.gain.exponentialRampToValueAtTime(1.1, now + 0.01)
    thudGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25)
    thud.connect(thudGain)
    thudGain.connect(this.master)
    thud.start(now)
    thud.stop(now + 0.3)

    const crunch = this.context.createBufferSource()
    const buffer = this.context.createBuffer(1, this.context.sampleRate * 0.12, this.context.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length)
    }
    crunch.buffer = buffer
    const crunchGain = this.context.createGain()
    crunchGain.gain.value = 0.7
    crunch.connect(crunchGain)
    crunchGain.connect(this.master)
    crunch.start(now)
  }

  jumpscare() {
    this.start()
    if (!this.context || !this.master) return
    void this.context.resume()

    const now = this.context.currentTime
    // loud dedicated bus so jumpscare always cuts through
    const scare = this.context.createGain()
    scare.gain.value = 2.0
    scare.connect(this.context.destination)

    this.master.gain.setValueAtTime(this.master.gain.value, now)
    this.master.gain.linearRampToValueAtTime(0.04, now + 0.03)

    this.impactHit(scare, now)
    this.deathScream(scare, now)
    this.deathScream(scare, now + 0.4)
    this.zombieRoar(scare, now)
    this.biteChomp(scare, now + 0.06)
    this.biteChomp(scare, now + 0.22)
    this.staticBurst(scare, now)
    this.wetGrowl(scare, now + 0.1)
    this.stinger(scare, now)
    this.distantScream(scare, now + 0.35)
    this.heartbeat(scare, now + 0.5)
    this.heartbeat(scare, now + 0.9)

    this.master.gain.setValueAtTime(0.04, now + 2)
    this.master.gain.linearRampToValueAtTime(0.28, now + 2.5)
  }

  deathCry() {
    this.start()
    if (!this.context) return
    void this.context.resume()
    const scare = this.context.createGain()
    scare.gain.value = 1.2
    scare.connect(this.context.destination)
    const now = this.context.currentTime
    this.deathScream(scare, now)
    this.deathScream(scare, now + 0.35)
  }

  private deathScream(dest: AudioNode, at: number) {
    if (!this.context) return

    // main human scream
    const scream = this.context.createOscillator()
    scream.type = 'sawtooth'
    scream.frequency.setValueAtTime(860, at)
    scream.frequency.linearRampToValueAtTime(1180, at + 0.18)
    scream.frequency.exponentialRampToValueAtTime(420, at + 1.1)

    const vibrato = this.context.createOscillator()
    vibrato.type = 'sine'
    vibrato.frequency.value = 7.5
    const vibratoGain = this.context.createGain()
    vibratoGain.gain.value = 55
    vibrato.connect(vibratoGain)
    vibratoGain.connect(scream.frequency)

    const screamGain = this.context.createGain()
    screamGain.gain.setValueAtTime(0.0001, at)
    screamGain.gain.exponentialRampToValueAtTime(1.6, at + 0.04)
    screamGain.gain.setValueAtTime(1.35, at + 0.35)
    screamGain.gain.exponentialRampToValueAtTime(0.0001, at + 1.25)

    const band = this.context.createBiquadFilter()
    band.type = 'bandpass'
    band.frequency.setValueAtTime(1400, at)
    band.frequency.exponentialRampToValueAtTime(700, at + 1)
    band.Q.value = 2.2

    scream.connect(band)
    band.connect(screamGain)
    screamGain.connect(dest)
    scream.start(at)
    scream.stop(at + 1.3)
    vibrato.start(at)
    vibrato.stop(at + 1.3)

    // second scream layer (panic)
    const scream2 = this.context.createOscillator()
    scream2.type = 'square'
    scream2.frequency.setValueAtTime(1020, at + 0.05)
    scream2.frequency.exponentialRampToValueAtTime(280, at + 0.95)
    const scream2Gain = this.context.createGain()
    scream2Gain.gain.setValueAtTime(0.0001, at)
    scream2Gain.gain.exponentialRampToValueAtTime(0.95, at + 0.06)
    scream2Gain.gain.exponentialRampToValueAtTime(0.0001, at + 1.0)
    const high = this.context.createBiquadFilter()
    high.type = 'highpass'
    high.frequency.value = 650
    scream2.connect(high)
    high.connect(scream2Gain)
    scream2Gain.connect(dest)
    scream2.start(at)
    scream2.stop(at + 1.05)

    // breathy noise in the scream
    const noise = this.context.createBufferSource()
    const buffer = this.context.createBuffer(
      1,
      this.context.sampleRate * 1.1,
      this.context.sampleRate,
    )
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 0.55)
    }
    noise.buffer = buffer
    const noiseFilter = this.context.createBiquadFilter()
    noiseFilter.type = 'bandpass'
    noiseFilter.frequency.value = 1600
    noiseFilter.Q.value = 0.8
    const noiseGain = this.context.createGain()
    noiseGain.gain.setValueAtTime(0.55, at)
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, at + 1.0)
    noise.connect(noiseFilter)
    noiseFilter.connect(noiseGain)
    noiseGain.connect(dest)
    noise.start(at)
    noise.stop(at + 1.1)
  }

  private impactHit(dest: AudioNode, at: number) {
    if (!this.context) return
    const osc = this.context.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(160, at)
    osc.frequency.exponentialRampToValueAtTime(22, at + 0.4)
    const gain = this.context.createGain()
    gain.gain.setValueAtTime(0.0001, at)
    gain.gain.exponentialRampToValueAtTime(2.2, at + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.5)
    osc.connect(gain)
    gain.connect(dest)
    osc.start(at)
    osc.stop(at + 0.55)

    const thump = this.context.createBufferSource()
    const buffer = this.context.createBuffer(1, this.context.sampleRate * 0.25, this.context.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2.5)
    }
    thump.buffer = buffer
    const filter = this.context.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 160
    const thumpGain = this.context.createGain()
    thumpGain.gain.value = 1.8
    thump.connect(filter)
    filter.connect(thumpGain)
    thumpGain.connect(dest)
    thump.start(at)
  }

  private zombieRoar(dest: AudioNode, at: number) {
    if (!this.context) return

    const roar = this.context.createOscillator()
    roar.type = 'sawtooth'
    roar.frequency.setValueAtTime(220, at)
    roar.frequency.exponentialRampToValueAtTime(55, at + 1.4)
    const roarGain = this.context.createGain()
    roarGain.gain.setValueAtTime(0.0001, at)
    roarGain.gain.exponentialRampToValueAtTime(1.5, at + 0.04)
    roarGain.gain.exponentialRampToValueAtTime(0.0001, at + 1.5)
    const low = this.context.createBiquadFilter()
    low.type = 'lowpass'
    low.frequency.setValueAtTime(900, at)
    low.frequency.exponentialRampToValueAtTime(280, at + 1.3)
    roar.connect(low)
    low.connect(roarGain)
    roarGain.connect(dest)
    roar.start(at)
    roar.stop(at + 1.55)

    const shriek = this.context.createOscillator()
    shriek.type = 'square'
    shriek.frequency.setValueAtTime(980, at + 0.02)
    shriek.frequency.exponentialRampToValueAtTime(140, at + 1.1)
    const shriekGain = this.context.createGain()
    shriekGain.gain.setValueAtTime(0.0001, at)
    shriekGain.gain.exponentialRampToValueAtTime(1.15, at + 0.03)
    shriekGain.gain.exponentialRampToValueAtTime(0.0001, at + 1.2)
    const band = this.context.createBiquadFilter()
    band.type = 'bandpass'
    band.frequency.setValueAtTime(1700, at)
    band.frequency.exponentialRampToValueAtTime(450, at + 1)
    band.Q.value = 4
    shriek.connect(band)
    band.connect(shriekGain)
    shriekGain.connect(dest)
    shriek.start(at)
    shriek.stop(at + 1.25)
  }

  private wetGrowl(dest: AudioNode, at: number) {
    if (!this.context) return
    const growl = this.context.createOscillator()
    growl.type = 'triangle'
    growl.frequency.setValueAtTime(70, at)
    growl.frequency.exponentialRampToValueAtTime(32, at + 1.2)
    const gain = this.context.createGain()
    gain.gain.setValueAtTime(0.0001, at)
    gain.gain.exponentialRampToValueAtTime(1.0, at + 0.08)
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 1.35)

    const noise = this.context.createBufferSource()
    const buffer = this.context.createBuffer(
      1,
      this.context.sampleRate * 1.2,
      this.context.sampleRate,
    )
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 0.7)
    }
    noise.buffer = buffer
    const wet = this.context.createBiquadFilter()
    wet.type = 'bandpass'
    wet.frequency.value = 340
    wet.Q.value = 1.2
    const noiseGain = this.context.createGain()
    noiseGain.gain.setValueAtTime(0.7, at)
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, at + 1.1)

    growl.connect(gain)
    gain.connect(dest)
    noise.connect(wet)
    wet.connect(noiseGain)
    noiseGain.connect(dest)
    growl.start(at)
    growl.stop(at + 1.4)
    noise.start(at)
    noise.stop(at + 1.2)
  }

  private biteChomp(dest: AudioNode, at: number) {
    if (!this.context) return
    const click = this.context.createOscillator()
    click.type = 'square'
    click.frequency.setValueAtTime(420, at)
    click.frequency.exponentialRampToValueAtTime(80, at + 0.08)
    const gain = this.context.createGain()
    gain.gain.setValueAtTime(0.0001, at)
    gain.gain.exponentialRampToValueAtTime(0.95, at + 0.005)
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.12)
    click.connect(gain)
    gain.connect(dest)
    click.start(at)
    click.stop(at + 0.14)

    const crunch = this.context.createBufferSource()
    const buffer = this.context.createBuffer(
      1,
      this.context.sampleRate * 0.1,
      this.context.sampleRate,
    )
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length)
    }
    crunch.buffer = buffer
    const crunchGain = this.context.createGain()
    crunchGain.gain.value = 0.85
    crunch.connect(crunchGain)
    crunchGain.connect(dest)
    crunch.start(at)
  }

  private distantScream(dest: AudioNode, at: number) {
    if (!this.context) return
    const scream = this.context.createOscillator()
    scream.type = 'sawtooth'
    scream.frequency.setValueAtTime(1300, at)
    scream.frequency.exponentialRampToValueAtTime(180, at + 0.85)
    const gain = this.context.createGain()
    gain.gain.setValueAtTime(0.0001, at)
    gain.gain.exponentialRampToValueAtTime(0.8, at + 0.04)
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.9)
    const filter = this.context.createBiquadFilter()
    filter.type = 'highpass'
    filter.frequency.value = 700
    scream.connect(filter)
    filter.connect(gain)
    gain.connect(dest)
    scream.start(at)
    scream.stop(at + 0.95)
  }

  private staticBurst(dest: AudioNode, at: number) {
    if (!this.context) return
    const noise = this.context.createBufferSource()
    const buffer = this.context.createBuffer(
      1,
      this.context.sampleRate * 0.9,
      this.context.sampleRate,
    )
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i += 1) {
      const env = Math.pow(1 - i / data.length, 0.4)
      data[i] = (Math.random() * 2 - 1) * env
    }
    noise.buffer = buffer
    const high = this.context.createBiquadFilter()
    high.type = 'highpass'
    high.frequency.value = 1000
    const gain = this.context.createGain()
    gain.gain.setValueAtTime(1.5, at)
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.85)
    noise.connect(high)
    high.connect(gain)
    gain.connect(dest)
    noise.start(at)
    noise.stop(at + 0.9)
  }

  private heartbeat(dest: AudioNode, at: number) {
    if (!this.context) return
    const beat = this.context.createOscillator()
    beat.type = 'sine'
    beat.frequency.setValueAtTime(75, at)
    beat.frequency.exponentialRampToValueAtTime(32, at + 0.2)
    const gain = this.context.createGain()
    gain.gain.setValueAtTime(0.0001, at)
    gain.gain.exponentialRampToValueAtTime(1.25, at + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.24)
    beat.connect(gain)
    gain.connect(dest)
    beat.start(at)
    beat.stop(at + 0.28)
  }

  private stinger(dest: AudioNode, at: number) {
    if (!this.context) return
    const sting = this.context.createOscillator()
    sting.type = 'sawtooth'
    sting.frequency.setValueAtTime(2100, at)
    sting.frequency.exponentialRampToValueAtTime(180, at + 0.7)
    const gain = this.context.createGain()
    gain.gain.setValueAtTime(0.0001, at)
    gain.gain.exponentialRampToValueAtTime(1.25, at + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.75)
    const filter = this.context.createBiquadFilter()
    filter.type = 'highpass'
    filter.frequency.value = 500
    sting.connect(filter)
    filter.connect(gain)
    gain.connect(dest)
    sting.start(at)
    sting.stop(at + 0.8)
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
}
