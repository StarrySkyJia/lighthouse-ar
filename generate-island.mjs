/**
 * Export the ORIGINAL lighthouse island (from src.html) as island.glb + island.usdz
 * for tabletop AR. Run: node generate-island.mjs
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
const SEABED_Y = -2.2;
const TABLE_DIAMETER = 0.28; // meters on desk

// Deterministic "random" so exports match across runs
let _seed = 42;
function rnd() {
  _seed = (_seed * 16807) % 2147483647;
  return (_seed - 1) / 2147483646;
}

function seabedHeight(x, z) {
  const r = Math.sqrt(x * x + z * z);
  let h = Math.sin(x * 0.55) * 0.28 + Math.cos(z * 0.48) * 0.24;
  h += Math.sin(x * 1.1 + z * 0.7) * 0.14;
  h += Math.cos(x * 0.35 - z * 0.9) * 0.18;
  h -= Math.max(0, 2.6 - r) * 0.08;
  return h;
}

function buildIsland() {
  const rockMat = new THREE.MeshStandardMaterial({ color: 0xc4a07a, roughness: 0.94, metalness: 0 });
  const rockDark = new THREE.MeshStandardMaterial({ color: 0xa68462, roughness: 0.96, metalness: 0 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x5f9a42, roughness: 0.86, metalness: 0, side: THREE.DoubleSide });
  const leafDeep = new THREE.MeshStandardMaterial({ color: 0x4a8234, roughness: 0.88, metalness: 0, side: THREE.DoubleSide });
  const woodMat = new THREE.MeshStandardMaterial({ color: 0xd08a4c, roughness: 0.72, metalness: 0.02 });
  const woodDark = new THREE.MeshStandardMaterial({ color: 0xb8743a, roughness: 0.78, metalness: 0.02 });
  const metalMat = new THREE.MeshStandardMaterial({ color: 0xc5ced4, roughness: 0.38, metalness: 0.62 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0xd6453a, roughness: 0.48, metalness: 0.04 });
  const doorMat = new THREE.MeshStandardMaterial({ color: 0x8d5a32, roughness: 0.7, metalness: 0.02 });
  const windowMat = new THREE.MeshStandardMaterial({
    color: 0xffe1b8, emissive: 0xffb15a, emissiveIntensity: 0.55, roughness: 0.25,
  });
  const flowerWhite = new THREE.MeshStandardMaterial({ color: 0xf7f4ee, roughness: 0.7 });
  const flowerCoral = new THREE.MeshStandardMaterial({ color: 0xe37b78, roughness: 0.68 });
  const palmTrunk = new THREE.MeshStandardMaterial({ color: 0x9a6842, roughness: 0.9, metalness: 0 });
  const palmRing = new THREE.MeshStandardMaterial({ color: 0x6d4630, roughness: 0.94, metalness: 0 });
  const palmLeaf = new THREE.MeshStandardMaterial({ color: 0x3e9a3c, roughness: 0.7, metalness: 0, side: THREE.DoubleSide });
  const palmLeafDark = new THREE.MeshStandardMaterial({ color: 0x2c7830, roughness: 0.76, metalness: 0, side: THREE.DoubleSide });
  const palmLeafLight = new THREE.MeshStandardMaterial({ color: 0x62c04e, roughness: 0.66, metalness: 0, side: THREE.DoubleSide });
  const stripeWhite = new THREE.MeshStandardMaterial({ color: 0xf6f2ea, roughness: 0.62, metalness: 0.02 });
  const stripeRed = new THREE.MeshStandardMaterial({ color: 0xe24b3c, roughness: 0.62, metalness: 0.02 });
  const glassOpaque = new THREE.MeshStandardMaterial({
    color: 0xffe6c0, emissive: 0xffb15c, emissiveIntensity: 0.65, roughness: 0.28, metalness: 0,
  });

  const sphere = new THREE.SphereGeometry(1, 14, 10);

  function addRock(parent, x, y, z, sx, sy, sz, mat) {
    const mesh = new THREE.Mesh(sphere, mat || rockMat);
    mesh.scale.set(sx, sy, sz);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }

  function makeFrondGeo(length, bend, width) {
    const geo = new THREE.PlaneGeometry(width, length, 1, 10);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const u = (pos.getY(i) + length * 0.5) / length;
      const taper = Math.max(0.07, 1 - u * 0.9);
      const notch = 0.55 + 0.45 * Math.abs(Math.sin(u * Math.PI * 8.0));
      pos.setX(i, pos.getX(i) * taper * notch);
      pos.setY(i, Math.sin(u * Math.PI) * length * 0.07 - u * u * bend * length);
      pos.setZ(i, u * length);
    }
    geo.computeVertexNormals();
    return geo;
  }

  function addTree(parent, x, y, z, scale) {
    const group = new THREE.Group();
    const segs = 8;
    const trunkH = 1.75 * scale;
    const leanX = (rnd() - 0.5) * 0.28 * scale;
    const leanZ = (rnd() - 0.5) * 0.28 * scale;
    for (let s = 0; s < segs; s++) {
      const t = (s + 0.5) / segs;
      const h = trunkH / segs;
      const rBot = (0.1 - (s / segs) * 0.038) * scale;
      const rTop = (0.1 - ((s + 1) / segs) * 0.038) * scale;
      const seg = new THREE.Mesh(
        new THREE.CylinderGeometry(Math.max(rTop, 0.028 * scale), Math.max(rBot, 0.034 * scale), h * 1.04, 6),
        s % 2 === 0 ? palmTrunk : palmRing
      );
      seg.position.set(leanX * t, h * (s + 0.5), leanZ * t);
      seg.rotation.z = leanX * 0.12;
      seg.rotation.x = -leanZ * 0.12;
      group.add(seg);
    }

    const foliage = new THREE.Group();
    foliage.position.set(leanX, trunkH, leanZ);
    const crown = new THREE.Mesh(new THREE.SphereGeometry(0.07 * scale, 8, 6), palmLeafDark);
    crown.scale.set(1, 0.7, 1);
    foliage.add(crown);

    // Slightly fewer fronds than main scene for mobile AR size
    const layers = [
      { count: 6, pitch: -1.2, bend: 0.48, len: 1.05, width: 0.42, yaw: 0.12 },
      { count: 7, pitch: -0.68, bend: 0.4, len: 1.22, width: 0.48, yaw: 0.32 },
      { count: 8, pitch: -0.16, bend: 0.58, len: 1.32, width: 0.5, yaw: 0.04 },
      { count: 7, pitch: 0.34, bend: 0.52, len: 1.16, width: 0.46, yaw: 0.48 },
    ];
    for (let li = 0; li < layers.length; li++) {
      const layer = layers[li];
      for (let f = 0; f < layer.count; f++) {
        const len = layer.len * scale * (0.9 + ((f + li) % 3) * 0.07);
        const geo = makeFrondGeo(len, layer.bend + (f % 3) * 0.04, layer.width * scale);
        const mat = li === 0 ? palmLeafLight : ((f + li) % 3 === 0 ? palmLeafDark : palmLeaf);
        const holder = new THREE.Group();
        holder.rotation.order = 'YXZ';
        holder.rotation.y = layer.yaw + (f / layer.count) * Math.PI * 2;
        holder.rotation.x = layer.pitch;
        const blade = new THREE.Mesh(geo, mat);
        const side = new THREE.Mesh(geo, mat);
        side.rotation.z = f % 2 === 0 ? 0.7 : -0.7;
        holder.add(blade, side);
        foliage.add(holder);
      }
    }
    for (let c = 0; c < 3; c++) {
      const nut = new THREE.Mesh(sphere, palmRing);
      const a = c * 2.15 + 0.4;
      nut.scale.set(0.05 * scale, 0.045 * scale, 0.05 * scale);
      nut.position.set(Math.cos(a) * 0.09 * scale, -0.05 * scale, Math.sin(a) * 0.09 * scale);
      foliage.add(nut);
    }
    group.add(foliage);
    group.position.set(x, y, z);
    parent.add(group);
  }

  function addFlower(parent, x, y, z, mat) {
    const bunch = new THREE.Group();
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.016, 0.2, 4), leafDeep);
    stem.position.y = 0.1;
    const head = new THREE.Mesh(sphere, mat);
    head.scale.set(0.065, 0.04, 0.065);
    head.position.y = 0.22;
    bunch.add(stem, head);
    bunch.position.set(x, y, z);
    parent.add(bunch);
  }

  const island = new THREE.Group();
  island.name = 'LighthouseIsland';

  function coastRadius(ang) {
    return 4.15
      + 0.88 * Math.sin(ang * 2.0 + 0.4)
      + 0.5 * Math.sin(ang * 3.0 + 1.7)
      + 0.3 * Math.cos(ang * 5.0 + 0.2);
  }
  function islandHeight(x, z) {
    let r = Math.hypot(x, z);
    if (r < 0.0001) r = 0.0001;
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

  // ---- land mesh (same as src.html) ----
  const landGeo = new THREE.PlaneGeometry(13.2, 13.2, 56, 56);
  landGeo.rotateX(-Math.PI / 2);
  const landPos = landGeo.attributes.position;
  const landColors = new Float32Array(landPos.count * 3);
  const sandCol = new THREE.Color('#e6d2a2');
  const grassCol = new THREE.Color('#6eae4c');
  const grassDeep = new THREE.Color('#4c8634');
  const tint = new THREE.Color();
  for (let li = 0; li < landPos.count; li++) {
    let lx = landPos.getX(li);
    let lz = landPos.getZ(li);
    let lr = Math.hypot(lx, lz) || 0.0001;
    const lang = Math.atan2(lz, lx);
    const ledge = coastRadius(lang);
    if (lr > ledge) {
      const pull = ledge / lr;
      lx *= pull;
      lz *= pull;
      landPos.setX(li, lx);
      landPos.setZ(li, lz);
      lr = ledge;
    }
    let lh = islandHeight(lx, lz);
    if (lh == null) lh = 0.02;
    landPos.setY(li, lh);
    const lt = 1 - lr / ledge;
    tint.copy(sandCol);
    if (lt > 0.12) tint.lerp(grassCol, Math.min(1, (lt - 0.12) / 0.22));
    if (lt > 0.38) tint.lerp(grassDeep, Math.min(0.45, (lt - 0.38) * 0.5));
    landColors[li * 3] = tint.r;
    landColors[li * 3 + 1] = tint.g;
    landColors[li * 3 + 2] = tint.b;
  }
  landGeo.setAttribute('color', new THREE.BufferAttribute(landColors, 3));

  const srcPos = landGeo.attributes.position;
  const srcIdx = landGeo.index.array;
  const srcN = srcPos.count;
  const sealedPos = new Float32Array(srcN * 2 * 3);
  const sealedCol = new Float32Array(srcN * 2 * 3);
  for (let vi = 0; vi < srcN; vi++) {
    const vx = srcPos.getX(vi);
    const vz = srcPos.getZ(vi);
    const vr = Math.hypot(vx, vz);
    const vang = vr < 0.0001 ? 0 : Math.atan2(vz, vx);
    const vedge = coastRadius(vang);
    const vt = Math.min(1, vr / Math.max(vedge, 0.001));
    const outR = vr * (1.04 + 0.42 * vt) + 0.95 * vt * vt;
    const ox = Math.cos(vang) * outR;
    const oz = Math.sin(vang) * outR;
    const bedY = SEABED_Y + seabedHeight(ox, oz) - 0.12 - 0.1;
    sealedPos[vi * 3] = vx;
    sealedPos[vi * 3 + 1] = srcPos.getY(vi);
    sealedPos[vi * 3 + 2] = vz;
    sealedPos[(srcN + vi) * 3] = ox;
    sealedPos[(srcN + vi) * 3 + 1] = bedY;
    sealedPos[(srcN + vi) * 3 + 2] = oz;
    sealedCol[vi * 3] = landColors[vi * 3];
    sealedCol[vi * 3 + 1] = landColors[vi * 3 + 1];
    sealedCol[vi * 3 + 2] = landColors[vi * 3 + 2];
    sealedCol[(srcN + vi) * 3] = 0.62;
    sealedCol[(srcN + vi) * 3 + 1] = 0.5;
    sealedCol[(srcN + vi) * 3 + 2] = 0.34;
  }
  const edgeUse = {};
  const edgeList = [];
  function edgeKey(a, b) { return a < b ? a + ':' + b : b + ':' + a; }
  for (let ti = 0; ti < srcIdx.length; ti += 3) {
    const tri = [srcIdx[ti], srcIdx[ti + 1], srcIdx[ti + 2]];
    for (let e = 0; e < 3; e++) {
      const ea = tri[e];
      const eb = tri[(e + 1) % 3];
      const ek = edgeKey(ea, eb);
      if (edgeUse[ek]) edgeUse[ek] += 1;
      else {
        edgeUse[ek] = 1;
        edgeList.push([ea, eb]);
      }
    }
  }
  const boundary = [];
  for (let ei = 0; ei < edgeList.length; ei++) {
    const ep = edgeList[ei];
    if (edgeUse[edgeKey(ep[0], ep[1])] === 1) boundary.push(ep);
  }
  const sealedIndex = new Uint32Array(srcIdx.length * 2 + boundary.length * 6);
  sealedIndex.set(srcIdx, 0);
  for (let bi = 0; bi < srcIdx.length; bi += 3) {
    sealedIndex[srcIdx.length + bi] = srcIdx[bi] + srcN;
    sealedIndex[srcIdx.length + bi + 1] = srcIdx[bi + 2] + srcN;
    sealedIndex[srcIdx.length + bi + 2] = srcIdx[bi + 1] + srcN;
  }
  let cursor = srcIdx.length * 2;
  for (let si = 0; si < boundary.length; si++) {
    const va = boundary[si][0];
    const vb = boundary[si][1];
    sealedIndex[cursor++] = va;
    sealedIndex[cursor++] = vb;
    sealedIndex[cursor++] = vb + srcN;
    sealedIndex[cursor++] = va;
    sealedIndex[cursor++] = vb + srcN;
    sealedIndex[cursor++] = va + srcN;
  }
  const sealedGeo = new THREE.BufferGeometry();
  sealedGeo.setAttribute('position', new THREE.BufferAttribute(sealedPos, 3));
  sealedGeo.setAttribute('color', new THREE.BufferAttribute(sealedCol, 3));
  sealedGeo.setIndex(new THREE.BufferAttribute(sealedIndex, 1));
  sealedGeo.computeVertexNormals();
  const land = new THREE.Mesh(sealedGeo, new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.92, metalness: 0, side: THREE.DoubleSide,
  }));
  island.add(land);

  for (let ri = 0; ri < 8; ri++) {
    const ra = (ri / 8) * Math.PI * 2 + 0.7;
    if (Math.abs(ra - Math.PI / 2) < 0.55) continue;
    const redge = coastRadius(ra);
    const rr = redge * (0.78 + (ri % 3) * 0.05);
    const rx = Math.cos(ra) * rr;
    const rz = Math.sin(ra) * rr;
    const rh = islandHeight(rx, rz);
    if (rh == null) continue;
    const rs = 0.08 + (ri % 3) * 0.035;
    addRock(island, rx, rh + rs * 0.2, rz, rs * 1.4, rs * 0.55, rs, ri % 2 ? rockDark : rockMat);
  }

  // Light grass (baked meshes — USDZ-friendly)
  const grassMat = new THREE.MeshStandardMaterial({
    color: 0x6faf48, roughness: 0.88, metalness: 0, side: THREE.DoubleSide,
  });
  const bladeGeo = new THREE.PlaneGeometry(0.022, 0.12, 1, 2);
  bladeGeo.translate(0, 0.06, 0);
  let grassN = 0;
  for (let tryG = 0; tryG < 900 && grassN < 180; tryG++) {
    const ang = rnd() * Math.PI * 2;
    const edge = coastRadius(ang);
    const rad = (0.34 + rnd() * 0.55) * edge;
    const gx = Math.cos(ang) * rad;
    const gz = Math.sin(ang) * rad;
    const gh = islandHeight(gx, gz);
    if (gh == null || gh < 0.2) continue;
    if (Math.hypot(gx, gz) < 1.08) continue;
    if (Math.abs(gx) < 1.05 && gz > 1.05 && gz < 8.8) continue;
    const blade = new THREE.Mesh(bladeGeo, grassMat);
    blade.position.set(gx, gh + 0.008, gz);
    blade.rotation.y = rnd() * Math.PI;
    const gs = 0.7 + rnd() * 0.7;
    blade.scale.set(gs, 0.9 + rnd() * 0.7, gs);
    island.add(blade);
    grassN++;
  }

  // ---- tower (striped cylinders, no canvas texture) ----
  const towerH = 4.85;
  const towerBottomR = 1.08;
  const towerTopR = 0.72;
  const towerBottom = 0.5;
  const bands = 8;
  for (let b = 0; b < bands; b++) {
    const t0 = b / bands;
    const t1 = (b + 1) / bands;
    const y0 = towerBottom + towerH * t0;
    const y1 = towerBottom + towerH * t1;
    const r0 = towerBottomR + (towerTopR - towerBottomR) * t0;
    const r1 = towerBottomR + (towerTopR - towerBottomR) * t1;
    const h = y1 - y0;
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(r1, r0, h, 28, 1),
      b % 2 === 0 ? stripeWhite : stripeRed
    );
    band.position.y = (y0 + y1) * 0.5;
    island.add(band);
  }

  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(1.32, 1.46, 0.62, 24), rockDark);
  plinth.position.y = 0.42;
  island.add(plinth);

  function placeOnTower(mesh, y, ang, push) {
    const t = Math.max(0, Math.min(1, (y - towerBottom) / towerH));
    const radius = towerBottomR + (towerTopR - towerBottomR) * t;
    const out = radius + push;
    mesh.position.set(Math.sin(ang) * out, y, Math.cos(ang) * out);
    mesh.rotation.y = ang;
    island.add(mesh);
  }

  const door = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.78, 0.08), doorMat);
  placeOnTower(door, 1.18, 0.35, 0.04);
  const knob = new THREE.Mesh(sphere, metalMat);
  knob.scale.set(0.035, 0.035, 0.035);
  placeOnTower(knob, 1.08, 0.52, 0.08);
  placeOnTower(new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.36, 0.06), windowMat), 2.35, 0.15, 0.03);
  placeOnTower(new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.34, 0.06), windowMat), 3.45, 2.4, 0.03);
  placeOnTower(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.3, 0.05), windowMat), 3.15, 4.3, 0.03);

  const towerTop = towerBottom + towerH;
  const capRing = new THREE.Mesh(new THREE.CylinderGeometry(0.92, towerTopR, 0.14, 24), metalMat);
  capRing.position.y = towerTop + 0.04;
  island.add(capRing);
  const gallery = new THREE.Mesh(new THREE.CylinderGeometry(1.14, 1.08, 0.11, 28), metalMat);
  gallery.position.y = towerTop + 0.12;
  island.add(gallery);
  for (let post = 0; post < 12; post++) {
    const ang = (post / 12) * Math.PI * 2;
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.018, 0.34, 5), metalMat);
    bar.position.set(Math.sin(ang) * 1.05, towerTop + 0.34, Math.cos(ang) * 1.05);
    island.add(bar);
  }
  [0.28, 0.44].forEach((lift) => {
    const rail = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.018, 6, 28), metalMat);
    rail.rotation.x = Math.PI / 2;
    rail.position.y = towerTop + lift;
    island.add(rail);
  });

  const sill = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.72, 0.16, 20), metalMat);
  sill.position.y = towerTop + 0.2;
  island.add(sill);
  const lanternY = towerTop + 0.62;
  const lanternCore = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.42, 0.56, 16), glassOpaque);
  lanternCore.position.y = lanternY;
  island.add(lanternCore);
  for (let mullion = 0; mullion < 8; mullion++) {
    const ma = (mullion / 8) * Math.PI * 2;
    const barM = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.56, 5), metalMat);
    barM.position.set(Math.sin(ma) * 0.5, lanternY, Math.cos(ma) * 0.5);
    island.add(barM);
  }
  const lanternCap = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.54, 0.08, 20), metalMat);
  lanternCap.position.y = lanternY + 0.33;
  island.add(lanternCap);
  const eave = new THREE.Mesh(new THREE.CylinderGeometry(0.88, 0.6, 0.1, 24), roofMat);
  eave.position.y = lanternY + 0.42;
  island.add(eave);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.7, 0.62, 24), roofMat);
  roof.position.y = lanternY + 0.78;
  island.add(roof);
  const finial = new THREE.Mesh(sphere, metalMat);
  finial.scale.set(0.09, 0.09, 0.09);
  finial.position.y = lanternY + 1.12;
  island.add(finial);
  const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.02, 0.28, 6), metalMat);
  spire.position.y = lanternY + 1.3;
  island.add(spire);

  function putTree(ang, factor, scale) {
    const edge = coastRadius(ang);
    const r = edge * factor;
    const x = Math.cos(ang) * r;
    const z = Math.sin(ang) * r;
    let h = islandHeight(x, z);
    if (h == null) h = 0.35;
    addTree(island, x, h - 0.02, z, scale);
  }
  putTree(2.5, 0.5, 1.25);
  putTree(5.55, 0.46, 1.1);

  function putFlower(ang, factor, mat) {
    const edge = coastRadius(ang);
    const r = edge * factor;
    const x = Math.cos(ang) * r;
    const z = Math.sin(ang) * r;
    const h = islandHeight(x, z);
    if (h == null) return;
    addFlower(island, x, h + 0.02, z, mat);
  }
  putFlower(0.45, 0.55, flowerWhite);
  putFlower(0.85, 0.66, flowerCoral);
  putFlower(2.15, 0.42, flowerWhite);
  putFlower(2.85, 0.58, flowerCoral);
  putFlower(3.7, 0.48, flowerWhite);
  putFlower(4.35, 0.62, flowerCoral);
  putFlower(5.2, 0.4, flowerWhite);
  putFlower(5.9, 0.58, flowerCoral);

  // ---- pier ----
  const pier = new THREE.Group();
  const shoreZ = coastRadius(Math.PI / 2);
  const z0 = shoreZ * 0.42;
  const z1 = shoreZ + 2.55;
  let yLand = islandHeight(0.02, z0);
  if (yLand == null) yLand = 0.4;
  const y0 = yLand + 0.08;
  const y1 = 0.34;
  const deckLen = z1 - z0;
  const plankN = 12;
  const plankD = deckLen / plankN;
  function deckY(z) {
    return y0 + (y1 - y0) * ((z - z0) / deckLen);
  }
  [-0.46, 0.5].forEach((x) => {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, deckLen), woodDark);
    const midZ = (z0 + z1) * 0.5;
    beam.position.set(x, deckY(midZ) - 0.08, midZ);
    beam.rotation.x = Math.atan2(y0 - y1, deckLen);
    pier.add(beam);
  });
  for (let plank = 0; plank < plankN; plank++) {
    const pz = z0 + (plank + 0.5) * plankD;
    const board = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.045, plankD * 0.78), plank % 2 ? woodMat : woodDark);
    board.position.set(0.02, deckY(pz), pz);
    pier.add(board);
  }
  const landing = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.06, 0.72), woodMat);
  landing.position.set(0.02, y0 + 0.02, z0 + 0.12);
  pier.add(landing);
  [0.38, 0.64, 0.9].forEach((t, idx) => {
    const pileZ = z0 + deckLen * t;
    [-0.46, 0.5].forEach((x) => {
      const deckLocal = deckY(pileZ);
      const bedLocal = SEABED_Y + seabedHeight(x, pileZ) - 0.12;
      const len = Math.max(0.6, deckLocal - bedLocal + 0.28);
      const pile = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.064, len, 6), woodDark);
      pile.position.set(x, bedLocal + len * 0.5 - 0.1, pileZ);
      pier.add(pile);
    });
    const brace = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.04, 0.04), woodDark);
    brace.position.set(0.02, deckY(pileZ) - 0.55, pileZ);
    brace.rotation.z = idx % 2 ? 0.42 : -0.42;
    pier.add(brace);
  });
  const railStartT = 0.34;
  const railZ0 = z0 + deckLen * railStartT;
  const railLen = z1 - railZ0;
  [-0.58, 0.62].forEach((x) => {
    for (let rp = 0; rp < 7; rp++) {
      const t = rp / 6;
      if (t < railStartT) continue;
      const postZ = z0 + deckLen * t;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.42, 5), woodDark);
      post.position.set(x, deckY(postZ) + 0.22, postZ);
      pier.add(post);
    }
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, railLen), woodMat);
    const railMid = (railZ0 + z1) * 0.5;
    rail.position.set(x, deckY(railMid) + 0.4, railMid);
    rail.rotation.x = Math.atan2(deckY(railZ0) - deckY(z1), railLen);
    pier.add(rail);
  });
  island.add(pier);

  // Boat (static)
  const boat = new THREE.Group();
  const hull = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.22, 1.35),
    new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: 0.62 })
  );
  hull.position.y = 0.05;
  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(0.48, 0.04, 1.15),
    new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 0.55 })
  );
  deck.position.y = 0.16;
  boat.add(hull, deck);
  boat.position.set(1.35, 0.12, z1 - 0.35);
  boat.rotation.y = -0.35;
  island.add(boat);

  // Sit on table: lift so lowest point ≈ 0, then scale to TABLE_DIAMETER
  island.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(island);
  const size = new THREE.Vector3();
  box.getSize(size);
  island.position.y -= box.min.y;
  const span = Math.max(size.x, size.z);
  const s = TABLE_DIAMETER / span;
  island.scale.setScalar(s);
  island.updateMatrixWorld(true);

  return island;
}

function exportGLB(scene) {
  return new Promise((resolve, reject) => {
    new GLTFExporter().parse(scene, (result) => resolve(Buffer.from(result)), reject, {
      binary: true, onlyVisible: true,
    });
  });
}

async function main() {
  const island = buildIsland();
  const root = new THREE.Group();
  root.add(island);

  // Quick Look / USDZ: front-side only
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
    ar: {
      anchoring: { type: 'plane' },
      planeAnchoring: { alignment: 'horizontal' },
    },
  });
  writeFileSync(join(__dirname, 'island.usdz'), Buffer.from(usdz));
  console.log(`Wrote island.usdz (${usdz.byteLength} bytes)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
