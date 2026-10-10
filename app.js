(() => {
  'use strict';
  const canvas = document.querySelector('#scene');
  const ctx = canvas.getContext('2d', { alpha: false });
  const textCanvas = document.createElement('canvas');
  textCanvas.width = 1024; textCanvas.height = 1024;
  const tc = textCanvas.getContext('2d');
  tc.setTransform(1024 / 1000, 0, 0, 1024 / 1100, 0, 0);
  const lightRenderer = window.createLightRenderer(canvas);
  const galleryRenderer = window.createGalleryRenderer(canvas);
  const $ = id => document.getElementById(id);
  const input = $('text-input');
  const initialText = 'Let the stars keep the sky.\nI have your light,\nand a lifetime\nbeside you.';
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let content = initialText, displayed = reduced ? content : '', typing = !reduced;
  let w, h, dpr, f, cx, cy, strength = .75, lightX = 0, color = 'warm';
  let pointer = { x: 0, y: 0 }, drift = { x: 0, y: 0 }, lastType = 0, lastDraw = 0;
  let textDirty = true, previousCursor = -1, texture, seeded = 148, fontReady = false;
  let mode = galleryRenderer ? 'gallery' : 'wall', zoom = 0, imageFit = 'cover';
  const roomView = { x: 0, y: 0 }, viewTarget = { x: 0, y: 0 };
  let dragStart = null, didDrag = false, viewOffset = { x: 0, y: 0 }, imageRequest = 0;
  input.value = content;
  const rand = () => { seeded = (seeded * 16807) % 2147483647; return (seeded - 1) / 2147483646; };
  const dust = Array.from({ length: 90 }, () => ({ x: rand(), y: rand(), r: rand() * .9 + .2, speed: rand() * .012 + .004, phase: rand() * 6.28 }));
  // A wall at z=0, floor at y=0, and a light on the opposite side of the wall.
  const camera = { y: 2.65, z: 10 };
  const light = { y: 8.1, z: -4.8 };
  function project(x, y, z = 0) { const scale = f / (camera.z - z); return { x: cx + (x + drift.x) * scale, y: cy - (y - camera.y + drift.y) * scale }; }
  function onFloor(x, y) { const t = light.y / (light.y - y); return { x: lightX + (x - lightX) * t, z: light.z * (1 - t) }; }
  function polygon(points, fill) { ctx.beginPath(); points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); }
  function line(a, b, stroke, width = 1) { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
  function resize() {
    w = innerWidth; h = innerHeight; dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = w * dpr; canvas.height = h * dpr;
    f = Math.min(h * 1.12, w * 1.55); cx = w * (w < 600 ? .53 : .54); cy = h * .29;
    textDirty = true;
  }
  function updateTexture(cursor) {
    tc.clearRect(0, 0, 1000, 1100);
    function layout(size) {
      tc.font = `400 ${size}px "Tangerine", "Kaiti SC", "STKaiti", cursive`;
      const lines = []; let row = '';
      for (const char of Array.from(displayed)) {
        if (char === '\n') { lines.push(row); row = ''; continue; }
        if (row && tc.measureText(row + char).width > 840) {
          const space = row.lastIndexOf(' ');
          if (space > 0) { lines.push(row.slice(0, space)); row = row.slice(space + 1); }
          else { lines.push(row); row = ''; }
        }
        row += char;
      }
      lines.push(row);
      return lines;
    }
    let fontSize = 132, lines = layout(fontSize);
    while (lines.length * fontSize * 1.35 > 840 && fontSize > 48) {
      fontSize -= 4; lines = layout(fontSize);
    }
    const lineHeight = fontSize * 1.35;
    const start = (1100 - lines.length * lineHeight) / 2 + lineHeight * .8;
    tc.textAlign = 'left'; tc.textBaseline = 'alphabetic';
    tc.fillStyle = color === 'warm' ? '#f1eedb' : '#e2f1ff';
    tc.shadowColor = color === 'warm' ? '#ece9c9' : '#c5e3ff'; tc.shadowBlur = 1.2;
    lines.forEach((row, i) => {
      const width = tc.measureText(row).width, x = (1000 - width) / 2;
      // Draw each line as a whole to preserve joined strokes and ligatures.
      tc.fillText(row, x, start + i * lineHeight);
      if (cursor && i === lines.length - 1) {
        tc.shadowBlur = 2;
        tc.fillRect(x + width + 9, start + i * lineHeight - fontSize * .5, 2, fontSize * .58);
      }
    });

    if (lightRenderer) lightRenderer.updateText(textCanvas);
    if (galleryRenderer) galleryRenderer.updateText(textCanvas);
    textDirty = false; previousCursor = cursor;
  }
  function renderRoom(time) {
    if (mode === 'gallery' && galleryRenderer) {
      roomView.x += (viewTarget.x - roomView.x) * .09;
      roomView.y += (viewTarget.y - roomView.y) * .09;
      galleryRenderer.render({ w, h, view: roomView, zoom, strength, lightX, color, imageFit });
      return;
    }
    if (lightRenderer) { lightRenderer.render({ w, h, f, cx, cy, strength, lightX, color, drift, time: reduced ? 0 : time }); return; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const bg = ctx.createRadialGradient(cx, h * .4, 0, cx, h * .4, w * .65);
    bg.addColorStop(0, '#33382b'); bg.addColorStop(.4, '#20251c'); bg.addColorStop(1, '#10130f');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    const horizon = project(0, 0).y;
    // A quiet room of mineral plaster, with a single freestanding wall.
    const floor = ctx.createLinearGradient(0, horizon, 0, h);
    floor.addColorStop(0, '#252b21'); floor.addColorStop(.42, '#1c221b'); floor.addColorStop(1, '#111710');
    ctx.fillStyle = floor; ctx.fillRect(0, horizon, w, h - horizon);
    line({ x: 0, y: horizon }, { x: w, y: horizon }, '#b4bb9622');
    for (let x = -18; x <= 18; x += 2.4) line(project(x, 0, -7), project(x, 0, 8.7), '#9faa8810', .8);
    for (let z = -4; z < 9; z += 2) line(project(-20, 0, z), project(20, 0, z), '#a7b3920c', .7);
    // Side recesses frame the wall instead of competing with the light.
    for (const sign of [-1, 1]) {
      const p = project(sign * 3.4, 5.8);
      ctx.fillStyle = '#070e0870'; ctx.fillRect(sign < 0 ? p.x - 75 : p.x, 0, 75, horizon);
      line({ x: p.x, y: 0 }, { x: p.x, y: horizon }, '#afb39313');
      line({ x: p.x + sign * 70, y: 0 }, { x: p.x + sign * 70, y: horizon }, '#00000050');
    }
    // Small pool of illumination under the screen.
    const pool = ctx.createRadialGradient(cx, horizon + h * .1, 0, cx, horizon + h * .1, w * .34);
    pool.addColorStop(0, `rgba(170,183,138,${strength * .045})`); pool.addColorStop(1, 'rgba(150,170,130,0)');
    ctx.fillStyle = pool; ctx.fillRect(0, horizon, w, h - horizon);
    const lt = project(-2.08, 5.3), rb = project(2.08, 0);
    const wall = ctx.createLinearGradient(lt.x, 0, rb.x, 0);
    wall.addColorStop(0, '#282d22'); wall.addColorStop(.44, '#34392b'); wall.addColorStop(1, '#282e22');
    ctx.save(); ctx.shadowColor = '#00000090'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 10;
    ctx.fillStyle = wall; ctx.fillRect(lt.x, lt.y, rb.x - lt.x, rb.y - lt.y); ctx.restore();
    line(lt, { x: lt.x, y: rb.y }, '#b8ba9024');
    line({ x: rb.x, y: lt.y }, rb, '#0b120ae0', 2);
    // Plaster texture is static and inexpensive.
    if (!texture) {
      texture = document.createElement('canvas'); texture.width = 240; texture.height = 300;
      const tctx = texture.getContext('2d');
      for (let i = 0; i < 14000; i++) { const g = Math.floor(rand() * 60 + 100); tctx.fillStyle = `rgba(${g},${g},${g - 15},${rand() * .13})`; tctx.fillRect(rand() * 240, rand() * 300, 1, 1); }
    }
    ctx.globalAlpha = .42; ctx.drawImage(texture, lt.x, lt.y, rb.x - lt.x, rb.y - lt.y); ctx.globalAlpha = 1;
    // Project each horizontal slice from wall to floor using the point light.
    ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = strength * .82;
    const slice = 3;
    for (let sy = 0; sy < 1100; sy += slice) {
      const ya = 4.73 - sy / 1100 * 3.42, yb = 4.73 - (sy + slice) / 1100 * 3.42;
      const a = onFloor(-1.59, ya), b = onFloor(1.59, ya), c = onFloor(-1.59, yb);
      const pa = project(a.x, 0, a.z), pb = project(b.x, 0, b.z), pc = project(c.x, 0, c.z);
      const sx = (pb.x - pa.x) / 1000, dy = (pc.y - pa.y) / slice;
      ctx.setTransform(dpr * sx, 0, dpr * (pc.x - pa.x) / slice, dpr * dy, dpr * pa.x, dpr * pa.y);
      ctx.drawImage(textCanvas, 0, sy * 1024 / 1100, 1024, slice * 1024 / 1100, 0, 0, 1000, slice + .25);
    }
    ctx.restore();
    // Soft volumetric shafts originate at the actual illuminated letters.
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    const rows = displayed.split('\n');
    const shaftColor = color === 'warm' ? '221,224,194' : '194,218,244';
    for (let i = 0; i < 25; i++) {
      const y = 4.05 - (i % 6) * .42, x = (Math.sin(i * 4.7) * 1.15);
      const visible = Math.min(1, displayed.length / 22);
      const a = project(x, y), floorPt = onFloor(x, y), b = project(floorPt.x, 0, floorPt.z);
      const beam = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
      const pulse = reduced ? 1 : .92 + Math.sin(time * .0003 + i) * .08;
      beam.addColorStop(0, `rgba(${shaftColor},${.032 * strength * visible * pulse})`);
      beam.addColorStop(.25, `rgba(${shaftColor},${.018 * strength * visible})`);
      beam.addColorStop(1, `rgba(${shaftColor},0)`);
      polygon([{ x: a.x - 1, y: a.y }, { x: a.x + 1, y: a.y }, { x: b.x + 19, y: b.y + 30 }, { x: b.x - 19, y: b.y + 30 }], beam);
    }
    const textTL = project(-1.59, 4.73), textBR = project(1.59, 1.31);
    ctx.globalAlpha = .6 + strength * .4; ctx.shadowColor = color === 'warm' ? '#e1e6bd' : '#c5dcff'; ctx.shadowBlur = 10 * strength;
    ctx.drawImage(textCanvas, textTL.x, textTL.y, textBR.x - textTL.x, textBR.y - textTL.y);
    ctx.shadowBlur = 0; ctx.globalAlpha = 1;
    // Dust catches the same light, with only a little movement.
    dust.forEach(p => { const px = cx + (p.x - .5) * Math.min(w * .48, 550); const py = h * .17 + ((p.y + (reduced ? 0 : time * p.speed * .00001)) % 1) * h * .61; const alpha = (.14 + Math.sin(p.phase + time * .0006) * .1) * strength; ctx.fillStyle = `rgba(${shaftColor},${alpha})`; ctx.beginPath(); ctx.arc(px, py, p.r, 0, 6.29); ctx.fill(); });
    ctx.restore();
    const vignette = ctx.createRadialGradient(cx, h * .43, h * .15, cx, h * .43, Math.max(w * .64, h * .73));
    vignette.addColorStop(0, '#03070100'); vignette.addColorStop(.63, '#03070120'); vignette.addColorStop(1, '#030701b8');
    ctx.fillStyle = vignette; ctx.fillRect(0, 0, w, h);
  }
  function frame(time) {
    if (document.hidden || !fontReady) { requestAnimationFrame(frame); return; }
    if (typing && time - lastType > 145) {
      const chars = Array.from(content), n = Array.from(displayed).length;
      displayed = chars.slice(0, n + 1).join(''); lastType = time; textDirty = true;
      if (displayed === content) { typing = false; }
    }
    const cursor = Math.floor(time / 580) % 2 === 0;
    if (textDirty || cursor !== previousCursor) updateTexture(cursor);
    if (time - lastDraw > 1000 / 30) {
      drift.x += (pointer.x - drift.x) * .035; drift.y += (pointer.y - drift.y) * .035;
      renderRoom(time); lastDraw = time;
    }
    requestAnimationFrame(frame);
  }
  function startTyping() { content = input.value.slice(0, 240); displayed = reduced ? content : ''; typing = !reduced && content.length > 0; textDirty = true; lastType = performance.now(); }
  function openEditor() { $('editor').hidden = false; $('settings').hidden = true; $('settings-toggle').setAttribute('aria-expanded', 'false'); input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
  function closeEditor() { $('editor').hidden = true; $('write').focus(); }
  $('write').addEventListener('click', openEditor);
  canvas.addEventListener('click', () => { if (!didDrag) openEditor(); });
  $('close-editor').addEventListener('click', closeEditor);
  input.addEventListener('input', () => { content = input.value; displayed = content; typing = false; textDirty = true; try { localStorage.setItem('light-wall-text', content); } catch {} });
  $('project').addEventListener('click', () => { startTyping(); closeEditor(); });
  $('replay').addEventListener('click', startTyping);
  $('settings-toggle').addEventListener('click', () => { const open = $('settings').hidden; $('settings').hidden = !open; $('editor').hidden = true; $('settings-toggle').setAttribute('aria-expanded', String(open)); });
  $('close-settings').addEventListener('click', () => { $('settings').hidden = true; $('settings-toggle').setAttribute('aria-expanded', 'false'); $('settings-toggle').focus(); });
  $('intensity').addEventListener('input', e => { strength = Number(e.target.value) / 100; $('intensity-value').textContent = `${e.target.value}%`; });
  $('angle').addEventListener('input', e => { lightX = Number(e.target.value) / 100 * 2; $('angle-value').textContent = lightX === 0 ? '居中' : `${lightX < 0 ? '偏左' : '偏右'} ${Math.abs(Number(e.target.value))}%`; });
  document.querySelectorAll('.swatch').forEach(el => el.addEventListener('click', () => { color = el.dataset.color; textDirty = true; document.querySelectorAll('.swatch').forEach(b => { b.classList.toggle('active', b === el); b.setAttribute('aria-pressed', String(b === el)); }); }));

  document.addEventListener('keydown', e => { if (e.key === 'Escape') { $('editor').hidden = true; $('settings').hidden = true; $('settings-toggle').setAttribute('aria-expanded', 'false'); } if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !$('editor').hidden) { startTyping(); closeEditor(); } });
  function setMode(next) {
    if (next === 'gallery' && !galleryRenderer) { showNotice('此浏览器无法显示 3D 展厅，已保留光墙模式'); return; }
    mode = next; document.body.dataset.mode = mode;
    lightRenderer?.setVisible(mode === 'wall'); galleryRenderer?.setVisible(mode === 'gallery');
    canvas.style.opacity = mode === 'gallery' || lightRenderer ? '0' : '1';
    $('gallery-mode').setAttribute('aria-pressed', String(mode === 'gallery'));
    $('wall-mode').setAttribute('aria-pressed', String(mode === 'wall'));
    $('upload').hidden = mode !== 'gallery'; $('gallery-settings').hidden = mode !== 'gallery';
    textDirty = true;
    try { localStorage.setItem('light-space-mode', mode); } catch {}
  }
  $('gallery-mode').addEventListener('click', () => setMode('gallery'));
  $('wall-mode').addEventListener('click', () => setMode('wall'));
  $('zoom').addEventListener('input', e => { zoom = Number(e.target.value) / 10; $('zoom-value').textContent = zoom > 0 ? '靠近' : zoom < 0 ? '退后' : '原位'; });
  $('image-fit').addEventListener('change', e => { imageFit = e.target.value; });
  $('reset-view').addEventListener('click', () => { viewOffset = { x: 0, y: 0 }; viewTarget.x = 0; viewTarget.y = 0; zoom = 0; $('zoom').value = '0'; $('zoom-value').textContent = '原位'; });
  canvas.addEventListener('pointerdown', e => {
    didDrag = false;
    if (mode === 'gallery') { dragStart = { x: e.clientX, y: e.clientY, vx: viewOffset.x, vy: viewOffset.y }; canvas.setPointerCapture(e.pointerId); }
  });
  canvas.addEventListener('pointerup', () => { dragStart = null; });
  canvas.addEventListener('lostpointercapture', () => { dragStart = null; });
  canvas.addEventListener('pointercancel', () => { dragStart = null; didDrag = true; });
  window.addEventListener('pointermove', e => {
    if (!reduced) { pointer.x = (e.clientX / w - .5) * .09; pointer.y = (e.clientY / h - .5) * .045; }
    if (dragStart) {
      if (Math.hypot(e.clientX - dragStart.x, e.clientY - dragStart.y) > 5) didDrag = true;
      viewOffset.x = Math.max(-4, Math.min(4, dragStart.vx + (e.clientX - dragStart.x) / w * 5));
      viewOffset.y = Math.max(-1.1, Math.min(1.1, dragStart.vy + (e.clientY - dragStart.y) / h * 2));
    }
    viewTarget.x = viewOffset.x + (reduced || e.pointerType === 'touch' ? 0 : (e.clientX / w - .5) * .55);
    viewTarget.y = viewOffset.y + (reduced || e.pointerType === 'touch' ? 0 : (e.clientY / h - .5) * .24);
  });
  canvas.addEventListener('keydown', e => {
    if (mode !== 'gallery' || !['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)) return;
    e.preventDefault();
    if (e.key === 'ArrowLeft') viewOffset.x = Math.max(-4, viewOffset.x - .2);
    if (e.key === 'ArrowRight') viewOffset.x = Math.min(4, viewOffset.x + .2);
    if (e.key === 'ArrowUp') viewOffset.y = Math.max(-1.1, viewOffset.y - .1);
    if (e.key === 'ArrowDown') viewOffset.y = Math.min(1.1, viewOffset.y + .1);
    viewTarget.x = viewOffset.x; viewTarget.y = viewOffset.y;
  });
  window.addEventListener('resize', resize);
  try {
    const saved = localStorage.getItem('light-wall-text');
    if (saved !== null) { input.value = saved.slice(0, 240); content = input.value; }
    const savedMode = localStorage.getItem('light-space-mode');
    if (savedMode === 'wall') mode = 'wall';
  } catch {}
  if (mode === 'gallery' || reduced) { displayed = content; typing = false; }
  setMode(mode);

  let noticeTimer;
  function showNotice(message) {
    $('notice').textContent = message; $('notice').hidden = false;
    clearTimeout(noticeTimer); noticeTimer = setTimeout(() => { $('notice').hidden = true; }, 4200);
  }
  function photoStore(action, value) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('words-into-light', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('photos');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result, tx = db.transaction('photos', action === 'get' ? 'readonly' : 'readwrite');
        const store = tx.objectStore('photos');
        const op = action === 'get' ? store.get('portrait') : action === 'put' ? store.put(value, 'portrait') : store.delete('portrait');
        let result; op.onsuccess = () => { result = op.result; };
        tx.oncomplete = () => { db.close(); resolve(result); };
        tx.onerror = () => { db.close(); reject(tx.error); };
        tx.onabort = () => { db.close(); reject(tx.error); };
      };
    });
  }
  async function loadPicture(source) {
    const request = ++imageRequest;
    const url = source instanceof Blob ? URL.createObjectURL(source) : source;
    const image = new Image(); image.src = url;
    try {
      await image.decode();
      if (request !== imageRequest) return false;
      galleryRenderer?.updateImage(image); return true;
    } finally { if (source instanceof Blob) URL.revokeObjectURL(url); }
  }
  $('upload').addEventListener('click', () => $('photo-input').click());
  $('photo-input').addEventListener('change', async e => {
    const file = e.target.files[0]; if (!file) return;
    if (!/^image\/(jpeg|png|webp|avif|gif)$/.test(file.type)) { showNotice('请选择 JPG、PNG、WebP、AVIF 或 GIF 图片'); e.target.value = ''; return; }
    if (file.size > 20 * 1024 * 1024) { showNotice('请选择小于 20 MB 的图片'); e.target.value = ''; return; }
    $('upload').disabled = true;
    try {
      const url = URL.createObjectURL(file), image = new Image();
      try { image.src = url; await image.decode(); } finally { URL.revokeObjectURL(url); }
      const scale = Math.min(1, 1600 / Math.max(image.width, image.height));
      const photo = document.createElement('canvas'); photo.width = Math.max(1, Math.round(image.width * scale)); photo.height = Math.max(1, Math.round(image.height * scale));
      photo.getContext('2d').drawImage(image, 0, 0, photo.width, photo.height);
      const blob = await new Promise(resolve => photo.toBlob(resolve, 'image/jpeg', .9));
      if (!blob) throw new Error('Image conversion failed');
      const applied = await loadPicture(blob);
      if (applied) {
        try { await photoStore('put', blob); showNotice('照片已换上，只保存在当前浏览器'); }
        catch { showNotice('照片已换上；当前浏览器无法保存，刷新后会恢复示例'); }
      }
    } catch { showNotice('这张图片未能读取，请换一张 JPG 或 PNG'); }
    finally { $('upload').disabled = false; e.target.value = ''; }
  });
  $('reset-photo').addEventListener('click', async () => {
    try {
      const removed = await photoStore('delete').then(() => true, () => false);
      await loadPicture('./assets/van-gogh-self-portrait.jpg');
      showNotice(removed ? '已恢复梵高自画像' : '已恢复示例；浏览器未能清除之前保存的照片');
    } catch { showNotice('恢复图片失败，请稍后重试'); }
  });
  if (galleryRenderer) {
    (async () => {
      try {
        const version = imageRequest;
        const savedPhoto = await photoStore('get').catch(() => null);
        if (version === imageRequest) await loadPicture(savedPhoto || './assets/van-gogh-self-portrait.jpg');
      } catch { showNotice('示例图片未能加载，你仍可以上传自己的照片'); }
    })();
  }

  document.fonts.load('400 132px "Tangerine"').catch(() => []).then(() => {
    fontReady = true; textDirty = true; lastType = performance.now();
  });
  resize(); requestAnimationFrame(frame);
})();
