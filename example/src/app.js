import {
  Clock,
  PerspectiveCamera,
  sRGBEncoding,
  WebGLRenderer,
} from 'three';
import PostProcessing from './core/postprocessing.js';
import Gameplay from './gameplay.js';
import './app.css';

const camera = new PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const clock = new Clock();
const fps = {
  dom: document.getElementById('fps'),
  count: 0,
  lastTick: clock.oldTime / 1000,
};
const renderer = new WebGLRenderer({
  antialias: true,
  powerPreference: 'high-performance',
  stencil: false,
});
const postprocessing = new PostProcessing({ samples: 4 });
const scene = new Gameplay({ camera, postprocessing, renderer });
renderer.outputEncoding = sRGBEncoding;
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setAnimationLoop(() => {
  const delta = Math.min(clock.getDelta(), 1);
  const time = clock.oldTime / 1000;
  scene.onAnimationTick(delta, time);
  postprocessing.render(renderer, scene, camera);
  fps.count++;
  if (time >= fps.lastTick + 1) {
    const count = Math.round(fps.count / (time - fps.lastTick));
    if (fps.lastCount !== count) {
      fps.lastCount = count;
      fps.dom.innerText = `${count}fps`;
    }
    fps.lastTick = time;
    fps.count = 0;
  }
});
document.getElementById('renderer').appendChild(renderer.domElement);

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  postprocessing.onResize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}, false);
document.addEventListener('visibilitychange', () => {
  const isVisible = document.visibilityState === 'visible';
  if (isVisible) {
    clock.start();
    fps.count = -1;
    fps.lastTick = clock.oldTime / 1000;
  }
}, false);

{
  const controls = document.createElement('div');
  controls.classList.add('dialog', 'controls');
  const toggleControls = () => controls.classList.toggle('enabled');
  document.getElementById('controls').addEventListener('click', toggleControls, false);
  controls.addEventListener('click', toggleControls, false);
  const wrapper = document.createElement('div');
  controls.appendChild(wrapper);
  document.body.appendChild(controls);
  [
    [
      "Mouse & Keyboard",
      [
        ["Mouse", "Look"],
        ["W A S D", "Move"],
        ["Shift", "Run"],
        ["Left click", "Shoot"],
        ["Right click", "Swap atlas"],
        ["E", "Walk/Fly"],
        ["Wheel", "Set speed"],
      ],
    ],
    [
      "Gamepad",
      [
        ["Right stick", "Look"],
        ["Left stick", "Move (press to run)"],
        ["Right trigger", "Shoot"],
        ["Left trigger", "Swap atlas"],
        ["A", "Walk/Fly"],
      ],
    ]
  ].forEach(([name, maps]) => {
    const group = document.createElement('div');
    const heading = document.createElement('h1');
    heading.innerText = name;
    group.appendChild(heading);
    maps.forEach((map) => {
      const item = document.createElement('div');
      map.forEach((map, i) => {
        const text = document.createElement('div');
        text.innerText = `${map}${i === 0 ? ':' : ''}`;
        item.appendChild(text);
      });
      group.appendChild(item);
    });
    wrapper.appendChild(group);
  });
}

{
  const GL = renderer.getContext();
  const ext = GL.getExtension('WEBGL_debug_renderer_info');
  if (ext) {
    document.getElementById('debug').innerText = GL.getParameter(ext.UNMASKED_RENDERER_WEBGL);
  }
}
