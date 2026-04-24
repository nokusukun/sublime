# Dependency slop

Every dependency is a long-term trust assertion: you are promising your future self and your colleagues that this package will remain maintained, safe, and worth its weight. Models default to naming packages from popularity priors in their training data — which means they recommend the packages that were popular in 2021, reach for heavyweight libraries for one-liner operations, and sometimes confidently name packages that never existed (the slopsquatting attack class). The patterns below are the dependency-level signatures of reflex over judgment.

### Lodash-for-isEmpty

**Tags:** `AI-slop` · `Lint` · `Lang:JavaScript`

**Pattern.** Pull a general-purpose utility library for a one-liner the language already provides.

**Forbidden example.**
```ts
import { isEmpty, get, isNil } from "lodash";

if (isEmpty(users)) return;
const name = get(user, "profile.name", "anonymous");
if (isNil(id)) throw new Error("no id");
```

**Why it hurts.** You just added a 24KB dependency and a supply-chain surface for three checks the runtime answers in native syntax. Modern JavaScript has `array.length === 0`, optional chaining, and `??`. The model reaches for Lodash because it was ubiquitous in its training data, not because your codebase needs it.

**Rewrite.**
```ts
if (users.length === 0) return;
const name = user?.profile?.name ?? "anonymous";
if (id == null) throw new Error("no id");
```

**See in `/sublime`:** [../sublime/SKILL.md#dependencies--integration](../sublime/SKILL.md#dependencies--integration), [../sublime/references/dependencies.md](../sublime/references/dependencies.md).

---

### axios-when-fetch-suffices

**Tags:** `AI-slop` · `Lint` · `Lang:JavaScript`

**Pattern.** Add a network dependency when the runtime already ships one.

**Forbidden example.**
```ts
import axios from "axios";

const res = await axios.get("/api/users", {
  headers: { Authorization: `Bearer ${token}` },
});
return res.data;
```

**Why it hurts.** Node 18+, Deno, Bun, and every modern browser ship `fetch`. Axios was the right answer in 2018; it is rarely the right answer today. Each dependency is a maintenance cost, a bundle-size cost, a CVE-watchlist entry, and one more thing that can go out of date. The runtime's built-in API has none of those costs.

**Rewrite.**
```ts
const res = await fetch("/api/users", {
  headers: { Authorization: `Bearer ${token}` },
});
if (!res.ok) throw new Error(`users: ${res.status}`);
return res.json();
```

**See in `/sublime`:** [../sublime/SKILL.md#dependencies--integration](../sublime/SKILL.md#dependencies--integration), [../sublime/references/dependencies.md](../sublime/references/dependencies.md).

---

### Deprecated-suggestion

**Tags:** `AI-slop` · `Lint` · `Universal`

**Pattern.** Import a package the ecosystem has formally deprecated or superseded.

**Forbidden example.**
```ts
import moment from "moment";
import request from "request";
import uuid from "node-uuid";

const now = moment().format("YYYY-MM-DD");
request.get(url, (err, res, body) => { /* ... */ });
const id = uuid.v4();
```

**Why it hurts.** `moment` is in maintenance mode and recommends you stop using it. `request` was deprecated in 2020. `node-uuid` was renamed to `uuid` a decade ago. The model names them because they dominated its training-era stack traces. Users who copy this ship a codebase that feels five years old on day one — and inherits every known vulnerability.

**Rewrite.**
```ts
import { randomUUID } from "node:crypto";

const now = new Date().toISOString().slice(0, 10);
const res = await fetch(url);
const id = randomUUID();
```

**See in `/sublime`:** [../sublime/SKILL.md#dependencies--integration](../sublime/SKILL.md#dependencies--integration), [../sublime/references/dependencies.md](../sublime/references/dependencies.md).

---

### Outdated API version

**Tags:** `AI-slop` · `Review` · `Universal`

**Pattern.** Call a method that existed in an older major version of a library the project actually installed at the current major.

**Forbidden example.**
```ts
import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const completion = await client.createCompletion({
  model: "text-davinci-003",
  prompt: "hello",
});
```

**Why it hurts.** dev.to/shuicici: *"Fabrications often happen on API details, SHAs, GUIDs, package names, and version numbers."* `createCompletion` on a top-level client is v3-era; the v4 SDK uses `client.chat.completions.create`. The call looks plausible, passes type-check if someone left `any` lying around, and fails in production. Always verify the method exists in the version that is installed.

**Rewrite.**
```ts
const completion = await client.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [{ role: "user", content: "hello" }],
});
```

**See in `/sublime`:** [../sublime/SKILL.md#hard-bans](../sublime/SKILL.md#hard-bans) (BAN 1), [../sublime/references/dependencies.md](../sublime/references/dependencies.md).

---

### Heavyweight-for-trivial

**Tags:** `AI-slop` · `Review` · `Universal`

**Pattern.** Spin up a heavyweight runtime or framework for a task a single standard-library call answers.

**Forbidden example.**
```ts
import puppeteer from "puppeteer";

const browser = await puppeteer.launch();
const page = await browser.newPage();
await page.goto("https://example.com/health");
const status = await page.evaluate(() => document.body.innerText);
await browser.close();
```

**Why it hurts.** You just downloaded a 200MB Chromium, launched a browser process, and rendered a page to read a string that `fetch` would have returned in 20ms. Puppeteer is the right answer for JavaScript-rendered scraping and end-to-end tests. It is the wrong answer for an HTTP GET. The model reaches for the impressive hammer because the prompt mentioned "check the site."

**Rewrite.**
```ts
const res = await fetch("https://example.com/health");
const status = await res.text();
```

**See in `/sublime`:** [../sublime/SKILL.md#dependencies--integration](../sublime/SKILL.md#dependencies--integration), [../sublime/references/dependencies.md](../sublime/references/dependencies.md).
