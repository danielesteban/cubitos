import {
  Audio,
  AudioListener,
  AudioLoader,
  Group,
  PositionalAudio,
} from 'three';

class SFX extends Group {
  constructor() {
    super();
    const loader = new AudioLoader();
    this.pools = {};
    Promise.all([
      ...['ambient', 'blast', 'shot'].map((sound) => (
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
      .then(([ambient, blast, shot]) => {
        const listener = new AudioListener();
        document.addEventListener('visibilitychange', () => (
          listener.setMasterVolume(document.visibilityState === 'visible' ? 1 : 0)
        ), false);
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
        this.ambient = new Audio(listener);
        this.ambient.setBuffer(ambient);
        this.ambient.setLoop(true);
        this.ambient.setVolume(0.4);
        this.ambient.play();
        this.listener = listener;
        this.pools.blast = getPool(blast, 16);
        this.pools.shot = getPool(shot, 16);
      });
  }

  onAnimationTick(camera) {
    const { listener } = this;
    if (!listener) {
      return;
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
