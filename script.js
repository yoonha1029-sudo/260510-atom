// === Config ===
const SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbwwJxZkOH-befqbeiGo6wD4U1HNlcGOK-9vb16Eo-F76D0EyFX1op6G087XgkTCOPsDKQ/exec';

// === Questions ===
const QUESTIONS = [
  {
    id: 1,
    instruction:
      '탄소(C) 원자 모형을 그려보세요. 양성자, 중성자, 전자를 표현해 보세요.',
    bg: null,
  },
  {
    id: 2,
    instruction:
      '리튬(Li) 원자가 리튬 이온이 되는 과정을 그림으로 표현해 보세요.',
    bg: 'pic2.png',
  },
  {
    id: 3,
    instruction:
      '황산 구리( II ) 수용액에 전류를 흘려 주면 어떤 변화가 나타날지 표현하고, 그 이유를 구리 이온과 황산 이온 모형을 그려 설명해 보세요.',
    bg: 'pic3.png',
  },
];

const Q_TOTAL = QUESTIONS.length;

// === State ===
const state = {
  name: '',
  studentId: '',
  current: 1,
  // image = "그림 레이어"(투명) dataURL
  answers: {
    1: { text: '', image: '' },
    2: { text: '', image: '' },
    3: { text: '', image: '' },
  },
};

// === Elements ===
const el = {
  headerBadge: document.getElementById('headerBadge'),

  screenStart: document.getElementById('screenStart'),
  screenTask: document.getElementById('screenTask'),
  screenDone: document.getElementById('screenDone'),

  inputName: document.getElementById('inputName'),
  inputStudentId: document.getElementById('inputStudentId'),
  btnStart: document.getElementById('btnStart'),
  btnDemo: document.getElementById('btnDemo'),

  chipProgress: document.getElementById('chipProgress'),
  chipWho: document.getElementById('chipWho'),
  instructionText: document.getElementById('instructionText'),
  btnBackToStart: document.getElementById('btnBackToStart'),

  toolPen: document.getElementById('toolPen'),
  toolEraser: document.getElementById('toolEraser'),
  btnClearAll: document.getElementById('btnClearAll'),
  colorButtons: Array.from(document.querySelectorAll('[data-color]')),

  bgCanvas: document.getElementById('bgCanvas'),
  drawCanvas: document.getElementById('drawCanvas'),
  textAnswer: document.getElementById('textAnswer'),
  bgStatus: document.getElementById('bgStatus'),
  saveStatus: document.getElementById('saveStatus'),
  btnNext: document.getElementById('btnNext'),
  btnSubmit: document.getElementById('btnSubmit'),

  doneSub: document.getElementById('doneSub'),
  doneHint: document.getElementById('doneHint'),
  previewGrid: document.getElementById('previewGrid'),
  btnRestart: document.getElementById('btnRestart'),

  toast: document.getElementById('toast'),
};

// === Toast ===
let toastTimer = null;
function showToast(msg) {
  el.toast.textContent = msg;
  el.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.toast.classList.remove('show'), 1700);
}

// === Screen control ===
function showScreen(which) {
  el.screenStart.classList.toggle('active', which === 'start');
  el.screenTask.classList.toggle('active', which === 'task');
  el.screenDone.classList.toggle('active', which === 'done');
}

function setHeaderBadge(text) {
  el.headerBadge.textContent = text;
}

// === Canvas drawing (2-layer) ===
const ctxBg = el.bgCanvas.getContext('2d', { willReadFrequently: false });
const ctx = el.drawCanvas.getContext('2d', { willReadFrequently: false });

const drawing = {
  tool: 'pen', // 'pen' | 'eraser'
  color: '#111827',
  penSize: 4,
  eraserSize: 20,
  isDown: false,
  lastX: 0,
  lastY: 0,
  bgImg: null,
  bgSrc: null,
  bgLoadToken: 0,
};

function clampQ(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 1;
  return Math.min(Q_TOTAL, Math.max(1, x));
}

function getCanvasPixelSize(canvasEl) {
  const rect = canvasEl.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  return {
    pxW: Math.round(Math.max(1, rect.width) * dpr),
    pxH: Math.round(Math.max(1, rect.height) * dpr),
    dpr,
  };
}

function fillBgWhite() {
  ctxBg.save();
  ctxBg.setTransform(1, 0, 0, 1, 0, 0);
  ctxBg.globalCompositeOperation = 'source-over';
  ctxBg.fillStyle = '#ffffff';
  ctxBg.fillRect(0, 0, el.bgCanvas.width, el.bgCanvas.height);
  ctxBg.restore();
}

function redrawBackground() {
  fillBgWhite();
  if (drawing.bgImg && drawing.bgImg.complete) {
    // 요청하신 방식: 캔버스 전체에 깔기
    ctxBg.drawImage(
      drawing.bgImg,
      0,
      0,
      el.bgCanvas.width,
      el.bgCanvas.height
    );
  }
}

function clearDrawingLayer(silent) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  ctx.clearRect(0, 0, el.drawCanvas.width, el.drawCanvas.height);
  ctx.restore();
  if (!silent) showToast('캔버스를 지웠어요');
  markAutoSaved();
}

function resizeCanvasesPreserving() {
  // preserve current drawing layer only (background is re-drawn)
  const prevDraw = el.drawCanvas.toDataURL('image/png');

  const { pxW, pxH } = getCanvasPixelSize(el.drawCanvas);
  if (el.drawCanvas.width === pxW && el.drawCanvas.height === pxH) return;

  el.bgCanvas.width = pxW;
  el.bgCanvas.height = pxH;
  el.drawCanvas.width = pxW;
  el.drawCanvas.height = pxH;

  redrawBackground();
  clearDrawingLayer(true);

  if (prevDraw) {
    restoreDrawingFromDataUrl(prevDraw);
  }
}

function canvasPointFromEvent(e) {
  const rect = el.drawCanvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const clientX =
    e.touches && e.touches[0] ? e.touches[0].clientX : e.clientX;
  const clientY =
    e.touches && e.touches[0] ? e.touches[0].clientY : e.clientY;
  return {
    x: (clientX - rect.left) * dpr,
    y: (clientY - rect.top) * dpr,
  };
}

function beginStroke(e) {
  drawing.isDown = true;
  const p = canvasPointFromEvent(e);
  drawing.lastX = p.x;
  drawing.lastY = p.y;
  drawDot(p.x, p.y);
  e.preventDefault?.();
}

function drawDot(x, y) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // 배경은 별도 캔버스라서, 지우개는 "그림 레이어"만 지워도 됨
  ctx.globalCompositeOperation =
    drawing.tool === 'eraser' ? 'destination-out' : 'source-over';
  ctx.strokeStyle = drawing.color;
  const w = drawing.tool === 'eraser' ? drawing.eraserSize : drawing.penSize;
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + 0.01, y + 0.01);
  ctx.stroke();
  ctx.restore();
  markAutoSaved();
}

function moveStroke(e) {
  if (!drawing.isDown) return;
  const p = canvasPointFromEvent(e);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.globalCompositeOperation =
    drawing.tool === 'eraser' ? 'destination-out' : 'source-over';
  ctx.strokeStyle = drawing.color;
  ctx.lineWidth = drawing.tool === 'eraser' ? drawing.eraserSize : drawing.penSize;
  ctx.beginPath();
  ctx.moveTo(drawing.lastX, drawing.lastY);
  ctx.lineTo(p.x, p.y);
  ctx.stroke();
  ctx.restore();
  drawing.lastX = p.x;
  drawing.lastY = p.y;
  markAutoSaved();
  e.preventDefault?.();
}

function endStroke() {
  if (!drawing.isDown) return;
  drawing.isDown = false;
  persistCurrentAnswer();
}

el.drawCanvas.addEventListener('pointerdown', beginStroke);
el.drawCanvas.addEventListener('pointermove', moveStroke);
window.addEventListener('pointerup', endStroke);
window.addEventListener('pointercancel', endStroke);

// === Tools ===
function setTool(tool) {
  drawing.tool = tool;
  el.toolPen.classList.toggle('active', tool === 'pen');
  el.toolEraser.classList.toggle('active', tool === 'eraser');
  showToast(tool === 'pen' ? '펜 선택' : '지우개 선택');
}
el.toolPen.addEventListener('click', () => setTool('pen'));
el.toolEraser.addEventListener('click', () => setTool('eraser'));

function setColor(color) {
  drawing.color = color;
  el.colorButtons.forEach((b) =>
    b.classList.toggle('active', b.dataset.color === color)
  );
  if (drawing.tool !== 'pen') setTool('pen');
  showToast('색상 변경');
}
el.colorButtons.forEach((btn) =>
  btn.addEventListener('click', () => setColor(btn.dataset.color))
);

el.btnClearAll.addEventListener('click', () => {
  // 배경은 유지, 그림 레이어만 지움
  clearDrawingLayer(false);
  persistCurrentAnswer();
});

// === Auto-save indicators ===
let saveBlinkTimer = null;
function markAutoSaved() {
  el.saveStatus.textContent = '자동 저장됨';
  el.saveStatus.style.color = 'var(--muted)';
  clearTimeout(saveBlinkTimer);
  saveBlinkTimer = setTimeout(() => {
    el.saveStatus.textContent = '자동 저장됨';
    el.saveStatus.style.color = 'var(--muted)';
  }, 600);
}

// === Background image handling (full cover drawImage) ===
function loadBackground(src) {
  const token = ++drawing.bgLoadToken;
  drawing.bgSrc = src || null;
  drawing.bgImg = null;

  if (!src) {
    el.bgStatus.textContent = '배경: 없음';
    redrawBackground();
    return;
  }

  el.bgStatus.textContent = '배경: 불러오는 중...';

  // 요청하신 방식 그대로
  const img = new Image();
  img.src = src;
  img.onload = () => {
    if (token !== drawing.bgLoadToken) return; // 문항 전환 중 뒤늦은 onload 무시
    drawing.bgImg = img;
    el.bgStatus.textContent = `배경: ${src}`;
    redrawBackground();
  };
  img.onerror = () => {
    if (token !== drawing.bgLoadToken) return;
    drawing.bgImg = null;
    el.bgStatus.textContent = `배경: ${src} (파일 없음)`;
    redrawBackground();
    showToast('배경 이미지를 찾을 수 없어요');
  };
}

// === Persist/restore per question ===
function persistCurrentAnswer() {
  const q = clampQ(state.current);
  state.answers[q].text = el.textAnswer.value || '';
  state.answers[q].image = el.drawCanvas.toDataURL('image/png');
}

function restoreDrawingFromDataUrl(dataUrl) {
  if (!dataUrl) {
    clearDrawingLayer(true);
    return;
  }
  const img = new Image();
  img.onload = () => {
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(img, 0, 0, el.drawCanvas.width, el.drawCanvas.height);
    ctx.restore();
  };
  img.src = dataUrl;
}

function compositeCurrentPngDataUrl() {
  const out = document.createElement('canvas');
  out.width = el.bgCanvas.width;
  out.height = el.bgCanvas.height;
  const octx = out.getContext('2d');
  // 흰 배경 + 배경 이미지 + 그림 레이어 순서
  octx.drawImage(el.bgCanvas, 0, 0);
  octx.drawImage(el.drawCanvas, 0, 0);
  return out.toDataURL('image/png');
}

function compositePngForQuestion(qNum) {
  const q = clampQ(qNum);
  const qInfo = QUESTIONS[q - 1];

  const out = document.createElement('canvas');
  out.width = el.bgCanvas.width || 1;
  out.height = el.bgCanvas.height || 1;
  const octx = out.getContext('2d');

  // white
  octx.fillStyle = '#ffffff';
  octx.fillRect(0, 0, out.width, out.height);

  // background (if loaded right now for this question it will be used; otherwise draw via image load later is not needed for submission)
  // For reliable output, draw background by loading the file synchronously is impossible,
  // so we instead render the bg by recreating it when the question is active.
  // We call this function after renderQuestion, so bgCanvas already contains correct background.
  if (state.current === q) {
    octx.drawImage(el.bgCanvas, 0, 0);
  }

  // drawing layer saved
  const drawData = state.answers[q].image;
  if (!drawData) return out.toDataURL('image/png');

  // draw layer from dataURL
  // (sync draw is not possible; we return placeholder and caller should use compositeCurrentPngDataUrl for active q)
  // To keep API simple, we avoid this path and handle payload by visiting each question sequentially.
  return drawData;
}

function renderQuestion(qIndex) {
  const idx = clampQ(qIndex);
  state.current = idx;

  const q = QUESTIONS[idx - 1];
  el.chipProgress.textContent = `${idx}/${Q_TOTAL}`;
  el.instructionText.textContent = q.instruction;
  el.btnNext.style.display = idx < Q_TOTAL ? 'inline-flex' : 'none';
  el.btnSubmit.style.display = idx === Q_TOTAL ? 'inline-flex' : 'none';

  el.textAnswer.value = state.answers[idx].text || '';

  // resize first (so bg draw fills correct pixel size)
  requestAnimationFrame(() => {
    resizeCanvasesPreserving();
    loadBackground(q.bg);

    // restore drawing layer (above bg)
    const savedDraw = state.answers[idx].image;
    if (savedDraw) restoreDrawingFromDataUrl(savedDraw);
    else clearDrawingLayer(true);

    persistCurrentAnswer();
  });

  setHeaderBadge(`문항 ${idx} 진행 중`);
}

// === Navigation ===
function goToStart() {
  showScreen('start');
  setHeaderBadge('준비됨');
  el.inputName.value = state.name || '';
  el.inputStudentId.value = state.studentId || '';
  validateStart();
}

function goToTask(qIndex) {
  showScreen('task');
  el.chipWho.textContent = `${state.name} (${state.studentId})`;
  renderQuestion(qIndex);
}

function goToDone(resultText) {
  showScreen('done');
  setHeaderBadge('완료');
  el.doneSub.textContent = resultText || '전송 완료';
  buildPreview();
}

// === Start validation ===
function validateStart() {
  const name = (el.inputName.value || '').trim();
  const sid = (el.inputStudentId.value || '').trim();
  const ok = name.length > 0 && sid.length > 0;
  el.btnStart.disabled = !ok;
  return ok;
}
el.inputName.addEventListener('input', validateStart);
el.inputStudentId.addEventListener('input', validateStart);

el.btnDemo.addEventListener('click', () => {
  el.inputName.value = '홍길동';
  el.inputStudentId.value = '20301';
  validateStart();
  showToast('예시를 채웠어요');
});

el.btnStart.addEventListener('click', () => {
  if (!validateStart()) {
    showToast('이름과 학번을 모두 입력하세요');
    return;
  }
  state.name = el.inputName.value.trim();
  state.studentId = el.inputStudentId.value.trim();
  goToTask(1);
});

el.btnBackToStart.addEventListener('click', () => {
  persistCurrentAnswer();
  if (
    confirm(
      '메인으로 돌아가면 진행 중인 내용은 유지되지만, 화면이 이동합니다. 돌아갈까요?'
    )
  ) {
    goToStart();
  }
});

// Save text live
el.textAnswer.addEventListener('input', () => {
  state.answers[clampQ(state.current)].text = el.textAnswer.value || '';
  el.saveStatus.textContent = '자동 저장됨';
  persistCurrentAnswer();
});

// 문항 2 → 3 전환 포함 전체 전환 로직 안전화
el.btnNext.addEventListener('click', () => {
  persistCurrentAnswer();
  const current = clampQ(state.current);
  const next = current + 1;
  if (next > Q_TOTAL) return;
  goToTask(next);
  showToast(`문항 ${next}로 이동`);
});

// === Submit ===
function buildPayload(imagesByQ) {
  return {
    name: state.name,
    studentId: state.studentId,
    q1_text: state.answers[1].text || '',
    q1_image: imagesByQ[1] || '',
    q2_text: state.answers[2].text || '',
    q2_image: imagesByQ[2] || '',
    q3_text: state.answers[3].text || '',
    q3_image: imagesByQ[3] || '',
  };
}

function setSubmitting(on) {
  el.btnSubmit.disabled = on;
  el.btnBackToStart.disabled = on;
  el.btnClearAll.disabled = on;
  el.toolPen.disabled = on;
  el.toolEraser.disabled = on;
  el.colorButtons.forEach((b) => (b.disabled = on));
  el.textAnswer.disabled = on;
  el.btnNext.disabled = on;
  el.btnSubmit.textContent = on ? '제출 중...' : '제출';
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

//클로드 배경 이미지 로드 수정
async function waitForBackground(maxMs = 2000) {
  const q = QUESTIONS[clampQ(state.current) - 1];
  if (!q.bg) return;
  const start = Date.now();
  while (!drawing.bgImg || !drawing.bgImg.complete) {
    if (Date.now() - start > maxMs) break;
    await sleep(10);
  }
  await sleep(30);
}

async function captureCompositeForQuestion(qNum) {
  // 해당 문항을 활성화해서 배경이 실제로 그려진 상태에서 합성 캡처
  goToTask(qNum);
  // 다음 프레임 + 이미지 onload까지 잠깐 여유
  await sleep(50);
  // 배경 이미지가 있는 문항은 onload가 더 걸릴 수 있어 한번 더 여유
  await waitForBackground();
  return compositeCurrentPngDataUrl();
}

el.btnSubmit.addEventListener('click', async () => {
  persistCurrentAnswer();

  if (!state.name || !state.studentId) {
    showToast('이름/학번 정보가 없어요. 메인으로 돌아가 다시 시작해 주세요.');
    return;
  }

  setSubmitting(true);
  showToast('제출을 시작합니다');

  try {
    // 모든 문항을 "배경 포함 합성 이미지"로 캡처
    const imagesByQ = {};
    for (const q of [1, 2, 3]) {
      imagesByQ[q] = await captureCompositeForQuestion(q);
    }

    // 제출은 문항 3에서 이뤄지므로 화면을 3으로 복귀
    goToTask(3);

    const payload = buildPayload(imagesByQ);

    //클로드 제출 오류 수정
    const res = await fetch(SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload),
      mode: 'no-cors',
      cache: 'no-store',
    });

    let text = '';
    try {
      text = await res.text();
    } catch (_e) {}

    if (!res.ok) {
      throw new Error(
        `HTTP ${res.status} ${res.statusText}${text ? ' - ' + text : ''}`
      );
    }

    // preview에서 합성본을 쓰기 위해 저장
    state.answers[1].__composite = imagesByQ[1];
    state.answers[2].__composite = imagesByQ[2];
    state.answers[3].__composite = imagesByQ[3];

    goToDone('전송 성공! (서버 응답 수신)');
    el.doneHint.textContent = text
      ? `서버 응답: ${text}`
      : '아래는 제출한 내용 미리보기입니다.';
  } catch (err) {
    console.error(err);
    // 실패해도 미리보기는 합성 캡처(가능하면)로 보여주기
    state.answers[1].__composite = state.answers[1].__composite || '';
    state.answers[2].__composite = state.answers[2].__composite || '';
    state.answers[3].__composite = state.answers[3].__composite || '';
    goToDone('전송 실패 (미리보기는 저장됨)');
    el.doneHint.textContent =
      '서버로 전송에 실패했어요. 인터넷 연결 또는 구글 스크립트 권한(CORS/배포 설정)을 확인한 뒤 다시 시도해 주세요. 아래는 현재 저장된 미리보기입니다.';
    showToast('전송 실패');
  } finally {
    setSubmitting(false);
  }
});

// === Preview ===
function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function previewItemHtml(qNum) {
  const q = QUESTIONS[qNum - 1];
  const composite = state.answers[qNum].__composite;
  const img = composite || '';
  const txt = (state.answers[qNum].text || '').trim();
  return `
    <div class="previewItem">
      <div class="meta">
        <div class="q">문항 ${qNum}</div>
        <div class="smallMuted">${img ? '그림 저장됨' : '그림 없음'}</div>
      </div>
      <div class="body">
        <div>
          <div class="smallMuted" style="margin-bottom:6px;">지시문</div>
          <div class="hint" style="margin:0 0 10px; color:var(--text);">${escapeHtml(
            q.instruction
          )}</div>
          <img alt="문항 ${qNum} 그림" src="${img || ''}" />
        </div>
        <div>
          <div class="smallMuted" style="margin-bottom:6px;">설명(선택)</div>
          <div class="previewText">${
            txt ? escapeHtml(txt) : '<span class="smallMuted">입력 없음</span>'
          }</div>
        </div>
      </div>
    </div>
  `;
}

function buildPreview() {
  persistCurrentAnswer();
  // 제출 성공/실패와 상관 없이, 현재 화면의 합성본이라도 만들어 채움
  for (const q of [1, 2, 3]) {
    if (!state.answers[q].__composite) {
      // 현재 활성 문항이면 즉시 합성 가능
      if (state.current === q && el.screenTask.classList.contains('active')) {
        state.answers[q].__composite = compositeCurrentPngDataUrl();
      }
    }
  }
  el.previewGrid.innerHTML = [1, 2, 3].map(previewItemHtml).join('');
}

el.btnRestart.addEventListener('click', () => {
  state.name = '';
  state.studentId = '';
  state.current = 1;
  state.answers = {
    1: { text: '', image: '' },
    2: { text: '', image: '' },
    3: { text: '', image: '' },
  };
  drawing.bgImg = null;
  drawing.bgSrc = null;
  drawing.bgLoadToken = 0;
  el.inputName.value = '';
  el.inputStudentId.value = '';
  el.textAnswer.value = '';
  setTool('pen');
  setColor('#111827');
  goToStart();
  showToast('초기화 완료');
});

// === Initial setup ===
function init() {
  validateStart();
  setTool('pen');
  setColor('#111827');

  requestAnimationFrame(() => {
    resizeCanvasesPreserving();
    redrawBackground();
    clearDrawingLayer(true);
  });
}
init();

// Resize handling
let resizeTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (el.screenTask.classList.contains('active')) {
      const prevDraw = el.drawCanvas.toDataURL('image/png');
      resizeCanvasesPreserving();
      if (prevDraw) restoreDrawingFromDataUrl(prevDraw);
      persistCurrentAnswer();
    } else {
      resizeCanvasesPreserving();
    }
  }, 120);
});

