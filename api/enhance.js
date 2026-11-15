// Server-side AI prompt-enhancer. GROQ_API_KEY lives only here (Vercel secret) —
// never sent to the browser. Free tier, no card on the account => cannot be charged.

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "openai/gpt-oss-120b";

function readBody(req) {
  return new Promise((resolve) => {
    if (req.body && typeof req.body === "object") return resolve(req.body);
    if (typeof req.body === "string") { try { return resolve(JSON.parse(req.body)); } catch { return resolve({}); } }
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => { try { resolve(JSON.parse(data || "{}")); } catch { resolve({}); } });
    req.on("error", () => resolve({}));
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "Use POST." }); return; }

  const key = process.env.GROQ_API_KEY;
  if (!key) { res.status(200).json({ error: "AI isn't configured yet." }); return; }

  const b = (await readBody(req)) || {};
  const raw = String(b.raw || "").slice(0, 6000).trim();
  if (!raw) { res.status(400).json({ error: "No prompt provided." }); return; }

  // Optional shaping the user chose — passed straight through as directives.
  const opts = [];
  if (b.tone) opts.push("Tone — " + b.tone);
  if (b.audience) opts.push("Audience — " + b.audience);
  if (b.format) opts.push("Output format — " + b.format);
  if (b.scope) opts.push(b.scope);
  if (b.role) opts.push("Give the AI this role — " + b.role);
  (Array.isArray(b.techniques) ? b.techniques : []).forEach((t) => t && opts.push(String(t)));
  (Array.isArray(b.constraints) ? b.constraints : []).forEach((c) => c && opts.push(String(c)));

  const auto = !!b.auto;

  const CORE = [
    "You are a world-class prompt engineer. Your ONLY job is to transform the user's rough request into ONE excellent, ready-to-use prompt that they will paste into an AI assistant (ChatGPT, Claude, Gemini, Copilot) to get a great result. You do NOT answer the request yourself — you produce the prompt.",
  ];

  const RULES = [
    "Non-negotiable rules:",
    "- Rewrite and EXPAND the rough request into concrete, specific, professional instructions. Infer a fitting expert role, the realistic context, the intended audience, and sensible specifics.",
    "- Never leave blanks, placeholders, brackets, or \"[TBD]\". Fill everything with plausible, concrete detail.",
    "- Address the prompt to the AI in the second person (\"You are…\", \"Write…\", \"Return…\").",
    "- Fully embody the framework's structure — but write it as a clean, natural prompt, not a labelled worksheet.",
    opts.length ? "- Apply these choices from the user: " + opts.join("; ") + "." : "",
    b.example ? "- Match the style/structure of the example the user provided." : "",
    "- Make it genuinely better than the user's original — the kind of prompt an expert would hand over.",
  ].filter(Boolean);

  function frameworkBlock(f) {
    const parts = Array.isArray(f.parts) && f.parts.length ? "\nIts parts:\n" + f.parts.map((p) => "- " + p).join("\n") : "";
    return [
      "Apply the " + f.name + " framework" + (f.full ? " (" + f.full + ")" : "") + ".",
      f.oneLiner ? "What it's for: " + f.oneLiner : "",
      f.whenToUse ? "When it fits: " + f.whenToUse : "",
      f.howToUse ? "How to apply it: " + f.howToUse : "",
      parts,
    ].filter(Boolean).join("\n");
  }

  let system, tail = "\n\nOutput ONLY the final prompt text. No preamble, no explanation, no headings like \"Enhanced prompt:\", no markdown code fences, no quotes around it.";

  if (auto) {
    const list = (Array.isArray(b.frameworksList) ? b.frameworksList : [])
      .map((f) => "- " + f.name + ": " + (f.oneLiner || "") + (f.whenToUse ? " (use when: " + f.whenToUse + ")" : "")).join("\n");
    system = CORE.concat([
      "First, silently choose the SINGLE best framework for this request from the list below, then write the enhanced prompt using it.",
      "Frameworks to choose from:\n" + list,
      "",
      RULES.join("\n"),
      "",
      "Begin your response with exactly one line: FRAMEWORK: <the framework name you chose>\nThen a blank line, then the prompt itself and nothing else.",
    ]).join("\n");
    tail = "";
  } else {
    const f = b.framework || {};
    system = CORE.concat(["", frameworkBlock(f), "", RULES.join("\n")]).join("\n") + tail;
  }

  const user = "Rough request:\n" + raw + (b.example ? "\n\nStyle example to match:\n" + String(b.example).slice(0, 2000) : "");

  try {
    const r = await fetch(GROQ_URL, {
      method: "POST",
      headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.5,
        max_tokens: 2048,
        reasoning_effort: "low",
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
      }),
    });
    if (!r.ok) {
      const t = await r.text();
      res.status(200).json({ error: r.status === 429 ? "The free AI hit its rate limit for a moment — wait a few seconds and hit Regenerate." : "AI is unavailable right now — hit Regenerate.", detail: t.slice(0, 160) });
      return;
    }
    const d = await r.json();
    let text = (d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content || "").trim();
    let chosen = null;
    if (auto) {
      const m = text.match(/^\s*FRAMEWORK:\s*(.+?)\s*\n/i);
      if (m) { chosen = m[1].trim(); text = text.slice(m.index + m[0].length).trim(); }
    }
    // strip stray leading label or code fences if the model added them
    text = text.replace(/^```[a-z]*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
    res.status(200).json({ text, chosen, model: "Groq · GPT-OSS 120B", usage: d.usage || null });
  } catch (e) {
    res.status(200).json({ error: "AI request failed — hit Regenerate." });
  }
};
