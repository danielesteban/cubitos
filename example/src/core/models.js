import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';

const cache = new Map();
const loading = new Map();
const loader = new GLTFLoader();

export default (id) => new Promise((resolve, reject) => {
  if (cache.has(id)) {
    resolve(cache.get(id));
    return;
  }
  if (loading.has(id)) {
    loading.get(id).push({ resolve, reject });
    return;
  }
  const promises = [{ resolve, reject }];
  loading.set(id, promises);
  loader.load(`/models/${id}.glb`, ({ animations, scene: model }) => {
    loading.delete(id);
    const data = {
      animations,
      model: () => cloneSkeleton(model),
    };
    cache.set(id, data);
    promises.forEach(({ resolve }) => resolve(data));
  }, () => {}, (err) => (
    promises.forEach(({ reject }) => reject(err))
  ));
});
