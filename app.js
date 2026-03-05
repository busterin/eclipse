const screens = {
  cover: document.getElementById("coverScreen"),
  quiz: document.getElementById("quizScreen"),
  scanner: document.getElementById("scannerScreen"),
};

const startBtn = document.getElementById("startBtn");
const confirmBtn = document.getElementById("confirmBtn");
const resetBtn = document.getElementById("resetBtn");
const statusMsg = document.getElementById("statusMsg");
const statsGrid = document.getElementById("statsGrid");
const totalAnswersEl = document.getElementById("totalAnswers");
const scannerLink = document.getElementById("scannerLink");
const scannerQrCanvas = document.getElementById("scannerQrCanvas");

const video = document.getElementById("camera");
const captureCanvas = document.getElementById("captureCanvas");
const cameraStatus = document.getElementById("cameraStatus");
const lastReadEl = document.getElementById("lastRead");
const sendReadBtn = document.getElementById("sendReadBtn");
const cardCanvas = document.getElementById("cardCanvas");
const downloadCardBtn = document.getElementById("downloadCardBtn");

const ANSWERS = ["A", "B", "C", "D"];
const CORRECT = "A";
const CARD_PAYLOAD = "QUIZ-CARD-V1";
const STORAGE_KEY = "quiz_counts_v1";
const CHANNEL_NAME = "quiz_scanner_channel";

const channel = "BroadcastChannel" in window ? new BroadcastChannel(CHANNEL_NAME) : null;

let counts = loadCounts();
let pendingRead = null;
let scanning = false;
let stream = null;

function showScreen(target) {
  Object.values(screens).forEach((screen) => screen.classList.remove("active"));
  target.classList.add("active");
}

function loadCounts() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { A: 0, B: 0, C: 0, D: 0 };
    const parsed = JSON.parse(raw);
    return {
      A: Number(parsed.A || 0),
      B: Number(parsed.B || 0),
      C: Number(parsed.C || 0),
      D: Number(parsed.D || 0),
    };
  } catch {
    return { A: 0, B: 0, C: 0, D: 0 };
  }
}

function saveCounts() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(counts));
}

function totalAnswers() {
  return ANSWERS.reduce((acc, key) => acc + counts[key], 0);
}

function percentFor(key) {
  const total = totalAnswers();
  if (!total) return 0;
  return (counts[key] / total) * 100;
}

function renderStats() {
  statsGrid.innerHTML = ANSWERS.map((key) => {
    const pct = percentFor(key).toFixed(1);
    return `
      <article class="stat-card">
        <p><strong>${key}</strong></p>
        <p>Respuestas: ${counts[key]}</p>
        <p>Porcentaje: ${pct}%</p>
      </article>
    `;
  }).join("");

  totalAnswersEl.textContent = `Total respuestas: ${totalAnswers()}`;
}

function addAnswer(answer) {
  if (!ANSWERS.includes(answer)) return;
  counts[answer] += 1;
  saveCounts();
  renderStats();

  if (channel) {
    channel.postMessage({ type: "counts-updated", counts });
  }
}

function resetCounts() {
  counts = { A: 0, B: 0, C: 0, D: 0 };
  saveCounts();
  renderStats();
  statusMsg.textContent = "";
  statusMsg.className = "status";

  if (channel) {
    channel.postMessage({ type: "counts-updated", counts });
  }
}

function evaluateQuestion() {
  const total = totalAnswers();
  if (total === 0) {
    statusMsg.textContent = "No hay respuestas todavía.";
    statusMsg.className = "status fail";
    return;
  }

  const correctRatio = counts[CORRECT] / total;
  if (correctRatio > 0.5) {
    statusMsg.textContent = `EXITO: ${
      (correctRatio * 100).toFixed(1)
    }% eligió la correcta (${CORRECT}).`;
    statusMsg.className = "status ok";
  } else {
    statusMsg.textContent = `FALLO: solo ${(correctRatio * 100).toFixed(
      1
    )}% eligió la correcta (${CORRECT}).`;
    statusMsg.className = "status fail";
  }
}

function setupScannerLink() {
  const url = new URL(window.location.href);
  url.searchParams.set("mode", "scanner");
  scannerLink.href = url.toString();
  scannerLink.textContent = url.toString();

  drawQrWithFallback(scannerQrCanvas, url.toString(), 220);
}

async function drawQrWithFallback(targetCanvas, text, size) {
  if (!targetCanvas) return false;
  const ctx = targetCanvas.getContext("2d");
  targetCanvas.width = size;
  targetCanvas.height = size;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, size, size);

  if (window.QRCode?.toCanvas) {
    try {
      await window.QRCode.toCanvas(targetCanvas, text, { width: size, margin: 1 });
      return true;
    } catch {
      // Fall through to image provider fallback.
    }
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      ctx.drawImage(img, 0, 0, size, size);
      resolve(true);
    };
    img.onerror = () => resolve(false);
    img.src = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(
      text
    )}`;
  });
}

async function setupCardCanvas() {
  if (!cardCanvas) return;

  const ctx = cardCanvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, cardCanvas.width, cardCanvas.height);

  ctx.fillStyle = "#111";
  ctx.font = "bold 20px Trebuchet MS";
  ctx.fillText("Tarjeta Quiz", 96, 30);

  const qrCanvas = document.createElement("canvas");
  const drawn = await drawQrWithFallback(qrCanvas, CARD_PAYLOAD, 240);
  if (!drawn) {
    ctx.fillStyle = "#bd1e1e";
    ctx.font = "bold 14px Trebuchet MS";
    ctx.fillText("Error generando QR de la tarjeta", 52, 220);
    return;
  }

  ctx.drawImage(qrCanvas, 40, 60);

  ctx.fillStyle = "#111";
  ctx.font = "bold 28px Trebuchet MS";
  ctx.fillText("A", 148, 52);
  ctx.fillText("B", 286, 188);
  ctx.fillText("C", 148, 350);
  ctx.fillText("D", 12, 188);

  ctx.font = "14px Trebuchet MS";
  ctx.fillText("Gira la tarjeta para responder A/B/C/D", 40, 388);
  ctx.fillText("Mantener centrada al escanear", 84, 406);
}

function getOrientationFromLocation(location) {
  const vx = location.topRightCorner.x - location.topLeftCorner.x;
  const vy = location.topRightCorner.y - location.topLeftCorner.y;

  const angle = Math.atan2(vy, vx) * (180 / Math.PI);

  if (angle >= -45 && angle < 45) return "A";
  if (angle >= 45 && angle < 135) return "B";
  if (angle >= -135 && angle < -45) return "D";
  return "C";
}

function tickScanner() {
  if (!scanning) return;
  if (!video.videoWidth || !video.videoHeight) {
    requestAnimationFrame(tickScanner);
    return;
  }

  captureCanvas.width = video.videoWidth;
  captureCanvas.height = video.videoHeight;

  const ctx = captureCanvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(video, 0, 0, captureCanvas.width, captureCanvas.height);

  const imageData = ctx.getImageData(0, 0, captureCanvas.width, captureCanvas.height);
  const code = jsQR(imageData.data, imageData.width, imageData.height);

  if (code && code.data === CARD_PAYLOAD) {
    pendingRead = getOrientationFromLocation(code.location);
    lastReadEl.textContent = pendingRead;
    sendReadBtn.disabled = false;
  }

  requestAnimationFrame(tickScanner);
}

async function startCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    cameraStatus.textContent = "Cámara no soportada por este navegador.";
    return;
  }

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
      audio: false,
    });
    video.srcObject = stream;
    cameraStatus.textContent = "Cámara activa";
    scanning = true;
    requestAnimationFrame(tickScanner);
  } catch {
    cameraStatus.textContent = "No se pudo abrir la cámara (permisos).";
  }
}

function stopCamera() {
  scanning = false;
  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
    stream = null;
  }
}

function initBroadcastSync() {
  if (!channel) return;

  channel.onmessage = (event) => {
    const msg = event.data;
    if (!msg || typeof msg !== "object") return;

    if (msg.type === "add-answer" && ANSWERS.includes(msg.answer)) {
      addAnswer(msg.answer);
      return;
    }

    if (msg.type === "counts-updated" && msg.counts) {
      counts = {
        A: Number(msg.counts.A || 0),
        B: Number(msg.counts.B || 0),
        C: Number(msg.counts.C || 0),
        D: Number(msg.counts.D || 0),
      };
      saveCounts();
      renderStats();
    }
  };
}

function initEvents() {
  startBtn?.addEventListener("click", () => {
    showScreen(screens.quiz);
  });

  confirmBtn?.addEventListener("click", evaluateQuestion);
  resetBtn?.addEventListener("click", resetCounts);

  document.querySelectorAll("[data-manual]").forEach((btn) => {
    btn.addEventListener("click", () => addAnswer(btn.dataset.manual));
  });

  sendReadBtn?.addEventListener("click", () => {
    if (!pendingRead) return;

    const mode = new URLSearchParams(window.location.search).get("mode");
    if (channel) {
      channel.postMessage({ type: "add-answer", answer: pendingRead });
    }

    // In scanner mode, let the quiz screen process the answer to avoid double counts.
    if (mode !== "scanner" || !channel) {
      addAnswer(pendingRead);
    }

    pendingRead = null;
    sendReadBtn.disabled = true;
  });

  downloadCardBtn?.addEventListener("click", () => {
    try {
      const link = document.createElement("a");
      link.download = "tarjeta-quiz-qr.png";
      link.href = cardCanvas.toDataURL("image/png");
      link.click();
    } catch {
      alert("No se pudo exportar PNG en este navegador. Haz captura de pantalla.");
    }
  });

  window.addEventListener("beforeunload", stopCamera);
}

function initByMode() {
  const mode = new URLSearchParams(window.location.search).get("mode");
  if (mode === "scanner") {
    showScreen(screens.scanner);
    startCamera();
  } else {
    showScreen(screens.cover);
    stopCamera();
  }
}

function init() {
  renderStats();
  setupScannerLink();
  setupCardCanvas();
  initEvents();
  initBroadcastSync();
  initByMode();
}

window.addEventListener("DOMContentLoaded", init);
