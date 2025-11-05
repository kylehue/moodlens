document.addEventListener("DOMContentLoaded", () => {
   const toggles = document.querySelectorAll(".toggle");
   const filterBtn = document.getElementById("filterBtn");
   const autoFilter = document.getElementById("autoFilter");

   // load saved state
   chrome.storage.sync.get(["moods", "autoFilter"], (data) => {
      if (data.moods) {
         toggles.forEach((t) => {
            if (data.moods.includes(t.dataset.mood)) {
               t.classList.add("active");
            } else {
               t.classList.remove("active");
            }
         });
      }

      if (typeof data.autoFilter === "boolean") {
         autoFilter.checked = data.autoFilter;
         filterBtn.disabled = data.autoFilter;
      }
   });

   // toggle active/inactive moods
   toggles.forEach((t) =>
      t.addEventListener("click", () => {
         t.classList.toggle("active");
         saveState();
      })
   );

   // handle auto-filter toggle
   autoFilter.addEventListener("change", () => {
      filterBtn.disabled = autoFilter.checked;
      saveState();
   });

   // handle manual filter click
   filterBtn.addEventListener("click", () => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
         chrome.tabs.sendMessage(tabs[0].id, { action: "runFilter" });
      });
   });

   function saveState() {
      const moods = Array.from(toggles)
         .filter((t) => t.classList.contains("active"))
         .map((t) => t.dataset.mood);

      chrome.storage.sync.set({
         moods,
         autoFilter: autoFilter.checked,
      });

      console.log("MoodLens: Saved state", {
         moods,
         autoFilter: autoFilter.checked,
      });
   }
});
