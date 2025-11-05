const SITES_SELECTORS = {
   "https://www.youtube.com/": [
      "#contents > ytd-rich-item-renderer",
      "#contents > ytd-video-renderer",
      "#contents > yt-lockup-view-model",
      "ytm-shorts-lockup-view-model",
      "#contents > ytd-comment-thread-renderer",
      "#contents > ytd-comment-view-model",
   ],
   "https://www.reddit.com/": ["shreddit-feed > article"],
};

const API_URL = "http://localhost:5000/analyze_bulk";
const MOOD_THRESHOLD = 0.6;

let autoFilterInterval = null;
let debounceTimer = null;

function debounce(fn, delay = 1000) {
   return (...args) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => fn(...args), delay);
   };
}

function getSiteSelectors() {
   const site = Object.keys(SITES_SELECTORS).find((url) =>
      location.href.startsWith(url)
   );
   return SITES_SELECTORS[site] || [];
}

function blurElement(el, mood) {
   if (el.dataset.moodlensBlocked === "true") return;
   el.dataset.moodlensBlocked = "true";

   const wrapper = document.createElement("div");
   wrapper.style.filter = "blur(10px)";
   wrapper.style.transition = "filter 0.3s ease";
   wrapper.style.width = "100%";
   wrapper.style.height = "100%";

   while (el.firstChild) {
      wrapper.appendChild(el.firstChild);
   }

   el.appendChild(wrapper);

   const overlay = document.createElement("div");
   overlay.innerText = `This content is hidden by MoodLens\nDetected mood: ${mood}`;
   overlay.style.position = "absolute";
   overlay.style.top = "0";
   overlay.style.left = "0";
   overlay.style.right = "0";
   overlay.style.bottom = "0";
   overlay.style.display = "flex";
   overlay.style.alignItems = "center";
   overlay.style.justifyContent = "center";
   overlay.style.background = "rgba(0,0,0,0.6)";
   overlay.style.color = "white";
   overlay.style.fontSize = "16px";
   overlay.style.fontFamily = "Inter, sans-serif";
   overlay.style.textAlign = "center";
   overlay.style.padding = "20px";
   overlay.style.borderRadius = "8px";
   overlay.style.pointerEvents = "none";
   overlay.style.backdropFilter = "blur(3px)";

   el.style.position = "relative";
   el.appendChild(overlay);
}

function generateElementId(el) {
   if (el.dataset.moodlensId) return el.dataset.moodlensId;
   const id = Math.random().toString(36).substring(2, 10);
   el.dataset.moodlensId = id;
   return id;
}

async function _analyzeAndFilterContent(selectedMoods = []) {
   const selectors = getSiteSelectors();
   if (!selectors.length) return;

   const elements = selectors.flatMap((sel) =>
      Array.from(document.querySelectorAll(sel))
   );

   const unblocked = elements.filter(
      (el) =>
         el.dataset.moodlensAnalyzed !== "true" &&
         el.dataset.moodlensBlocked !== "true" &&
         el.textContent?.trim().length >= 10
   );

   if (unblocked.length === 0) return;

   console.log(`MoodLens: Sending ${unblocked.length} elements for analysis.`);

   const elementMap = Object.fromEntries(
      unblocked.map((item) => [generateElementId(item), item])
   );

   const payload = Object.entries(elementMap).map(([id, el]) => ({
      id,
      text: el.textContent.trim(),
   }));

   try {
      const res = await fetch(API_URL, {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({ items: payload }),
      });

      const results = await res.json();
      if (!Array.isArray(results)) return console.error("Invalid API response");

      results.forEach((result) => {
         const { id, scores } = result;
         const el = elementMap[id];
         if (!el) return;
         el.dataset.moodlensAnalyzed = "true";

         const moods = Object.entries(scores)
            .sort((a, b) => b[1] - a[1])
            .filter(
               ([mood, score]) =>
                  score >= MOOD_THRESHOLD && selectedMoods.includes(mood)
            );
         if (moods.length === 0) return;
         blurElement(el, moods.map(([mood]) => mood).join(", "));
      });
   } catch (err) {
      console.error("MoodLens API Error:", err);
   }
}

// wrap server calls with debounce
const analyzeAndFilterContent = debounce(_analyzeAndFilterContent, 1200);

// start or stop auto filter efficiently
function manageAutoFilter(autoFilterEnabled, moods) {
   if (autoFilterEnabled) {
      console.log("MoodLens: Auto-filter activated.");
      if (autoFilterInterval) clearInterval(autoFilterInterval);
      autoFilterInterval = setInterval(() => {
         chrome.storage.sync.get(["moods"], (data) => {
            analyzeAndFilterContent(data.moods || []);
         });
      }, 1000);
   } else {
      if (autoFilterInterval) {
         console.log("MoodLens: Auto-filter stopped.");
         clearInterval(autoFilterInterval);
         autoFilterInterval = null;
      }
   }
}

// initialization
chrome.storage.sync.get(["autoFilter", "moods"], (data) => {
   const moods = data.moods || [];
   manageAutoFilter(data.autoFilter, moods);
});

// listen to manual trigger or autoFilter toggle
chrome.runtime.onMessage.addListener((msg) => {
   if (msg.action === "runFilter") {
      chrome.storage.sync.get(["moods"], (data) => {
         analyzeAndFilterContent(data.moods || []);
      });
   } else if (msg.action === "updateAutoFilter") {
      chrome.storage.sync.get(["autoFilter", "moods"], (data) => {
         manageAutoFilter(data.autoFilter, data.moods || []);
      });
   }
});
