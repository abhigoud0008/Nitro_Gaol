import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';

export interface AssetPreloadProgress {
  progress: number; // 0..100
  label: string;
}

export class ArenaAssetLoader {
  public readonly manager: THREE.LoadingManager;
  public readonly gltfLoader: GLTFLoader;
  private dracoLoader: DRACOLoader;
  private ktx2Loader: KTX2Loader;
  private modelCache = new Map<string, THREE.Group>();

  constructor(renderer: THREE.WebGLRenderer) {
    THREE.Cache.enabled = true;
    this.manager = new THREE.LoadingManager();

    // Configure Draco mesh compression decoder & KTX2 texture transcoder
    this.dracoLoader = new DRACOLoader(this.manager);
    this.dracoLoader.setDecoderPath(
      'https://www.gstatic.com/draco/versioned/decoders/1.5.7/'
    );

    this.ktx2Loader = new KTX2Loader(this.manager);
    this.ktx2Loader.setTranscoderPath(
      'https://cdn.jsdelivr.net/npm/three@0.174.0/examples/jsm/libs/basis/'
    );
    this.ktx2Loader.detectSupport(renderer);

    this.gltfLoader = new GLTFLoader(this.manager);
    this.gltfLoader.setDRACOLoader(this.dracoLoader);
    this.gltfLoader.setKTX2Loader(this.ktx2Loader);
  }

  public async loadCustomVehicleGltf(url: string): Promise<THREE.Group> {
    if (this.modelCache.has(url)) {
      return this.modelCache.get(url)!.clone();
    }

    const gltf = await this.gltfLoader.loadAsync(url);
    const root = gltf.scene;

    // Normalize custom GLB vehicle scale & pivot to match arena physics chassis (~4.5m long, bottom-center grounded)
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const scale = 4.5 / maxDim;
    root.scale.setScalar(scale);

    box.setFromObject(root);
    const center = box.getCenter(new THREE.Vector3());
    root.position.set(-center.x, -box.min.y, -center.z);

    const wrapper = new THREE.Group();
    wrapper.add(root);
    wrapper.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });

    this.modelCache.set(url, wrapper);
    return wrapper.clone();
  }

  public async loadVehicleFromFile(file: File): Promise<THREE.Group> {
    const buffer = await file.arrayBuffer();
    return new Promise((resolve, reject) => {
      this.gltfLoader.parse(
        buffer,
        '',
        (gltf) => {
          const root = gltf.scene;
          const box = new THREE.Box3().setFromObject(root);
          const size = box.getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z) || 1;
          root.scale.setScalar(4.5 / maxDim);

          box.setFromObject(root);
          const center = box.getCenter(new THREE.Vector3());
          root.position.set(-center.x, -box.min.y, -center.z);

          const wrapper = new THREE.Group();
          wrapper.add(root);
          wrapper.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              const mesh = child as THREE.Mesh;
              mesh.castShadow = true;
              mesh.receiveShadow = true;
            }
          });
          resolve(wrapper);
        },
        (err) => reject(err)
      );
    });
  }

  public dispose(): void {
    this.dracoLoader.dispose();
    this.ktx2Loader.dispose();
    this.modelCache.clear();
  }
}
