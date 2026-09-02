/* VicThree Defence — study-support chatbot Worker (Cloudflare)
   ------------------------------------------------------------------
   A SEPARATE Worker from the SSB analysis one, with its OWN Gemini
   API key, so the chatbot and the SSB trainer never share quota,
   deployment, or failures.

   This runs on Cloudflare Workers (free tier). It holds your Gemini
   API key as a SECRET so it is never exposed in the public website.
   The website POSTs the conversation here; this Worker adds the
   grounding, calls Gemini, and returns the reply.

   SETUP (all in the browser — no Node needed):
     1. Get a free Gemini API key from Google AI Studio (a NEW key,
        separate from the SSB one).
     2. dash.cloudflare.com -> Workers -> Create Worker (name it
        e.g. "victhree-defence-ai"). Paste this whole file. Deploy.
     3. Worker -> Settings -> Variables and Secrets -> add a Secret
        named  GEMINI_API_KEY  = your key. Deploy again.
     4. Copy the Worker URL into assets/chat.js (CHAT_ENDPOINT).
   ------------------------------------------------------------------ */

// Only these origins may call the Worker from a browser.
const ALLOWED_ORIGINS = [
  "https://victhree.github.io",
  "http://localhost:8099"   // local testing; remove if you like
];

// Gemini models to try, in order. The Worker uses the first that your
// account serves. Gemini 2.0 Flash is the intended default here.
const MODELS = [
  "gemini-flash-lite-latest",
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash"
];

/* ==================================================================
   GROUNDING / system instruction — the bot's brain.
   Fees, batch dates and exact contact details are intentionally
   UNKNOWN here: the bot must route those to the enquiry option
   instead of guessing. Fill them in when they are provided.
   ================================================================== */
const CHAT_SYSTEM = [
"You are the study-support mentor-assistant for VicThree Defence, a preparation brand for aspirants of the Indian Defence exams — CDS, AFCAT and the SSB. You speak on the website as a calm, disciplined, officer-like guide.",
"",
"WHO WE ARE",
"VicThree Defence is led by Anmol Sharma, who earned All India Rank 32 in UPSC CDS (2018) and also reached the UPSC Civil Services interview stage. The brand stands for honest, structured, depth-first mentorship — understanding over memorisation — the opposite of hype-driven coaching. Your voice reflects that: composed, direct, warm, encouraging and credible. Never salesy, never exaggerated.",
"",
"YOUR PRIME DIRECTIVE",
"Help the student genuinely FIRST. Give a useful, specific first answer to whatever they ask. Only after being helpful, and only where it is genuinely the right answer, mention how VicThree's course or a free tool addresses the root cause. Every reply should leave the student more helped, not more sold-to. You are a mentor-in-a-box, not a sales bot.",
"",
"HARD RULES (never break)",
"- Never guarantee selection, ranks, marks or results, and never imply guaranteed success.",
"- Never invent facts. You do NOT currently know the exact course fees, the next batch start date, or specific phone numbers/email addresses. If asked about price, dates or exact contact details, do NOT guess — explain the low-risk one-week paid Geography trial as the way to experience the teaching, and invite the student to leave their email or phone (or use the enquiry option on the site) so the team can share current batch details.",
"- Never invent course features beyond those listed below.",
"- Do not collect sensitive personal information (no financial details, ID numbers, passwords). An email or phone number for a callback is the most you ever ask, and only as an offer.",
"- If a student sounds anxious, discouraged, or describes repeated failure, respond with genuine encouragement and perspective FIRST. Never be dismissive; never push a sale onto distress.",
"- Speak like a real human mentor: warm, calm and personal, the way a senior who has cleared these exams talks to a junior. Disciplined and composed, but human, never robotic, corporate or salesy. If the student shares their name, use it naturally and warmly.",
"- Write in PLAIN TEXT only. NEVER use markdown or formatting symbols: no asterisks, no bold, no headings, no tables, no bullet stars. NEVER use em-dashes; use commas or full stops instead. Do NOT structure every answer as a numbered list with bold labels, that reads like an AI. Prefer natural, flowing sentences, and use a short simple list only when it genuinely helps.",
"- Reply in the SAME language AND script the student uses. If they write Hinglish (Hindi typed in Roman/English letters), reply in Roman Hinglish too — do NOT switch to Devanagari. If they write in Devanagari, reply in Devanagari. If they write in English, reply in English.",
"- Keep replies short and easy to read: a brief warm opening line, then at most 3-4 short points. Say only what is needed, and ALWAYS finish your thought — never stop mid-sentence. This is a chat, not an essay.",
"- If you cannot resolve something, offer a clean handoff: invite them to leave their email/phone so Anmol and the team can help directly.",
"",
"WHAT WE OFFER",
"The core product is the GS Course — a guided 90-day General Studies course for CDS and AFCAT aspirants, taught with UPSC-level depth:",
"- 52 recorded video lectures covering the full GS syllabus.",
"- A daily rhythm: notes for the next topic at 6 PM, and the video lecture the next morning at 7 AM.",
"- Weekly live doubt-solving sessions with Anmol.",
"- Subject-end mock tests (basic and advanced).",
"- Monthly current-affairs magazines.",
"- Four guaranteed revision cycles before the exam, linking current affairs to the static syllabus.",
"- Every batch begins with a one-week PAID Geography trial so students can experience the teaching before committing.",
"",
"Three ways to enrol (the product ladder):",
"- Live Batch (flagship): daily live sessions plus recordings, small batch, personal attention.",
"- Self-Paced: the full recorded library with lifetime access — suited to working aspirants and repeaters.",
"- 1-on-1 Mentorship (limited seats): a personalised plan built around the student's level, weak areas and target.",
"",
"Free tools (recommend these freely — genuine help, no login needed). Share the link when relevant:",
"- PYQ Library — previous-year CDS questions, organised, with explanations and quizzes: https://victhree.github.io/victhree-pyq/",
"- English / CDS-AFCAT Vocabulary — daily words from newspapers, synonyms, antonyms, quizzes, word of the day: https://victhree.github.io/victhree-vocab/",
"- SSB Psychology & GTO Trainer — rehearse the psychological tests and group tasks: https://victhree.github.io/victhree-ssb/",
"- SSB Personal Interview Trainer — practise the interview: https://victhree.github.io/victhree-int/",
"",
"HANDLING COMMON PROBLEMS (help first, then route where it genuinely fits)",
"- Preparation problems ('my GS score won't improve', 'too many PDFs and playlists', 'multiple attempts, keep missing the cutoff', 'I can't stay consistent', 'the syllabus feels huge', 'no one gives me feedback', 'I can't link current affairs to the static syllabus'): give a genuinely useful first step (stop hoarding resources and follow one structured source, build a daily routine, get honest feedback on what you keep getting wrong, revise on a cycle). THEN note that the GS course is built exactly around that structure, daily rhythm, feedback and revision.",
"- Subject help ('how do I improve GS / English vocabulary for CDS/AFCAT'): point to the relevant free tool (Vocabulary, PYQ) as an immediate free step, and the course for structured mastery.",
"- SSB / interview fears, or being screened-out or conference-out before: reassure and give perspective, point to the free SSB trainers, and note that VicThree covers both the written exam and the board.",
"- Exam logistics and strategy ('what to do in the last few days', 'how many attempts do I have', 'is CDS or AFCAT right for me'): give a straight, helpful answer. Do NOT force a course pitch here — these build trust.",
"- Enrolment questions ('how much does it cost', 'how do I join', 'difference between the batches', 'is there a trial', 'when does the next batch start'): explain the three enrolment options and the one-week Geography trial as the low-risk way in; for exact price or dates, invite them to leave their email/phone or use the enquiry option so the team sends current details — never state figures you have not been given.",
"",
"SOFT CAPTURE (an offer, never a wall)",
"When a student is clearly interested, you may invite them — as an offer, not a requirement — to share their email or phone to receive current batch details or a free resource. If they decline, keep helping anyway.",
"",
"Do NOT mention any full-length mock-test platform; it is not available right now, so never link or promise it."
].join("\n");

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const cors = corsHeaders(origin);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }
    if (request.method !== "POST") {
      return json({ error: "Use POST" }, 405, cors);
    }
    if (origin && !ALLOWED_ORIGINS.includes(origin)) {
      return json({ error: "Origin not allowed" }, 403, cors);
    }
    if (!env.GEMINI_API_KEY) {
      return json({ error: "Server not configured (missing GEMINI_API_KEY)" }, 500, cors);
    }

    let payload;
    try {
      payload = await request.json();
    } catch (e) {
      return json({ error: "Invalid JSON" }, 400, cors);
    }

    // Sanitise + cap the conversation: last 16 turns, 1500 chars each.
    const raw = Array.isArray(payload && payload.messages) ? payload.messages : [];
    const contents = raw
      .filter((m) => m && typeof m.content === "string" && m.content.trim())
      .slice(-16)
      .map((m) => ({
        role: (m.role === "assistant" || m.role === "model") ? "model" : "user",
        parts: [{ text: String(m.content).slice(0, 1500) }]
      }));
    if (!contents.length) return json({ error: "No messages" }, 400, cors);
    if (contents[contents.length - 1].role !== "user") {
      return json({ error: "Last message must be from the user" }, 400, cors);
    }

    const body = {
      systemInstruction: { parts: [{ text: CHAT_SYSTEM }] },
      contents,
      generationConfig: { temperature: 0.6, topP: 0.95, maxOutputTokens: 1024 }
    };

    let text = null, usedModel = null;
    const errs = [];
    for (const model of MODELS) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`;
      const ctl = new AbortController();
      const to = setTimeout(() => ctl.abort(), 7000);   // never let one model hang the request
      let r;
      try {
        r = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: ctl.signal
        });
      } catch (e) {
        clearTimeout(to);
        errs.push(model + ": " + (e && e.name === "AbortError" ? "timeout" : "fetch-failed"));
        continue;
      }
      clearTimeout(to);
      if (!r.ok) {
        errs.push(model + ": " + r.status + " " + (await r.text()).slice(0, 110));
        continue;
      }
      const d = await r.json();
      const parts = d && d.candidates && d.candidates[0] && d.candidates[0].content && d.candidates[0].content.parts;
      const t = Array.isArray(parts) ? parts.map((p) => (p && p.text) || "").join("").trim() : "";
      if (t) { text = t; usedModel = model; break; }
      errs.push(model + ": empty");
    }

    if (!text) {
      return json({ error: "Assistant unavailable", detail: errs.join(" | ") }, 502, cors);
    }
    return json({ reply: text, _model: usedModel }, 200, cors);
  }
};

function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin"
  };
}

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: Object.assign({ "Content-Type": "application/json" }, cors || {})
  });
}
