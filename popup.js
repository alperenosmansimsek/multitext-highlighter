const wordsInput = document.getElementById("wordsInput");
const caseSensitiveToggle = document.getElementById("caseSensitiveToggle");
const diacriticsToggle = document.getElementById("diacriticsToggle");
const activeToggle = document.getElementById("activeToggle");
const statusDot = document.getElementById("statusDot");

let debounceTimer = null;

// 1. LOAD SAVED SETTINGS
document.addEventListener("DOMContentLoaded", async () => {
  const saved = await chrome.storage.local.get(["words", "caseSensitive", "diacritics", "active"]);
  if (saved.words) wordsInput.value = saved.words;
  if (saved.caseSensitive !== undefined) caseSensitiveToggle.checked = saved.caseSensitive;
  if (saved.diacritics !== undefined) diacriticsToggle.checked = saved.diacritics;
  if (saved.active !== undefined) activeToggle.checked = saved.active;
  updateStatus();
});

// 2. WRITE TO STORAGE WITH 300MS DEBOUNCE WHEN USER TYPES IN TEXTAREA
wordsInput.addEventListener("input", () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => saveAndApply(), 300);
});

// 3. TOGGLES — save and apply immediately when toggles change
caseSensitiveToggle.addEventListener("change", saveAndApply);
diacriticsToggle.addEventListener("change", saveAndApply);
activeToggle.addEventListener("change", () => {
  updateStatus();
  saveAndApply();
});

// 4. WRITE SETTINGS TO STORAGE - content script listens for changes and applies highlights accordingly
async function saveAndApply() {
  const active = activeToggle.checked;

  await chrome.storage.local.set({
    words: active ? wordsInput.value : "",
    caseSensitive: caseSensitiveToggle.checked,
    diacritics: diacriticsToggle.checked,
    active: active
  });
}

// 5. STATUS DOT - green if active, gray if inactive
function updateStatus() {
  if (statusDot) {
    statusDot.style.background = activeToggle.checked ? "#6BCB77" : "#ced4da";
  }
}