import { Detector } from './detector.js';
import { assess, summaryText } from './compliance.js';
import { drawDetections } from './draw.js';
import { classInfo } from './labels.js';

const $ = (id) => document.getElementById(id);
const detector = new Detector({ modelUrl: 'model/best.onnx', classesUrl: 'model/classes.json' });

const state = {
  mode: 'upload',
  conf: 0.35,
  image: null,
  raw: null,
  stream: null,
  running: false,
  lastVerdictKey: '',
};

/* ---------- Model loading ---------- */

let loadPromise = null;
const mb = (bytes) => (bytes / 1e6).toFixed(1).replace('.', ',');

function setModelState(kind, text, fraction) {
  $('model-state').dataset.state = kind;
  $('model-text').textContent = text;
  if (fraction !== undefined) $('model-bar').style.width = `${Math.round(fraction * 100)}%`;
  $('model-retry').hidden = kind !== 'error';
}

function ensureModel() {
  if (!loadPromise) {
    setModelState('loading', 'Memuat model…', 0);
    loadPromise = detector
      .load((loaded, total) => setModelState('loading', `Memuat model ${mb(loaded)} / ${mb(total)} MB`, loaded / total))
      .then(() => setModelState('ready', `Model siap · berjalan dengan ${detector.backend}`, 1))
      .catch((err) => {
        loadPromise = null;
        setModelState('error', `Model gagal dimuat: ${err.message}`);
        throw err;
      });
  }
  return loadPromise;
}

$('model-retry').addEventListener('click', () => ensureModel().catch(() => {}));

// Start downloading as soon as the demo is near the viewport.
new IntersectionObserver((entries, obs) => {
  if (entries.some((e) => e.isIntersecting)) {
    ensureModel().catch(() => {});
    obs.disconnect();
  }
}, { rootMargin: '300px' }).observe($('demo'));

/* ---------- Verdict panel ---------- */

const VERDICT = {
  VIOLATION: { title: 'Pelanggaran', cls: 'verdict--violation' },
  SAFE: { title: 'Aman', cls: 'verdict--safe' },
  NO_WORKER: { title: 'Tidak ada pekerja', cls: 'verdict--idle' },
};

function setVerdict(cls, title, text) {
  $('verdict').className = `verdict ${cls}`;
  $('verdict-title').textContent = title;
  $('verdict-text').textContent = text;
}

function fillTally(list, items, emptyText) {
  list.replaceChildren(...(items.length
    ? items.map((it) => {
      const li = document.createElement('li');
      const name = document.createElement('span');
      name.textContent = it.label;
      const count = document.createElement('span');
      count.className = 'mono';
      count.textContent = `${it.count}`;
      li.append(name, count);
      return li;
    })
    : [Object.assign(document.createElement('li'), { className: 'empty-row', textContent: emptyText })]));
}

function renderResult(result) {
  const key = `${result.status}|${summaryText(result)}|${result.ppe.map((p) => p.name + p.count).join()}`;
  if (key === state.lastVerdictKey) return; // avoid re-announcing identical webcam frames
  state.lastVerdictKey = key;

  const v = VERDICT[result.status];
  setVerdict(v.cls, v.title, summaryText(result));
  $('breakdown').hidden = result.status === 'NO_WORKER';
  fillTally($('list-violation'), result.violations, 'Tidak ada');
  fillTally($('list-ppe'), result.ppe, 'Tidak terdeteksi');
}

function showError(text) {
  state.lastVerdictKey = '';
  setVerdict('verdict--idle', 'Belum bisa dideteksi', text);
  $('breakdown').hidden = true;
}

/* ---------- Photo mode ---------- */

const canvas = $('result-canvas');

function redrawPhoto() {
  if (!state.raw || !state.image) return;
  const dets = detector.decode(state.raw, { conf: state.conf });
  canvas.width = state.raw.srcW;
  canvas.height = state.raw.srcH;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(state.image, 0, 0);
  drawDetections(ctx, dets);
  renderResult(assess(dets));
  $('meta').textContent = `${Math.round(state.raw.ms)} ms · ${detector.backend} · ${dets.length} objek`;
}

async function runImage(img) {
  $('drop').hidden = true;
  canvas.hidden = false;
  $('reset').hidden = false;
  // Show the photo immediately; boxes follow once inference finishes.
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  canvas.getContext('2d').drawImage(img, 0, 0);
  state.lastVerdictKey = '';
  setVerdict('verdict--idle verdict--busy', 'Menganalisis…', 'Model sedang memeriksa foto.');

  try {
    await ensureModel();
    state.image = img;
    state.raw = await detector.infer(img);
    redrawPhoto();
  } catch (err) {
    showError(`Terjadi kesalahan: ${err.message}`);
  }
}

async function loadImage(src) {
  const img = new Image();
  img.src = src;
  await img.decode();
  return img;
}

async function handleFile(file) {
  if (!file) return;
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
    showError('Format file tidak didukung. Gunakan JPG, PNG, atau WebP.');
    return;
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    markSample(null);
    await runImage(img);
  } catch {
    showError('Foto tidak bisa dibaca. Coba file lain.');
  } finally {
    URL.revokeObjectURL(url);
  }
}

function resetPhoto() {
  state.image = null;
  state.raw = null;
  state.lastVerdictKey = '';
  canvas.hidden = true;
  $('reset').hidden = true;
  $('drop').hidden = false;
  $('file').value = '';
  $('meta').textContent = '';
  markSample(null);
  setVerdict('verdict--idle', 'Menunggu gambar', 'Pilih foto, contoh, atau webcam untuk mulai.');
  $('breakdown').hidden = true;
}

function markSample(btn) {
  document.querySelectorAll('.sample').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
}

$('file').addEventListener('change', (e) => handleFile(e.target.files[0]));
$('reset').addEventListener('click', resetPhoto);

const drop = $('drop');
['dragenter', 'dragover'].forEach((t) => drop.addEventListener(t, (e) => {
  e.preventDefault();
  drop.classList.add('is-over');
}));
['dragleave', 'drop'].forEach((t) => drop.addEventListener(t, () => drop.classList.remove('is-over')));
drop.addEventListener('drop', (e) => {
  e.preventDefault();
  handleFile(e.dataTransfer.files[0]);
});
drop.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    $('file').click();
  }
});
drop.tabIndex = 0;
drop.setAttribute('role', 'button');

document.querySelectorAll('.sample').forEach((btn) => {
  btn.setAttribute('aria-pressed', 'false');
  btn.addEventListener('click', async () => {
    if (state.mode !== 'upload') switchTab('upload');
    markSample(btn);
    try {
      await runImage(await loadImage(btn.dataset.src));
    } catch {
      showError('Contoh gambar gagal dimuat.');
    }
  });
});

/* ---------- Confidence slider ---------- */

$('conf').addEventListener('input', (e) => {
  state.conf = Number(e.target.value) / 100;
  $('conf-out').textContent = `${e.target.value}%`;
  state.lastVerdictKey = '';
  if (state.mode === 'upload') redrawPhoto();
});

/* ---------- Webcam mode ---------- */

const video = $('video');
const overlay = $('overlay');

async function startCam() {
  if (state.running) return;
  const idleText = $('cam-idle').querySelector('p');
  if (!navigator.mediaDevices?.getUserMedia) {
    idleText.textContent = 'Browser ini tidak mendukung akses kamera. Gunakan tab Foto.';
    return;
  }
  $('cam-start').disabled = true;
  idleText.textContent = 'Meminta izin kamera…';
  try {
    const [stream] = await Promise.all([
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false }),
      ensureModel(),
    ]);
    state.stream = stream;
    video.srcObject = stream;
    await video.play();
    $('cam-idle').hidden = true;
    $('cam-stop').hidden = false;
    state.running = true;
    state.lastVerdictKey = '';
    loop();
  } catch (err) {
    stopCam();
    const msg = {
      NotAllowedError: 'Izin kamera ditolak. Izinkan kamera di pengaturan browser, lalu coba lagi.',
      NotFoundError: 'Tidak ada kamera yang terdeteksi di perangkat ini.',
      NotReadableError: 'Kamera sedang dipakai aplikasi lain.',
    }[err.name] ?? `Kamera tidak bisa dibuka: ${err.message}`;
    idleText.textContent = msg;
  } finally {
    $('cam-start').disabled = false;
  }
}

function stopCam() {
  state.running = false;
  state.stream?.getTracks().forEach((t) => t.stop());
  state.stream = null;
  video.srcObject = null;
  overlay.getContext('2d').clearRect(0, 0, overlay.width, overlay.height);
  $('cam-idle').hidden = false;
  $('cam-idle').querySelector('p').textContent = 'Kamera mati. Tekan tombol untuk menyalakan lagi.';
  $('cam-stop').hidden = true;
  $('fps').textContent = '-';
}

async function loop() {
  let frames = 0;
  let windowStart = performance.now();
  while (state.running) {
    if (video.readyState >= 2 && video.videoWidth) {
      try {
        const raw = await detector.infer(video);
        if (!state.running) break;
        const dets = detector.decode(raw, { conf: state.conf });
        overlay.width = raw.srcW;
        overlay.height = raw.srcH;
        drawDetections(overlay.getContext('2d'), dets);
        renderResult(assess(dets));

        frames++;
        const now = performance.now();
        if (now - windowStart >= 1000) {
          const fps = (frames * 1000) / (now - windowStart);
          $('fps').textContent = `${fps.toFixed(1).replace('.', ',')} FPS · ${Math.round(raw.ms)} ms · ${detector.backend}`;
          frames = 0;
          windowStart = now;
        }
      } catch (err) {
        showError(`Deteksi webcam berhenti: ${err.message}`);
        stopCam();
        break;
      }
    }
    await new Promise(requestAnimationFrame);
  }
}

$('cam-start').addEventListener('click', startCam);
$('cam-stop').addEventListener('click', stopCam);
document.addEventListener('visibilitychange', () => {
  if (document.hidden && state.running) stopCam();
});

/* ---------- Tabs ---------- */

const tabs = { upload: $('tab-upload'), webcam: $('tab-webcam') };

function switchTab(mode) {
  if (mode === state.mode) return;
  state.mode = mode;
  for (const [name, tab] of Object.entries(tabs)) {
    const active = name === mode;
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
    $(tab.getAttribute('aria-controls')).hidden = !active;
  }
  $('samples').hidden = mode !== 'upload';
  state.lastVerdictKey = '';
  if (mode === 'upload') {
    stopCam();
    if (state.raw) redrawPhoto();
    else resetPhoto();
  } else {
    setVerdict('verdict--idle', 'Menunggu kamera', 'Nyalakan kamera untuk deteksi langsung.');
    $('breakdown').hidden = true;
    $('meta').textContent = '';
  }
}

Object.entries(tabs).forEach(([name, tab]) => {
  tab.addEventListener('click', () => switchTab(name));
  tab.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const next = name === 'upload' ? 'webcam' : 'upload';
    switchTab(next);
    tabs[next].focus();
  });
});

document.querySelectorAll('[data-open-webcam]').forEach((a) => a.addEventListener('click', () => {
  switchTab('webcam');
  startCam();
}));

/* ---------- Accuracy section ---------- */

const pct = (v) => `${(v * 100).toFixed(1).replace('.', ',')}%`;

async function loadMetrics() {
  let m;
  try {
    const res = await fetch('model/metrics.json');
    if (!res.ok) return;
    m = await res.json();
  } catch {
    return;
  }

  $('score').hidden = false;
  $('score-value').textContent = pct(m.mAP50);

  const table = document.createElement('table');
  table.className = 'metrics-table';
  table.innerHTML = '<thead><tr><th scope="col">Kelas</th><th scope="col">Precision</th><th scope="col">Recall</th><th scope="col">mAP50</th></tr></thead>';
  const body = document.createElement('tbody');
  for (const c of [...m.per_class].sort((a, b) => b.mAP50 - a.mAP50)) {
    const tr = document.createElement('tr');
    const cells = [classInfo(c.class).label, pct(c.precision), pct(c.recall), pct(c.mAP50)];
    cells.forEach((text, i) => {
      const td = document.createElement(i === 0 ? 'th' : 'td');
      if (i === 0) td.scope = 'row';
      td.textContent = text;
      if (i === 3) {
        const bar = document.createElement('span');
        bar.className = 'bar';
        bar.setAttribute('aria-hidden', 'true');
        bar.innerHTML = `<i style="width:${Math.round(c.mAP50 * 100)}%"></i>`;
        td.append(bar);
      }
      tr.append(td);
    });
    body.append(tr);
  }
  table.append(body);

  const caption = document.createElement('p');
  caption.className = 'metrics-caption';
  caption.textContent = `Data ${m.split === 'test' ? 'uji' : 'validasi'} · precision ${pct(m.precision)} · recall ${pct(m.recall)} · mAP50-95 ${pct(m['mAP50-95'])}`;
  $('metrics').replaceChildren(table, caption);
}

loadMetrics();
