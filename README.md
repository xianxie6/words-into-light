# 光感文字 · Words into Light

一个可以书写的光影空间。英文手写文字出现在暗色墙面上，光穿过字形，在空气中形成光束，并向地面投出拉长的字影。

**[在线体验](https://xianxie6.github.io/words-into-light/)**

点击墙面或「开始书写」，输入自己的文字。墙面、光束和地面投影实时更新。用「逐字投映」或「重新播放」重播打字过程，在「调节光线」中调整光强、左右位置和冷暖色。

默认英文诗：

> Let the stars keep the sky.  
> I have your light,  
> and a lifetime  
> beside you.

## 本地运行

没有构建步骤，也不依赖外部服务。在项目目录运行：

```sh
python3 -m http.server 4173
```

打开 http://localhost:4173，也可以直接打开 `index.html`。

## 光影与字体

WebGL 沿视线采样空气，通过墙面字形遮罩计算光路散射。墙面文字、空气光束和地面投影使用同一张字形纹理。粗糙墙面、透视石板与亮部曝光共同构成空间感，无 WebGL 时使用 Canvas 投影版本。

文字仅保存在访问者自己的浏览器中。系统开启减少动态效果时，文字直接显示，并停止视差与浮尘运动。

字体使用随项目提供的 **Tangerine Regular**，保留细笔画和英文连写。字体来自 [Google Fonts](https://github.com/google/fonts/tree/main/ofl/tangerine)，按 SIL Open Font License 发布，授权见 [fonts/OFL.txt](fonts/OFL.txt)。

## 部署

GitHub Pages 从 `main` 分支根目录发布。推送到 `main` 后，GitHub 会自动更新在线站点。
