# 灯塔小岛 · 桌面 AR

独立入口，**不会改动**主站 `lighthouse/index.html` / `src.html`。

朋友用手机扫码打开本目录下的页面，可把简化版小岛放到真实桌面上观看。

## 怎么给朋友扫

1. 用 **HTTPS** 把 `ar/`（至少 `index.html`）部署到可公网访问的地址，例如：
   - 任意静态托管（Vercel / Netlify / GitHub Pages / 自家 Nginx）
   - 或本机调试：`npx serve ar -l 5173` 再配合内网穿透 / `chrome://flags` 仅限本机
2. 把完整 URL（例如 `https://你的域名/lighthouse/ar/`）生成二维码发给朋友
3. **推荐 Android + Chrome** 打开；点「进入 AR」→ 对准平坦桌面 → 出现光圈后点击放置

## 设备兼容

| 环境 | 效果 |
|------|------|
| Android Chrome（较新） | WebXR `immersive-ar` + 平面 hit-test，可真桌面放置 |
| iOS Safari | 多数机型暂无 WebXR AR；页面会自动落到「三维预览」 |
| 桌面浏览器 | 三维预览（轨道旋转），一般不能开摄像头 AR |

摄像头权限、HTTPS（或 localhost）是启动 AR 的硬性条件。

## 与主页面的关系

- 主海景：`../index.html`（由 `src.html` + `assemble.js` 生成）— **本目录不触碰**
- 桌面 AR：`./index.html` — 独立精简场景（约 22cm 桌面尺度），Three.js 走 CDN

以后若要在主页加「扫码看 AR」入口，只需加一个指向本页的链接/二维码即可。

## 本地快速看

用任意静态服务器打开本目录，例如在仓库根：

```bash
npx --yes serve lighthouse/ar -l 5173
```

浏览器访问 `http://localhost:5173`。真机 AR 请换成 HTTPS 公网地址后再扫码。
