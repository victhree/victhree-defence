/* VicThree Defence — Razorpay Standard Checkout Worker (Cloudflare)
   ------------------------------------------------------------------
   A SEPARATE Worker from the chatbot one, with its OWN secrets, so
   payments and the chatbot never share deployment or failures.

   This is the BACKEND that a static GitHub Pages site cannot host by
   itself. It does the two things that MUST happen on a server, where
   the Razorpay KEY SECRET lives and is never exposed to the browser:
     • POST /create-order   -> creates a Razorpay order (fixed price)
     • POST /verify-payment  -> verifies the payment signature (HMAC)

   The publishable KEY ID is returned to the browser by /create-order,
   so the website never has to hardcode any Razorpay value.

   SETUP (all in the browser — no Node needed):
     1. dash.cloudflare.com -> Workers -> Create Worker
        (name it e.g. "victhree-razorpay"). Paste this whole file. Deploy.
     2. Worker -> Settings -> Variables and Secrets -> add TWO Secrets:
          RZP_KEY_ID      = rzp_test_xxxxxxxx   (or your live key id)
          RZP_KEY_SECRET  = your key secret      (NEVER put this in the repo)
        Deploy again.
     3. Copy the Worker URL into gs-course.html  ->  window.VT.RZP_API
   ------------------------------------------------------------------ */

// Only these origins may call the Worker from a browser.
const ALLOWED_ORIGINS = [
  "https://victhree.github.io",
  "https://victhreedefence.com",
  "https://www.victhreedefence.com",
  "http://localhost:8099"   // local testing; remove if you like
];

/* Prices are defined HERE, server-side, so the browser can never ask
   for a cheaper order. The website sends a product key, not an amount.
   Amounts are in paise (₹999 = 99900). Minimum Razorpay amount: 100. */
const PRODUCTS = {
  trial:  { amount: 99900,   label: "GS Geography Trial (1 week)" },
  hero:   { amount: 299900,  label: "VicThree Hero — Self-paced GS course" },
  elite:  { amount: 849900,  label: "VicThree Elite — Live 90-day program" },
  legend: { amount: 1199900, label: "VicThree Legend — 1-on-1 mentorship" }
};

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
    if (!env.RZP_KEY_ID || !env.RZP_KEY_SECRET) {
      return json({ error: "Server not configured (missing Razorpay secrets)" }, 500, cors);
    }

    const path = new URL(request.url).pathname.replace(/\/+$/, "");

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return json({ error: "Invalid JSON" }, 400, cors);
    }

    if (path.endsWith("/create-order")) {
      return createOrder(body, env, cors);
    }
    if (path.endsWith("/verify-payment")) {
      return verifyPayment(body, env, cors);
    }
    return json({ error: "Not found" }, 404, cors);
  }
};

/* ---------- STEP 1: create a Razorpay order ---------- */
async function createOrder(body, env, cors) {
  // The browser sends a product key; the price is decided here.
  const product = PRODUCTS[(body && body.product) || "trial"];
  if (!product) return json({ error: "Unknown product" }, 400, cors);

  const amount = product.amount;
  if (!Number.isInteger(amount) || amount < 100) {
    return json({ error: "Invalid amount" }, 400, cors);
  }

  const auth = "Basic " + btoa(env.RZP_KEY_ID + ":" + env.RZP_KEY_SECRET);
  const receipt = "vt_" + Date.now().toString(36);

  let r;
  try {
    r = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: { "Authorization": auth, "Content-Type": "application/json" },
      body: JSON.stringify({ amount, currency: "INR", receipt, payment_capture: 1 })
    });
  } catch (e) {
    return json({ error: "Could not reach Razorpay" }, 500, cors);
  }

  if (r.status === 401) {
    return json({ error: "Razorpay auth failed (check key id / secret)" }, 401, cors);
  }
  if (!r.ok) {
    const detail = (await r.text()).slice(0, 200);
    return json({ error: "Razorpay order failed", detail }, 500, cors);
  }

  const order = await r.json();
  // Only what the browser needs — the key id here is the PUBLISHABLE one.
  return json({
    key_id: env.RZP_KEY_ID,
    order_id: order.id,
    amount: order.amount,
    currency: order.currency,
    description: product.label
  }, 200, cors);
}

/* ---------- STEP 3: verify the payment signature ---------- */
async function verifyPayment(body, env, cors) {
  const orderId = body && body.razorpay_order_id;
  const paymentId = body && body.razorpay_payment_id;
  const signature = body && body.razorpay_signature;

  if (!orderId || !paymentId || !signature) {
    return json({ error: "Missing fields" }, 400, cors);
  }

  const expected = await hmacHex(env.RZP_KEY_SECRET, orderId + "|" + paymentId);
  const ok = timingSafeEqual(expected, String(signature));

  if (!ok) {
    // Signature mismatch — do NOT treat this as paid.
    return json({ verified: false, error: "Signature mismatch" }, 400, cors);
  }
  return json({ verified: true, payment_id: paymentId }, 200, cors);
}

/* ---------- helpers ---------- */
async function hmacHex(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Length-independent constant-time-ish comparison of two hex strings.
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

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
