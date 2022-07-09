import {
  AnimationMixer,
  Box3,
  Group,
  MathUtils,
  Vector3,
  ShaderMaterial,
  ShaderLib,
  UniformsUtils,
} from 'three';

const _box = new Box3();
const _vector = new Vector3();

class Actor extends Group {
  static setupMaterial() {
    const { uniforms, vertexShader, fragmentShader } = ShaderLib.basic;
    Actor.material = new ShaderMaterial({
      uniforms: UniformsUtils.clone(uniforms),
      vertexShader: vertexShader
        .replace(
          '#include <common>',
          [
            '#include <common>',
            'varying vec3 fragNormal;',
          ].join('\n')
        )
        .replace(
          '#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )',
          '#if 1'
        )
        .replace(
          '#include <begin_vertex>',
          [
            '#include <begin_vertex>',
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
    animations,
    colors,
    model,
    walkingBaseSpeed = 3,
  }) {
    if (!Actor.material) {
      Actor.setupMaterial();
    };
    super();
    this.mixer = new AnimationMixer(model);
    this.actions = animations.reduce((actions, clip) => {
      const action = this.mixer.clipAction(clip);
      action.play();
      action.enabled = false;
      actions[clip.name] = action;
      return actions;
    }, {});
    this.actions.walking.baseSpeed = walkingBaseSpeed;
    this.action = this.actions.idle;
    this.action.enabled = true;
    this.collider = new Box3(new Vector3(-0.25, 0, -0.25), new Vector3(0.25, 2, 0.25));
    this.colors = colors;
    this.rotation.set(0, 0, 0, 'YXZ');
    this.targetRotation = 0;
    this.setWalkingSpeed(3);
    model.traverse((child) => {
      if (child.isMesh) {
        const material = child.material.name;
        child.material = Actor.material;
        child.onBeforeRender = () => {
          const { colors } = this;
          child.material.uniforms.diffuse.value.copy(colors[material]);
          child.material.uniformsNeedUpdate = true;
        };
        child.frustumCulled = false;
      }
    });
    this.add(model);
  }
  
  getCollider() {
    const { collider, matrixWorld } = this;
    this.updateWorldMatrix(true, false);
    return _box.copy(collider).applyMatrix4(matrixWorld);
  }

  onAnimationTick(delta, frustum) {
    const {
      actions,
      mixer,
      rotation,
      targetRotation,
      walkingSpeed,
    } = this;
    mixer.update(delta);
    if (this.actionTimer) {
      this.actionTimer -= delta;
      if (this.actionTimer <= 0) {
        this.setAction(actions.idle);
      }
    }
    if (Math.abs(targetRotation - rotation.y) > 0.01) {
      rotation.y = MathUtils.damp(rotation.y, targetRotation, walkingSpeed * 1.5, delta);
    }
    this.processMovement(delta);
    this.visible = frustum.intersectsBox(this.getCollider());
  }

  processMovement(delta) {
    const {
      actions,
      onDestination,
      onStep,
      position,
      path,
      step,
      walkingSpeed,
    } = this;
    if (!path) {
      return;
    }
    const from = path[step];
    const to = path[step + 1];
    const isAscending = from.y < to.y;
    const isDescending = from.readyToDescent;
    const isBeforeDescending = !isDescending && from.y > to.y;
    this.interpolation = Math.min(
      this.interpolation + delta * walkingSpeed * (isAscending || isDescending ? 1.5 : 1),
      1.0
    );
    const { interpolation } = this;
    const destination = _vector.copy(to);
    if (isAscending) {
      destination.copy(from);
      destination.y = to.y;
    } else if (isBeforeDescending) {
      destination.y = from.y;
    }
    position.lerpVectors(from, destination, interpolation);
    if (this.interpolation < 1) {
      return;
    }
    this.interpolation = 0;
    if (isAscending || isBeforeDescending) {
      if (isAscending) {
        from.y = to.y;
      }
      if (isBeforeDescending) {
        from.x = to.x;
        from.z = to.z;
        from.readyToDescent = true;
      }
      return;
    }
    this.step++;
    const isLast = this.step >= path.length - 1;
    if (onStep && (isLast || (step % 2 === 0))) {
      onStep();
    }
    if (isLast) {
      delete this.onDestination;
      delete this.path;
      let action;
      if (onDestination) {
        action = onDestination();
      }
      this.setAction(action || actions.idle);
    } else {
      this.setTarget(path[this.step + 1]);
    }
  }

  setAction(action, timer) {
    const { actions, action: current } = this;
    this.actionTimer = timer;
    if (action === current) {
      return;
    }
    this.action = action;
    action
      .reset()
      .crossFadeFrom(
        current,
        [action, current].includes(actions.walking) ? 0.25 : 0.4,
        false
      );
  }

  setPath(results, scale, onDestination) {
    const { actions, position } = this;
    const path = [position.clone()];
    for (let i = 3, l = results.length; i < l; i += 3) {
      const isDestination = i === l - 3;
      path.push(new Vector3(
        (results[i] + 0.25 + (isDestination ? 0.25 : (Math.random() * 0.5))) * scale.x,
        results[i + 1] * scale.y,
        (results[i + 2] + 0.25 + (isDestination ? 0.25 : (Math.random() * 0.5))) * scale.z
      ));
    }
    this.path = path;
    this.step = 0;
    this.interpolation = 0;
    this.onDestination = onDestination;
    this.setAction(actions.walking);
    this.setTarget(path[1]);
  }

  setTarget(target) {
    const { position, rotation } = this;
    _vector.subVectors(target, position);
    _vector.y = 0;
    _vector.normalize();
    this.targetRotation = Math.atan2(_vector.x, _vector.z);
    const d = Math.abs(this.targetRotation - rotation.y);
    if (Math.abs(this.targetRotation - (rotation.y - Math.PI * 2)) < d) {
      rotation.y -= Math.PI * 2;
    } else if (Math.abs(this.targetRotation - (rotation.y + Math.PI * 2)) < d) {
      rotation.y += Math.PI * 2;
    }
  }

  setWalkingSpeed(speed) {
    const { actions } = this;
    actions.walking.timeScale = speed / actions.walking.baseSpeed;
    this.walkingSpeed = speed;
  }
}

export default Actor;
