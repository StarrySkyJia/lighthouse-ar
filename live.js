import * as THREE from 'three';
import { createLiveScene, createPixelPipeline, qualityPreset } from './live-scene.js';

const $ = (id) => document.getElementById(id);
const hint = $('hint');
const banner = $('banner');
const loadBar = $('loadBar');
const loadFill = $('loadFill');
const btnStart = $('btnStart');
const btnPlace = $('btnPlace');
const btnPixel = $('btnPixel');
const btnQuality = $('btnQuality');
const camVideo = $('cam');
const canvas = $('c');

const ua = navigator.userAgent || '';
const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isAndroid = /Android/i.test(ua);
const isWeChat = /MicroMessenger/i.test(ua);

let renderer, scene, camera, clock;
let live, pixel, worldRoot, reticle;
let xrHitTestSource = null;
let xrRefSpace = null;
let xrViewerSpace = null;
let placed = false;
let mode = 'boot'; // boot | preview | ar-scan | ar-placed | ios-cam
let qualityName = 'auto';
let starting = false;

function setHint(t) { hint.textContent = t; }
function setLoad(p) {
  loadBar.style.display = p >= 1 ? 'none' : 'block';
  loadFill.style.width = Math.round(p * 100) + '%';
}

function showBanner() {
  if (isWeChat) {
    banner.style.display = 'block';
    banner.innerHTML = isIOS
      ? '<strong>请在 Safari 打开：</strong>右上角 ··· → 在 Safari 中打开，再体验完整动态 AR。'
      : '<strong>建议用 Chrome 打开：</strong>右上角 ··· → 在浏览器中打开。';
  }
}

function makeReticle() {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.07, 0.09, 40),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, side: THREE.DoubleSide })
  );
  ring.rotation.x = -Math.PI / 2;
  g.add(ring);
  g.visible = false;
  return g;
}

function initRenderer() {
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    alpha: true,
    powerPreference: 'high-performance',
  });
  const q = qualityPreset(qualityName, {
    cores: navigator.hardwareConcurrency || 4,
    mem: navigator.deviceMemory || 4,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.pr));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.xr.enabled = true;
  renderer.setClearColor(0x000000, 0);

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.01, 40);
  camera.position.set(0.45, 0.38, 0.55);
  clock = new THREE.Clock();

  worldRoot = new THREE.Group();
  worldRoot.visible = false;
  scene.add(worldRoot);

  reticle = makeReticle();
  scene.add(reticle);

  window.addEventListener('resize', onResize);
  canvas.addEventListener('pointerdown', onPointerDown);
}

function onResize() {
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
  const pr = renderer.getPixelRatio();
  if (pixel) pixel.setSize(w, h, pr);
}

async function buildSceneProgressive() {
  setLoad(0.15);
  setHint('正在构建灯塔小岛…');
  await yieldFrame();

  const q = qualityPreset(qualityName, {
    cores: navigator.hardwareConcurrency || 4,
    mem: navigator.deviceMemory || 4,
  });
  btnQuality.textContent = '画质: ' + q.name;
  live = createLiveScene(THREE, { quality: q });
  worldRoot.add(live.root);
  setLoad(0.55);
  setHint('正在准备像素风与动画…');
  await yieldFrame();

  pixel = createPixelPipeline(renderer, scene, camera, q.pixelCell);
  pixel.setSize(window.innerWidth, window.innerHeight, renderer.getPixelRatio());
  setLoad(0.85);
  await yieldFrame();

  // Preview lighting backdrop when not in camera/XR
  scene.background = new THREE.Color(0x0e1a26);
  worldRoot.visible = true;
  worldRoot.position.set(0, 0, 0);
  placed = true;
  mode = 'preview';
  setLoad(1);
  setHint('预览就绪。点「开始 AR」放到桌上（含海浪/鸟/鱼/草/人物，可开关像素风）。');
  btnStart.disabled = false;
  btnPlace.style.display = 'none';
  btnPixel.style.display = '';
  btnQuality.style.display = '';
}

function yieldFrame() {
  return new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
}

async function checkWebXR() {
  if (!navigator.xr) return false;
  try {
    return await navigator.xr.isSessionSupported('immersive-ar');
  } catch (_) {
    return false;
  }
}

async function startAR() {
  if (starting) return;
  starting = true;
  btnStart.disabled = true;
  try {
    const hasXR = await checkWebXR();
    if (hasXR) {
      await startWebXR();
    } else if (isIOS || isAndroid) {
      await startIOSCameraAR();
    } else {
      setHint('当前设备不支持摄像头 AR，可继续在预览中旋转观看（拖动下方空白处无效；请用手机扫码）。');
      btnStart.disabled = false;
    }
  } catch (e) {
    console.warn(e);
    setHint('启动 AR 失败：' + (e && e.message ? e.message : '请检查摄像头权限与 HTTPS'));
    btnStart.disabled = false;
  } finally {
    starting = false;
  }
}

async function startWebXR() {
  const session = await navigator.xr.requestSession('immersive-ar', {
    requiredFeatures: ['hit-test'],
    optionalFeatures: ['dom-overlay', 'light-estimation'],
    domOverlay: { root: $('overlay') },
  }).catch(() => navigator.xr.requestSession('immersive-ar', { requiredFeatures: ['hit-test'] }));

  scene.background = null;
  await renderer.xr.setSession(session);
  worldRoot.visible = false;
  placed = false;
  mode = 'ar-scan';
  setHint('对准桌面扫描，出现光圈后点屏幕放置完整动态场景。');
  btnPlace.style.display = 'none';
  btnStart.style.display = 'none';

  xrRefSpace = await session.requestReferenceSpace('local');
  xrViewerSpace = await session.requestReferenceSpace('viewer');
  xrHitTestSource = await session.requestHitTestSource({ space: xrViewerSpace });
  session.addEventListener('end', () => {
    xrHitTestSource = null;
    mode = 'preview';
    scene.background = new THREE.Color(0x0e1a26);
    worldRoot.visible = true;
    worldRoot.position.set(0, 0, 0);
    placed = true;
    btnStart.style.display = '';
    btnStart.disabled = false;
    setHint('AR 已结束，回到预览。');
  });
}

async function startIOSCameraAR() {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
  });
  camVideo.srcObject = stream;
  camVideo.style.display = 'block';
  await camVideo.play();
  scene.background = null;
  renderer.setClearColor(0x000000, 0);
  worldRoot.visible = false;
  placed = false;
  mode = 'ios-cam';
  setHint('已打开摄像头。对准桌面，点「放置场景」把灯塔小岛放到桌上。');
  btnPlace.style.display = '';
  btnStart.style.display = 'none';
}

function placeFromCamera(distance = 0.65) {
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  // Horizontal placement: project onto a plane below the camera
  const tableY = camera.position.y - 0.42;
  const flat = forward.clone();
  flat.y = 0;
  if (flat.lengthSq() < 1e-6) flat.set(0, 0, -1);
  flat.normalize();
  const pos = camera.position.clone().add(flat.multiplyScalar(distance));
  pos.y = tableY;
  worldRoot.position.copy(pos);
  // Face camera roughly
  const look = camera.position.clone();
  look.y = pos.y;
  worldRoot.lookAt(look);
  worldRoot.rotateY(Math.PI);
  worldRoot.visible = true;
  placed = true;
  mode = 'ar-placed';
  setHint('已放置。可走动观看；海浪/鸟/鱼/草/人物都在动。点「放置场景」可换位置。');
}

function onPointerDown(ev) {
  if (renderer.xr.isPresenting && mode === 'ar-scan') {
    if (!reticle.visible) {
      setHint('先缓慢移动手机，等桌面光圈出现再点。');
      return;
    }
    worldRoot.position.copy(reticle.position);
    worldRoot.quaternion.copy(reticle.quaternion);
    worldRoot.visible = true;
    placed = true;
    reticle.visible = false;
    mode = 'ar-placed';
    setHint('场景已放到桌上。完整动态效果运行中。');
    ev.preventDefault();
  }
}

function animate(_t, frame) {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  if (live) live.update(t, dt);

  if (renderer.xr.isPresenting && frame && xrHitTestSource && xrRefSpace && !placed) {
    const hits = frame.getHitTestResults(xrHitTestSource);
    if (hits.length) {
      const pose = hits[0].getPose(xrRefSpace);
      if (pose) {
        reticle.visible = true;
        reticle.matrix.fromArray(pose.transform.matrix);
        reticle.matrix.decompose(reticle.position, reticle.quaternion, reticle.scale);
        reticle.scale.set(1, 1, 1);
      }
    } else reticle.visible = false;
  }

  // Pixel pass: preview only (keeps camera / XR background clear + saves FPS)
  if (pixel && pixel.enabled && mode === 'preview' && !renderer.xr.isPresenting) {
    pixel.render();
  } else {
    renderer.render(scene, camera);
  }
}

let sceneReady = false;

btnStart.addEventListener('click', async () => {
  if (!sceneReady) {
    btnStart.disabled = true;
    await buildSceneProgressive();
    sceneReady = true;
    btnStart.textContent = '开始 AR';
    btnStart.disabled = false;
    return;
  }
  await startAR();
});
btnPlace.addEventListener('click', () => placeFromCamera());
btnPixel.addEventListener('click', () => {
  if (!pixel) return;
  pixel.enabled = !pixel.enabled;
  btnPixel.textContent = pixel.enabled ? '像素风: 开' : '像素风: 关';
  btnPixel.setAttribute('aria-pressed', pixel.enabled ? 'true' : 'false');
});
btnQuality.addEventListener('click', async () => {
  if (!sceneReady) return;
  qualityName = qualityName === 'low' ? 'med' : qualityName === 'med' ? 'high' : 'low';
  setHint('正在切换画质并重建场景…');
  btnStart.disabled = true;
  while (worldRoot.children.length) worldRoot.remove(worldRoot.children[0]);
  if (pixel) pixel.dispose();
  live = null;
  await buildSceneProgressive();
  btnStart.disabled = false;
});

showBanner();
initRenderer();
renderer.setAnimationLoop(animate);
setHint('点「加载动态场景」开始（分阶段加载，可再开 AR）。iPhone 请用 Safari。');
btnStart.textContent = '加载动态场景';
btnStart.disabled = false;
