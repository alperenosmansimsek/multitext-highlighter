document.addEventListener('DOMContentLoaded', () => {

  const elements = {
settingsToggle: document.getElementById('settingsToggle'),
settingsPanel: document.getElementById('settingsPanel'),
inputText: document.getElementById('inputText'),
miniClear: document.getElementById('miniClear'),
searchBtn: document.getElementById('searchBtn'),
clearAllBtn: document.getElementById('clearAllBtn'),
matchesBox: document.getElementById('matchesBox'),
asinCount: document.getElementById('asinCount'),
asinContainer: document.getElementById('asinContainer'),
copyAsinBtn: document.getElementById('copyAsinBtn'),
toggleActive: document.getElementById('toggleActive'),
toggleCase: document.getElementById('toggleCase'),
copyPageBtn: document.getElementById('copyPageBtn'),
toggleDiacritics: document.getElementById('toggleDiacritics')
};

let detectedAsinsList = [];

// Open/Close Settings Panel
elements.settingsToggle.addEventListener('click', () => {

  const isDisplayed = elements.settingsPanel.style.display === 'block';
  elements.settingsPanel.style.display = isDisplayed ? 'none' : 'block';
});

// Save/Load Selections
const saveSettings = () => {
chrome.storage.local.set({
active: elements.toggleActive.checked,
caseSensitive: elements.toggleCase.checked,
diacritics: elements.toggleDiacritics.checked,
text: elements.inputText.value
});

};

chrome.storage.local.get(['active', 'caseSensitive', 'diacritics', 'text', 'lastMatches', 'lastAsins'], (data) => {

  if (data.active !== undefined) elements.toggleActive.checked = data.active;
  if (data.caseSensitive !== undefined) elements.toggleCase.checked = data.caseSensitive;

if (data.diacritics !== undefined) elements.toggleDiacritics.checked = data.diacritics;

if (data.text !== undefined) elements.inputText.value = data.text;

if (data.lastMatches) renderMatches(data.lastMatches);

if (data.lastAsins) renderAsins(data.lastAsins);

});

[elements.toggleActive, elements.toggleCase, elements.toggleDiacritics].forEach(el => {

el.addEventListener('change', saveSettings);

});

// Copy Page Button Functionality

 elements.copyPageBtn.addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]?.id) {
        elements.copyPageBtn.textContent = '❌ No tab';
        setTimeout(() => { elements.copyPageBtn.textContent = '📄 COPY PAGE'; }, 1500);
        return;
      }

      // Loading göster
      elements.copyPageBtn.textContent = '⏳ Loading...';

      // allFrames: true → ana sayfa + TÜM iframe'lerde çalıştırır
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id, allFrames: true },
        func: () => {
          // ============================================
          // 1. Ana metin
          // ============================================
          let fullText = document.body.innerText || "";

          // ============================================
          // 2. Shadow DOM içindeki metinleri topla
          // ============================================
          function getShadowText(root) {
            let text = "";
            try {
              const allElements = root.querySelectorAll('*');
              allElements.forEach(el => {
                if (el.shadowRoot) {
                  text += "\n" + (el.shadowRoot.textContent || "");
                  text += getShadowText(el.shadowRoot);
                }
              });
            } catch(e) {}
            return text;
          }
          fullText += getShadowText(document);

          // ============================================
          // 3. contentDocument erişilebilen iframe'ler
          //    (same-origin iframe'ler için ek güvenlik)
          // ============================================
          try {
            const iframes = document.querySelectorAll('iframe');
            iframes.forEach(iframe => {
              try {
                const iDoc = iframe.contentDocument || iframe.contentWindow?.document;
                if (iDoc && iDoc.body) {
                  fullText += "\n" + (iDoc.body.innerText || "");
                }
              } catch(e) {}
            });
          } catch(e) {}

          // ============================================
          // 4. object/embed elementleri (nadir ama olabilir)
          // ============================================
          try {
            const objects = document.querySelectorAll('object, embed');
            objects.forEach(obj => {
              try {
                const oDoc = obj.contentDocument;
                if (oDoc && oDoc.body) {
                  fullText += "\n" + (oDoc.body.innerText || "");
                }
              } catch(e) {}
            });
          } catch(e) {}

          // ============================================
          // 5. user-select: none ile gizlenmiş metinler
          //    (CSS ile seçim engellenmiş olabilir)
          // ============================================
          try {
            const hiddenEls = document.querySelectorAll('[style*="user-select"]');
            hiddenEls.forEach(el => {
              const computed = window.getComputedStyle(el);
              if (computed.userSelect === 'none') {
                fullText += "\n" + (el.textContent || "");
              }
            });
          } catch(e) {}

          return fullText;
        }
      }, (results) => {
        // Hata kontrolü
        if (chrome.runtime.lastError || !results || results.length === 0) {
          elements.copyPageBtn.textContent = '❌ Error';
          setTimeout(() => { elements.copyPageBtn.textContent = '📄 COPY PAGE'; }, 1500);
          return;
        }

        // Tüm frame'lerden gelen metinleri birleştir
        let combinedText = "";
        results.forEach(frame => {
          if (frame && frame.result) {
            combinedText += frame.result + "\n";
          }
        });

        combinedText = combinedText.trim();

        if (combinedText) {
          elements.inputText.value = combinedText;
          saveSettings();

          // Kaç frame'den metin alındığını göster
          const frameCount = results.filter(f => f && f.result && f.result.trim()).length;
          elements.copyPageBtn.textContent = `✅ ${frameCount} frame(s)`;
          setTimeout(() => { elements.copyPageBtn.textContent = '📄 COPY PAGE'; }, 2000);
        } else {
          elements.copyPageBtn.textContent = '⚠️ Empty';
          setTimeout(() => { elements.copyPageBtn.textContent = '📄 COPY PAGE'; }, 1500);
        }
      });
    });
  });

// Stopwords - words to ignore (counted as 0)

const STOPWORDS = new Set([

// Alphabet letters

"a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m",

"n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z",

// Numbers as words (1-10)

"one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",

// Articles & Determiners

"the", "an", "any", "some", "this", "that", "these", "those", "each", "every",

"all", "both", "few", "more", "most", "other", "such", "own", "same",

// Auxiliary verbs

"be", "been", "being", "have", "has", "had", "do", "does", "did",

// Conjunctions

"and", "or", "but", "nor", "so", "yet", "because", "although",

"though", "while", "whereas", "unless", "since", "until", "if", "when", "where", "after", "before", "once", "as", "than",

// Prepositions

"to", "of", "in", "for", "on", "with", "at", "by", "from", "as",

"into", "through", "during", "before", "after", "above", "below",

"between", "under", "over", "about", "against", "among", "around", "within", "without", "toward", "towards", "upon", "along", "across",

// Common verbs

"is", "are", "was", "were", "be", "been", "being",

"have", "has", "had", "do", "does", "did",

"will", "would", "could", "should", "may", "might", "shall", "can", "must",

// Pronouns

"it", "its", "this", "that", "these", "those",

"he", "she", "they", "we", "you", "me", "him", "her", "us", "them",

// Adverbs & Others

"not", "no", "very", "just", "also", "only", "then", "than",

"too", "so", "always", "never", "often", "again", "further",

"here", "there", "when", "where", "why", "how",

"all", "each", "every", "both", "few", "more", "most",

"other", "some", "such", "own", "same",

"what", "which", "who", "whom",

// numbers

"one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",

"eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty",

"1", "2", "3", "4", "5", "6", "7", "8", "9", "10","11","12","13","14","15","16","17","18","19","20",

"21","22","23","24","25","26","27","28","29","30","31","32","33","34","35","36","37","38","39","40",

"41","42","43","44","45","46","47","48","49","50","51","52","53","54","55","56","57","58","59","60",

"61","62","63","64","65","66","67","68","69","70","71","72","73","74","75","76","77","78","79","80",

"81","82","83","84","85","86","87","88","89","90","91","92","93","94","95","96","97","98","99","100",

"101","102","103","104","105","106","107","108","109","110","111","112","113","114","115","116","117","118","119","120",

"121","122","123","124","125","126","127","128","129","130","131","132","133","134","135","136","137","138","139","140",

"141","142","143","144","145","146","147","148","149","150","151","152","153","154","155","156","157","158","159","160",

"161","162","163","164","165","166","167","168","169","170","171","172","173","174","175","176","177","178","179","180",

"181","182","183","184","185","186","187","188","189","190","191","192","193","194","195","196","197","198","199","200",

"201","202","203","204","205","206","207","208","209","210","211","212","213","214","215","216","217","218","219","220",

"221","222","223","224","225","226","227","228","229","230","231","232","233","234","235","236","237","238","239","240",

"241","242","243","244","245","246","247","248","249","250","251","252","253","254","255","256","257","258","259","260",

"261","262","263","264","265","266","267","268","269","270","271","272","273","274","275","276","277","278","279","280",

"281","282","283","284","285","286","287","288","289","290","291","292","293","294","295","296","297","298","299","300",

"301","302","303","304","305","306","307","308","309","310","311","312","313","314","315","316","317","318","319","320",

"321","322","323","324","325","326","327","328","329","330","331","332","333","334","335","336","337","338","339","340",

"341","342","343","344","345","346","347","348","349","350","351","352","353","354","355","356","357","358","359","360",

"361","362","363","364","365","366","367","368","369","370","371","372","373","374","375","376","377","378","379","380",

"381","382","383","384","385","386","387","388","389","390","391","392","393","394","395","396","397","398","399","400",

"401","402","403","404","405","406","407","408","409","410",

// Commonly ignored words in e-commerce context

"product", "products", "item", "items", "listing", "listings", "page", "pages","seller", "sellers", "vendor", "vendors", "manufacturer", "manufacturers",

"use", "used", "using", "useful", "usefully", "usefulness", "uses", "used", "user", "users",

"contact", "contacts", "contacted", "contacting", "contactable", "contactless",

"support", "supports", "supported", "supporting", "supportive", "supporter", "supporters",

"help", "helps", "helped", "helping", "helpful", "helpless", "helper", "helpers",

"service", "services", "serviced", "servicing", "servicable", "serviceless",

// Custom ignored words

"different", "full", "restrict", "please", "mention", "example",

"whether", "similar", "brand", "brands", "particular", "section",

"category", "categories", "product", "products", "ASIN", "ASINs", "item", "items", "listing", "listings", "page", "pages",

"seller", "sellers", "vendor", "vendors", "manufacturer", "manufacturers",

"use", "used", "using", "useful", "usefully", "usefulness", "uses", "used", "user", "users",

"contact", "contacts", "contacted", "contacting", "contactable", "contactless",

"support", "supports", "supported", "supporting", "supportive", "supporter", "supporters",

"help", "helps", "helped", "helping", "helpful", "helpless", "helper", "helpers",

"service", "services", "serviced", "servicing", "servicable", "serviceless",

"country", "countries","contact", "contacts", "contacted", "contacting", "contactable", "contactless",

"support", "supports", "supported", "supporting", "supportive", "supporter", "supporters",

"help", "helps", "helped", "helping", "helpful", "helpless", "helper", "helpers",

"contact", "contacts", "contacted", "contacting", "contactable", "contactless",

"support", "supports", "supported", "supporting", "supportive", "supporter", "supporters",

"DE", "FR", "IT", "ES", "UK", "US", "CA", "AU", "TR", "JP", "BR", "MX", "IN", "AE", "SA", "SG", "NL", "BE", "PL", "SE", "CH", "AT", "DK", "FI", "NO", "IE",

"de", "fr", "it", "es", "uk", "us", "ca", "au", "tr", "jp", "br", "mx", "in", "ae", "sa", "sg", "nl", "be", "pl", "se", "ch", "at", "dk", "fi", "no", "ie",

"De", "Fr", "It", "Es", "Uk", "Us", "Ca", "Au", "Tr", "Jp", "Br", "Mx", "In", "Ae", "Sa", "Sg", "Nl", "Be", "Pl", "Se", "Ch", "At", "Dk", "Fi", "No", "Ie",

"Amazon", "amazon", "AMAZON", "sie", "Sie", "your","Your","Days","days","our","Our",

"company","Company","website","Website","email","Email","phone","Phone","address","Address",

"contact","Contact","support","Support","service","Service","help","Help",

"customer","Customer","team","Team","manager","Manager","representative","Representative",

"agent","Agent","specialist","Specialist","advisor","Advisor","consultant","Consultant",

"representatives","Representatives","agents","Agents","specialists","Specialists","advisors","Advisors","consultants","Consultants",

"case","Case","issue","Issue","problem","Problem","question","Question","inquiry","Inquiry",

"status","Status","update","Update","response","Response","reply","Reply",

"account","Account","order","Order","purchase","Purchase","transaction","Transaction",

"review","Review","feedback","Feedback","rating","Rating","comment","Comment",

"policy","Policy","terms","Terms","conditions","Conditions","agreement","Agreement",

"privacy","Privacy","security","Security","compliance","Compliance","regulation","Regulation",

"details","Details","information","Information","data","Data","documentation","Documentation",

"Asin","ASIN","asin","Asin","asins","Asin","ASINs","asin","Asin","ASIN","asin","Asin","ASIN","asin",

"take","Take","taken","Taken","taking","Taking","took","Took","took","Took",

"ago","Ago","before","Before","after","After","later","Later","earlier","Earlier",

"selected","select", "Select", "Selected","selecting","Selecting","selects","Selects","choose","Choose","choosing","Choosing",

"information","Information","details","Details","data","Data","documentation","Documentation",

"contact","Contact","contacts","Contacts","contacted","Contacted","contacting","Contacting",

"contactable","Contactable","contactless","Contactless","support","Support","supports","Supports",

"supported","Supported","supporting","Supporting","supportive","Supportive","supporter","Supporter",

"supporters","Supporters","help","Help","helps","Helps","helped","Helped",

"helping","Helping","helpful","Helpful","helpless","Helpless","helper","Helper",

"helpers","Helpers","service","Service","services","Services","serviced","Serviced",

"servicing","Servicing","servicable","Servicable","serviceless","Serviceless",

"Id","id","ID","Id","iD","iD","Id","iD","ID","id","appeal","Appeal","appeals","Appeals","appealed","Appealed","appealing","Appealing",

"appeals","Appeals","appealed","Appealed","appealing","Appealing","appealable","Appealable",

"appealless","Appealless","appealability","Appealability","appealabilities","Appealabilities",

"appealabilitys","Appealabilitys","ago","Ago","before","Before","after","After","later","Later","earlier","Earlier",

"amazon.de","amazon.fr","amazon.it","amazon.es","amazon.co.uk","amazon.com","amazon.ca","amazon.com.au","amazon.com.tr","amazon.co.jp","amazon.com.br","amazon.com.mx","amazon.in","amazon.ae","amazon.sa","amazon.sg","amazon.nl","amazon.be","amazon.pl","amazon.se","amazon.ch","amazon.at","amazon.dk","amazon.fi","amazon.no","amazon.ie",

"Amazon.de","Amazon.fr","Amazon.it","Amazon.es","Amazon.co.uk","Amazon.com","Amazon.ca","Amazon.com.au","Amazon.com.tr","Amazon.co.jp","Amazon.com.br","Amazon.com.mx","Amazon.in","Amazon.ae","Amazon.sa","Amazon.sg","Amazon.nl","Amazon.be","Amazon.pl","Amazon.se","Amazon.ch","Amazon.at","Amazon.dk","Amazon.fi","Amazon.no","Amazon.ie",

"Central","central","Center","center","Centre","centre","Centres","centres","Centers","centers",

"Marketplace","marketplace","Marketplaces","marketplaces","Market","market","Markets","markets",

"Seller","seller","Sellers","sellers","Vendor","vendor","Vendors","vendors",

"Language","language","Languages","languages","Lang","lang","Langs","langs",

"Country","country","Countries","countries","Nation","nation","Nations","nations",

"Region","region","Regions","regions","Area","area","Areas","areas",

"Yes","yes","No","no","Maybe","maybe","Not sure","not sure","Unsure","unsure","YES","YES","NO","NO","MAYBE","MAYBE","NOT SURE","NOT SURE","UNSURE","UNSURE",

"true","false","True","False","TRUE","FALSE","t","f","T","F",

"on","off","On","Off","ON","OFF",

]);

// Tokenizer Function (Punctuation Cleanup)

function tokenize(text) {

if (!text.trim()) return [];

const rawWords = text.trim().split(/\s+/);

const cleanedWords = rawWords.map(word => {

// Removes punctuation from start and end of words, preserves internal punctuation

return word.replace(/^[\p{P}\p{S}]+/u, '').replace(/[\p{P}\p{S}]+$/u, '');

}).filter(word => word.length > 0);

// Filter out stopwords

const filtered = cleanedWords.filter(w => !STOPWORDS.has(w.toLowerCase()));

return [...new Set(filtered)]; // Returns unique list

}

// ASIN Detector

function detectAsins(text) {

const asinRegex = /\b(B[0-9A-Z]{9})\b/g;

const matches = text.toUpperCase().match(asinRegex);

if (!matches) return [];

const unique = [...new Set(matches)];

return unique.filter(asin => /[0-9]/.test(asin.slice(1)));

}

// Render Matches in the UI

function renderMatches(matches) {

const validMatches = Object.entries(matches)

.filter(([_, count]) => count > 0)

.sort((a, b) => b[1] - a[1]);

if (validMatches.length === 0) {

elements.matchesBox.innerHTML = '<div class="empty-text">No active matches found.</div>';

return;

}

elements.matchesBox.innerHTML = validMatches.map(([word, count]) => `

<div class="match-item">

<span class="match-word"><strong>${word}</strong></span>

<span class="match-count">${count}</span>

</div>

`).join('');

}

function renderAsins(asins) {

detectedAsinsList = asins;

elements.asinCount.textContent = asins.length;

if (asins.length === 0) {

elements.asinContainer.innerHTML = '<div class="empty-text">No ASINs detected.</div>';

elements.asinContainer.classList.add('empty-text');

} else {

elements.asinContainer.innerHTML = `<div class="asin-list">${asins.map(a => `<span class="asin-tag">${a},</span>`).join('')}</div>`;

elements.asinContainer.classList.remove('empty-text');

}

}

// Cleaning Input and Resetting Matches

elements.miniClear.addEventListener('click', () => {

elements.inputText.value = '';

saveSettings();

});

elements.clearAllBtn.addEventListener('click', () => {

elements.inputText.value = '';

elements.matchesBox.innerHTML = '<div class="empty-text">No active matches found.</div>';

elements.asinCount.textContent = '0';

elements.asinContainer.innerHTML = '<div class="empty-text">No ASINs detected.</div>';

elements.asinContainer.classList.add('empty-text');

detectedAsinsList = [];

chrome.storage.local.remove(['text', 'lastMatches', 'lastAsins']);

chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {

if (tabs[0]?.id) {

chrome.tabs.sendMessage(tabs[0].id, { action: "clear" });

}

});

});

// Search and Highlight Matches

elements.searchBtn.addEventListener('click', () => {

saveSettings();

const text = elements.inputText.value;

const tokens = tokenize(text);

const asins = detectAsins(text);

renderAsins(asins);

chrome.storage.local.set({ lastAsins: asins });

if (tokens.length === 0) {

elements.matchesBox.innerHTML = '<div class="empty-text">No active matches found.</div>';

return;

}

chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {

if (!tabs[0]?.id) return;

chrome.tabs.sendMessage(tabs[0].id, {

action: "highlight",

words: tokens,

options: {

active: elements.toggleActive.checked,

caseSensitive: elements.toggleCase.checked,

diacritics: elements.toggleDiacritics.checked

}

}, (response) => {

if (chrome.runtime.lastError) {

elements.matchesBox.innerHTML = '<div class="empty-text" style="color:red;">Error: Please refresh the page and try again.</div>'; return;

}

if (response && response.counts) {

renderMatches(response.counts);

chrome.storage.local.set({ lastMatches: response.counts });

}

});

});

});

// The copy button functionality for ASINs

elements.copyAsinBtn.addEventListener('click', () => {

if (detectedAsinsList.length === 0) return;

const textToCopy = detectedAsinsList.join(', ');

navigator.clipboard.writeText(textToCopy).then(() => {

const originalText = elements.copyAsinBtn.textContent;

elements.copyAsinBtn.textContent = '✅';

setTimeout(() => elements.copyAsinBtn.textContent = originalText, 1000);

});

});

});