import {
  Box3,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  PlaneGeometry,
  Sphere,
  Vector3,
} from 'three';

const _bounds = new Box3();
const _box = new Box3();
const _neighbor = new Vector3();
const _neighbors = [
  new Vector3(0, 0, 1),
  new Vector3(0, 1, 0),
  new Vector3(0, -1, 0),
  new Vector3(-1, 0, 0),
  new Vector3(1, 0, 0),
  new Vector3(0, 0, -1),
];
const _voxel = new Vector3();

class Chunk extends Mesh {
  static setupGeometry() {
    const plane = new PlaneGeometry(1, 1, 1, 1);
    plane.translate(0, 0, 0.5);
    const uv = plane.getAttribute('uv');
    for (let i = 0, l = uv.count; i < l; i++) {
      uv.setXY(i, uv.getX(i), 1.0 - uv.getY(i));
    }
    Chunk.geometry = {
      index: plane.getIndex(),
      position: plane.getAttribute('position'),
      normal: plane.getAttribute('normal'),
      uv,
    };
  }

  constructor({ material, position, world }) {
    if (!Chunk.geometry) {
      Chunk.setupGeometry();
    }
    const geometry = new InstancedBufferGeometry();
    geometry.boundingSphere = new Sphere();
    geometry.setIndex(Chunk.geometry.index);
    geometry.setAttribute('position', Chunk.geometry.position);
    geometry.setAttribute('normal', Chunk.geometry.normal);
    geometry.setAttribute('uv', Chunk.geometry.uv);
    super(geometry, material);
    this.matrixAutoUpdate = false;
    this.position.copy(position).multiplyScalar(world.chunkSize);
    this.world = world;
    this.updateMatrix();
    this.update();
  }

  update() {
    const { geometry, material, position, world: { chunkSize, volume } } = this;  
    const faces = [];
    _bounds.makeEmpty();
    for (let cz = 0; cz < chunkSize; cz++) {
      for (let cy = 0; cy < chunkSize; cy++) {
        for (let cx = 0; cx < chunkSize; cx++) {
          _voxel.set(cx, cy, cz).add(position);
          const value = volume.memory.voxels.view[volume.voxel(_voxel)];
          if (value !== 0) {
            _neighbors.forEach((neighbor, face) => {
              _neighbor.addVectors(_voxel, neighbor);
              const voxel = volume.voxel(_neighbor);
              if (voxel !== -1 && volume.memory.voxels.view[voxel] === 0) {
                _box.min.set(cx, cy, cz);
                _box.max.set(cx + 1, cy + 1, cz + 1);
                _bounds.union(_box);
                const texture = material.mapping ? (
                  material.mapping(face, value, _voxel)
                ) : (
                  value - 1
                );
                faces.push(cx + 0.5, cy + 0.5, cz + 0.5, texture * 6 + face);
              }
            });
          }
        }
      }
    }
    _bounds.getBoundingSphere(geometry.boundingSphere);
    geometry.instanceCount = geometry._maxInstanceCount = faces.length / 4;
    geometry.setAttribute('face', new InstancedBufferAttribute(new Float32Array(faces), 4, false, 1));
    this.visible = geometry.instanceCount !== 0;
  }
}

export default Chunk;
