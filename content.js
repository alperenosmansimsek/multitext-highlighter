let currentOptions = { active: true, caseSensitive: false, diacritics: false };
let targetWords = [];
let colorMap = {};
let observer = null;

const COLORS = [
  "#FFD700", "#FF6B6B", "#6BCB77", "#4D96FF",
  "#FF922B", "#CC5DE8", "#20C997", "#F06595",
  "#74C0FC", "#A9E34B", "#FFB703", "#3A86FF", "#FF006E", "#8338EC",
  "#FFBE0B", "#FB5607", "#FF006E", "#8338EC",
  "#3A86FF", "#FF006E", "#8338EC", "#FFBE0B"
];

// ==========================================================================
// COLOR MAP
// ==========================================================================
function generateColorMap(words) {
  colorMap = {};
  words.forEach((word, index) => {
    const key = currentOptions.caseSensitive ? word : word.toLowerCase();
    colorMap[key] = COLORS[index % COLORS.length];
  });
}

// ==========================================================================
// DIACRITICS
// ==========================================================================
function removeDiacritics(str) {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0142/g, "l").replace(/\u0141/g, "L");
}

// ==========================================================================
// IS WORD CHAR - word boundary check
// ==========================================================================
function isWordChar(ch) {
  if (!ch) return false;
  const code = ch.charCodeAt(0);

  // ASCII digits (0-9)
  if (code >= 48 && code <= 57) return true;
  // ASCII uppercase (A-Z)
  if (code >= 65 && code <= 90) return true;
  // ASCII lowercase (a-z)
  if (code >= 97 && code <= 122) return true;
  // Extended Latin (accented chars: é, ñ, ü, etc.)
  if (code >= 192 && code <= 687) return true;

  // --- CJK & Special Ranges: don't count as word characters ---
  // CJK Unified Ideographs (Chinese/Japanese/Korean): U+4E00 - U+9FFF
  if (code >= 0x4E00 && code <= 0x9FFF) return false;
  // CJK Compatibility Ideographs: U+F900 - U+FAFF
  if (code >= 0xF900 && code <= 0xFAFF) return false;
  // Hiragana: U+3040 - U+309F
  if (code >= 0x3040 && code <= 0x309F) return false;
  // Katakana: U+30A0 - U+30FF
  if (code >= 0x30A0 && code <= 0x30FF) return false;
  // CJK Punctuation (、。「」 etc.): U+3000 - U+303F
  if (code >= 0x3000 && code <= 0x303F) return false;
  // Fullwidth punctuation/symbols: U+FF00 - U+FFEF
  if (code >= 0xFF00 && code <= 0xFFEF) return false;
  // Korean Hangul: U+AC00 - U+D7AF
  if (code >= 0xAC00 && code <= 0xD7AF) return false;
  // Arabic: U+0600 - U+06FF
  if (code >= 0x0600 && code <= 0x06FF) return false;

  // Other Unicode letters and numbers (for broader language support)
  if (code > 687) return /[\p{L}\p{N}]/u.test(ch);

  return false;
}

// ==========================================================================
// PREPARE TEXT - prepare text for searching based on options (diacritics, case sensitivity)
// ==========================================================================
function prepareText(text) {
  let result = text;
  if (currentOptions.diacritics) {
    result = removeDiacritics(result);
  }
  if (!currentOptions.caseSensitive) {
    result = result.toLowerCase();
  }
  return result;
}

// ==========================================================================
// COUNT WORDS
// ==========================================================================
function countWords() {
  const pageText = document.body.innerText || "";
  const searchPage = prepareText(pageText);
  const counts = {};

  targetWords.forEach(word => {
    const key = prepareText(word);
    const keyLen = key.length;
    let count = 0;
    let startPos = 0;

    while (true) {
      const idx = searchPage.indexOf(key, startPos);
      if (idx === -1) break;

      const charBefore = idx > 0 ? searchPage[idx - 1] : " ";
      const charAfter = idx + keyLen < searchPage.length ? searchPage[idx + keyLen] : " ";

      if (!isWordChar(charBefore) && !isWordChar(charAfter)) {
        count++;
      }
      startPos = idx + keyLen;
    }

    counts[word] = count;
  });

  return counts;
}

// ==========================================================================
// HIGHLIGHT
// ==========================================================================
function highlightPage() {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode: function(node) {
      const parent = node.parentNode;
      if (!parent) return NodeFilter.FILTER_REJECT;
      const tag = parent.tagName;
      if (['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'NOSCRIPT'].includes(tag)) {
        return NodeFilter.FILTER_REJECT;
      }
      if (parent.classList && parent.classList.contains('mh-highlight')) {
        return NodeFilter.FILTER_REJECT;
      }
      if (!node.textContent.trim()) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });

  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);

  nodes.forEach(textNode => {
    const originalText = textNode.textContent;
    if (!originalText.trim()) return;

    const searchText = prepareText(originalText);

    // search for matches
    const allMatches = [];

    targetWords.forEach(word => {
      const key = prepareText(word);
      const keyLen = key.length;
      let startPos = 0;

      while (true) {
        const idx = searchText.indexOf(key, startPos);
        if (idx === -1) break;

        const charBefore = idx > 0 ? searchText[idx - 1] : " ";
        const charAfter = idx + keyLen < searchText.length ? searchText[idx + keyLen] : " ";

        if (!isWordChar(charBefore) && !isWordChar(charAfter)) {
          const colorKey = currentOptions.caseSensitive ? word : word.toLowerCase();
          allMatches.push({
            start: idx,
            end: idx + keyLen,
            color: colorMap[colorKey] || '#FFD700'
          });
        }
        startPos = idx + keyLen;
      }
    });

    if (allMatches.length === 0) return;

    // sort and merge overlapping matches
    allMatches.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));

    const finalMatches = [];
    let lastEnd = -1;
    for (let i = 0; i < allMatches.length; i++) {
      if (allMatches[i].start >= lastEnd) {
        finalMatches.push(allMatches[i]);
        lastEnd = allMatches[i].end;
      }
    }

    // create a document fragment to replace the text node
    const fragment = document.createDocumentFragment();
    let lastIndex = 0;

    for (let i = 0; i < finalMatches.length; i++) {
      const m = finalMatches[i];
      if (m.start > lastIndex) {
        fragment.appendChild(document.createTextNode(originalText.slice(lastIndex, m.start)));
      }
      const span = document.createElement('span');
      span.className = 'mh-highlight';
      span.style.backgroundColor = m.color;
      span.style.borderRadius = '3px';
      span.style.padding = '1px 2px';
      span.textContent = originalText.slice(m.start, m.end);
      fragment.appendChild(span);
      lastIndex = m.end;
    }

    if (lastIndex < originalText.length) {
      fragment.appendChild(document.createTextNode(originalText.slice(lastIndex)));
    }

    if (textNode.parentNode) {
      textNode.parentNode.replaceChild(fragment, textNode);
    }
  });
}

// ==========================================================================
// CLEAR HIGHLIGHTS
// ==========================================================================
function clearHighlights() {
  document.querySelectorAll('.mh-highlight').forEach(span => {
    const textNode = document.createTextNode(span.textContent);
    if (span.parentNode) {
      span.parentNode.replaceChild(textNode, span);
    }
  });
  document.body.normalize();
}

// ==========================================================================
// MESSAGE LISTENER - The model: popup sends a message, results are returned
// ==========================================================================
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "highlight") {
    // clear
    clearHighlights();

    // get the words and options from the request
    targetWords = request.words || [];
    currentOptions = request.options || { active: true, caseSensitive: false, diacritics: false };
    generateColorMap(targetWords);

    if (!currentOptions.active || targetWords.length === 0) {
      sendResponse({ counts: {} });
      return true;
    }

    // 1. first count the words
    const counts = countWords();

    // 2. after counting, highlight the page
    highlightPage();

    // 3. MutationObserver
    if (observer) observer.disconnect();
    observer = new MutationObserver(() => {
      observer.disconnect();
      highlightPage();
      observer.observe(document.body, { childList: true, subtree: true });
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // 4. return the counts to the popup
    sendResponse({ counts: counts });

  } else if (request.action === "clear") {
    if (observer) observer.disconnect();
    clearHighlights();
    targetWords = [];
    sendResponse({ status: "cleared" });
  }

  else if (request.action === "getPageText") {
    // Sayfadaki tüm görünür metni al (script/style hariç)
    const pageText = document.body.innerText || "";
    sendResponse({ text: pageText });
  }

  return true;
});

