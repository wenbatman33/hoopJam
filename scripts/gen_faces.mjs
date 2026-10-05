#!/usr/bin/env node
// 透過 codex exec 內建 image_gen 批次生成球員臉部貼圖原圖（不需 OPENAI_API_KEY）
// 用法：node scripts/gen_faces.mjs [--jobs 3] [--ids LAL_77,GSW_30]
// 已存在的檔案會跳過，可中斷續跑。全部跑完後執行 python3 scripts/process_faces.py
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const manifest = JSON.parse(readFileSync(resolve(__dirname, 'face_manifest.json'), 'utf8'));
const outDir = resolve(root, manifest.outDir);
mkdirSync(outDir, { recursive: true });

const arg = (name, def) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : def;
};
const jobs = Number(arg('--jobs', 3));
const only = arg('--ids', '');
const size = manifest.size || 1024;
const items = manifest.items.filter((it) => !only || only.split(',').includes(it.id));

let done = 0, skipped = 0, failed = 0;
const queue = [];
for (const item of items) {
  if (existsSync(resolve(outDir, item.id + '.png'))) { skipped++; console.log(`[skip] ${item.id}`); } else queue.push(item);
}

function run(item) {
  const out = resolve(outDir, item.id + '.png');
  const instruction =
    `請用內建 image_gen 工具產生一張 ${size}x${size} 的 PNG 圖片。` +
    `主題：${item.prompt}. ${manifest.styleBase} ` +
    `產生後把檔案複製到絕對路徑 ${out}，並用 sips 縮放為 ${size}x${size}（sips -z ${size} ${size} "${out}"）。` +
    `完成後只回報 OK。`;
  return new Promise((ok) => {
    const t0 = Date.now();
    const p = spawn('codex', ['exec', '--skip-git-repo-check', '--sandbox', 'workspace-write', instruction], { cwd: root, stdio: 'ignore' });
    const timer = setTimeout(() => p.kill('SIGKILL'), 6 * 60 * 1000);
    p.on('close', () => {
      clearTimeout(timer);
      const sec = ((Date.now() - t0) / 1000).toFixed(0);
      if (existsSync(out)) { done++; console.log(`[ok] ${item.id} (${sec}s)`); } else { failed++; console.log(`[miss] ${item.id} (${sec}s) — 檔案未產生`); }
      ok();
    });
    p.on('error', (e) => { clearTimeout(timer); failed++; console.log(`[fail] ${item.id}: ${e.message}`); ok(); });
  });
}

async function worker() {
  while (queue.length) await run(queue.shift());
}
console.log(`待生成 ${queue.length} 張，同時 ${jobs} 個工作`);
await Promise.all(Array.from({ length: Math.min(jobs, queue.length) }, worker));
console.log(`=== 完成 ${done} / 跳過 ${skipped} / 失敗 ${failed}（共 ${items.length}）===`);
