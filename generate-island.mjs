/**
 * Build a tabletop-scale lighthouse island as island.glb (meters).
 * Run: node generate-island.mjs
 */
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Node has no FileReader; GLTFExporter needs a small polyfill.
if (typeof globalThis.FileReader === 'undefined') {
  globalThis.FileReader = class FileReader {
    constructor() {
      this.onloadend = null;
      this.result = null;
    }
    readAsArrayBuffer(blob) {
      Promise.resolve(blob.arrayBuffer()).then((buf) => {
        this.result = buf;
        this.onloadend && this.onloadend();
      });
    }
    readAsDataURL(blob) {
      Promise.resolve(blob.arrayBuffer()).then((buf) => {
        this.result = 'data:application/octet-stream;base64,' + Buffer.from(buf).toString('base64');
        this.onloadend && this.onloadend();
      });
    }
  };
}

const __dirname = dirname(fileURLToPath(import.meta.url));

function buildIsland() {
  const root = new THREE.Group();
  root.name = 'LighthouseIsland';

  const landMat = new THREE.MeshStandardMaterial({ color: 0x6b9a5a, roughness: 0.85, metalness: 0.05 });
  const sandMat = new THREE.MeshStandardMaterial({ color: 0xc9a66b, roughness: 0.9, metalness: 0 });
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x7a756c, roughness: 0.95, metalness: 0.05 });
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x2a6f8f, roughness: 0.35, metalness: 0.15, transparent: true, opacity: 0.9,
  });

  const water = new THREE.Mesh(new THREE.CircleGeometry(0.72, 48), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.002;
  root.add(water);

  const mound = new THREE.Mesh(
    new THREE.SphereGeometry(0.38, 32, 20, 0, Math.PI * 2, 0, Math.PI * 0.52),
    landMat
  );
  mound.scale.set(1.15, 0.55, 1.0);
  mound.position.y = 0.01;
  root.add(mound);

  const beach = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.07, 10, 40), sandMat);
  beach.rotation.x = Math.PI / 2;
  beach.position.y = 0.02;
  beach.scale.set(1.05, 0.95, 1);
  root.add(beach);

  const tower = new THREE.Group();
  tower.position.set(0.08, 0.12, -0.05);

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.06, 16), rockMat);
  base.position.y = 0.03;
  tower.add(base);

  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.055, 0.28, 16),
    new THREE.MeshStandardMaterial({ color: 0xf2efe8, roughness: 0.7 })
  );
  body.position.y = 0.2;
  tower.add(body);

  const stripe = new THREE.Mesh(
    new THREE.CylinderGeometry(0.046, 0.05, 0.05, 16),
    new THREE.MeshStandardMaterial({ color: 0xb33a3a, roughness: 0.65 })
  );
  stripe.position.y = 0.22;
  tower.add(stripe);

  const gallery = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.06, 0.02, 16),
    new THREE.MeshStandardMaterial({ color: 0x33404c, roughness: 0.6 })
  );
  gallery.position.y = 0.35;
  tower.add(gallery);

  const lantern = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.035, 0.05, 12),
    new THREE.MeshStandardMaterial({
      color: 0xffe3a1,
      emissive: 0xffc066,
      emissiveIntensity: 0.7,
      roughness: 0.4,
    })
  );
  lantern.position.y = 0.39;
  tower.add(lantern);

  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(0.05, 0.05, 12),
    new THREE.MeshStandardMaterial({ color: 0x2c3540, roughness: 0.55 })
  );
  roof.position.y = 0.44;
  tower.add(roof);
  root.add(tower);

  const house = new THREE.Group();
  house.position.set(-0.18, 0.08, 0.08);
  const hut = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.08, 0.1),
    new THREE.MeshStandardMaterial({ color: 0xd8c3a0, roughness: 0.8 })
  );
  hut.position.y = 0.04;
  house.add(hut);
  const hutRoof = new THREE.Mesh(
    new THREE.ConeGeometry(0.1, 0.07, 4),
    new THREE.MeshStandardMaterial({ color: 0x8b4a3a, roughness: 0.85 })
  );
  hutRoof.position.y = 0.11;
  hutRoof.rotation.y = Math.PI / 4;
  house.add(hutRoof);
  root.add(house);

  const pier = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 0.015, 0.22),
    new THREE.MeshStandardMaterial({ color: 0x8b6a45, roughness: 0.9 })
  );
  pier.position.set(0.28, 0.02, 0.18);
  pier.rotation.y = -0.35;
  root.add(pier);

  function tree(x, z, h = 0.12) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.008, 0.01, 0.04, 6),
      new THREE.MeshStandardMaterial({ color: 0x6b4a2e })
    );
    trunk.position.y = 0.02;
    g.add(trunk);
    const leaf = new THREE.Mesh(
      new THREE.ConeGeometry(0.04, h, 7),
      new THREE.MeshStandardMaterial({ color: 0x3f7a45, roughness: 0.8 })
    );
    leaf.position.y = 0.04 + h * 0.4;
    g.add(leaf);
    g.position.set(x, 0.06, z);
    root.add(g);
  }
  tree(-0.05, 0.16, 0.11);
  tree(-0.22, -0.06, 0.13);
  tree(0.22, -0.12, 0.09);

  for (let i = 0; i < 5; i++) {
    const r = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.025 + (i % 3) * 0.008, 0),
      rockMat
    );
    const a = (i / 5) * Math.PI * 2 + 0.4;
    r.position.set(Math.cos(a) * 0.36, 0.03, Math.sin(a) * 0.3);
    r.rotation.set(0.2 * i, 0.3 * i, 0.1 * i);
    root.add(r);
  }

  // ~22cm wide on table
  root.scale.setScalar(0.22);
  root.updateMatrixWorld(true);
  return root;
}

const scene = buildIsland();
const exporter = new GLTFExporter();

exporter.parse(
  scene,
  (result) => {
    const buf = Buffer.from(result);
    const out = join(__dirname, 'island.glb');
    writeFileSync(out, buf);
    console.log(`Wrote ${out} (${buf.length} bytes)`);
  },
  (err) => {
    console.error(err);
    process.exit(1);
  },
  { binary: true, onlyVisible: true }
);
