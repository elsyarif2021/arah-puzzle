import {makePuzzle, findBlocker} from './puzzle.mjs';

const $ = id => document.getElementById(id);
const totalLevels = 10;
const colors = ['#ffac6d', '#a7a5ff', '#69dac5', '#ff9ab1', '#f3d381'];
const utcDay = Math.floor((Date.now() + 7 * 3600000) / 86400000);
const dailyDate = new Date(utcDay * 86400000).toISOString().slice(0, 10);
const storageKey = 'arah-progress-v1';
const defaults = {unlocked: 1, level: 1, games: {}};
let progress;
try { progress = JSON.parse(localStorage.getItem(storageKey)) || defaults; }
catch { progress = defaults; }

let mode = 'campaign';
let level = progress.level;
let puzzle, game, remaining, highlighted;
let turning = false;
let deferredInstall;

function save() {
  try { localStorage.setItem(storageKey, JSON.stringify(progress)); }
  catch { $('connection').textContent = 'Penyimpanan progres tidak tersedia'; }
}

function start(reset = false) {
  if ($('dialog').open) $('dialog').close();
  const isDaily = mode === 'daily';
  const key = isDaily ? 'daily-' + dailyDate : 'level-' + level;
  puzzle = isDaily ? makePuzzle(7, utcDay * 75323) : makePuzzle(level);
  if (reset || !progress.games[key]) {
    for (const saved of Object.keys(progress.games)) {
      if (saved.startsWith('daily-') && saved !== 'daily-' + dailyDate) delete progress.games[saved];
    }
    progress.games[key] = {lives: 3, removed: [], hints: 1};
  }
  game = progress.games[key];
  remaining = puzzle.paths.filter((_, index) => !game.removed.includes(index));
  highlighted = null;
  turning = false;
  if (!isDaily) progress.level = level;
  save();
  $('campaign').setAttribute('aria-pressed', String(!isDaily));
  $('daily').setAttribute('aria-pressed', String(isDaily));
  $('levels').hidden = isDaily;
  render();
  if (!remaining.length || game.lives === 0) finish();
  else $('status').textContent = isDaily ? 'Tantangan ' + new Intl.DateTimeFormat('id-ID', {dateStyle:'long', timeZone:'UTC'}).format(new Date(dailyDate)) : 'Pilih panah yang jalan keluarnya bebas.';
}

function svg(tag, props, parent) {
  const element = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(props)) element.setAttribute(key, value);
  parent.append(element);
  return element;
}

function render(focusBoard = false) {
  $('level-label').textContent = String(level).padStart(2, '0');
  $('count').textContent = game.removed.length + ' / ' + puzzle.paths.length;
  $('progress').max = puzzle.paths.length;
  $('progress').value = game.removed.length;
  $('hearts').setAttribute('aria-label', game.lives + ' dari 3 nyawa');
  $('hearts').innerHTML = '<span aria-hidden="true">' + '♥'.repeat(game.lives) + '<span class="spent">' + '♥'.repeat(3-game.lives) + '</span></span>';
  $('hint').disabled = !game.hints || !game.lives || !remaining.length;
  const board = $('board');
  const spacing = 32, inset = 22;
  const side = inset * 2 + (puzzle.size - 1) * spacing;
  board.setAttribute('viewBox', '0 0 ' + side + ' ' + side);
  board.replaceChildren();
  const coord = n => inset + n * spacing;
  const defs = svg('defs', {}, board);
  const pattern = svg('pattern', {id:'dots', width:spacing, height:spacing, x:inset, y:inset, patternUnits:'userSpaceOnUse', patternTransform:'translate(-2 -2)'}, defs);
  svg('circle', {cx:2, cy:2, r:1.6, fill:'#383c56'}, pattern);
  svg('rect', {width:side, height:side, fill:'url(#dots)'}, board);
  const active = game.lives > 0;
  remaining.forEach(path => {
    const index = puzzle.paths.indexOf(path);
    const tip = path.at(-1);
    const neck = path.at(-2);
    const dx = tip[0] - neck[0], dy = tip[1] - neck[1];
    const x = coord(tip[0]), y = coord(tip[1]);
    const direction = dx ? (dx > 0 ? 'kanan' : 'kiri') : (dy > 0 ? 'bawah' : 'atas');
    const group = svg('g', {class:'arrow' + (path === highlighted ? ' hinted' : ''), color:colors[index % colors.length], role:'button', tabindex:active ? 0 : -1, 'aria-label':'Panah ' + (index + 1) + ' ke ' + direction}, board);
    const points = path.map(([px,py]) => coord(px) + ',' + coord(py)).join(' ');
    svg('polyline', {points, fill:'none', stroke:'transparent', 'stroke-width':28, 'stroke-linecap':'round', 'stroke-linejoin':'round'}, group);
    svg('polyline', {class:'ink', points, fill:'none', stroke:'currentColor', 'stroke-width':7, 'stroke-linecap':'round', 'stroke-linejoin':'round', 'pointer-events':'none'}, group);
    const wing = sign => [x-dx*11+dy*sign*7,y-dy*11-dx*sign*7].join(',');
    svg('polyline', {class:'ink', points:wing(1)+' '+x+','+y+' '+wing(-1), fill:'none', stroke:'currentColor', 'stroke-width':6, 'stroke-linecap':'round', 'stroke-linejoin':'round', 'pointer-events':'none'}, group);
    group.addEventListener('click', () => play(path, group));
    group.addEventListener('keydown', event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      play(path, group, true);
    });
  });
  if (focusBoard) board.querySelector('.arrow')?.focus();
}

function play(path, group, keyboard = false) {
  if (turning || !game.lives || !remaining.includes(path)) return;
  turning = true;
  const currentGame = game;
  const blocker = findBlocker(path, remaining, puzzle.size);
  const head = path.at(-1), neck = path.at(-2);
  const dx = head[0]-neck[0], dy = head[1]-neck[1];
  if (blocker) {
    game.lives--;
    group.classList.add('blocked');
    $('status').textContent = 'Jalur terhalang. Satu nyawa berkurang.';
  } else {
    game.removed.push(puzzle.paths.indexOf(path));
    remaining = remaining.filter(other => other !== path);
    if (highlighted === path) highlighted = null;
    if (!remaining.length && mode === 'campaign') progress.unlocked = Math.max(progress.unlocked, Math.min(level+1, totalLevels));
    $('status').textContent = 'Panah berhasil keluar!';
  }
  save();
  function complete() {
    if (game !== currentGame || !group.isConnected) return;
    turning = false;
    render(keyboard);
    if (!game.lives || !remaining.length) finish();
  }
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return complete();
  const keyframes = blocker
    ? [{transform:'translate(0,0)'},{transform:'translate('+dx*6+'px,'+dy*6+'px)'},{transform:'translate(0,0)'}]
    : [{opacity:1},{transform:'translate('+dx*450+'px,'+dy*450+'px)',opacity:0}];
  group.animate(keyframes, {duration:blocker ? 210 : 300, easing:'ease-out', fill:'forwards'}).finished.then(complete);
}

function modal(title) {
  $('dialog-title').textContent = title;
  $('dialog-content').replaceChildren();
  if (!$('dialog').open) $('dialog').showModal();
  return $('dialog-content');
}

function paragraph(parent, value) {
  const text = document.createElement('p');
  text.textContent = value;
  parent.append(text);
}

function button(parent, label, action, style = 'quiet') {
  const control = document.createElement('button');
  control.textContent = label;
  control.className = style;
  control.addEventListener('click', action);
  parent.append(control);
  return control;
}

function finish() {
  const won = remaining.length === 0;
  const final = mode === 'campaign' && level === totalLevels;
  const title = won ? (final ? 'Semua level selesai!' : 'Papan berhasil dibersihkan!') : 'Nyawa habis';
  $('status').textContent = title;
  const content = modal(title);
  paragraph(content, won ? 'Sisa nyawa ' + game.lives + ' dari 3.' : 'Coba lagi dan cari panah yang jalurnya bebas.');
  const actions = document.createElement('div');
  actions.className = 'dialog-actions';
  content.append(actions);
  if (won && mode === 'campaign' && !final) button(actions, 'Level berikutnya →', () => { level++; start(); }, 'accent');
  button(actions, 'Main lagi', () => start(true), won ? 'quiet' : 'accent');
}

$('close').onclick = () => $('dialog').close();
$('campaign').onclick = () => { if (mode !== 'campaign') { mode = 'campaign'; start(); } };
$('daily').onclick = () => { if (mode !== 'daily') { mode = 'daily'; start(); } };
$('reset').onclick = () => start(true);
$('levels').onclick = () => {
  if (turning) return;
  const content = modal('Pilih level');
  const grid = document.createElement('div');
  grid.className = 'level-grid';
  content.append(grid);
  for (let n = 1; n <= totalLevels; n++) {
    const item = button(grid, String(n), () => { level = n; start(); }, n === level ? 'accent' : 'quiet');
    item.disabled = n > progress.unlocked;
    item.setAttribute('aria-label', 'Level ' + n + (item.disabled ? ' terkunci' : ''));
  }
};
$('hint').onclick = () => {
  if (turning || !game.hints) return;
  highlighted = remaining.find(path => !findBlocker(path, remaining, puzzle.size));
  game.hints--;
  save();
  render();
  $('status').textContent = 'Panah yang menyala bisa keluar.';
};

window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); deferredInstall = event; });
window.addEventListener('appinstalled', () => { deferredInstall = null; $('install').hidden = true; });
$('install').hidden = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
$('install').onclick = async () => {
  if (deferredInstall) {
    const prompt = deferredInstall;
    deferredInstall = null;
    await prompt.prompt();
    return;
  }
  const content = modal('Pasang Arah');
  paragraph(content, 'Di Android atau komputer, buka menu browser dan pilih Pasang aplikasi jika tersedia.');
  paragraph(content, 'Di iPhone, buka di Safari, ketuk Bagikan, lalu Tambahkan ke Layar Utama.');
};

function connection() {
  $('connection').textContent = navigator.onLine ? 'Siap dimainkan offline' : 'Sedang offline';
}
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').then(() => navigator.serviceWorker.ready).then(() => {
    connection();
    window.addEventListener('online', connection);
    window.addEventListener('offline', connection);
  }).catch(() => { $('connection').textContent = 'Mode offline belum siap'; });
} else $('connection').textContent = 'Mode offline belum siap';
start();
