import {
  BoxGeometry,
  Color,
  DynamicDrawUsage,
  InstancedBufferGeometry,
  InstancedBufferAttribute,
  Mesh,
  ShaderLib,
  ShaderMaterial,
  UniformsUtils,
  Vector3,
} from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const _voxel = new Vector3();

class Rain extends Mesh {
  static setupGeometry() {
    let drop = new BoxGeometry(0.05, 0.5, 0.05);
    drop.deleteAttribute('uv');
    drop.translate(0, 0.25, 0);
    drop = mergeVertices(drop);
    Rain.geometry = {
      index: drop.getIndex(),
      position: drop.getAttribute('position'),
      normal: drop.getAttribute('normal'),
    };
  }

  static setupMaterial() {
    const { uniforms, vertexShader, fragmentShader } = ShaderLib.basic;
    Rain.material = new ShaderMaterial({
      uniforms: {
        ...UniformsUtils.clone(uniforms),
        diffuse: { value: new Color(0x224466) },
      },
      vertexShader: vertexShader
        .replace(
          '#include <common>',
          [
            'attribute vec3 offset;',
            'varying vec3 fragNormal;',
            '#include <common>',
          ].join('\n')
        )
        .replace(
          '#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )',
          '#if 1'
        )
        .replace(
          '#include <begin_vertex>',
          [
            'vec3 transformed = vec3(position + offset);',
            'fragNormal = transformedNormal;',
          ].join('\n')
        ),
      fragmentShader: fragmentShader
        .replace(
          '#include <common>',
          [
            '#include <common>',
            'layout(location = 1) out vec4 pc_fragNormal;',
            'varying vec3 fragNormal;',
          ].join('\n')
        )
        .replace(
          '#include <dithering_fragment>',
          [
            '#include <dithering_fragment>',
            'pc_fragNormal = vec4(normalize(fragNormal), 0.0);',
          ].join('\n')
        ),
    });
  }

  constructor({
    minY = 0,
    world,
  }) {
    if (!Rain.geometry) {
      Rain.setupGeometry();
    }
    if (!Rain.material) {
      Rain.setupMaterial();
    }
    const geometry = new InstancedBufferGeometry();
    geometry.setIndex(Rain.geometry.index);
    geometry.setAttribute('position', Rain.geometry.position);
    geometry.setAttribute('offset', (new InstancedBufferAttribute(new Float32Array(Rain.numDrops * 3), 3).setUsage(DynamicDrawUsage)));
    super(
      geometry,
      Rain.material
    );
    this.dropMinY = minY;
    this.targets = new Float32Array(Rain.numDrops);
    this.frustumCulled = false;
    this.matrixAutoUpdate = false;
    this.visible = false;
    this.world = world;
  }

  dispose() {
    const { geometry } = this;
    geometry.dispose();
  }

  onAnimationTick(delta, anchor) {
    if (!this.visible) {
      return;
    }
    const { geometry, targets } = this;
    const offsets = geometry.getAttribute('offset');
    for (let i = 0; i < Rain.numDrops; i += 1) {
      const y = offsets.getY(i) - (delta * (20 + (i % 10)));
      const height = targets[i];
      if (y > height) {
        offsets.setY(i, y);
      } else {
        this.resetDrop(anchor, i);
      }
    }
    offsets.needsUpdate = true;
  }

  resetDrop(anchor, i) {
    const { radius } = Rain;
    const {
      geometry,
      dropMinY,
      targets,
      world,
    } = this;
    _voxel
      .set(Math.random() - 0.5, 0, Math.random() - 0.5)
      .normalize()
      .multiplyScalar(radius * Math.random())
      .add(anchor);
    const offsets = geometry.getAttribute('offset');
    offsets.setX(i, _voxel.x);
    offsets.setZ(i, _voxel.z);

    _voxel.divide(world.scale).floor();
    let height = dropMinY;
    if (
      _voxel.x >= 0 && _voxel.x < world.volume.width
      && _voxel.z >= 0 && _voxel.z < world.volume.depth
    ) {
      height = Math.max(world.volume.memory.height.view[_voxel.z * world.volume.width + _voxel.x] + 1, dropMinY);
    }
    height *= world.scale.y;
    targets[i] = height;
    offsets.setY(i, Math.max(anchor.y + Math.random() * radius * 2, height));
    offsets.needsUpdate = true;
  }

  reset(anchor) {
    const { numDrops } = Rain;
    for (let i = 0; i < numDrops; i += 1) {
      this.resetDrop(anchor, i);
    }
  }
}

Rain.numDrops = 8000;
Rain.radius = 40;

export default Rain;
