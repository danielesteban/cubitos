import { TextureLoader } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';

const load = (loader, format = (a) => (a)) => {
  const cache = new Map();
  const loading = new Map();
  return (url) => new Promise((resolve, reject) => {
    if (cache.has(url)) {
      resolve(cache.get(url));
      return;
    }
    if (loading.has(url)) {
      loading.get(url).push({ resolve, reject });
      return;
    }
    const promises = [{ resolve, reject }];
    loading.set(url, promises);
    loader.load(url, (loaded) => {
      loading.delete(url);
      const asset = format(loaded);
      cache.set(url, asset);
      promises.forEach(({ resolve }) => resolve(asset));
    }, () => {}, (err) => (
      promises.forEach(({ reject }) => reject(err))
    ));
  });
};

export const loadModel = load(
  new GLTFLoader(),
  ({ animations, scene }) => ({
    animations,
    model: () => cloneSkeleton(scene),
  })
);

export const loadTexture = load(new TextureLoader());
