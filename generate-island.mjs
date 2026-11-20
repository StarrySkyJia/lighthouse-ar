/**
 * Export FULL static diorama (island + water + seabed + birds + fish + grass + fisher + pier)
 * as island.glb + island.usdz for Quick Look / Scene Viewer.
 * Run: node generate-island.mjs
 */
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { USDZExporter } from 'three/examples/jsm/exporters/USDZExporter.js';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

if (typeof globalThis.FileReader === 'undefined') {
  globalThis.FileReader = class FileReader {
    constructor() { this.onloadend = null; this.result = null; }
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
const SEABED_Y = -1.35;
const TABLE_DIAMETER = 0.32;

let _seed = 42;
function rnd() {
  _seed = (_seed * 16807) % 2147483647;
  return (_seed - 1) / 2147483646;
}

function coastRadius(ang) {
  return 4.15
    + 0.88 * Math.sin(ang * 2.0 + 0.4)
    + 0.5 * Math.sin(ang * 3.0 + 1.7)
    + 0.3 * Math.cos(ang * 5.0 + 0.2);
}

function islandHeight(x, z) {
  let r = Math.hypot(x, z) || 0.0001;
  const edge = coastRadius(Math.atan2(z, x));
  const t = 1 - r / edge;
  if (t <= 0) return null;
  const und = 0.22 * Math.sin(x * 1.15 + 0.6) * Math.cos(z * 0.95)
    + 0.12 * Math.sin(x * 2.1 - z * 1.7 + 0.3)
    + 0.08 * Math.cos(z * 2.4 + x);
  let h = Math.pow(t, 0.72) * (0.95 + und);
  if (t < 0.16) h *= t / 0.16;
  if (r < 1.5) {
    let u = r < 0.95 ? 1 : (1.5 - r) / 0.55;
    u = u * u * (3 - 2 * u);
    h = h * (1 - u) + 0.42 * u;
  }
  return h;
}

function buildDiorama() {
  const root = new THREE.Group();
  root.name = 'LighthouseDiorama';

  const rockMat = new THREE.MeshStandardMaterial({ color: 0xc4a07a, roughness: 0.94 });
  const rockDark = new THREE.MeshStandardMaterial({ color: 0xa68462, roughness: 0.96 });
  const woodMat = new THREE.MeshStandardMaterial({ color: 0xd08a4c, roughness: 0.72 });
  const woodDark = new THREE.MeshStandardMaterial({ color: 0xb8743a, roughness: 0.78 });
  const metalMat = new THREE.MeshStandardMaterial({ color: 0xc5ced4, roughness: 0.38, metalness: 0.55 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0xd6453a, roughness: 0.48 });
  const stripeW = new THREE.MeshStandardMaterial({ color: 0xf6f2ea, roughness: 0.62 });
  const stripeR = new THREE.MeshStandardMaterial({ color: 0xe24b3c, roughness: 0.62 });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0xffe6c0, emissive: 0xffc066, emissiveIntensity: 0.65, roughness: 0.3,
  });
  const palmTrunk = new THREE.MeshStandardMaterial({ color: 0x9a6842, roughness: 0.9 });
  const palmRing = new THREE.MeshStandardMaterial({ color: 0x6d4630, roughness: 0.94 });
  const palmLeaf = new THREE.MeshStandardMaterial({ color: 0x3e9a3c, roughness: 0.7 });
  const palmLeafD = new THREE.MeshStandardMaterial({ color: 0x2c7830, roughness: 0.76 });
  const grassMat = new THREE.MeshStandardMaterial({ color: 0x6faf48, roughness: 0.88 });
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x2a7f9e, roughness: 0.28, metalness: 0.12,
  });
  const waterDeep = new THREE.MeshStandardMaterial({
    color: 0x1a5570, roughness: 0.55, metalness: 0.05,
  });
  const gullMat = new THREE.MeshStandardMaterial({ color: 0xf7f8f6, roughness: 0.65 });
  const sphere = new THREE.SphereGeometry(1, 12, 9);

  const island = new THREE.Group();
  root.add(island);

  // Land
  const landGeo = new THREE.PlaneGeometry(13.2, 13.2, 48, 48);
  landGeo.rotateX(-Math.PI / 2);
  const lp = landGeo.attributes.position;
  const cols = new Float32Array(lp.count * 3);
  const sand = new THREE.Color('#e6d2a2');
  const g1 = new THREE.Color('#6eae4c');
  const g2 = new THREE.Color('#4c8634');
  const tint = new THREE.Color();
  for (let i = 0; i < lp.count; i++) {
    let x = lp.getX(i), z = lp.getZ(i);
    let r = Math.hypot(x, z) || 0.0001;
    const ang = Math.atan2(z, x);
    const edge = coastRadius(ang);
    if (r > edge) {
      const pull = edge / r;
      x *= pull; z *= pull;
      lp.setX(i, x); lp.setZ(i, z);
      r = edge;
    }
    let h = islandHeight(x, z); if (h == null) h = 0.02;
    lp.setY(i, h);
    const lt = 1 - r / edge;
    tint.copy(sand);
    if (lt > 0.12) tint.lerp(g1, Math.min(1, (lt - 0.12) / 0.22));
    if (lt > 0.38) tint.lerp(g2, Math.min(0.45, (lt - 0.38) * 0.5));
    cols[i * 3] = tint.r; cols[i * 3 + 1] = tint.g; cols[i * 3 + 2] = tint.b;
  }
  landGeo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  landGeo.computeVertexNormals();
  island.add(new THREE.Mesh(landGeo, new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.92, metalness: 0,
  })));

  // Seabed + water volume rim
  const bed = new THREE.Mesh(new THREE.CircleGeometry(7.4, 48), new THREE.MeshStandardMaterial({
    color: 0x9a7a52, roughness: 1,
  }));
  bed.rotation.x = -Math.PI / 2;
  bed.position.y = SEABED_Y;
  root.add(bed);

  // Water surface with soft hole (ring of segments outside coast)
  const waterGeo = new THREE.RingGeometry(0.2, 7.3, 64, 12);
  // RingGeometry is XY; rotate to XZ and lift; punch shape by scaling verts near coast
  const wpos = waterGeo.attributes.position;
  for (let i = 0; i < wpos.count; i++) {
    const x = wpos.getX(i);
    const y = wpos.getY(i); // will become z after rotate
    const r = Math.hypot(x, y) || 0.0001;
    const ang = Math.atan2(y, x);
    const edge = coastRadius(ang);
    // pull inner ring to just outside coast
    if (r < 3.5) {
      const nr = edge + 0.12 + (r / 3.5) * 0.5;
      wpos.setX(i, Math.cos(ang) * nr);
      wpos.setY(i, Math.sin(ang) * nr);
    }
    // bake mild wave
    const wx = wpos.getX(i), wz = wpos.getY(i);
    wpos.setZ(i, Math.sin(wx * 1.1) * 0.04 + Math.cos(wz * 1.2) * 0.03);
  }
  waterGeo.computeVertexNormals();
  const water = new THREE.Mesh(waterGeo, waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.08;
  root.add(water);

  // Underwater block sides (diorama feel)
  const wall = new THREE.Mesh(
    new THREE.CylinderGeometry(7.35, 7.35, Math.abs(SEABED_Y) + 0.15, 48, 1, true),
    waterDeep
  );
  wall.position.y = SEABED_Y * 0.5;
  root.add(wall);

  // Tower stripes
  const towerH = 4.85, towerBottomR = 1.08, towerTopR = 0.72, towerBottom = 0.5;
  for (let b = 0; b < 8; b++) {
    const t0 = b / 8, t1 = (b + 1) / 8;
    const y0 = towerBottom + towerH * t0, y1 = towerBottom + towerH * t1;
    const r0 = towerBottomR + (towerTopR - towerBottomR) * t0;
    const r1 = towerBottomR + (towerTopR - towerBottomR) * t1;
    const band = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, y1 - y0, 22), b % 2 ? stripeR : stripeW);
    band.position.y = (y0 + y1) * 0.5;
    island.add(band);
  }
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(1.32, 1.46, 0.62, 20), rockDark);
  plinth.position.y = 0.42;
  island.add(plinth);
  const towerTop = towerBottom + towerH;
  const gallery = new THREE.Mesh(new THREE.CylinderGeometry(1.14, 1.08, 0.11, 20), metalMat);
  gallery.position.y = towerTop + 0.12;
  island.add(gallery);
  const lantern = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.44, 0.56, 12), glassMat);
  lantern.position.y = towerTop + 0.62;
  island.add(lantern);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.7, 0.62, 16), roofMat);
  roof.position.y = towerTop + 1.28;
  island.add(roof);

  // Trees
  function addTree(x, y, z, scale) {
    const g = new THREE.Group();
    const trunkH = 1.6 * scale;
    for (let s = 0; s < 6; s++) {
      const h = trunkH / 6;
      const seg = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06 * scale * (1 - s * 0.08), 0.08 * scale * (1 - s * 0.06), h, 5),
        s % 2 ? palmRing : palmTrunk
      );
      seg.position.y = h * (s + 0.5);
      g.add(seg);
    }
    const foliage = new THREE.Group();
    foliage.position.y = trunkH;
    for (let i = 0; i < 10; i++) {
      const leaf = new THREE.Mesh(new THREE.PlaneGeometry(0.35 * scale, 1.1 * scale), i % 2 ? palmLeafD : palmLeaf);
      leaf.position.set(0, 0.1, 0.15 * scale);
      const hold = new THREE.Group();
      hold.rotation.order = 'YXZ';
      hold.rotation.y = (i / 10) * Math.PI * 2;
      hold.rotation.x = -0.4 + (i % 3) * 0.25;
      hold.add(leaf);
      foliage.add(hold);
    }
    g.add(foliage);
    g.position.set(x, y, z);
    island.add(g);
  }
  function putTree(ang, factor, scale) {
    const edge = coastRadius(ang);
    const r = edge * factor;
    const x = Math.cos(ang) * r, z = Math.sin(ang) * r;
    let h = islandHeight(x, z); if (h == null) h = 0.35;
    addTree(x, h - 0.02, z, scale);
  }
  putTree(2.5, 0.5, 1.15);
  putTree(5.55, 0.46, 1.0);

  // Grass
  const bladeGeo = new THREE.PlaneGeometry(0.022, 0.12);
  bladeGeo.translate(0, 0.06, 0);
  for (let i = 0; i < 140; i++) {
    const ang = rnd() * Math.PI * 2;
    const edge = coastRadius(ang);
    const rad = (0.35 + rnd() * 0.52) * edge;
    const gx = Math.cos(ang) * rad, gz = Math.sin(ang) * rad;
    const gh = islandHeight(gx, gz);
    if (gh == null || gh < 0.22 || Math.hypot(gx, gz) < 1.1) continue;
    const blade = new THREE.Mesh(bladeGeo, grassMat);
    blade.position.set(gx, gh + 0.008, gz);
    blade.rotation.y = rnd() * Math.PI;
    const s = 0.7 + rnd() * 0.8;
    blade.scale.set(s, 0.85 + rnd() * 0.7, s);
    island.add(blade);
  }

  // Pier + boat
  const pier = new THREE.Group();
  const shoreZ = coastRadius(Math.PI / 2);
  const z0 = shoreZ * 0.42, z1 = shoreZ + 2.2;
  let yLand = islandHeight(0.02, z0); if (yLand == null) yLand = 0.4;
  const y0 = yLand + 0.08, y1deck = 0.34;
  const deckLen = z1 - z0;
  function deckY(z) { return y0 + (y1deck - y0) * ((z - z0) / deckLen); }
  for (let p = 0; p < 10; p++) {
    const pz = z0 + (p + 0.5) * (deckLen / 10);
    const board = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.045, deckLen / 10 * 0.75), p % 2 ? woodMat : woodDark);
    board.position.set(0.02, deckY(pz), pz);
    pier.add(board);
  }
  [-0.45, 0.48].forEach((x) => {
    [0.4, 0.75].forEach((t) => {
      const pz = z0 + deckLen * t;
      const bedY = SEABED_Y + 0.2;
      const len = Math.max(0.5, deckY(pz) - bedY);
      const pile = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, len, 5), woodDark);
      pile.position.set(x, bedY + len * 0.5, pz);
      pier.add(pile);
    });
  });
  island.add(pier);

  const boat = new THREE.Group();
  boat.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 1.2), new THREE.MeshStandardMaterial({ color: 0xc0392b })));
  const deckM = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.04, 1.0), new THREE.MeshStandardMaterial({ color: 0xf4f1ea }));
  deckM.position.y = 0.12;
  boat.add(deckM);
  boat.position.set(1.25, 0.15, z1 - 0.4);
  boat.rotation.y = -0.35;
  island.add(boat);

  // Rocks
  for (let ri = 0; ri < 7; ri++) {
    const ra = (ri / 7) * Math.PI * 2 + 0.5;
    if (Math.abs(ra - Math.PI / 2) < 0.5) continue;
    const rr = coastRadius(ra) * 0.82;
    const rx = Math.cos(ra) * rr, rz = Math.sin(ra) * rr;
    const rh = islandHeight(rx, rz); if (rh == null) continue;
    const rock = new THREE.Mesh(sphere, ri % 2 ? rockDark : rockMat);
    const rs = 0.1 + (ri % 3) * 0.04;
    rock.scale.set(rs * 1.3, rs * 0.55, rs);
    rock.position.set(rx, rh + rs * 0.2, rz);
    island.add(rock);
  }

  // Birds (static poses in air)
  for (let i = 0; i < 3; i++) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 5), gullMat);
    body.scale.set(1, 0.7, 1.4);
    const wingL = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 0.1), gullMat);
    const wingR = wingL.clone();
    wingL.position.set(-0.12, 0.02, 0); wingL.rotation.z = 0.35;
    wingR.position.set(0.12, 0.02, 0); wingR.rotation.z = -0.35;
    g.add(body, wingL, wingR);
    const a = i * 2.1 + 0.4;
    g.position.set(Math.cos(a) * (3.5 + i), 2.4 + i * 0.35, Math.sin(a) * (3.5 + i));
    g.rotation.y = -a + Math.PI / 2;
    root.add(g);
  }

  // Fish (static underwater)
  const fishMats = [
    new THREE.MeshStandardMaterial({ color: 0xe07a3a, roughness: 0.45 }),
    new THREE.MeshStandardMaterial({ color: 0x3a8fd0, roughness: 0.45 }),
    new THREE.MeshStandardMaterial({ color: 0xd0c45a, roughness: 0.45 }),
  ];
  for (let i = 0; i < 8; i++) {
    const f = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), fishMats[i % 3]);
    body.scale.set(0.55, 0.45, 1.1);
    const tail = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.08), fishMats[i % 3]);
    tail.position.z = -0.12;
    f.add(body, tail);
    const a = i * 0.9 + 0.2;
    const radius = 5.6 + (i % 3) * 0.5;
    let x = Math.cos(a) * radius, z = Math.sin(a) * radius;
    const edge = coastRadius(Math.atan2(z, x)) + 1.4;
    const r = Math.hypot(x, z);
    if (r < edge) { x *= edge / r; z *= edge / r; }
    f.position.set(x, -0.4 - (i % 3) * 0.15, z);
    f.rotation.y = -a + Math.PI / 2;
    f.scale.setScalar(0.75 + (i % 3) * 0.2);
    root.add(f);
  }

  // Fisher
  const fisher = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: 0xe8b896, roughness: 0.7 });
  const cloth = new THREE.MeshStandardMaterial({ color: 0x3a6ea5, roughness: 0.75 });
  const pants = new THREE.MeshStandardMaterial({ color: 0x3d3a36, roughness: 0.8 });
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), skin);
  head.position.y = 1.05;
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.45, 8), cloth);
  torso.position.y = 0.72;
  const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.4, 6), pants);
  const legR = legL.clone();
  legL.position.set(-0.07, 0.28, 0);
  legR.position.set(0.07, 0.28, 0);
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.4, 5), woodDark);
  rod.position.set(0.28, 0.95, 0.1);
  rod.rotation.z = -0.55;
  rod.rotation.x = 0.25;
  fisher.add(head, torso, legL, legR, rod);
  const fh = islandHeight(1.1, 2.4) || 0.4;
  fisher.position.set(1.1, fh, 2.4);
  fisher.rotation.y = 0.6;
  island.add(fisher);

  // Underwater rocks
  for (let i = 0; i < 6; i++) {
    const a = i * 1.1 + 0.3;
    const rr = 5.2 + (i % 2) * 0.8;
    const rock = new THREE.Mesh(sphere, rockDark);
    const s = 0.25 + (i % 3) * 0.08;
    rock.scale.set(s * 1.2, s * 0.7, s);
    rock.position.set(Math.cos(a) * rr, SEABED_Y + s * 0.35, Math.sin(a) * rr);
    root.add(rock);
  }

  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  root.position.y -= box.min.y;
  const size = new THREE.Vector3();
  box.getSize(size);
  const span = Math.max(size.x, size.z);
  root.scale.setScalar(TABLE_DIAMETER / span);
  root.updateMatrixWorld(true);
  return root;
}

function exportGLB(scene) {
  return new Promise((resolve, reject) => {
    new GLTFExporter().parse(scene, (result) => resolve(Buffer.from(result)), reject, {
      binary: true, onlyVisible: true,
    });
  });
}

async function main() {
  const diorama = buildDiorama();
  const root = new THREE.Group();
  root.add(diorama);
  root.traverse((o) => {
    if (o.isMesh && o.material) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach((m) => { m.side = THREE.FrontSide; });
    }
  });

  const glb = await exportGLB(root);
  writeFileSync(join(__dirname, 'island.glb'), glb);
  console.log(`Wrote island.glb (${glb.length} bytes)`);

  const usdz = await new USDZExporter().parse(root, {
    quickLookCompatible: true,
    ar: { anchoring: { type: 'plane' }, planeAnchoring: { alignment: 'horizontal' } },
  });
  writeFileSync(join(__dirname, 'island.usdz'), Buffer.from(usdz));
  console.log(`Wrote island.usdz (${usdz.byteLength} bytes)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
