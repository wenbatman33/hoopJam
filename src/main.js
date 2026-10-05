import { loadOverrides } from './config.js';
import { Game } from './game.js';
import { DevTools } from './devtools.js';
import { loadModels } from './models.js';

// 進入點：載入 DEV 覆寫值 → 等字型與模型 → 建立遊戲

loadOverrides();

async function boot() {
  // 等字型載入，讓球場與號碼貼圖使用正確字型
  const fonts = Promise.race([
    Promise.all([document.fonts.load('40px "Bungee"'), document.fonts.load('900 20px "Noto Sans TC"')]),
    new Promise((r) => setTimeout(r, 2500)),
  ]).catch(() => {});
  const [models] = await Promise.all([loadModels(), fonts]);
  const game = new Game(document.getElementById('game'), models);
  new DevTools(game);
  window.__game = game; // 除錯用
  const ld = document.getElementById('loading');
  ld.style.opacity = '0';
  setTimeout(() => ld.remove(), 450);
}

boot().catch((e) => {
  console.error(e);
  document.getElementById('loading').innerHTML = `<div>載入失敗</div><div style="font-size:12px;opacity:.7">${e.message}</div>`;
});
