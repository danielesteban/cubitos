import { Group, Vector3 } from 'three';
import Chunk from './chunk.js';

const _queueMicrotask = (typeof self.queueMicrotask === 'function') ? (
  self.queueMicrotask
) : (callback) => {
  Promise.resolve()
    .then(callback)
    .catch(e => setTimeout(() => { throw e; }));
};

const _chunk = new Vector3();
const _voxel = new Vector3();

class World extends Group {
  constructor({ chunkSize = 16, material, volume }) {
    super();
    this.matrixAutoUpdate = false;
    this.chunks = new Map();
    this.chunkSize = chunkSize;
    this.remeshQueue = new Map();
    this.volume = volume;
    for (let z = 0; z < volume.depth / chunkSize; z++) {
      for (let y = 0; y < volume.height / chunkSize; y++) {
        for (let x = 0; x < volume.width / chunkSize; x++) {
          const chunk = new Chunk({ material, position: new Vector3(x, y, z), world: this });
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
    const { chunkSize, volume } = this;
    World.getBrush(radius).forEach((offset) => {
      _voxel.addVectors(point, offset);
      const voxel = volume.voxel(_voxel);
      if (voxel !== -1) {
        volume.memory.voxels.view[voxel] = typeof value === 'function' ? value(offset.d, volume.memory.voxels.view[i]) : value;
        _chunk.copy(_voxel).divideScalar(chunkSize).floor();
        _voxel.addScaledVector(_chunk, -chunkSize);
        this.remesh(_chunk.x, _chunk.y, _chunk.z);
        if (_voxel.x === 0) {
          this.remesh(_chunk.x - 1, _chunk.y, _chunk.z);
        }
        if (_voxel.y === 0) {
          this.remesh(_chunk.x, _chunk.y - 1, _chunk.z);
        }
        if (_voxel.z === 0) {
          this.remesh(_chunk.x, _chunk.y, _chunk.z - 1);
        }
        if (_voxel.x === chunkSize - 1) {
          this.remesh(_chunk.x + 1, _chunk.y, _chunk.z);
        }
        if (_voxel.y === chunkSize - 1) {
          this.remesh(_chunk.x, _chunk.y + 1, _chunk.z);
        }
        if (_voxel.z === chunkSize - 1) {
          this.remesh(_chunk.x, _chunk.y, _chunk.z + 1);
        }
      }
    });
  }

  static getBrush(radius) {
    const { brushes } = World;
    let brush = brushes.get(radius);
    if (!brush) {
      brush = [];
      const center = (new Vector3()).setScalar(0.5);
      for (let z = -radius; z <= radius + 1; z += 1) {
        for (let y = -radius; y <= radius + 1; y += 1) {
          for (let x = -radius; x <= radius + 1; x += 1) {
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
