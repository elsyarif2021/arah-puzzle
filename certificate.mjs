export function showCertificate(parent, tier, date, nickname) {
  const form = document.createElement('form');
  form.className = 'score-form';
  const label = document.createElement('label');
  label.textContent = 'Nama di sertifikat';
  const input = document.createElement('input');
  input.autocomplete = 'name';
  input.maxLength = 64;
  input.required = true;
  input.value = nickname;
  label.append(input);
  const download = document.createElement('button');
  download.type = 'submit';
  download.className = 'accent';
  download.textContent = 'Unduh PNG';
  form.append(label, download);
  const canvas = document.createElement('canvas');
  canvas.width = 3508;
  canvas.height = 2480;
  canvas.className = 'certificate-preview';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Pratinjau sertifikat jenjang ' + tier.name);
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  parent.append(canvas, form, status);
  const dateLabel = new Intl.DateTimeFormat('id-ID', {dateStyle:'long', timeZone:'UTC'}).format(new Date(date));
  const ctx = canvas.getContext('2d');
  function draw() {
    ctx.save();
    ctx.scale(3.508, 2.48 / .707);
    ctx.fillStyle = '#fff9eb';
    ctx.fillRect(0,0,1000,707);
    ctx.fillStyle = '#0c5148';
    ctx.fillRect(0,0,1000,134);
    ctx.strokeStyle = '#b99045';
    ctx.lineWidth = 2;
    ctx.strokeRect(34,34,932,639);
    ctx.strokeRect(43,43,914,621);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    function line(text, y, font, color, maxWidth = 810) {
      ctx.fillStyle = color;
      ctx.font = font;
      ctx.fillText(text,500,y,maxWidth);
    }
    ctx.strokeStyle = '#d4ae62';
    ctx.lineWidth = 1.5;
    for (const x of [98,902]) {
      for (const angle of [0, Math.PI / 4]) {
        ctx.save();
        ctx.translate(x,209);
        ctx.rotate(angle);
        ctx.strokeRect(-20,-20,40,40);
        ctx.restore();
      }
    }
    line('ARAH  /  PUZZLE PANAH',86,'700 21px sans-serif','#f7d99b');
    line('Sertifikat Penghargaan',211,'700 45px Georgia, serif','#0c5148');
    line('Diberikan kepada',286,'19px sans-serif','#475951');
    line(input.value.trim() || 'Nama pemain',348,'700 60px Georgia, serif','#132a45');
    ctx.beginPath();
    ctx.moveTo(280,396);
    ctx.lineTo(720,396);
    ctx.stroke();
    line('Atas penyelesaian 10 level Puzzle Panah',446,'21px sans-serif','#475951');
    line('Jenjang ' + tier.name,506,'700 38px Georgia, serif','#0c5148');
    line('Diselesaikan pada ' + dateLabel,585,'18px sans-serif','#475951');
    ctx.restore();
  }
  input.addEventListener('input', () => { input.setCustomValidity(''); draw(); });
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!input.value.trim()) {
      input.setCustomValidity('Masukkan nama untuk sertifikat.');
      input.reportValidity();
      return;
    }
    draw();
    canvas.toBlob(blob => {
      if (!blob) { status.textContent = 'PNG belum bisa dibuat. Coba lagi.'; return; }
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.href = url;
      link.download = 'sertifikat-arah-' + tier.name.toLowerCase() + '.png';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      status.textContent = 'Sertifikat siap diunduh.';
    }, 'image/png');
  });
  draw();
}
