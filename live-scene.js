/**
 * Compact dynamic diorama for tabletop AR — island, waves, birds, fish, grass, fisher, pixel look.
 * Quality tiers: low | med | high
 */
import * as THREE from 'three';

const SEABED_Y = -1.35;

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function qualityPreset(name, hints = {}) {
  const isLowEnd = hints.cores && hints.cores <= 4 || hints.mem && hints.mem <= 4;
  const base = name === 'low' || (name === 'auto' && isLowEnd) ? 'low'
    : name === 'high' && !isLowEnd ? 'high' : 'med';
  const table = {
    low:  { grass: 48, fish: 4, birds: 2, waterSeg: 36, pixelCell: 3, pr: 1, shadows: false },
    med:  { grass: 110, fish: 7, birds: 3, waterSeg: 48, pixelCell: 2, pr: 1.25, shadows: false },
    high: { grass: 160, fish: 10, birds: 4, waterSeg: 64, pixelCell: 2, pr: 1.5, shadows: true },
  };
  return { name: base, ...table[base] };
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

function makeWaterMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uColorDeep: { value: new THREE.Color(0x1a5f7a) },
      uColorShallow: { value: new THREE.Color(0x4db3c8) },
      uSky: { value: new THREE.Color(0xb8d8ef) },
    },
    vertexShader: /* glsl */`
      uniform float uTime;
      varying vec2 vLocalXZ;
      varying float vCrest;
      void main() {
        vec3 p = position;
        float w1 = sin(p.x * 1.15 + uTime * 1.6) * 0.045;
        float w2 = cos(p.z * 1.35 - uTime * 1.25) * 0.035;
        float w3 = sin((p.x + p.z) * 0.85 + uTime * 2.1) * 0.02;
        p.y += w1 + w2 + w3;
        vCrest = clamp((w1 + w2) * 6.0 + 0.35, 0.0, 1.0);
        vLocalXZ = position.xz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      precision mediump float;
      uniform vec3 uColorDeep;
      uniform vec3 uColorShallow;
      uniform vec3 uSky;
      varying vec2 vLocalXZ;
      varying float vCrest;
      float coastRadius(float ang) {
        return 4.15 + 0.88 * sin(ang * 2.0 + 0.4) + 0.5 * sin(ang * 3.0 + 1.7) + 0.3 * cos(ang * 5.0 + 0.2);
      }
      void main() {
        float ang = atan(vLocalXZ.y, vLocalXZ.x);
        float r = length(vLocalXZ);
        float edge = coastRadius(ang);
        float land = smoothstep(edge + 0.15, edge - 0.35, r);
        if (land > 0.98) discard;
        float shallow = smoothstep(edge + 1.8, edge + 0.1, r);
        vec3 col = mix(uColorDeep, uColorShallow, shallow);
        col = mix(col, uSky, vCrest * 0.35);
        float alpha = mix(0.72, 0.42, shallow) * (1.0 - land);
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });
}

function makePixelMaterial(beautyTex) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uBeauty: { value: beautyTex },
      uCell: { value: new THREE.Vector2(2, 2) },
      uTexel: { value: new THREE.Vector2(1, 1) },
      uPalette: { value: 1 },
    },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.0,1.0); }`,
    fragmentShader: /* glsl */`
      precision mediump float;
      varying vec2 vUv;
      uniform sampler2D uBeauty;
      uniform vec2 uCell;
      uniform vec2 uTexel;
      uniform float uPalette;
      void main(){
        vec2 cell = max(uCell, vec2(1.0));
        vec2 uv = (floor(vUv / (uTexel * cell)) * cell + 0.5 * cell) * uTexel;
        vec3 c = texture2D(uBeauty, uv).rgb;
        // mild posterize
        float steps = mix(32.0, 12.0, uPalette);
        c = floor(c * steps + 0.5) / steps;
        // cheap ink from luma neighbor
        float l = dot(c, vec3(0.299,0.587,0.114));
        float l2 = dot(texture2D(uBeauty, uv + uTexel * cell).rgb, vec3(0.299,0.587,0.114));
        float edge = smoothstep(0.04, 0.14, abs(l - l2));
        c *= 1.0 - edge * 0.55;
        gl_FragColor = vec4(c, 1.0);
      }
    `,
  });
}

export function createLiveScene(THREE_NS, opts = {}) {
  const THREE = THREE_NS;
  const rnd = mulberry32(20261121);
  const q = opts.quality || qualityPreset('med');
  const root = new THREE.Group();
  root.name = 'LiveDiorama';

  const hemi = new THREE.HemisphereLight(0xb8d4ef, 0x4a3a28, 0.9);
  root.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0d8, 1.05);
  sun.position.set(4, 8, 3);
  if (q.shadows) {
    sun.castShadow = true;
    sun.shadow.mapSize.set(512, 512);
  }
  root.add(sun);

  const rockMat = new THREE.MeshStandardMaterial({ color: 0xc4a07a, roughness: 0.94 });
  const rockDark = new THREE.MeshStandardMaterial({ color: 0xa68462, roughness: 0.96 });
  const woodMat = new THREE.MeshStandardMaterial({ color: 0xd08a4c, roughness: 0.72 });
  const woodDark = new THREE.MeshStandardMaterial({ color: 0xb8743a, roughness: 0.78 });
  const metalMat = new THREE.MeshStandardMaterial({ color: 0xc5ced4, roughness: 0.38, metalness: 0.55 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0xd6453a, roughness: 0.48 });
  const stripeW = new THREE.MeshStandardMaterial({ color: 0xf6f2ea, roughness: 0.62 });
  const stripeR = new THREE.MeshStandardMaterial({ color: 0xe24b3c, roughness: 0.62 });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0xffe6c0, emissive: 0xffb15c, emissiveIntensity: 0.7, roughness: 0.3,
  });
  const palmTrunk = new THREE.MeshStandardMaterial({ color: 0x9a6842, roughness: 0.9 });
  const palmRing = new THREE.MeshStandardMaterial({ color: 0x6d4630, roughness: 0.94 });
  const palmLeaf = new THREE.MeshStandardMaterial({ color: 0x3e9a3c, roughness: 0.7, side: THREE.DoubleSide });
  const palmLeafD = new THREE.MeshStandardMaterial({ color: 0x2c7830, roughness: 0.76, side: THREE.DoubleSide });
  const grassMat = new THREE.MeshStandardMaterial({ color: 0x6faf48, roughness: 0.88, side: THREE.DoubleSide });
  const sphere = new THREE.SphereGeometry(1, 10, 8);

  const island = new THREE.Group();
  root.add(island);

  // Land
  const landGeo = new THREE.PlaneGeometry(13.2, 13.2, 40, 40);
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

  // Seabed plate + water volume feel
  const bed = new THREE.Mesh(
    new THREE.CircleGeometry(7.2, 48),
    new THREE.MeshStandardMaterial({ color: 0x9a7a52, roughness: 1 })
  );
  bed.rotation.x = -Math.PI / 2;
  bed.position.y = SEABED_Y;
  root.add(bed);

  const waterMat = makeWaterMaterial();
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(14.5, 14.5, q.waterSeg, q.waterSeg),
    waterMat
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.08;
  water.renderOrder = 2;
  root.add(water);

  // Tower
  const towerH = 4.85, towerBottomR = 1.08, towerTopR = 0.72, towerBottom = 0.5;
  for (let b = 0; b < 8; b++) {
    const t0 = b / 8, t1 = (b + 1) / 8;
    const y0 = towerBottom + towerH * t0, y1 = towerBottom + towerH * t1;
    const r0 = towerBottomR + (towerTopR - towerBottomR) * t0;
    const r1 = towerBottomR + (towerTopR - towerBottomR) * t1;
    const band = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, y1 - y0, 20), b % 2 ? stripeR : stripeW);
    band.position.y = (y0 + y1) * 0.5;
    island.add(band);
  }
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(1.32, 1.46, 0.62, 18), rockDark);
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
  const lamp = new THREE.PointLight(0xffd27a, 0.65, 12, 2);
  lamp.position.y = towerTop + 0.62;
  island.add(lamp);

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
    g.userData.foliage = foliage;
    g.userData.phase = rnd() * Math.PI * 2;
    island.add(g);
    return g;
  }
  function putTree(ang, factor, scale) {
    const edge = coastRadius(ang);
    const r = edge * factor;
    const x = Math.cos(ang) * r, z = Math.sin(ang) * r;
    let h = islandHeight(x, z); if (h == null) h = 0.35;
    return addTree(x, h - 0.02, z, scale);
  }
  const trees = [putTree(2.5, 0.5, 1.15), putTree(5.55, 0.46, 1.0)];

  // Grass blades
  const grass = [];
  const bladeGeo = new THREE.PlaneGeometry(0.022, 0.12);
  bladeGeo.translate(0, 0.06, 0);
  for (let i = 0; i < q.grass; i++) {
    const ang = rnd() * Math.PI * 2;
    const edge = coastRadius(ang);
    const rad = (0.35 + rnd() * 0.52) * edge;
    const gx = Math.cos(ang) * rad, gz = Math.sin(ang) * rad;
    const gh = islandHeight(gx, gz);
    if (gh == null || gh < 0.22) continue;
    if (Math.hypot(gx, gz) < 1.1) continue;
    const blade = new THREE.Mesh(bladeGeo, grassMat);
    blade.position.set(gx, gh + 0.008, gz);
    blade.rotation.y = rnd() * Math.PI;
    const s = 0.7 + rnd() * 0.8;
    blade.scale.set(s, 0.85 + rnd() * 0.7, s);
    blade.userData.phase = rnd() * Math.PI * 2;
    island.add(blade);
    grass.push(blade);
  }

  // Pier
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
      const bed = SEABED_Y + 0.2;
      const len = Math.max(0.5, deckY(pz) - bed);
      const pile = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, len, 5), woodDark);
      pile.position.set(x, bed + len * 0.5, pz);
      pier.add(pile);
    });
  });
  island.add(pier);

  // Boat
  const boat = new THREE.Group();
  boat.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 1.2), new THREE.MeshStandardMaterial({ color: 0xc0392b })));
  const deckM = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.04, 1.0), new THREE.MeshStandardMaterial({ color: 0xf4f1ea }));
  deckM.position.y = 0.12;
  boat.add(deckM);
  boat.position.set(1.25, 0.15, z1 - 0.4);
  boat.rotation.y = -0.35;
  boat.userData.phase = rnd() * 10;
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

  // Birds
  const birds = [];
  const gullMat = new THREE.MeshStandardMaterial({ color: 0xf7f8f6, roughness: 0.65, side: THREE.DoubleSide });
  for (let i = 0; i < q.birds; i++) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 5), gullMat);
    body.scale.set(1, 0.7, 1.4);
    const wingL = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 0.1), gullMat);
    const wingR = wingL.clone();
    wingL.position.set(-0.12, 0.02, 0);
    wingR.position.set(0.12, 0.02, 0);
    g.add(body, wingL, wingR);
    g.userData = {
      phase: rnd() * Math.PI * 2,
      radius: 3.2 + rnd() * 2.5,
      speed: 0.35 + rnd() * 0.35,
      height: 2.2 + rnd() * 2.0,
      wingL, wingR,
    };
    root.add(g);
    birds.push(g);
  }

  // Fish
  const fishes = [];
  const fishMats = [
    new THREE.MeshStandardMaterial({ color: 0xe07a3a, roughness: 0.45 }),
    new THREE.MeshStandardMaterial({ color: 0x3a8fd0, roughness: 0.45 }),
    new THREE.MeshStandardMaterial({ color: 0xd0c45a, roughness: 0.45 }),
  ];
  for (let i = 0; i < q.fish; i++) {
    const f = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), fishMats[i % 3]);
    body.scale.set(0.55, 0.45, 1.1);
    const tail = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.08), fishMats[i % 3]);
    tail.position.z = -0.12;
    f.add(body, tail);
    f.userData = {
      phase: rnd() * Math.PI * 2,
      radius: 5.5 + rnd() * 2.2,
      speed: 0.25 + rnd() * 0.55,
      depth: -0.35 - rnd() * 0.55,
      tail,
      scale: 0.7 + rnd() * 0.9,
    };
    f.scale.setScalar(f.userData.scale);
    root.add(f);
    fishes.push(f);
  }

  // Fisher character
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
  fisher.userData.phase = 0;
  island.add(fisher);

  // Table scale ~28cm across
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  box.getSize(size);
  root.position.y -= box.min.y;
  const span = Math.max(size.x, size.z);
  root.scale.setScalar(0.34 / span);
  root.updateMatrixWorld(true);

  const api = {
    root,
    waterMat,
    quality: q,
    pixelOn: true,
    update(t, dt) {
      waterMat.uniforms.uTime.value = t;
      lamp.intensity = 0.5 + Math.sin(t * 2.2) * 0.12;

      for (const tr of trees) {
        if (!tr.userData.foliage) continue;
        tr.userData.foliage.rotation.z = Math.sin(t * 1.3 + tr.userData.phase) * 0.04;
        tr.userData.foliage.rotation.x = Math.cos(t * 1.1 + tr.userData.phase) * 0.03;
      }
      for (const bl of grass) {
        bl.rotation.z = Math.sin(t * 2.0 + bl.userData.phase) * 0.18;
      }
      boat.position.y = 0.12 + Math.sin(t * 1.4 + boat.userData.phase) * 0.03;
      boat.rotation.z = Math.sin(t * 1.1 + boat.userData.phase) * 0.04;

      for (const b of birds) {
        const u = b.userData;
        const a = t * u.speed + u.phase;
        b.position.set(Math.cos(a) * u.radius, u.height + Math.sin(a * 2.2) * 0.25, Math.sin(a) * u.radius);
        b.rotation.y = -a + Math.PI / 2;
        const flap = Math.sin(t * 10 + u.phase) * 0.55;
        u.wingL.rotation.z = flap;
        u.wingR.rotation.z = -flap;
      }
      for (const f of fishes) {
        const u = f.userData;
        const a = t * u.speed + u.phase;
        const x = Math.cos(a) * u.radius;
        const z = Math.sin(a * 1.05) * u.radius * 0.9;
        const edge = coastRadius(Math.atan2(z, x)) + 1.3;
        const r = Math.hypot(x, z);
        const k = r < edge ? edge / (r || 1) : 1;
        f.position.set(x * k, u.depth + Math.sin(t * 1.5 + u.phase) * 0.08, z * k);
        f.rotation.y = -a + Math.PI / 2;
        u.tail.rotation.y = Math.sin(t * 12 + u.phase) * 0.4;
      }
      fisher.userData.phase += dt;
      rod.rotation.z = -0.55 + Math.sin(fisher.userData.phase * 1.2) * 0.04;
    },
  };

  return api;
}

export function createPixelPipeline(renderer, scene, camera, cell = 2) {
  const w = 1, h = 1;
  const beautyRT = new THREE.WebGLRenderTarget(w, h, {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    depthBuffer: true,
  });
  const postScene = new THREE.Scene();
  const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const tri = new THREE.BufferGeometry();
  tri.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  tri.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 2, 0, 0, 2]), 2));
  const postMat = makePixelMaterial(beautyRT.texture);
  postMat.uniforms.uCell.value.set(cell, cell);
  postScene.add(new THREE.Mesh(tri, postMat));

  return {
    enabled: true,
    setSize(width, height, pr) {
      const rw = Math.max(1, Math.floor(width * pr));
      const rh = Math.max(1, Math.floor(height * pr));
      beautyRT.setSize(rw, rh);
      postMat.uniforms.uTexel.value.set(1 / rw, 1 / rh);
      postMat.uniforms.uCell.value.set(cell, cell);
    },
    setCell(c) {
      cell = c;
      postMat.uniforms.uCell.value.set(c, c);
    },
    render() {
      if (!this.enabled) {
        renderer.render(scene, camera);
        return;
      }
      renderer.setRenderTarget(beautyRT);
      renderer.clear();
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      renderer.render(postScene, postCam);
    },
    dispose() {
      beautyRT.dispose();
      postMat.dispose();
    },
  };
}
