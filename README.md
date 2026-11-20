# 灯塔小岛 · 扫码桌面 AR（iOS + Android）

HTTPS 线上地址：

**https://starryskyjia.github.io/lighthouse-ar/**

朋友用手机扫页内二维码（或直接打开链接）→ 点「放到桌上（AR）」→ 把小岛放到真实桌面。

## 兼容方式

| 设备 | 技术 |
|------|------|
| iPhone / iPad | Google `model-viewer` → 系统 **AR Quick Look**（自动从 GLB 生成 USDZ） |
| Android | **Scene Viewer** / **WebXR** |
| 电脑 | 仅 3D 预览 |

主海景页 `../index.html` / `src.html` **不会被本目录改动**。

## 本地

```bash
# 重新导出模型（可选）
node generate-island.mjs

# 静态预览
npx --yes serve . -l 5173
```

## 重新部署

```bash
git add -A
git commit -m "Update AR page"
git push
```

GitHub Pages 已指向 `main` 根目录，推送后约一分钟生效。
