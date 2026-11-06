// ======= JEDYNE MIEJSCE DO EDYCJI =======
// Wklej tu Production URL webhooka z n8n, zanim opublikujesz stronę na GitHub Pages.
const WEBHOOK_URL = "WKLEJ_TUTAJ_URL_WEBHOOKA";
// Musi być identyczny jak wartość pola "secret" sprawdzana po stronie n8n.
const SEKRET = "WKLEJ_TUTAJ_SEKRET";
// =========================================

const TIMEOUT_MS = 60000;
const MOCK_DELAY_MS = 800;

const WELCOME_MESSAGE =
  "Dzień dobry. Jestem wirtualnym asystentem informacyjnym. To wersja demonstracyjna, nie oficjalny czat kliniki. Mogę podać informacje o cenach, godzinach, zabiegach i zasadach wizyt. W czym mogę pomóc?";
const ERROR_MESSAGE = "Przepraszam, wystąpił błąd połączenia. Proszę spróbować ponownie za chwilę.";
const QUICK_QUESTIONS = ["Ile kosztuje przegląd?", "Godziny otwarcia", "Jak umówić wizytę?"];

// Tylko dla ?mock=1. Dane są celowo fikcyjne, żeby nikt nie wziął ich za prawdziwe.
const MOCK_REPLIES = [
  {
    pattern: /przegl|koszt|cen/i,
    reply:
      "[Tryb testowy] Przykładowa odpowiedź o cenach:\n\nPrzegląd: 000 zł\nHigienizacja: 000 zł\n\nTo nie są prawdziwe dane."
  },
  {
    pattern: /godzin|otwar/i,
    reply:
      "[Tryb testowy] Przykładowe godziny otwarcia:\n\nPoniedziałek-piątek: 00:00-00:00\nSobota: 00:00-00:00\n\nTo nie są prawdziwe dane."
  },
  {
    pattern: /um[oó]w|wizyt/i,
    reply:
      "[Tryb testowy] Przykładowa odpowiedź o umawianiu wizyty:\n\n1. Pierwszy krok.\n2. Drugi krok.\n3. Trzeci krok.\n\nTo nie są prawdziwe dane."
  }
];
const MOCK_FALLBACK_REPLIES = [
  "[Tryb testowy] Krótka przykładowa odpowiedź.",
  "[Tryb testowy] Dłuższa przykładowa odpowiedź do sprawdzenia zawijania tekstu i automatycznego przewijania. Na wąskim ekranie ten akapit powinien zająć kilka linii, a okno powinno samo przewinąć się do końca wiadomości.\n\nDrugi akapit po pustej linii.\nTrzecia linia zaraz pod drugą.\n\nTo nie są prawdziwe dane."
];

const params = new URLSearchParams(window.location.search);
const grupa = params.get("grupa") || "demo-publiczne";
const isMock = params.get("mock") === "1";
// Na telefonie nie przywracamy fokusu, żeby klawiatura nie zasłaniała odpowiedzi.
const canAutofocus = window.matchMedia("(hover: hover)").matches;

let sessionId = newSessionId();
let historiaRozmowy = [];
let activeRequest = null;
let quickQuestionsEl = null;
let mockFallbackIndex = 0;

const chatEl = document.getElementById("chat");
const formEl = document.getElementById("composer");
const inputEl = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const resetBtn = document.getElementById("resetBtn");

function newSessionId() {
  return "demo-" + Math.random().toString(36).slice(2, 10);
}

function formatCzas() {
  const teraz = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return pad(teraz.getHours()) + ":" + pad(teraz.getMinutes()) + ":" + pad(teraz.getSeconds());
}

function formatujHistorieRozmowy() {
  return historiaRozmowy
    .map((wpis) => "[" + wpis.czas + "] " + (wpis.rola === "bot" ? "BOT" : "UŻYTKOWNIK") + ": " + wpis.tekst)
    .join("\n");
}

function scrollToBottom() {
  chatEl.scrollTop = chatEl.scrollHeight;
}

function addMessage(text, sender, zapiszWHistorii = true) {
  const bubble = document.createElement("div");
  bubble.className = "bubble " + sender;
  bubble.textContent = text;
  chatEl.appendChild(bubble);
  scrollToBottom();

  if (zapiszWHistorii) {
    historiaRozmowy.push({
      rola: sender === "user" ? "uzytkownik" : "bot",
      tekst: text,
      czas: formatCzas()
    });
  }

  return bubble;
}

function addTyping() {
  const bubble = document.createElement("div");
  bubble.className = "bubble ai typing";
  bubble.textContent = "pisze...";
  chatEl.appendChild(bubble);
  scrollToBottom();
  return bubble;
}

function showQuickQuestions() {
  quickQuestionsEl = document.createElement("div");
  quickQuestionsEl.className = "quick-questions";

  QUICK_QUESTIONS.forEach((question) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = question;
    button.addEventListener("click", () => sendMessage(question));
    quickQuestionsEl.appendChild(button);
  });

  chatEl.appendChild(quickQuestionsEl);
  scrollToBottom();
}

function hideQuickQuestions() {
  if (quickQuestionsEl) {
    quickQuestionsEl.remove();
    quickQuestionsEl = null;
  }
}

function showWelcome() {
  addMessage(WELCOME_MESSAGE, "ai");
  showQuickQuestions();
}

function setBusy(busy) {
  inputEl.disabled = busy;
  sendBtn.disabled = busy;
  if (!busy && canAutofocus) inputEl.focus();
}

function resizeInput() {
  inputEl.style.height = "auto";
  const border = inputEl.offsetHeight - inputEl.clientHeight;
  inputEl.style.height = inputEl.scrollHeight + border + "px";
}

function getMockReply(text) {
  const match = MOCK_REPLIES.find((item) => item.pattern.test(text));
  if (match) return match.reply;

  const reply = MOCK_FALLBACK_REPLIES[mockFallbackIndex % MOCK_FALLBACK_REPLIES.length];
  mockFallbackIndex += 1;
  return reply;
}

async function getReply(text, signal) {
  const payload = {
    sessionId,
    message: text,
    secret: SEKRET,
    grupa,
    historia_rozmowy: formatujHistorieRozmowy()
  };

  if (isMock) {
    console.info("[mock] Do webhooka poszłoby:", { ...payload, secret: "(ukryty)" });
    await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY_MS));
    return getMockReply(text);
  }

  const response = await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal
  });

  if (!response.ok) {
    throw new Error("Zła odpowiedź serwera: " + response.status);
  }

  const data = await response.json();
  if (typeof data.reply !== "string" || !data.reply.trim()) {
    throw new Error("Odpowiedź webhooka nie zawiera pola reply.");
  }
  return data.reply;
}

async function sendMessage(text) {
  if (activeRequest) return;

  hideQuickQuestions();
  addMessage(text, "user");
  const typingBubble = addTyping();

  const request = new AbortController();
  activeRequest = request;
  setBusy(true);
  const timeoutId = setTimeout(() => request.abort(), TIMEOUT_MS);

  try {
    const reply = await getReply(text, request.signal);
    // Inny activeRequest oznacza, że w trakcie czekania kliknięto "Zacznij od nowa".
    if (activeRequest !== request) return;
    typingBubble.remove();
    addMessage(reply, "ai");
  } catch (err) {
    if (activeRequest !== request) return;
    console.error("Błąd komunikacji z chatbotem:", err);
    typingBubble.remove();
    addMessage(ERROR_MESSAGE, "ai error", false);
  } finally {
    clearTimeout(timeoutId);
    if (activeRequest === request) {
      activeRequest = null;
      setBusy(false);
    }
  }
}

function submitInput() {
  const text = inputEl.value.trim();
  if (!text || activeRequest) return;
  inputEl.value = "";
  resizeInput();
  sendMessage(text);
}

formEl.addEventListener("submit", (event) => {
  event.preventDefault();
  submitInput();
});

inputEl.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    submitInput();
  }
});

inputEl.addEventListener("input", resizeInput);

// Po otwarciu klawiatury lub obrocie telefonu ostatnia wiadomość ma zostać widoczna.
window.addEventListener("resize", scrollToBottom);

resetBtn.addEventListener("click", () => {
  const request = activeRequest;
  activeRequest = null;
  if (request) request.abort();

  sessionId = newSessionId();
  historiaRozmowy = [];
  chatEl.textContent = "";
  inputEl.value = "";
  resizeInput();
  setBusy(false);
  showWelcome();
});

showWelcome();
if (canAutofocus) inputEl.focus();
