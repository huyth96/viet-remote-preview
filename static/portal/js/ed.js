/* Việt Remote — ed.js: the A kit's one behaviour (static/portal/css/ed.css §12, the switcher).
   Load it only on a page with a switcher:  {% block extra_js %}<script src="{% asset 'portal/js/ed.js' %}" defer></script>{% endblock %}
   (Everything else the kit does — reveals, count-ups, lines that draw — is CSS + common.js VR.live.)

   THE SWITCHER: numbered rows drive ONE large preview.
     <div class="ed-switch" data-ed-switch>
       … <a class="ed-row [is-lit]" id="tab-x" href="/x/" data-ed-tab="view-x">…</a> …
       … <div class="ed-panel [is-on]" id="view-x">… <a class="rv-pill …" href="/x/">Mở …</a></div> …
     </div>
   Without JS, and under 1024 px: the rows are plain links, the stage shows the row marked .is-lit.
   From 1024 px the list becomes a vertical tablist (role=tab on each row, aria-selected, aria-controls, a roving
   tabindex; each panel a tabpanel labelled by its row):
     · a mouse resting on a row (90 ms, so a diagonal sweep to the stage changes nothing) cross-fades the stage to it,
       and a mouse click still opens that row's page (the row is a link, its preview is already showing);
     · touch and pen: the first tap selects, a tap on the selected row opens it;
     · keyboard: ↑ ↓ ← → Home End move and select, Enter opens the selected row's page, Tab goes on to the panel's pill;
     · Ctrl/⌘/Shift/Alt or middle clicks always open (a new tab, as on any link).
   The cross-fade itself is CSS (ed.css §12): 220 ms, instant under reduced motion and html.hm-lite.

   THE TWINS (the switcher's lighter mode, added at the integration): rows and their twins in one view share a key;
   pointing at, focusing or tapping one lights every element that names the key (.is-lit), so a row lights its phrase
   in a message, its tick on a job, its segment on an agenda, and back. Nothing hides, nothing moves.
     <div data-ed-twins="fee" [data-ed-hold]>
       … <button class="… is-lit" data-ed-k="fee" aria-pressed="true">…</button> … <mark data-ed-k="fee">…</mark> …
     </div>
   data-ed-twins: the key lit at rest ("" = none); data-ed-hold: the last pick stays when the pointer leaves (without
   it the view goes back to the key at rest). A twin may name several keys ("a b"); a <button> reports aria-pressed.
   window.edTwins(root) wires views a script builds later (the events agenda). */
(function () {
  "use strict";

  const WIDE = "(min-width: 1024px)";

  function init(root) {
    const tabs = Array.from(root.querySelectorAll("[data-ed-tab]"));
    const panels = tabs.map((tab) => document.getElementById(tab.dataset.edTab));
    if (tabs.length < 2 || panels.some((panel) => !panel)) return;
    const list = tabs[0].closest("ol, ul");
    const listRole = list.getAttribute("role");
    const label = root.dataset.edLabel || "";
    const mq = window.matchMedia ? window.matchMedia(WIDE) : null;
    let on = false;
    let current = Math.max(0, tabs.findIndex((tab) => tab.classList.contains("is-lit")));
    let pointer = "";
    let timer = 0;

    const show = (i) => {
      tabs.forEach((tab, j) => {
        const selected = j === i;
        tab.classList.toggle("is-lit", selected);
        panels[j].classList.toggle("is-on", selected);
        if (on) {
          tab.setAttribute("aria-selected", selected ? "true" : "false");
          tab.tabIndex = selected ? 0 : -1;
        }
      });
      current = i;
    };

    const enable = () => {
      if (on) return;
      on = true;
      list.setAttribute("role", "tablist");
      list.setAttribute("aria-orientation", "vertical");
      if (label) list.setAttribute("aria-label", label);
      tabs.forEach((tab, j) => {
        if (!tab.id) tab.id = panels[j].id + "-tab";
        tab.parentElement.setAttribute("role", "presentation");
        tab.setAttribute("role", "tab");
        tab.setAttribute("aria-controls", panels[j].id);
        panels[j].setAttribute("role", "tabpanel");
        panels[j].setAttribute("aria-labelledby", tab.id);
      });
      show(current);
    };

    const disable = () => {
      if (!on) return;
      on = false;
      clearTimeout(timer);
      if (listRole) list.setAttribute("role", listRole); else list.removeAttribute("role");
      list.removeAttribute("aria-orientation");
      list.removeAttribute("aria-label");
      tabs.forEach((tab, j) => {
        tab.parentElement.removeAttribute("role");
        ["role", "aria-selected", "aria-controls", "tabindex"].forEach((name) => tab.removeAttribute(name));
        panels[j].removeAttribute("role");
        panels[j].removeAttribute("aria-labelledby");
      });
    };

    tabs.forEach((tab, i) => {
      tab.addEventListener("pointerenter", (event) => {
        if (!on || event.pointerType !== "mouse") return;
        clearTimeout(timer);
        timer = setTimeout(() => { if (i !== current) show(i); }, 90);
      });
      tab.addEventListener("pointerleave", () => clearTimeout(timer));
      tab.addEventListener("pointerdown", (event) => { pointer = event.pointerType || "mouse"; });
      tab.addEventListener("pointercancel", () => { pointer = ""; });
      tab.addEventListener("focus", () => {
        // keyboard focus (or a screen reader's cursor) selects; a pointer's focus waits for its click
        if (on && !pointer && i !== current) show(i);
      });
      tab.addEventListener("click", (event) => {
        const by = pointer;
        pointer = "";
        if (!on || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        if (by === "mouse") return;            // the preview already followed the pointer: the click opens the page
        if (i === current) return;             // the selected row: open it
        event.preventDefault();
        clearTimeout(timer);
        show(i);
      });
      tab.addEventListener("keydown", (event) => {
        if (!on) return;
        const last = tabs.length - 1;
        let j = -1;
        if (event.key === "ArrowDown" || event.key === "ArrowRight") j = i === last ? 0 : i + 1;
        else if (event.key === "ArrowUp" || event.key === "ArrowLeft") j = i === 0 ? last : i - 1;
        else if (event.key === "Home") j = 0;
        else if (event.key === "End") j = last;
        else if (event.key === " " || event.key === "Spacebar") { event.preventDefault(); show(i); return; }
        if (j < 0) return;
        event.preventDefault();
        show(j);
        tabs[j].focus();
      });
    });

    document.addEventListener("keydown", () => { pointer = ""; }, true);   // a key press means the next focus is the keyboard's

    if (!mq) { enable(); return; }
    if (mq.matches) enable();
    const sync = () => (mq.matches ? enable() : disable());
    if (mq.addEventListener) mq.addEventListener("change", sync); else if (mq.addListener) mq.addListener(sync);
  }

  function twins(box) {
    if (box._edTwins) return;
    box._edTwins = true;
    const hold = box.hasAttribute("data-ed-hold");
    const keys = (el) => el.dataset.edK.split(/\s+/);
    let current = box.dataset.edTwins || "";
    const light = (k) => box.querySelectorAll("[data-ed-k]").forEach((el) => {
      const on = k !== "" && keys(el).includes(k);
      el.classList.toggle("is-lit", on);
      if (el.tagName === "BUTTON") el.setAttribute("aria-pressed", on ? "true" : "false");
    });
    const pick = (event) => {
      const el = event.target.closest && event.target.closest("[data-ed-k]");
      if (!el || !box.contains(el)) return;
      const k = keys(el)[0];
      if (hold) current = k;
      light(k);
    };
    const rest = () => light(hold ? current : (box.dataset.edTwins || ""));
    box.addEventListener("pointerover", pick);
    box.addEventListener("focusin", pick);
    box.addEventListener("click", pick);
    box.addEventListener("pointerleave", rest);
    box.addEventListener("focusout", (event) => { if (!box.contains(event.relatedTarget)) rest(); });
    light(current);
  }
  window.edTwins = (root) => (root || document).querySelectorAll("[data-ed-twins]").forEach(twins);

  const start = () => {
    document.querySelectorAll("[data-ed-switch]").forEach(init);
    window.edTwins();
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
