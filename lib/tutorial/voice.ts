// ============================================================
// Web Speech API wrapper for tutorial voice narration
// ============================================================
// SSR-safe: all window/speechSynthesis access is guarded.
// ============================================================

let voicesLoaded = false;
let cachedVoice: SpeechSynthesisVoice | null = null;

function loadVoices(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  if (cachedVoice) return cachedVoice;

  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return null;

  // Prefer a local English voice (sounds most natural)
  const preferred =
    voices.find((v) => v.lang.startsWith("en") && v.localService) ??
    voices.find((v) => v.lang.startsWith("en-GB")) ??
    voices.find((v) => v.lang.startsWith("en")) ??
    null;

  cachedVoice = preferred;
  return preferred;
}

/** Initialise voice cache once voices are ready (Chrome loads them async). */
export function initVoices(): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  if (voicesLoaded) return;

  const tryLoad = () => {
    loadVoices();
    voicesLoaded = true;
  };

  if (window.speechSynthesis.getVoices().length > 0) {
    tryLoad();
  } else {
    window.speechSynthesis.addEventListener("voiceschanged", tryLoad, { once: true });
  }
}

/** Speak a string. Cancels any currently playing utterance first. */
export function speak(text: string, onEnd?: () => void): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.92;
  utterance.pitch = 1.0;
  utterance.volume = 0.9;

  const voice = loadVoices();
  if (voice) utterance.voice = voice;

  if (onEnd) utterance.onend = onEnd;

  // Chrome bug: speech sometimes cuts off on long strings.
  // Wrapping in a small timeout mitigates it.
  setTimeout(() => {
    window.speechSynthesis.speak(utterance);
  }, 50);
}

/** Cancel any currently playing utterance. */
export function stopSpeech(): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
}
