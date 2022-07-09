import {
  Color,
  Frustum,
  Group,
  MathUtils,
  Matrix4,
  Scene,
  Vector3,
} from 'three';
import { ChunkMaterial, Volume, World, Worldgen } from 'cubitos';
import Actors from './core/actors.js';
import ChunkAtlas from './core/atlas.js';
import loadModel from './core/models.js';
import Input from './core/input.js';
import Projectiles from './core/projectiles.js';
import SFX from './core/sfx.js';
import Dome from './renderables/dome.js';

const _color = new Color();
const _origin = new Vector3();
const _direction = new Vector3();
const _forward = new Vector3();
const _projection = new Matrix4();
const _right = new Vector3();
const _worldUp = new Vector3(0, 1, 0);

class Gameplay extends Scene {
  constructor({ camera, renderer }) {
    super();

    this.dome = new Dome();
    this.add(this.dome);
    this.input = new Input(renderer.domElement);
    this.loading = document.getElementById('loading');
    this.loading.classList.add('enabled');
    this.sfx = new SFX();
    this.add(this.sfx);

    camera.position.set(0, 1.6, 0);
    camera.rotation.set(0, 0, 0, 'YXZ');
    this.player = new Group();
    this.player.camera = camera;
    this.player.frustum = new Frustum();
    this.player.isWalking = true;
    this.player.lastShot = 0;
    this.player.targetFloor = 0;
    this.player.targetPosition = this.player.position.clone();
    this.player.targetRotation = this.player.camera.rotation.clone();
    this.player.add(camera);
    this.add(this.player);

    Promise.all([
      loadModel('bot'),
      new Promise((resolve, reject) => {
        const volume = new Volume({
          width: 192,
          height: 128,
          depth: 192,
          onLoad: () => resolve(Worldgen({ volume })),
          onError: (err) => reject(err),
        });
      })
        .then((volume) => {
          this.volume = volume;
          this.world = new World({
            material: new ChunkMaterial(new ChunkAtlas()),
            volume: this.volume,
          });
          this.world.scale.setScalar(0.5);
          this.world.updateMatrix();
          this.add(this.world);

          this.projectiles = new Projectiles({ sfx: this.sfx, world: this.world });
          this.add(this.projectiles);

          this.player.position.set(
            Math.floor(this.volume.width * 0.5),
            this.volume.height - 1,
            Math.floor(this.volume.depth * 0.5)
          );
          this.player.position.y = this.volume.ground(this.player.position);
          this.player.position.x += 0.5;
          this.player.position.z += 0.5;
          this.player.position.multiply(this.world.scale);
          this.player.targetFloor = this.player.position.y;
          this.player.targetPosition.copy(this.player.position);

          this.loading.classList.remove('enabled');
        }),
    ])
      .then(([bot]) => {
        this.actors = new Actors({ count: 20, model: bot, world: this.world });
        this.add(this.actors);
      })
      .catch((e) => console.log(e));
  }

  onAnimationTick(delta, time) {
    const { actors, input, player, projectiles, sfx, world } = this;
    if (!world) {
      return;
    }
    input.onAnimationTick();
    this.processPlayerMovement(delta);
    this.processPlayerInput(time);
    if (actors) {
      actors.onAnimationTick(delta, player.frustum);
    }
    projectiles.onAnimationTick(delta);
    sfx.onAnimationTick(player.camera);
  }

  processPlayerMovement(delta) {
    const { input, player, volume, world } = this;

    if (input.look.x || input.look.y) {
      player.targetRotation.y += input.look.x;
      player.targetRotation.x += input.look.y;
      player.targetRotation.x = Math.min(Math.max(player.targetRotation.x, Math.PI * -0.5), Math.PI * 0.5);
    }
    player.camera.rotation.y = MathUtils.damp(player.camera.rotation.y, player.targetRotation.y, 20, delta);
    player.camera.rotation.x = MathUtils.damp(player.camera.rotation.x, player.targetRotation.x, 20, delta);

    if (input.movement.x || input.movement.y) {
      player.camera.getWorldDirection(_forward);
      if (player.isWalking) {
        _forward.y = 0;
        _forward.normalize();
      }
      _right.crossVectors(_forward, _worldUp).normalize();
      _direction
        .set(0, 0, 0)
        .addScaledVector(_right, input.movement.x)
        .addScaledVector(_forward, input.movement.y);
      const length = _direction.length();
      if (length > 1) {
        _direction.divideScalar(length);
      }
      const step = input.speed * (input.buttons.run ? 2 : 1) * delta;
      if (player.isWalking) {
        player.camera.getWorldPosition(_forward)
          .sub(player.position)
          .add(player.targetPosition)
          .addScaledVector(_direction, step)
          .divide(world.scale)
          .floor();
        const floor = volume.ground(_forward) * world.scale.y;
        if (floor !== -1 && Math.abs(floor - player.targetPosition.y) < 2) {
          player.targetPosition.addScaledVector(_direction, step);
          player.targetFloor = floor;
        }
      } else {
        player.targetPosition.addScaledVector(_direction, step);
      }
    }
  
    if (player.isWalking) {
      player.targetPosition.y = MathUtils.damp(player.targetPosition.y, player.targetFloor, 10, delta);
    }
    player.position.x = MathUtils.damp(player.position.x, player.targetPosition.x, 10, delta);
    player.position.y = MathUtils.damp(player.position.y, player.targetPosition.y, 10, delta);
    player.position.z = MathUtils.damp(player.position.z, player.targetPosition.z, 10, delta);
  
    player.updateMatrixWorld();
    _projection.multiplyMatrices(player.camera.projectionMatrix, player.camera.matrixWorldInverse);
    player.frustum.setFromProjectionMatrix(_projection);
  }
  
  processPlayerInput(time) {
    const { input, player, projectiles, volume, world } = this;
    if (input.buttons.primary && time >= player.lastShot + 0.06) {
      player.lastShot = time;
      _origin.setFromMatrixPosition(player.camera.matrixWorld);
      _direction.set(0, 0, 0.5).unproject(player.camera).sub(_origin).normalize();
      projectiles.shoot({
        color: _color.setHSL(Math.random(), 0.4 + Math.random() * 0.2, 0.6 + Math.random() * 0.2),
        direction: _direction,
        offset: 1,
        origin: _origin,
        owner: player,
      });
    }
    if (input.buttons.interactDown) {
      player.isWalking = !player.isWalking;
      if (player.isWalking) {
        const y = volume.ground(_origin.copy(player.targetPosition).divide(world.scale).floor());
        if (y !== -1) {
          player.targetFloor = y * world.scale.y;
        }
      }
    }
  }
}

export default Gameplay;
