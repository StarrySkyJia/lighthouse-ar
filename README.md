# 灯塔小岛 · AR

线上：https://starryskyjia.github.io/lighthouse-ar/

| 页面 | 说明 |
|------|------|
| `index.html` | 入口（动态 / 静态分流 + 二维码） |
| `live.html` | **完整动态 AR**：海浪、鸟、鱼、草、渔夫、像素风 |
| `static.html` | 快速静态 AR（Quick Look / Scene Viewer） |

## 动态版要点

- Android Chrome：WebXR hit-test 贴桌  
- iPhone：Safari 摄像头 + 点击放置（非系统 Quick Look）  
- 画质档 `low / med / high` 可切换，降低草/鱼数量与像素倍率  
- 主海景 `../src.html` 不改动  

## 本地

```bash
npx --yes serve . -l 5173
```
