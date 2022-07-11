import { Color, Group, Vector3 } from 'three';
import Actor from '../renderables/actor.js';

const _from = new Vector3();
const _to = new Vector3();
const _offset = new Vector3();

class Actors extends Group {
  constructor({ count, model, world }) {
    super();
    this.matrixAutoUpdate = false;
    this.model = model;
    this.world = world;
    Actor.setupMaterial();
    ['ambientColor', 'lightColor'].forEach((uniform) => {
      Actor.material.uniforms[uniform].value = world.material.uniforms[uniform].value;
    });
    for (let i = 0; i < count; i++) {
      this.spawn();
    }
  }

  onAnimationTick(delta, frustum) {
    const { children, world } = this;
    children.forEach((actor) => {
      actor.onAnimationTick(delta, frustum);
      if (actor.path) {
        return;
      }
      if (actor.waiting > 0) {
        actor.waiting -= delta;
        return;
      }
      _from.copy(actor.position).divide(world.scale).floor();
      const ground = world.volume.ground(_from, 4);
      if (ground !== _from.y) {
        _from.y = ground;
        actor.position.copy(_from);
        world.volume.obstacle(actor.obstacle, false, 4);
        world.volume.obstacle(actor.obstacle.copy(_from), true, 4);
        actor.position.x += 0.5;
        actor.position.z += 0.5;
        actor.position.multiply(world.scale);
        actor.setLight(actor.position);
      }
      _to.copy(_from).addScaledVector(_offset.set(Math.random() - 0.5, Math.random() - 0.25, Math.random() - 0.5), 32).floor();
      _to.y = Math.min(_to.y, world.volume.height - 1);
      _to.y = world.volume.ground(_to, 4);
      if (_to.y <= 0) {
        actor.waiting = Math.random();
        return;
      }
      const result = world.volume.pathfind({
        from: _from,
        to: _to,
        maxVisited: 2048,
        height: 4,
      });
      if (result.length <= 3) {
        actor.waiting = Math.random();
        return;
      }
      actor.setPath(
        result,
        world.scale,
        () => {
          actor.waiting = 3 + Math.random() * 3;
        },
      );
      world.volume.obstacle(actor.obstacle, false, 4);
      world.volume.obstacle(actor.obstacle.copy(_to), true, 4);
    });
  }

  light(position) {
    const { world } = this;
    _from.copy(position).divide(world.scale).floor();
    _from.y += 2;
    const voxel = world.volume.voxel(_from);
    return voxel !== -1 ? (world.volume.memory.light.view[voxel] / 32) : 1;
  }

  spawn() {
    const { model: { animations, model }, world } = this;
    const actor = new Actor({
      animations,
      colors: {
        Joints: new Color(0.4, 0.4, 0.4),
        Surface: (new Color()).setHSL(Math.random(), 0.4 + Math.random() * 0.2, 0.5 + Math.random() * 0.2),
      },
      light: this.light.bind(this),
      model: model(),
    });
    actor.position
      .set(
        world.volume.width * 0.5 + (Math.random() - 0.5) * world.volume.width * 0.5,
        world.volume.height - 1,
        world.volume.depth * 0.5 + (Math.random() - 0.5) * world.volume.depth * 0.5
      )
      .floor();
    actor.position.y = world.volume.ground(actor.position);
    actor.obstacle = actor.position.clone();
    world.volume.obstacle(actor.obstacle, true, 4);
    actor.position.x += 0.5;
    actor.position.z += 0.5;
    actor.position.multiply(world.scale);
    actor.setLight(actor.position);
    this.add(actor);
  }
}

export default Actors;
