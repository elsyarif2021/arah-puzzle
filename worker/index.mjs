import {makePuzzle, findBlocker} from '../puzzle.mjs';
import {normalizeNickname, nicknameHelp} from '../profile.mjs';
import {questions} from '../quiz.mjs';

const upsert = `
  INSERT INTO leaderboard (day, player, nickname, lives, elapsed, submitted)
  VALUES (?, ?, ?, ?, ?, ?)
  ON CONFLICT(day, player) DO UPDATE SET
    nickname=excluded.nickname, lives=excluded.lives, elapsed=excluded.elapsed, submitted=excluded.submitted
  WHERE excluded.lives > leaderboard.lives
    OR (excluded.lives = leaderboard.lives AND excluded.elapsed < leaderboard.elapsed)`;
const select = `
  SELECT nickname, lives, elapsed FROM leaderboard WHERE day = ?
  ORDER BY lives DESC, elapsed ASC, submitted ASC, player ASC LIMIT 20`;
const validDevice = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(data, status = 200) {
  return Response.json(data, {status, headers:{'Cache-Control':'no-store'}});
}

function replay(utcDay, moves) {
  let lives = 3;
  let helps = 3;
  let blocked;
  const {paths, size} = makePuzzle(7, utcDay * 75323, 3);
  let remaining = [...paths];
  function remove(path) {
    remaining = remaining.filter(candidate => candidate !== path);
    if (blocked === path) blocked = undefined;
  }
  for (const move of moves) {
    if (!lives || !remaining.length || !Array.isArray(move)) return;
    const [action, value, answer] = move;
    if (action === 'arrow') {
      const path = paths[value];
      if (move.length !== 2 || !Number.isInteger(value) || !remaining.includes(path)) return;
      if (remaining.length === 1 && helps === 3) return;
      if (findBlocker(path, remaining, size)) {
        lives--;
        blocked = path;
      } else remove(path);
      continue;
    }
    if (move.length !== 3 || !helps || !questions.some(q => q.ayah === value && q.answer === answer)) return;
    if (action === 'clear') {
      const blocker = blocked && findBlocker(blocked, remaining, size);
      if (!blocker) return;
      remove(blocker);
    } else if (action === 'life' && lives === 1) lives++;
    else if (action !== 'hint') return;
    helps--;
  }
  if (!remaining.length && lives && helps < 3) return lives;
}

async function leaderboard(request, env) {
  const utcDay = Math.floor((Date.now() + 7 * 3600000) / 86400000);
  const date = new Date(utcDay * 86400000).toISOString().slice(0, 10);
  if (request.method === 'POST') {
    const origin = request.headers.get('Origin');
    if (origin && origin !== new URL(request.url).origin) return json({error:'Permintaan ditolak.'}, 403);
    if (!request.headers.get('Content-Type')?.startsWith('application/json')) return json({error:'Format skor tidak valid.'}, 415);
    const reader = request.body?.getReader();
    if (!reader) return json({error:'Skor kosong.'}, 400);
    let text = '';
    const decoder = new TextDecoder();
    while (true) {
      const {value, done} = await reader.read();
      if (done) break;
      text += decoder.decode(value, {stream:true});
      if (text.length > 12000) {
        await reader.cancel();
        return json({error:'Skor terlalu besar.'}, 413);
      }
    }
    let parsed;
    try { parsed = JSON.parse(text + decoder.decode()); }
    catch { return json({error:'Format skor tidak valid.'}, 400); }
    const {nickname, device, moves, elapsed} = parsed ?? {};
    if (parsed?.date !== date) return json({error:'Skor hanya bisa dikirim pada hari tantangannya (WIB).'}, 409);
    const name = normalizeNickname(nickname);
    if (!name) return json({error:nicknameHelp}, 400);
    if (typeof device !== 'string' || !validDevice.test(device) || !Array.isArray(moves) || moves.length > 120 ||
      !Number.isInteger(elapsed) || elapsed < 1000 || elapsed > 86400000) return json({error:'Data skor tidak valid.'}, 400);
    const lives = replay(utcDay, moves);
    if (!lives) return json({error:'Skor tidak sesuai dengan papan hari ini.'}, 422);
    const player = request.headers.get('oai-authenticated-user-id') || device.toLowerCase();
    await env.DB.prepare(upsert).bind(date, player, name, lives, elapsed, Date.now()).run();
  } else if (request.method !== 'GET') {
    return json({error:'Metode tidak didukung.'}, 405);
  }
  const {results} = await env.DB.prepare(select).bind(date).all();
  return json({date, scores:results});
}

export function createWorker(assets) {
  return {
    async fetch(request, env) {
      const path = new URL(request.url).pathname;
      if (path === '/api/leaderboard') {
        try { return await leaderboard(request, env); }
        catch (error) {
          console.error('Leaderboard unavailable:', error.message);
          return json({error:'Peringkat belum bisa dimuat. Coba lagi nanti.'}, 503);
        }
      }
      if (request.method !== 'HEAD' && request.method !== 'GET') return new Response(null, {status:405});
      const file = Object.hasOwn(assets, path) ? assets[path] : null;
      if (!file) return new Response('Halaman tidak ditemukan.', {status:404});
      const [type, encoded] = file;
      const bytes = Uint8Array.from(atob(encoded), character => character.charCodeAt(0));
      const headers = {'Content-Type':type,'Content-Length':String(bytes.length),'Cache-Control':'no-cache'};
      return new Response(request.method === 'HEAD' ? null : bytes, {headers});
    }
  };
}
