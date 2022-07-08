import {
  BufferAttribute,
  Color,
  IcosahedronGeometry,
  InstancedBufferGeometry,
  InstancedBufferAttribute,
  Mesh,
  ShaderLib,
  ShaderMaterial,
  UniformsUtils,
} from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

class Explosion extends Mesh {
  static setupGeometry() {
    const sphere = new IcosahedronGeometry(0.5, 3);
    sphere.deleteAttribute('uv');
    const scale = 1 / Explosion.chunks;
    sphere.scale(scale, scale, scale);
    {
      const { count } = sphere.getAttribute('position');
      const color = new BufferAttribute(new Float32Array(count * 3), 3);
      let light;
      for (let i = 0; i < count; i += 1) {
        if (i % 3 === 0) {
          light = 1 - Math.random() * 0.1;
        }
        color.setXYZ(i, light, light, light);
      }
      sphere.setAttribute('color', color);
    }
    const model = mergeVertices(sphere);
    const geometry = new InstancedBufferGeometry();
    geometry.setIndex(model.getIndex());
    geometry.setAttribute('position', model.getAttribute('position'));
    geometry.setAttribute('color', model.getAttribute('color'));
    geometry.setAttribute('normal', model.getAttribute('normal'));
    const count = Explosion.chunks ** 3;
    const stride = 1 / Explosion.chunks;
    const offset = new Float32Array(count * 3);
    const direction = new Float32Array(count * 3);
    for (let v = 0, z = -0.5; z < 0.5; z += stride) {
      for (let y = -0.5; y < 0.5; y += stride) {
        for (let x = -0.5; x < 0.5; x += stride, v += 3) {
          direction[v] = Math.random() - 0.5;
          direction[v + 1] = Math.random() - 0.5;
          direction[v + 2] = Math.random() - 0.5;
          offset[v] = x;
          offset[v + 1] = y;
          offset[v + 2] = z;
        }
      }
    }
    geometry.setAttribute('direction', new InstancedBufferAttribute(direction, 3));
    geometry.setAttribute('offset', new InstancedBufferAttribute(offset, 3));
    Explosion.geometry = geometry;
  }

  static setupMaterial() {
    const { uniforms, vertexShader, fragmentShader } = ShaderLib.basic;
    Explosion.material = new ShaderMaterial({
      vertexColors: true,
      uniforms: {
        ...UniformsUtils.clone(uniforms),
        step: { value: 0 },
      },
      vertexShader: vertexShader
        .replace(
          '#include <common>',
          [
            '#include <common>',
            'varying vec3 fragNormal;',
            'attribute vec3 direction;',
            'attribute vec3 offset;',
            'uniform float step;',
          ].join('\n')
        )
        .replace(
          '#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )',
          '#if 1'
        )
        .replace(
          '#include <begin_vertex>',
          [
            'fragNormal = transformedNormal;',
            'vec3 transformed = vec3( position * (2.0 - step * step * 2.0) + direction * step * 5.0 + offset );',
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

  constructor() {
    if (!Explosion.geometry) {
      Explosion.setupGeometry();
    }
    if (!Explosion.material) {
      Explosion.setupMaterial();
    }
    super(
      Explosion.geometry,
      Explosion.material 
    );
    this.color = new Color();
    this.frustumCulled = false;
    this.matrixAutoUpdate = false;
  }

  onAnimationTick(delta) {
    const { step } = this;
    this.step = Math.min(step + delta * 3, 1);
    return this.step >= 1;
  }

  onBeforeRender() {
    const { color, material, step } = this;
    material.uniforms.diffuse.value.copy(color);
    material.uniforms.step.value = step;
    material.uniformsNeedUpdate = true;
  }
}

Explosion.chunks = 4;

export default Explosion;
