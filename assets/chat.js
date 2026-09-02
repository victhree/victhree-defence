/* VicThree Defence — study-support chat widget
   ------------------------------------------------------------------
   Talks to the SEPARATE chatbot Worker (its own Gemini key).
   Config below: set the Worker URL, and (later) the master-site
   Google Form for lead capture.
   ------------------------------------------------------------------ */
(function () {
  "use strict";

  var CONFIG = {
    // Cloudflare Worker URL for the chatbot. If you name the Worker
    // "victhree-defence-ai" in the same account, this is already correct.
    endpoint: "https://victhree-defence-ai.anmolxsharma.workers.dev",

    // Lead capture -> a NEW Google Form/Sheet for the master site.
    // Fill action + the three entry ids to switch the "Get batch details"
    // button ON. Left blank, the button stays hidden (no broken promise).
    leadForm: {
      action: "",
      fields: { name: "", phone: "", email: "" }
    }
  };

  var GREETING =
    "Jai Hind! Good to have you here. May I know your name? And what is the biggest challenge you're facing in your preparation? Let's get your journey started.";

  var CHIPS = [
    "My GS score won't improve",
    "Where do I even start?",
    "I'm nervous about the SSB",
    "How does the course work?"
  ];

  // conversation history sent to the Worker (user + assistant only)
  var history = [];
  var busy = false;
  var started = false;

  // ---------- build DOM ----------
  var launch = el("button", { id: "vt-launch", "aria-label": "Open the VicThree Defence mentor chat" });
  launch.innerHTML = icon("chat") + '<span class="vt-l-txt">Ask the mentor</span>';

  var panel = el("div", { id: "vt-panel", role: "dialog", "aria-label": "VicThree Defence mentor chat", hidden: "" });
  panel.innerHTML =
    '<div class="vt-head">' +
      '<img class="vt-head-banner" src="assets/banner-wordmark.png?v=19" alt="VicThree Defence by Anmol Sharma">' +
      '<button class="vt-close" aria-label="Close chat">&times;</button>' +
    '</div>' +
    '<div class="vt-msgs" id="vt-msgs" aria-live="polite"></div>' +
    '<div class="vt-chips" id="vt-chips"></div>' +
    '<form class="vt-input" id="vt-form">' +
      '<textarea id="vt-in" rows="1" placeholder="Ask about your preparation…" aria-label="Message"></textarea>' +
      '<button type="submit" class="vt-send" aria-label="Send">' + icon("send") + '</button>' +
    '</form>' +
    '<div class="vt-foot">' +
      '<button id="vt-lead-btn" class="vt-lead-btn" hidden>Get batch details</button>' +
      '<span class="vt-dis">Guidance only. Fees &amp; dates: please enquire.</span>' +
    '</div>' +
    '<div class="vt-lead" id="vt-lead" hidden>' +
      '<div class="vt-lead-card">' +
        '<h4>Get current batch details</h4>' +
        '<p>Leave your details and the team will reach out with fees and the next batch date. No spam.</p>' +
        '<input id="vt-lead-name" placeholder="Name" autocomplete="name">' +
        '<input id="vt-lead-phone" placeholder="Phone / WhatsApp" autocomplete="tel" inputmode="tel">' +
        '<input id="vt-lead-email" placeholder="Email" autocomplete="email" inputmode="email">' +
        '<div class="vt-lead-actions">' +
          '<button type="button" class="vt-lead-cancel">Cancel</button>' +
          '<button type="button" class="vt-lead-ok">Send</button>' +
        '</div>' +
        '<p class="vt-lead-note" hidden>Thank you. The team will reach out shortly.</p>' +
      '</div>' +
    '</div>';

  document.body.appendChild(launch);
  document.body.appendChild(panel);

  var msgs = panel.querySelector("#vt-msgs");
  var chips = panel.querySelector("#vt-chips");
  var form = panel.querySelector("#vt-form");
  var input = panel.querySelector("#vt-in");
  var sendBtn = form.querySelector(".vt-send");
  var leadBtn = panel.querySelector("#vt-lead-btn");
  var leadOverlay = panel.querySelector("#vt-lead");

  if (CONFIG.leadForm && CONFIG.leadForm.action) leadBtn.hidden = false;

  // ---------- open / close ----------
  function open() {
    panel.hidden = false;
    launch.classList.add("vt-hidden");
    if (!started) { started = true; addBot(GREETING); renderChips(); }
    setTimeout(function () { input.focus(); }, 60);
  }
  function close() { panel.hidden = true; launch.classList.remove("vt-hidden"); }
  launch.addEventListener("click", open);
  panel.querySelector(".vt-close").addEventListener("click", close);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !panel.hidden) close(); });

  // ---------- chips ----------
  function renderChips() {
    chips.innerHTML = "";
    CHIPS.forEach(function (c) {
      var b = el("button", { "class": "vt-chip", type: "button" });
      b.textContent = c;
      b.addEventListener("click", function () { send(c); });
      chips.appendChild(b);
    });
  }
  function clearChips() { chips.innerHTML = ""; }

  // ---------- messages ----------
  function addBot(text) {
    var d = el("div", { "class": "vt-msg vt-bot" });
    d.innerHTML = format(text);
    msgs.appendChild(d); scrollDown(); return d;
  }
  function addUser(text) {
    var d = el("div", { "class": "vt-msg vt-user" });
    d.textContent = text;
    msgs.appendChild(d); scrollDown();
  }
  function showTyping() {
    var d = el("div", { "class": "vt-msg vt-bot vt-typing" });
    d.innerHTML = "<i></i><i></i><i></i>";
    msgs.appendChild(d); scrollDown(); return d;
  }
  function scrollDown() { msgs.scrollTop = msgs.scrollHeight; }

  // ---------- send ----------
  function send(text) {
    text = (text || input.value || "").trim();
    if (!text || busy) return;
    clearChips();
    addUser(text);
    history.push({ role: "user", content: text });
    input.value = ""; autosize();
    busy = true; sendBtn.disabled = true;
    var typing = showTyping();

    fetch(CONFIG.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "chat", messages: history })
    })
      .then(function (r) { return r.json().catch(function () { return {}; }); })
      .then(function (data) {
        typing.remove();
        var reply = data && data.reply;
        if (reply) {
          addBot(reply);
          history.push({ role: "assistant", content: reply });
        } else {
          addBot("I'm having trouble connecting right now. Please try again in a moment — or use the Contact section of the site to reach the team directly.");
        }
      })
      .catch(function () {
        typing.remove();
        addBot("I couldn't reach the server just now. Please try again shortly, or reach the team through the Contact section.");
      })
      .then(function () { busy = false; sendBtn.disabled = false; input.focus(); });
  }

  form.addEventListener("submit", function (e) { e.preventDefault(); send(); });
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  });
  input.addEventListener("input", autosize);
  function autosize() { input.style.height = "auto"; input.style.height = Math.min(input.scrollHeight, 120) + "px"; }

  // ---------- lead capture ----------
  leadBtn.addEventListener("click", function () { leadOverlay.hidden = false; });
  leadOverlay.querySelector(".vt-lead-cancel").addEventListener("click", function () { leadOverlay.hidden = true; });
  leadOverlay.querySelector(".vt-lead-ok").addEventListener("click", function () {
    var name = val("#vt-lead-name"), phone = val("#vt-lead-phone"), email = val("#vt-lead-email");
    if (!name || (!phone && !email)) { alert("Please add your name and a phone or email."); return; }
    var f = CONFIG.leadForm;
    if (f && f.action) {
      var body = new URLSearchParams();
      if (f.fields.name) body.append(f.fields.name, name);
      if (f.fields.phone) body.append(f.fields.phone, phone);
      if (f.fields.email) body.append(f.fields.email, email);
      fetch(f.action, { method: "POST", mode: "no-cors", body: body }).catch(function () {});
    }
    leadOverlay.querySelector(".vt-lead-note").hidden = false;
    setTimeout(function () {
      leadOverlay.hidden = true;
      leadOverlay.querySelector(".vt-lead-note").hidden = true;
      val("#vt-lead-name", ""); val("#vt-lead-phone", ""); val("#vt-lead-email", "");
    }, 1600);
  });

  // ---------- helpers ----------
  function el(tag, attrs) {
    var n = document.createElement(tag);
    if (attrs) for (var k in attrs) if (attrs.hasOwnProperty(k)) n.setAttribute(k, attrs[k]);
    return n;
  }
  function val(sel, set) {
    var n = panel.querySelector(sel);
    if (set !== undefined) { n.value = set; return; }
    return (n.value || "").trim();
  }
  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  // Escape HTML, then render light markdown as clean text (no stray * symbols).
  function format(text) {
    var s = esc(text);
    s = s.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");   // **bold** -> bold
    s = s.replace(/__([^_\n]+)__/g, "<strong>$1</strong>");        // __bold__ -> bold
    s = s.replace(/^[ \t]*[\*\-•]\s+/gm, "• ");                // *, - bullets -> •
    s = s.replace(/\*/g, "");                                        // drop any leftover asterisks
    s = s.replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)])/g, function (u) {
      return '<a href="' + u + '" target="_blank" rel="noopener">' + u + "</a>";
    });
    return s;
  }
  function icon(name) {
    if (name === "chat") return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 5h16v11H9l-5 4z"/><path d="M8 10h8M8 13h5"/></svg>';
    if (name === "shield") return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 3l7 3v5c0 4.4-3 7.8-7 9-4-1.2-7-4.6-7-9V6z"/></svg>';
    if (name === "send") return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12h14M13 6l6 6-6 6"/></svg>';
    return "";
  }
})();
