import {getNickname, saveNickname, normalizeNickname} from './profile.mjs';

const endpoint = './api/leaderboard';

function add(parent, element, text) {
  const node = document.createElement(element);
  if (text) node.textContent = text;
  parent.append(node);
  return node;
}

function formatTime(milliseconds) {
  const seconds = Math.round(milliseconds / 1000);
  return Math.floor(seconds / 60) + 'm ' + (seconds % 60) + 'd';
}

async function api(method, payload) {
  const response = await fetch(endpoint, {
    method,
    headers: payload ? {'Content-Type': 'application/json'} : undefined,
    body: payload ? JSON.stringify(payload) : undefined,
    cache: 'no-store'
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) throw new Error(data?.error || 'Peringkat belum bisa dimuat.');
  return data;
}

export async function showLeaderboard(content, date, result) {
  const panel = add(content, 'section');
  add(panel, 'p', 'Tantangan ' + date + ' (WIB) · Sisa nyawa terbanyak, lalu waktu tercepat.');
  let submitting = false;
  if (result) {
    add(panel, 'p', 'Hasilmu: ' + result.lives + ' nyawa · ' + formatTime(result.elapsed));
    const form = add(panel, 'form');
    form.className = 'score-form';
    const label = add(form, 'label', 'Nama panggilan');
    const input = add(label, 'input');
    input.name = 'nickname';
    input.required = true;
    input.maxLength = 24;
    input.autocomplete = 'nickname';
    input.value = getNickname();
    const submit = add(form, 'button', 'Kirim skor');
    submit.className = 'accent';
    form.addEventListener('submit', async event => {
      event.preventDefault();
      submit.disabled = true;
      submitting = true;
      try {
        let device = localStorage.getItem('arah-ranking-id');
        if (!device) {
          device = crypto.randomUUID();
          localStorage.setItem('arah-ranking-id', device);
        }
        const data = await api('POST', {date, nickname:input.value, device, moves:result.moves, elapsed:result.elapsed});
        try { saveNickname(normalizeNickname(input.value)); } catch {}
        showRows(data);
        status.textContent = 'Skor terbaikmu tercatat.';
      } catch (error) {
        status.textContent = navigator.onLine ? error.message : 'Kamu sedang offline. Skor di perangkat bisa dikirim saat online.';
      } finally {
        submit.disabled = false;
      }
    });
  } else {
    add(panel, 'p', 'Selesaikan Tantangan Harian untuk mengirim skor.');
  }
  const status = add(panel, 'p', 'Memuat peringkat…');
  status.setAttribute('role', 'status');
  const list = add(panel, 'ol');
  list.className = 'score-list';

  function showRows(data) {
    list.replaceChildren();
    if (data.date !== date) {
      status.textContent = 'Hari sudah berganti. Muat ulang aplikasi untuk melihat papan terbaru.';
      return;
    }
    status.textContent = data.scores.length ? '' : 'Belum ada skor hari ini.';
    for (const score of data.scores) {
      const row = add(list, 'li');
      add(row, 'strong', score.nickname);
      add(row, 'small', score.lives + ' nyawa · ' + formatTime(score.elapsed));
    }
  }

  try {
    const data = await api('GET');
    if (!submitting) showRows(data);
  } catch (error) {
    if (!submitting) status.textContent = navigator.onLine ? error.message : 'Peringkat tersedia saat online.';
  }
}
