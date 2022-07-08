import { Group, Vector3 } from 'three';
import Explosion from '../renderables/explosion.js';
import Projectile from '../renderables/projectile.js';

const _voxel = new Vector3();

class Projectiles extends Group {
  constructor({ sfx, world }) {
    super();
    this.matrixAutoUpdate = false;
    this.sfx = sfx;
    this.pools = {
      explosions: [],
      projectiles: [],
    };
    this.world = world;
    this.explosions = [];
    this.projectiles = [];
    this.targets = [];
  }

  onAnimationTick(delta) {
    const { explosions, pools, projectiles, targets, world } = this;
    const iterations = 3;
    const step = (60 / iterations) * delta;
    for (let p = 0, l = projectiles.length; p < l; p++) {
      const projectile = projectiles[p];
      for (let i = 0; i < iterations; i++) {
        projectile.onAnimationTick(step);
        _voxel.copy(projectile.position).divide(world.scale).floor();
        let hit = this.test(_voxel) && world;
        if (!hit && i !== 0) {
          hit = targets.find((target) => (
            target.visible && projectile.position.distanceTo(target.head || target.position) < target.scale.x
          ));
        }
        if (hit || projectile.distance > 200) {
          this.remove(projectile);
          projectiles.splice(p, 1);
          pools.projectiles.push(projectile);
          p--;
          l--;
          if (hit) {
            const point = hit === world ? projectile.position : hit.position;
            this.blast({
              color: hit.color || projectile.color,
              origin: point,
              radius: 3 + Math.floor(Math.random() * 2),
            });
            this.dispatchEvent({
              type: 'hit',
              color: hit.color || projectile.color,
              object: hit,
              owner: projectile.owner,
              point,
            });
          }
          break;
        }
      }
    }
    for (let i = 0, l = explosions.length; i < l; i++) {
      const explosion = explosions[i];
      if (explosion.onAnimationTick(delta)) {
        this.remove(explosion);
        explosions.splice(i, 1);
        pools.explosions.push(explosion);
        i--;
        l--;
      }
    }
  }

  blast({ color, origin, radius }) {
    const { explosions, pools, sfx, world } = this;
    _voxel.copy(origin).divide(world.scale).floor();
    world.update(_voxel, radius, 0);
    sfx.playAt('blast', origin, 'lowpass', 1000 + Math.random() * 1000);
    const explosion = pools.explosions.pop() || new Explosion();
    explosion.color.copy(color);
    explosion.position.copy(origin);
    explosion.rotation.set((Math.random() - 0.5) * Math.PI * 2, (Math.random() - 0.5) * Math.PI * 2, (Math.random() - 0.5) * Math.PI * 2);
    explosion.updateMatrix();
    explosion.step = 0;
    explosions.push(explosion);
    this.add(explosion);
  }

  shoot({ color, direction, offset = 1, origin, owner }) {
    const { pools, projectiles, sfx } = this;
    sfx.playAt('shot', _voxel.addVectors(origin, direction), 'highpass', 1000 + Math.random() * 1000);
    const projectile = pools.projectiles.pop() || new Projectile();
    projectile.color.copy(color);
    projectile.direction.copy(direction);
    projectile.distance = 0;
    projectile.position.copy(origin).addScaledVector(direction, offset);
    projectile.owner = owner;
    projectiles.push(projectile);
    this.add(projectile);
  }
    
  test(position) {
    const { world } = this;
    const voxel = world.volume.voxel(position);
    return voxel !== -1 && world.volume.memory.voxels.view[voxel] !== 0;
  }
}

export default Projectiles;
