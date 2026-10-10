# 光感文字 · Words into Light

一个可以书写、换照片和改变视角的光影空间。

**[在线体验](https://xianxie6.github.io/words-into-light/)**

## 两个空间

- **沉浸展厅**：手写文字遍布墙面与地面，中央立柱展示照片。前景立柱和长凳产生遮挡，所有内容使用同一套三维透视。鼠标移动产生轻微视差；拖动或聚焦画布后使用方向键，可以改变观看角度。
- **光感文字**：保留原来的文字光墙。光穿过字形，在空气中形成光束，在地面留下拉长的投影。

## 操作

点击「开始书写」或点击场景，输入最多 240 字；墙面与地面同步更新。「逐字投映」和「重新播放」可以重播打字。

在展厅点击「上传照片」，选择 JPG、PNG、WebP、AVIF 或 GIF 图片（最多 20 MB）。照片会在浏览器内缩放处理，只保存在访问者自己的浏览器中，不会上传到服务器。GIF 使用静态画面。

「调节光线」支持光强、投影左右位置、冷暖色。展厅还可以调整观看距离，选择照片完整显示或填满立柱，以及恢复正面视角和示例画像。手机支持拖动查看。

默认英文诗：

> Let the stars keep the sky.  
> I have your light,  
> and a lifetime  
> beside you.

## 本地运行

无需安装依赖或构建。在项目目录运行：

```sh
python3 -m http.server 4173
```

打开 http://localhost:4173。也可以直接打开 `index.html`，但浏览器的本地文件限制可能阻止加载画像或保存照片，因此推荐使用本地服务。

## 实现与素材

`gallery-renderer.js` 通过视线与墙面、立柱、长凳的交点计算透视与遮挡，再按世界坐标映射字形和照片。`light-renderer.js` 沿视线采样空气，并通过字形遮罩计算光束散射。两个空间共享 `app.js` 中的手写文字画布。

照片保存在 IndexedDB，文字与空间模式保存在 localStorage。系统开启减少动态效果时，文字直接显示并停止自动视差；手动改变视角仍然可用。不支持 WebGL 时保留 Canvas 光墙。

默认画像为梵高 1889 年《自画像》，来自 [Wikimedia Commons / Google Art Project](https://commons.wikimedia.org/wiki/File:Vincent_van_Gogh_-_Self-Portrait_-_Google_Art_Project.jpg)，素材说明见 [assets/README.md](assets/README.md)。

字体使用随项目提供的 **Tangerine Regular**，保留细笔画和英文连写。字体来自 [Google Fonts](https://github.com/google/fonts/tree/main/ofl/tangerine)，按 SIL Open Font License 发布，授权见 [fonts/OFL.txt](fonts/OFL.txt)。

## 部署

GitHub Pages 从 `main` 分支根目录发布。推送到 `main` 后，GitHub 自动更新在线站点。
