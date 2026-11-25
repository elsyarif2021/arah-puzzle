import {makePuzzle, findBlocker, difficulty} from './puzzle.mjs';
import {questions} from './quiz.mjs';

const $ = id => document.getElementById(id);
const totalLevels = 10;
const spacing = 28;
const inset = 16;
const exitGutter = 46;
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
let puzzle, game, remaining, highlighted, obstructed;
let questionQueue = [];
let lastQuestion;
const sounds = { correct: new Audio('./benar.mp3'), wrong: new Audio('./salah.mp3') };
Object.values(sounds).forEach(audio => { audio.preload = 'auto'; });
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
  if (reset || !progress.games[key]) {
    for (const saved of Object.keys(progress.games)) {
      if (saved.startsWith('daily-') && saved !== 'daily-' + dailyDate) delete progress.games[saved];
    }
    progress.games[key] = {lives: 3, removed: [], hints: 1, boardVersion: 3};
  }
  game = progress.games[key];
  puzzle = makePuzzle(isDaily ? 7 : level, isDaily ? utcDay * 75323 : undefined, game.boardVersion ?? 1);
  remaining = puzzle.paths.filter((_, index) => !game.removed.includes(index));
  highlighted = null;
  obstructed = null;
  turning = false;
  if (!isDaily) progress.level = level;
  save();
  $('campaign').setAttribute('aria-pressed', String(!isDaily));
  $('daily').setAttribute('aria-pressed', String(isDaily));
  $('levels').hidden = isDaily;
  render();
  if (!remaining.length || game.lives === 0) finish();
  else if (needsQuiz() && remaining.length === 1) $('status').textContent = 'Jawab satu soal lewat Petunjuk untuk membuka panah terakhir.';
  else $('status').textContent = isDaily ? 'Tantangan ' + new Intl.DateTimeFormat('id-ID', {dateStyle:'long', timeZone:'UTC'}).format(new Date(dailyDate)) : 'Pilih panah yang jalan keluarnya bebas.';
}

function svg(tag, props, parent) {
  const element = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(props)) element.setAttribute(key, value);
  parent.append(element);
  return element;
}

function render(focusBoard = false) {
  $('difficulty').textContent = difficulty(level).name;
  const blockedArrow = obstructed && findBlocker(obstructed, remaining, puzzle.size) ? obstructed : null;
  $('clear').hidden = !blockedArrow || !game.lives;
  $('level-label').textContent = String(level).padStart(2, '0');
  $('count').textContent = game.removed.length + ' / ' + puzzle.paths.length;
  $('progress').max = puzzle.paths.length;
  $('progress').value = game.removed.length;
  $('hearts').setAttribute('aria-label', game.lives + ' dari 3 nyawa');
  $('hearts').innerHTML = '<span aria-hidden="true">' + '♥'.repeat(game.lives) + '<span class="spent">' + '♥'.repeat(3-game.lives) + '</span></span>';
  $('hint').disabled = !game.hints || !game.lives || !remaining.length;
  const board = $('board');
  const side = inset * 2 + (puzzle.size - 1) * spacing;
  const frame = side + exitGutter * 2;
  board.setAttribute('viewBox', `${-exitGutter} ${-exitGutter} ${frame} ${frame}`);
  board.replaceChildren();
  const coord = n => inset + n * spacing;
  const defs = svg('defs', {}, board);
  const pattern = svg('pattern', {id:'dots', width:spacing, height:spacing, x:inset, y:inset, patternUnits:'userSpaceOnUse', patternTransform:'translate(-2 -2)'}, defs);
  svg('circle', {cx:2, cy:2, r:1.6, fill:'#383c56'}, pattern);
  svg('rect', {width:side, height:side, rx:12, fill:'#181a2a', stroke:'#373b55'}, board);
  svg('rect', {width:side, height:side, rx:12, fill:'url(#dots)'}, board);
  const active = game.lives > 0;
  remaining.forEach(path => {
    const index = puzzle.paths.indexOf(path);
    const tip = path.at(-1);
    const neck = path.at(-2);
    const dx = tip[0] - neck[0], dy = tip[1] - neck[1];
    const x = coord(tip[0]), y = coord(tip[1]);
    const direction = dx ? (dx > 0 ? 'kanan' : 'kiri') : (dy > 0 ? 'bawah' : 'atas');
    const group = svg('g', {class:'arrow' + (path === highlighted ? ' hinted' : '') + (path === blockedArrow ? ' blocked' : ''), color:colors[index % colors.length], role:'button', tabindex:active ? 0 : -1, 'aria-label':'Panah ' + (index + 1) + ' ke ' + direction}, board);
    const points = path.map(([px,py]) => coord(px) + ',' + coord(py)).join(' ');
    svg('polyline', {points, fill:'none', stroke:'transparent', 'stroke-width':25, 'stroke-linecap':'round', 'stroke-linejoin':'round'}, group);
    svg('polyline', {class:'ink', points, fill:'none', stroke:'currentColor', 'stroke-width':5.5, 'stroke-linecap':'round', 'stroke-linejoin':'round', 'pointer-events':'none'}, group);
    svg('polyline', {class:'ink', points:arrowhead(x,y,dx,dy), fill:'none', stroke:'currentColor', 'stroke-width':4.5, 'stroke-linecap':'round', 'stroke-linejoin':'round', 'pointer-events':'none'}, group);
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
  if (needsQuiz() && remaining.length === 1) {
    openQuiz('hint');
    return;
  }
  turning = true;
  const currentGame = game;
  const blocker = findBlocker(path, remaining, puzzle.size);
  const head = path.at(-1), neck = path.at(-2);
  const dx = head[0]-neck[0], dy = head[1]-neck[1];
  if (blocker) {
    obstructed = path;
    game.lives--;
    group.classList.remove('blocked');
  } else {
    removePath(path);
    if (!remaining.length) {
      game.cleared = true;
      if (mode === 'campaign') progress.completed = [...new Set([...(progress.completed || []), level])];
      speak(true);
    }
    $('status').textContent = needsQuiz() && remaining.length === 1 ?
      'Jawab satu soal lewat Petunjuk untuk membuka panah terakhir.' : 'Panah berhasil keluar!';
  }
  save();
  function complete() {
    if (game !== currentGame || !group.isConnected) return;
    turning = false;
    render(keyboard);
    if (!game.lives || !remaining.length) finish();
  }
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let impactDistance;
  if (blocker) {
    const distances = blocker.flatMap(([x, y]) => {
      const offsetX = x - head[0], offsetY = y - head[1];
      const ahead = offsetX * dx + offsetY * dy;
      return ahead > 0 && offsetX * dy === offsetY * dx ? [ahead] : [];
    });
    impactDistance = Math.min(...distances) - 4 / spacing;
  }
  crawl(path, group, dx, dy, reducedMotion, impactDistance, complete);
}

function arrowhead(x, y, dx, dy) {
  const wing = sign => [x - dx * 8 + dy * sign * 5, y - dy * 8 - dx * sign * 5].join(',');
  return wing(1) + ' ' + x + ',' + y + ' ' + wing(-1);
}

function crawl(path, group, dx, dy, reducedMotion, impactDistance, complete) {
  const points = path.map(([x,y]) => [inset + x * spacing, inset + y * spacing]);
  const [x,y] = points.at(-1);
  const bodyLength = points.length - 1;
  const side = inset * 2 + (puzzle.size - 1) * spacing;
  const edgeDistance = dx > 0 ? side - x : dx < 0 ? x : dy > 0 ? side - y : y;
  const blocked = impactDistance !== undefined;
  const travel = impactDistance ?? bodyLength + (edgeDistance + exitGutter + 12) / spacing;
  const trailLength = blocked ? travel * spacing : edgeDistance + exitGutter;
  const [body, head] = group.querySelectorAll('.ink');
  const board = $('board');
  board.append(group);
  group.classList.add('crawling');
  const trail = svg('line', {
    class:'exit-trail',
    x1: x, y1: y,
    x2: x + dx * trailLength,
    y2: y + dy * trailLength,
    'aria-hidden':'true'
  }, group);
  group.prepend(trail);
  const beads = reducedMotion ? [] : path.slice(1).map(() => svg('circle', {
    class:'crawl-segment', r:1.55, 'aria-hidden':'true'
  }, group));
  const startTime = performance.now();
  const forward = blocked ? (reducedMotion ? 220 : 240 + travel * 155) :
    (reducedMotion ? 650 : 420 + travel * 155);
  const pause = blocked ? 320 : 0;
  const retreat = blocked ? (reducedMotion ? 180 : 210 + travel * 105) : 0;
  const duration = forward + pause + retreat;
  let hit = false;

  function pointAt(distance) {
    if (distance >= bodyLength) {
      const outward = (distance - bodyLength) * spacing;
      return [x + dx * outward, y + dy * outward];
    }
    const base = Math.floor(distance);
    const [ax,ay] = points[base], [bx,by] = points[base + 1];
    const fraction = distance - base;
    return [ax + (bx - ax) * fraction, ay + (by - ay) * fraction];
  }

  function frame(now) {
    if (!group.isConnected) return;
    const elapsed = Math.min(duration, now - startTime);
    if (blocked && elapsed >= forward && !hit) {
      hit = true;
      group.classList.add('blocked');
      speak(false);
      $('status').textContent = 'Panah mentok. Satu nyawa berkurang.';
    }
    const fraction = elapsed <= forward ? elapsed / forward :
      1 - Math.max(0, elapsed - forward - pause) / retreat;
    const step = travel * fraction;
    const stretch = reducedMotion ? 0 : .28 * Math.sin(step * Math.PI) * Math.sin(fraction * Math.PI);
    const tail = Math.max(0, step - stretch);
    const tip = bodyLength + step;
    const segment = [
      pointAt(tail),
      ...points.slice(Math.floor(tail) + 1),
      pointAt(tip)
    ];
    body.setAttribute('points', segment.map(point => point.join(',')).join(' '));
    head.setAttribute('points', arrowhead(...segment.at(-1), dx, dy));
    beads.forEach((bead, index) => {
      const [bx,by] = pointAt(tail + (tip - tail) * (index + .5) / beads.length);
      bead.setAttribute('cx', bx);
      bead.setAttribute('cy', by);
    });
    if (elapsed < duration) requestAnimationFrame(frame);
    else complete();
  }
  requestAnimationFrame(frame);
}

function removePath(path) {
  game.removed.push(puzzle.paths.indexOf(path));
  remaining = remaining.filter(other => other !== path);
  if (highlighted === path) highlighted = null;
  if (obstructed === path) obstructed = null;
}

function speak(correct) {
  if (progress.sound === false) return;
  Object.values(sounds).forEach(audio => { audio.pause(); audio.currentTime = 0; });
  sounds[correct ? 'correct' : 'wrong'].play().catch(() => {});
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
  const title = won ? (final ? 'Alhamdulillah, level sulit selesai!' : 'Alhamdulillah, papan bersih!') : 'Nyawa habis';
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
  for (const first of [1, 4, 8]) {
    const group = document.createElement('section');
    group.className = 'difficulty-group';
    const heading = document.createElement('h3');
    heading.textContent = difficulty(first).name;
    const grid = document.createElement('div');
    grid.className = 'level-grid';
    group.append(heading, grid);
    content.append(group);
    for (let n = first; n <= totalLevels && difficulty(n).first === first; n++) {
      const item = button(grid, String(n), () => { level = n; start(); }, n === level ? 'accent' : 'quiet');
      item.disabled = !levelAvailable(n);
      item.setAttribute('aria-label', 'Level ' + n + (item.disabled ? ' terkunci' : ''));
    }
  }
};

function levelAvailable(n) {
  if (n === difficulty(n).first || n <= progress.unlocked || progress.games['level-' + n]) return true;
  return progress.completed?.includes(n - 1) === true;
}

function shuffle(values) {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function needsQuiz() {
  return game.boardVersion >= 3 && !game.quizPassed;
}

function openQuiz(kind) {
  if (turning || !game.lives || !remaining.length) return;
  const blocker = obstructed && findBlocker(obstructed, remaining, puzzle.size);
  if (kind === 'clear' ? !blocker : !game.hints) return;
  if (!questionQueue.length) {
    questionQueue = shuffle(questions);
    if (questionQueue.at(-1) === lastQuestion) questionQueue.unshift(questionQueue.pop());
  }
  const question = questionQueue.pop();
  lastQuestion = question;
  const finalArrow = kind === 'hint' && remaining.length === 1 && needsQuiz();
  const content = modal(kind === 'clear' ? 'Singkirkan penghalang' : finalArrow ? 'Buka panah terakhir' : 'Buka petunjuk');
  paragraph(content, 'Juz ' + question.juz + ' · ' + question.surah + ' ' + question.ayah);
  paragraph(content, question.prompt);
  const options = document.createElement('div');
  options.className = 'quiz-options';
  content.append(options);
  for (const option of shuffle([question.answer, ...question.distractors])) {
    button(options, option, () => {
      const correct = option === question.answer;
      speak(correct);
      options.remove();
      const feedback = document.createElement('p');
      feedback.className = 'feedback';
      feedback.setAttribute('role', 'status');
      feedback.textContent = correct ? 'Alhamdulillah, jawaban benar!' : 'Astaghfirullah, jawaban yang tepat adalah ' + question.answer + '.';
      content.append(feedback);
      paragraph(content, question.translation);
      const source = document.createElement('a');
      source.href = question.source;
      source.target = '_blank';
      source.rel = 'noopener noreferrer';
      source.className = 'ayah-source';
      source.textContent = 'Rujukan terjemahan · ' + question.surah + ' ' + question.ayah;
      content.append(source);
      if (correct) {
        game.quizPassed = true;
        if (kind === 'clear') {
          removePath(blocker);
          $('status').textContent = 'Penghalang disingkirkan. Coba panahnya lagi.';
        } else {
          highlighted = remaining.find(path => !findBlocker(path, remaining, puzzle.size));
          game.hints--;
          $('status').textContent = 'Panah yang menyala bisa keluar.';
        }
        save();
        render();
      } else {
        $('status').textContent = 'Jawaban belum tepat. Kamu bisa mencoba soal lain.';
      }
      const actions = document.createElement('div');
      actions.className = 'dialog-actions';
      content.append(actions);
      button(actions, correct ? 'Kembali ke papan' : 'Coba soal lain', () => {
        if (correct) $('dialog').close();
        else openQuiz(kind);
      }, 'accent').focus();
    });
  }
  options.querySelector('button')?.focus();
}

$('hint').onclick = () => openQuiz('hint');
$('clear').onclick = () => openQuiz('clear');
function updateSound() {
  $('sound').setAttribute('aria-pressed', String(progress.sound !== false));
  $('sound').textContent = progress.sound === false ? 'Suara nonaktif' : 'Suara aktif';
}
$('sound').onclick = () => {
  progress.sound = progress.sound === false;
  if (!progress.sound) Object.values(sounds).forEach(audio => audio.pause());
  save();
  updateSound();
};
updateSound();

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
