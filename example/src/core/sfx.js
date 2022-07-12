import {
  Audio,
  AudioListener,
  AudioLoader,
  Group,
  MathUtils,
  PositionalAudio,
} from 'three';

class SFX extends Group {
  constructor() {
    super();
    const loader = new AudioLoader();
    this.pools = {};
    Promise.all([
      ...['ambient', 'blast', 'shot', 'rain'].map((sound) => (
        new Promise((resolve, reject) => loader.load(`/sounds/${sound}.ogg`, resolve, null, reject))
      )),
      new Promise((resolve) => {
        const onFirstInteraction = () => {
          window.removeEventListener('keydown', onFirstInteraction);
          window.removeEventListener('mousedown', onFirstInteraction);
          resolve();
        };
        window.addEventListener('keydown', onFirstInteraction, false);
        window.addEventListener('mousedown', onFirstInteraction, false);
      }),
    ])
      .then(([ambient, blast, shot, rain]) => {
        const listener = new AudioListener();
        document.addEventListener('visibilitychange', () => (
          listener.setMasterVolume(document.visibilityState === 'visible' ? 1 : 0)
        ), false);
        this.listener = listener;

        const getPool = (buffer, pool) => (
         Array.from({ length: pool }, () => {
            const sound = new PositionalAudio(listener);
            sound.matrixAutoUpdate = false;
            sound.setBuffer(buffer);
            sound.filter = new BiquadFilterNode(listener.context);
            sound.setFilter(sound.filter);
            sound.setRefDistance(32);
            sound.setVolume(0.4);
            this.add(sound);
            return sound;
          })
        );
        this.pools.blast = getPool(blast, 16);
        this.pools.shot = getPool(shot, 16);

        const filter = new BiquadFilterNode(listener.context, {
          type: 'lowpass',
          frequency: 1000,
        });
        const dry = new GainNode(listener.context, { gain: 1 });
        const wet = new GainNode(listener.context, { gain: 0 });
        filter.connect(listener.getInput());
        dry.connect(listener.getInput());
        wet.connect(filter);
        this.filterAmbient = (delta, light) => {
          const d = MathUtils.damp(dry.gain.value, light, 10, delta);
          dry.gain.value = d;
          wet.gain.value = 1 - d;
        };
        const getAmbient = (buffer) => {
          const sound = new Audio(listener);
          sound.gain.disconnect(listener.getInput());
          sound.gain.connect(dry);
          sound.gain.connect(wet);
          sound.setBuffer(buffer);
          sound.setLoop(true);
          sound.setVolume(0.4);
          return sound;
        };
        this.ambient = getAmbient(ambient);
        this.ambient.play();
        this.rain = getAmbient(rain, 0);
      });
  }

  onAnimationTick(delta, camera, light, isRaining) {
    const { listener, rain } = this;
    if (!listener) {
      return;
    }
    this.filterAmbient(delta, light);
    if (isRaining && !rain.isPlaying) {
      rain.play();
    } else if (!isRaining && rain.isPlaying) {
      rain.pause();
    }
    camera.matrixWorld.decompose(listener.position, listener.quaternion, listener.scale);
    listener.updateMatrixWorld();
  }

  playAt(id, position, filter, frequency) {
    const { pools } = this;
    const pool = pools[id];
    if (!pool) {
      return;
    }
    const sound = pools[id].find(({ isPlaying }) => !isPlaying);
    if (!sound) {
      return;
    }
    sound.filter.type = filter;
    sound.filter.frequency.value = Math.round(frequency);
    sound.position.copy(position);
    sound.updateMatrix();
    sound.play(sound.listener.timeDelta);
  }
}

export default SFX;
