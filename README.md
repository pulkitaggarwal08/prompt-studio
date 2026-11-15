# Prompt Studio

**Live:** https://promptstudio-pulkit.vercel.app

Most people type one vague line into an AI tool and get a mediocre answer back. The usual fix, "learn prompt
engineering", is slow and most people won't do it. Prompt Studio does that work for them: type a rough request,
and it returns a complete prompt you can paste into Copilot, ChatGPT, Claude or Gemini.

## How it works

1. **Type your request** in plain English. One rough line is enough.
2. **Pick a framework, or let the AI pick.** There are 14 established prompt structures (RTF, CO-STAR, RISEN,
   CRISPE, CIDI, TAG, RACE, APE, PECRA, SCQA, STAR, BAB, TREF, ERA). Each has an explainer: when to use it, how,
   and the common mistake.
3. **Tune it** with tone, audience, format, depth and length, then copy the result.

Example. Rough line: *"Write a project status update for leadership covering last week's progress, risks, and
decisions before Friday."* The output gives the AI a role (program manager writing to leadership), a structure
(3 outcomes, risks tagged H/M/L with mitigations, decisions with options and a recommendation), a tone and a
word limit.

## Two modes

- **Builder (in the browser).** Fills the chosen framework with real directives from your request. Runs entirely
  client-side, nothing leaves the page.
- **AI enhance.** `api/enhance.js` is a Vercel serverless function that sends the request to an open-weight model
  on Groq and returns one finished prompt. The API key lives only in a Vercel environment variable and is never
  sent to the browser. Input is capped at 6,000 characters.

## A decision worth noting

The first version (built on Lovable) produced a *meta-prompt*: it described the framework to the model and left
the request raw ("interpret this through these lenses..."), so the user never saw the prompt that would actually
run. This version produces the finished prompt itself: the actual recipe, not a recipe template.

## Run it locally

```bash
python3 -m http.server 8777
```

Then open http://localhost:8777. The builder works offline; AI enhance needs `GROQ_API_KEY` set and `vercel dev`.

## Layout

| File | What it is |
|---|---|
| `index.html` | The whole front end: frameworks, enhancers, builder, explainers |
| `api/enhance.js` | Serverless AI enhance endpoint |
| `og.png` | Social preview image |

Built by Pulkit Aggarwal.
