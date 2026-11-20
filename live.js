import * as THREE from 'three';
import { createLiveScene, createPixelPipeline, qualityPreset } from './live-scene.js';

window.__LIVE_OK = true;

const $ = (id) => document.getElementById(id);
const hint = $('hint');
const banner = $('banner');
const loadBar = $('loadBar');
const loadFill = $('loadFill');
const btnStart = $('btnStart');
const btnPlace = $('btnPlace');
const btnPixel = $('btnPixel');
const btnQuality = $('btnQuality');
const btnExit = $('btnExit');
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
let sceneReady = false;
let deviceOrientEnabled = false;
let screenOrientAngle = 0;
const orientEuler = new THREE.Euler();
const orientQ0 = new THREE.Quaternion();
const orientQ1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5));
const orientZee = new THREE.Vector3(0, 0, 1);
const deviceAlphaBetaGamma = { alpha: 0, beta: 90, gamma: 0 };

function setHint(t) { hint.textContent = t; }
function setLoad(p) {
  loadBar.style.display = p >= 1 ? 'none' : 'block';
  loadFill.style.width = Math.round(p * 100) + '%';
}
function inCameraAR() {
  return mode === 'ios-cam' || mode === 'ar-placed' || mode === 'ar-scan' || renderer?.xr?.isPresenting;
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
  camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, 50);
  camera.position.set(0.55, 0.42, 0.7);
  clock = new THREE.Clock();

  worldRoot = new THREE.Group();
  worldRoot.visible = false;
  scene.add(worldRoot);

  reticle = makeReticle();
  scene.add(reticle);

  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', () => {
    screenOrientAngle = (window.orientation || 0) * Math.PI / 180;
  });
  screenOrientAngle = (window.orientation || 0) * Math.PI / 180;
  canvas.addEventListener('pointerdown', onPointerDown);
}

function onResize() {
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
  if (pixel) pixel.setSize(w, h, renderer.getPixelRatio());
}

function yieldFrame() {
  return new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
}

async function buildSceneProgressive(opts = {}) {
  const keepCameraAR = !!opts.keepCameraAR;
  setLoad(0.15);
  setHint('正在构建灯塔小岛…');
  await yieldFrame();

  while (worldRoot.children.length) worldRoot.remove(worldRoot.children[0]);
  if (pixel) {
    pixel.dispose();
    pixel = null;
  }

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
  setLoad(1);

  btnPixel.style.display = '';
  btnQuality.style.display = '';

  if (keepCameraAR) {
    // Stay in camera AR — do NOT paint opaque background / reset pose wrongly
    scene.background = null;
    renderer.setClearColor(0x000000, 0);
    if (placed) {
      worldRoot.visible = true;
      setHint('画质已更新。场景仍在摄像头画面中。');
    } else {
      worldRoot.visible = false;
      setHint('画质已更新。请再点「放置场景」。');
    }
    btnStart.style.display = 'none';
    btnPlace.style.display = '';
    btnExit.style.display = '';
    return;
  }

  scene.background = new THREE.Color(0x0e1a26);
  worldRoot.visible = true;
  worldRoot.position.set(0, 0, 0);
  worldRoot.quaternion.identity();
  camera.position.set(0.55, 0.42, 0.7);
  camera.quaternion.identity();
  camera.lookAt(0, 0.08, 0);
  placed = true;
  mode = 'preview';
  setHint('预览就绪。点「开始 AR」放到桌上。');
  btnStart.style.display = '';
  btnStart.disabled = false;
  btnStart.textContent = '开始 AR';
  btnPlace.style.display = 'none';
  btnExit.style.display = 'none';
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
  if (starting || !sceneReady) return;
  starting = true;
  btnStart.disabled = true;
  try {
    const hasXR = await checkWebXR();
    if (hasXR) await startWebXR();
    else if (isIOS || isAndroid) await startIOSCameraAR();
    else {
      setHint('当前设备不支持摄像头 AR，请用手机 Safari / Chrome 扫码。');
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
  setHint('对准桌面扫描，出现光圈后点屏幕放置。');
  btnPlace.style.display = 'none';
  btnStart.style.display = 'none';
  btnExit.style.display = '';

  xrRefSpace = await session.requestReferenceSpace('local');
  xrViewerSpace = await session.requestReferenceSpace('viewer');
  xrHitTestSource = await session.requestHitTestSource({ space: xrViewerSpace });
  session.addEventListener('end', onLeaveAR);
}

function onLeaveAR() {
  xrHitTestSource = null;
  stopCameraStream();
  deviceOrientEnabled = false;
  mode = 'preview';
  scene.background = new THREE.Color(0x0e1a26);
  renderer.setClearColor(0x000000, 1);
  worldRoot.visible = true;
  worldRoot.position.set(0, 0, 0);
  worldRoot.quaternion.identity();
  camera.position.set(0.55, 0.42, 0.7);
  camera.quaternion.identity();
  camera.lookAt(0, 0.08, 0);
  placed = true;
  btnStart.style.display = '';
  btnStart.disabled = false;
  btnPlace.style.display = 'none';
  btnExit.style.display = 'none';
  setHint('已回到预览。可再次点「开始 AR」。');
}

function stopCameraStream() {
  camVideo.style.display = 'none';
  const stream = camVideo.srcObject;
  if (stream && stream.getTracks) stream.getTracks().forEach((t) => t.stop());
  camVideo.srcObject = null;
}

async function enableDeviceOrientation() {
  try {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      const r = await DeviceOrientationEvent.requestPermission();
      if (r !== 'granted') throw new Error('未获得运动传感器权限');
    }
  } catch (e) {
    console.warn(e);
    setHint('未授权方向传感器，将使用简化放置（小岛会出现在镜头前方固定位置）。');
  }
  window.addEventListener('deviceorientation', onDeviceOrient, true);
  deviceOrientEnabled = true;
}

function onDeviceOrient(e) {
  if (e.alpha == null || e.beta == null || e.gamma == null) return;
  deviceAlphaBetaGamma.alpha = e.alpha;
  deviceAlphaBetaGamma.beta = e.beta;
  deviceAlphaBetaGamma.gamma = e.gamma;
}

function updateCameraFromDevice() {
  if (!deviceOrientEnabled) return;
  const alpha = THREE.MathUtils.degToRad(deviceAlphaBetaGamma.alpha);
  const beta = THREE.MathUtils.degToRad(deviceAlphaBetaGamma.beta);
  const gamma = THREE.MathUtils.degToRad(deviceAlphaBetaGamma.gamma);
  orientEuler.set(beta, alpha, -gamma, 'YXZ');
  camera.quaternion.setFromEuler(orientEuler);
  camera.quaternion.multiply(orientQ1);
  camera.quaternion.multiply(orientQ0.setFromAxisAngle(orientZee, -screenOrientAngle));
  camera.position.set(0, 0, 0);
}

async function startIOSCameraAR() {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      facingMode: { ideal: 'environment' },
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
  });
  camVideo.srcObject = stream;
  camVideo.style.display = 'block';
  await camVideo.play();
  await enableDeviceOrientation();

  scene.background = null;
  renderer.setClearColor(0x000000, 0);
  camera.position.set(0, 0, 0);
  camera.near = 0.05;
  camera.far = 40;
  camera.updateProjectionMatrix();

  worldRoot.visible = false;
  placed = false;
  mode = 'ios-cam';
  setHint('已打开摄像头。对准桌面，点「放置场景」——小岛会出现在镜头前方桌面上。');
  btnPlace.style.display = '';
  btnStart.style.display = 'none';
  btnExit.style.display = '';
}

/** Place diorama in front of current camera view (camera-local → world). */
function placeFromCamera() {
  updateCameraFromDevice();
  camera.updateMatrixWorld(true);

  // In front of phone, slightly downward so it sits on a desk in view
  const local = new THREE.Vector3(0, -0.18, -0.55);
  const pos = local.applyMatrix4(camera.matrixWorld);

  worldRoot.position.copy(pos);

  // Keep model upright: yaw toward camera
  const camPos = camera.position.clone();
  const flatCam = new THREE.Vector3(camPos.x, pos.y, camPos.z);
  worldRoot.lookAt(flatCam);
  worldRoot.rotateY(Math.PI);

  // Extra visibility nudge: ensure scale not zero
  if (worldRoot.scale.x === 0) worldRoot.scale.setScalar(1);

  worldRoot.visible = true;
  placed = true;
  mode = 'ar-placed';
  setHint('已放置。转动手机可环看；点「放置场景」可换位置，「退出 AR」回预览。');
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

  if ((mode === 'ios-cam' || mode === 'ar-placed') && !renderer.xr.isPresenting) {
    updateCameraFromDevice();
  }

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

  if (pixel && pixel.enabled && mode === 'preview' && !renderer.xr.isPresenting) {
    pixel.render();
  } else {
    renderer.render(scene, camera);
  }
}

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

btnExit.addEventListener('click', async () => {
  if (renderer.xr.isPresenting) {
    const s = renderer.xr.getSession && renderer.xr.getSession();
    if (s) s.end();
    return;
  }
  onLeaveAR();
});

btnPixel.addEventListener('click', () => {
  if (!pixel) return;
  pixel.enabled = !pixel.enabled;
  btnPixel.textContent = pixel.enabled ? '像素风: 开' : '像素风: 关';
});

btnQuality.addEventListener('click', async () => {
  if (!sceneReady) return;
  if (renderer.xr.isPresenting) {
    setHint('WebXR 会话中请先点「退出 AR」再调画质。');
    return;
  }
  const keep = (mode === 'ios-cam' || mode === 'ar-placed');
  qualityName = qualityName === 'low' ? 'med' : qualityName === 'med' ? 'high' : 'low';
  btnQuality.disabled = true;
  await buildSceneProgressive({ keepCameraAR: keep });
  btnQuality.disabled = false;
  if (!keep) {
    btnStart.style.display = '';
    btnStart.disabled = false;
  }
});

showBanner();
initRenderer();
renderer.setAnimationLoop(animate);
setHint('点「加载动态场景」开始。iPhone 请用 Safari。');
btnStart.textContent = '加载动态场景';
btnStart.disabled = false;
