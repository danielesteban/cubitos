import { Group, Vector3 } from 'three';
import Chunk from './chunk.js';

const _queueMicrotask = (typeof self.queueMicrotask === 'function') ? (
  self.queueMicrotask
) : (callback) => {
  Promise.resolve()
    .then(callback)
    .catch(e => setTimeout(() => { throw e; }));
};

const _max = new Vector3();
const _min = new Vector3();
const _voxel = new Vector3();

class World extends Group {
  constructor({ material, volume }) {
    super();
    this.matrixAutoUpdate = false;
    this.chunks = new Map();
    this.material = material;
    this.remeshQueue = new Map();
    this.volume = volume;
    for (let z = 0; z < volume.depth / volume.chunkSize; z++) {
      for (let y = 0; y < volume.height / volume.chunkSize; y++) {
        for (let x = 0; x < volume.width / volume.chunkSize; x++) {
          const chunk = new Chunk({ material, position: new Vector3(x, y, z), volume });
          this.chunks.set(`${z}:${y}:${x}`, chunk);
          this.add(chunk);
        }
      }
    }
  }

  remesh(x, y, z) {
    const { chunks, remeshQueue } = this;
    const mesh = chunks.get(`${z}:${y}:${x}`);
    if (!mesh) {
      return;
    }
    if (!remeshQueue.size) {
      _queueMicrotask(() => {
        remeshQueue.forEach((mesh) => mesh.update());
        remeshQueue.clear();
      });
    }
    remeshQueue.set(mesh, mesh);
  }

  update(point, radius, value) {
    const { material, volume } = this;
    const updateLight = material.defines.USE_LIGHT;
    World.getBrush(radius).forEach((offset) => {
      _voxel.addVectors(point, offset);
      const current = volume.memory.voxels.view[volume.voxel(_voxel)];
      const update = typeof value === 'function' ? (
        value(offset.d, current, _voxel)
      ) : (
        value
      );
      if (update !== -1 && update !== current) {
        const bounds = volume.update(_voxel, update, updateLight);
        _min.set(bounds[0] - 1, bounds[1] - 1, bounds[2] - 1).divideScalar(volume.chunkSize).floor();
        _max.set(bounds[3] + 1, bounds[4] + 1, bounds[5] + 1).divideScalar(volume.chunkSize).floor();
        for (let z = _min.z; z <= _max.z; z++) {
          for (let y = _min.y; y <= _max.y; y++) {
            for (let x = _min.x; x <= _max.x; x++) {
              this.remesh(x, y, z);
            }
          }
        }
      }
    });
  }

  static getBrush(radius) {
    const { brushes } = World;
    let brush = brushes.get(radius);
    if (!brush) {
      brush = [];
      const center = (new Vector3()).setScalar(-0.5);
      for (let z = -radius; z <= radius; z += 1) {
        for (let y = -radius; y <= radius; y += 1) {
          for (let x = -radius; x <= radius; x += 1) {
            const point = new Vector3(x, y, z);
            point.d = point.distanceTo(center);
            if (point.d <= radius) {
              brush.push(point);
            }
          }
        }
      }
      brush.sort((a, b) => (a.d - b.d));
      brushes.set(radius, brush);
    }
    return brush;
  }
}

World.brushes = new Map();

export default World;
