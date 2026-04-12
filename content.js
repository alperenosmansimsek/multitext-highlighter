// content.js

// 1. COLORS
const COLORS = [
  "#FFD700", "#FF6B6B", "#6BCB77", "#4D96FF",
  "#FF922B", "#CC5DE8", "#20C997", "#F06595",
  "#74C0FC", "#A9E34B" , "#FFB703", "#3A86FF", "#FF006E", "#8338EC",
  "#FFBE0B", "#FB5607", "#FF006E", "#8338EC",
  "#3A86FF", "#FF006E", "#8338EC", "#FFBE0B",
  "#FB5607", "#FF006E", "#8338EC", "#3A86FF", "#FF006E", "#8338EC", "#FFBE0B", "#FB5607",
];

// 2. STATE
let highlightMap = {};
let currentSettings = { caseSensitive: false, diacritics: true };
let observer = null;
let isProcessing = false;

// 3. INIT: load saved words and settings, apply highlights, and start observing DOM changes
async function init() {
  const saved = await chrome.storage.local.get(["words", "caseSensitive", "diacritics"]);
  if (saved.words && saved.words.trim()) {
    applyHighlights(saved.words, saved.caseSensitive, saved.diacritics);
  }
  startObserver();
}

// 4. MUTATION OBSERVER: watch for new nodes added to the DOM and apply highlights to them
function startObserver() {
  if (observer) observer.disconnect();

  observer = new MutationObserver((mutations) => {
    if (isProcessing) return;
    if (Object.keys(highlightMap).length === 0) return;

    const newNodes = [];
    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          newNodes.push(node);
        }
      });
    });

    if (newNodes.length > 0) {
      isProcessing = true;
      newNodes.forEach(node => walkTextNodes(node));
      isProcessing = false;
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  }); 
}

// 5.  listen for changes in storage and update highlights accordingly
chrome.storage.onChanged.addListener((changes) => {
  if (changes.words || changes.caseSensitive || changes.diacritics) {
    chrome.storage.local.get(["words", "caseSensitive", "diacritics"], (saved) => {
      clearHighlights();
      if (saved.words && saved.words.trim()) {
        applyHighlights(saved.words, saved.caseSensitive, saved.diacritics);
      }
    });
  }
});

// 6.  main function to apply highlights: prepare the highlight map based on user input, then walk through text nodes to apply highlights
function applyHighlights(rawText, caseSensitive = false, diacritics = true) {
  currentSettings = { caseSensitive, diacritics };
  
  highlightMap = {};
  let colorIndex = 0;

  const words = rawText.split(/\s+/).filter(w => w.length > 0);

  words.forEach(word => {
    const key = prepareWord(word, caseSensitive, diacritics);
    if (!highlightMap[key]) {
      highlightMap[key] = COLORS[colorIndex % COLORS.length];
      colorIndex++;
    }
  });

  isProcessing = true;
  walkTextNodes(document.body);
  isProcessing = false;
}

// 7. TEXT NODE WALKER 
function walkTextNodes(root) {
  if (!root) return;

  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "INPUT"].includes(parent.tagName)) {
          return NodeFilter.FILTER_REJECT;
        }
        if (parent.classList && parent.classList.contains("mh-highlight")) {
          return NodeFilter.FILTER_REJECT;
        }
        if (node.textContent.trim() === "") return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  const nodesToReplace = [];
  let node;
  while ((node = walker.nextNode())) {
    nodesToReplace.push(node);
  }
  nodesToReplace.forEach(node => replaceTextNode(node));
}


// 8. replace text node with highlighted spans: find matches, create a document fragment with text and span nodes, and replace the original text node
function replaceTextNode(textNode) {
  const originalText = textNode.textContent;
  const words = Object.keys(highlightMap);
  if (words.length === 0) return;

  const escapedWords = words.map(w => `(?<=[^\\w]|^)${escapeRegex(w)}(?=[^\\w]|$)`);
  const flags = currentSettings.caseSensitive ? "g" : "gi";
  const regex = new RegExp(`(${escapedWords.join("|")})`, flags);

  // Arama için metni hazırla
  const searchText = prepareText(originalText, currentSettings.caseSensitive, currentSettings.diacritics);

  const matches = [];
  let match;
  while ((match = regex.exec(searchText)) !== null) {
    const key = prepareWord(match[0], currentSettings.caseSensitive, currentSettings.diacritics);
    if (highlightMap[key]) {
      matches.push({
        start: match.index,
        end: match.index + match[0].length,
        color: highlightMap[key]
      });
    }
  }

  if (matches.length === 0) return;

  const fragment = document.createDocumentFragment();
  let lastIndex = 0;

  matches.forEach(({ start, end, color }) => {
    if (start > lastIndex) {
      fragment.appendChild(document.createTextNode(originalText.slice(lastIndex, start)));
    }
    const span = document.createElement("span");
    span.className = "mh-highlight";
    span.textContent = originalText.slice(start, end);
    span.style.backgroundColor = color;
    span.dataset.mhWord = originalText.slice(start, end);
    fragment.appendChild(span);
    lastIndex = end;
  });

  if (lastIndex < originalText.length) {
    fragment.appendChild(document.createTextNode(originalText.slice(lastIndex)));
  }

  if (textNode.parentNode) {
    textNode.parentNode.replaceChild(fragment, textNode);
  }
}

// 9. clear highlights: find all highlight spans, replace with original text, and normalize to merge adjacent text nodes
function clearHighlights() {
  document.querySelectorAll("span.mh-highlight").forEach(span => {
    const parent = span.parentNode;
    if (parent) {
      parent.replaceChild(document.createTextNode(span.textContent), span);
      parent.normalize();
    }
  });
  highlightMap = {};
}

// 10. utility functions: escape regex special characters, prepare word for matching, and prepare text for searching
function prepareText(text, caseSensitive, diacritics) {
  let result = text;
  if (diacritics) {
    result = result.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }
  if (!caseSensitive) {
    result = result.toLowerCase();
  }
  return result;
}

function prepareWord(word, caseSensitive, diacritics) {
  return prepareText(word, caseSensitive, diacritics ?? true);
}

// 11. REGEX ESCAPE
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// 12. listen for messages from the popup to clear highlights
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "clear") {
    clearHighlights();
    sendResponse({ status: "cleared" });
  }
});

// START THE EXTENSION
init();