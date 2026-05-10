// === Config ===
const SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbwwJxZkOH-befqbeiGo6wD4U1HNlcGOK-9vb16Eo-F76D0EyFX1op6G087XgkTCOPsDKQ/exec';

// === Questions ===
const QUESTIONS = [
  {
    id: 1,
    instruction:
      '탄소(C) 원자 모형을 그려보세요. 원자핵(양성자·중성자)과 전자의 위치를 표현해주세요.',
    bg: null,
  },
  {
    id: 2,
    instruction:
      '리튬(Li) 원자가 리튬 이온(Li⁺)이 되는 과정을 그림으로 표현해보세요. 전자의 변화에 주목하세요.',
    bg: 'pic2.png',
  },
  {
    id: 3,
    instruction:
      '황산 구리(II) 수용액에 전류를 흘렸을 때 이온의 이동 방향을 그림으로 나타내보세요. 구리 이온과 황산 이온이 각각 어느 극으로 이동하는지 표현해주세요.',
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
  btnNext: document.getElementById('btnNext'),
  btnSubmit: document.getElementById('btnSubmit'),

  doneSub: document.getElementById('doneSub'),
  doneHint: document.getElementById('doneHint'),
  previewGrid: document.getElementById('previewGrid'),
  btnRestart: document.getElementById('btnRestart'),

  toast: document.getElementById('toast'),
  submitOverlay: document.getElementById('submitOverlay'),
};

// === Toast ===
let toastTimer = null;
function showToast(msg) {
  el.toast.textContent = msg;
  el.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.toast.classList.remove('show'), 1700);
}

function setSubmitOverlay(on) {
  if (!el.submitOverlay) return;
  el.submitOverlay.classList.toggle('show', !!on);
  el.submitOverlay.setAttribute('aria-hidden', on ? 'false' : 'true');
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
function markAutoSaved() {
  // 상태 표시 UI 제거됨 (의도적으로 no-op)
}

// === Background image handling (full cover drawImage) ===
function loadBackground(src) {
  const token = ++drawing.bgLoadToken;
  drawing.bgSrc = src || null;
  drawing.bgImg = null;

  if (!src) {
    redrawBackground();
    return;
  }

  // 요청하신 방식 그대로
  const img = new Image();
  img.src = src;
  img.onload = () => {
    if (token !== drawing.bgLoadToken) return; // 문항 전환 중 뒤늦은 onload 무시
    drawing.bgImg = img;
    redrawBackground();
  };
  img.onerror = () => {
    if (token !== drawing.bgLoadToken) return;
    drawing.bgImg = null;
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
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      ctx.save();
      ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(img, 0, 0, el.drawCanvas.width, el.drawCanvas.height);
      ctx.restore();
      resolve();
    };
    img.onerror = () => resolve();
    img.src = dataUrl;
  });
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
  showToast('예시 입력 완료!');
});

el.btnStart.addEventListener('click', () => {
  if (!validateStart()) {
    showToast('이름과 학번을 먼저 입력해 주세요');
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
      '메인으로 돌아갈까요? (지금까지 그린 내용은 그대로 저장돼요)'
    )
  ) {
    goToStart();
  }
});

// Save text live
el.textAnswer.addEventListener('input', () => {
  state.answers[clampQ(state.current)].text = el.textAnswer.value || '';
  persistCurrentAnswer();
});

// 문항 2 → 3 전환 포함 전체 전환 로직 안전화
el.btnNext.addEventListener('click', () => {
  persistCurrentAnswer();
  const current = clampQ(state.current);
  const next = current + 1;
  if (next > Q_TOTAL) return;
  const josa = next === 3 ? '으로' : '로';
  showToast(`문항 ${next}${josa} 이동합니다`);
  goToTask(next);
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

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image_load_failed'));
    img.src = src;
  });
}

// 근본 해결: "화면 전환 없이" 문항별 저장값으로 오프스크린 합성 캡처
async function captureCompositeForQuestion(qNum) {
  const q = clampQ(qNum);
  const info = QUESTIONS[q - 1];

  const w = el.drawCanvas.width || 1600;
  const h = el.drawCanvas.height || 1000;

  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const octx = out.getContext('2d');

  // white base
  octx.fillStyle = '#ffffff';
  octx.fillRect(0, 0, w, h);

  // background (full cover)
  if (info.bg) {
    try {
      const bgImg = await loadImage(info.bg);
      octx.drawImage(bgImg, 0, 0, w, h);
    } catch (_e) {
      // ignore (still submit white background)
    }
  }

  // drawing layer for that question (transparent PNG)
  const drawData = state.answers[q].image;
  if (drawData) {
    try {
      const drawImg = await loadImage(drawData);
      octx.drawImage(drawImg, 0, 0, w, h);
    } catch (_e) {
      // ignore
    }
  }

  // 요구사항: restore 후 약간의 딜레이(캡처 안정화)
  await sleep(50);

  return out.toDataURL('image/png');
}

el.btnSubmit.addEventListener('click', async () => {
  persistCurrentAnswer();

  if (!state.name || !state.studentId) {
    showToast('이름/학번이 없어요. 메인에서 다시 시작해 주세요.');
    return;
  }

  if (!confirm('제출하면 수정이 어렵습니다. 제출하시겠어요?')) return;

  setSubmitting(true);
  setSubmitOverlay(true);
  showToast('제출을 시작할게요');

  try {
    // 모든 문항을 "배경 포함 합성 이미지"로 캡처
    const imagesByQ = {};
    for (const q of [1, 2, 3]) {
      imagesByQ[q] = await captureCompositeForQuestion(q);
    }

    const payload = buildPayload(imagesByQ);

    //클로드 제출 오류 수정
    await fetch(SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload),
      mode: 'no-cors',
      cache: 'no-store',
    });


    // preview에서 합성본을 쓰기 위해 저장
    state.answers[1].__composite = imagesByQ[1];
    state.answers[2].__composite = imagesByQ[2];
    state.answers[3].__composite = imagesByQ[3];

    goToDone('제출 완료! 수고했어요. 선생님께 전달되었어요.');
  } catch (err) {
    console.error(err);
    // 실패해도 미리보기는 합성 캡처(가능하면)로 보여주기
    state.answers[1].__composite = state.answers[1].__composite || '';
    state.answers[2].__composite = state.answers[2].__composite || '';
    state.answers[3].__composite = state.answers[3].__composite || '';
    goToDone('제출이 잘 안 됐어요');
    el.doneHint.textContent =
      '인터넷 연결을 확인하고 다시 제출해 보세요. 그래도 안 되면 선생님께 화면을 보여 주세요.';
    showToast('전송 실패');
  } finally {
    setSubmitting(false);
    setSubmitOverlay(false);
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

