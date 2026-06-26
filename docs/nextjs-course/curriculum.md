# Next.js for Beginners — Full Curriculum

> **EDITOR'S NOTE**
> This curriculum was authored fresh against the editing brief. The source slot
> (`[PASTE YOUR CURRICULUM HERE]`) arrived empty, so there was no prior draft to
> revise. As a result, every module is net-new and is flagged
> `[ADDED — REASON]`. There is nothing to flag as `[REMOVED]` or `[REORDERED]`
> because no prior ordering existed. Content that belongs *after* the beginner
> track is collected at the end under **What's Next** and flagged
> `[MOVED TO INTERMEDIATE — REASON]` so the beginner path stays focused.
>
> The running project for the entire course is a **personal portfolio site with
> a simple blog** — real, deployable, and portfolio-worthy. Every module adds a
> visible feature to it. We call this project **`my-portfolio`** throughout.

---

## SECTION 0: Before You Begin

### MODULE 0: Prerequisites & Readiness Check
*[ADDED — the brief requires explicit prerequisite clarity and a readiness checklist; none existed.]*

- **Learning objective:** Confirm you have the exact HTML, CSS, JavaScript, and React foundations this course assumes, so no module catches you off guard.

- **Plain-English explanation:**
  Next.js is a framework *built on top of* React, which is built on top of
  JavaScript, which renders HTML styled with CSS. This course does **not**
  teach those underlying layers — it assumes them. If a layer below is shaky,
  Next.js concepts will feel like magic instead of logic. Spend an honest five
  minutes with the checklist below before Module 1. It is cheaper to close a gap
  now than to be confused for three modules.

  Specifically, you should be comfortable with:
  - **HTML:** tags, attributes, nesting, semantic elements (`<nav>`, `<main>`, `<article>`).
  - **CSS:** selectors, the box model, flexbox/grid basics, and at least one of: plain CSS, CSS Modules, or a utility framework like Tailwind.
  - **JavaScript (modern, ES6+):** variables (`const`/`let`), arrow functions, array methods (`.map()`, `.filter()`), destructuring, template literals, `import`/`export` modules, promises, and `async`/`await`.
  - **React basics:** components, JSX, props, `useState`, `useEffect`, lists with `key`, and conditional rendering.

- **Code example (the JavaScript you must already read fluently):**

  ```jsx
  // If every line here is obvious to you, you're ready.
  import { useState } from "react";          // ES module import + a React hook

  function Greeting({ name }) {               // a component that takes props
    const [count, setCount] = useState(0);    // state with the useState hook

    return (
      <div>
        {/* template literal + JSX expression */}
        <p>{`Hello, ${name}! Clicked ${count} times.`}</p>
        <button onClick={() => setCount(count + 1)}>Click</button>
      </div>
    );
  }

  export default Greeting;                     // ES module export
  ```

- **Mini-exercise:**
  Without running it, predict what the component above renders before any click
  and after two clicks. Then write a one-paragraph honest self-assessment: which
  of the four areas (HTML, CSS, JS, React) is your weakest, and what one thing
  you'll review if a later module gets hard.

- **Why this matters:**
  The single biggest reason beginners "fail" at Next.js is that they're actually
  stuck on a React or JavaScript gap and don't realize it. Naming your weakest
  layer now turns "I'm confused" into "oh, that's a `useEffect` thing, not a
  Next.js thing."

> **YOU ARE READY WHEN YOU CAN…**
> - [ ] Write semantic HTML and style it with CSS (any method) without copying from a tutorial.
> - [ ] Read and write ES6+ JavaScript: arrow functions, `.map()`/`.filter()`, destructuring, `import`/`export`.
> - [ ] Explain what a promise is and use `async`/`await` to wait for one.
> - [ ] Build a small React component that uses props and `useState`.
> - [ ] Explain what `useEffect` does and roughly when it runs.
> - [ ] Open a terminal, run a command, and `cd` into a folder.
> - [ ] Install Node.js (v20 or newer; Next.js 15 requires at least 18.18, and Node 18 is now end-of-life) and run `node --version` successfully.
>
> If three or more boxes are unchecked, do a short React refresher first. You'll
> move through this course far faster afterward.

---

## SECTION 1: Foundations

### MODULE 1: What Next.js Is and Why It Exists
*[ADDED — foundations coverage requires "what Next.js is and why it exists vs plain React".]*

- **Learning objective:** Explain, in plain English, what problems Next.js solves that plain React leaves to you.

- **Plain-English explanation:**
  Plain React (e.g. a Vite or Create-React-App project) gives you one powerful
  thing: a way to build UI out of components. But it deliberately leaves a long
  list of "real website" concerns up to you:
  - How do URLs map to pages? (routing)
  - How does the page get rendered — in the browser, or on a server first? (rendering strategy)
  - How do you fetch data efficiently and securely?
  - How do you optimize images, fonts, and performance?
  - How do you set page titles and social-share previews for SEO?
  - How do you deploy it so it's fast worldwide?

  With plain React you assemble a pile of separate libraries to answer these,
  and you wire them together yourself. **Next.js is a React *framework*: React
  plus opinionated, built-in answers to all of those questions.** It gives you
  routing, server rendering, data fetching, image/font optimization, an API
  layer, and a deployment story — out of the box, designed to work together.

  The mental shorthand: *React is the engine; Next.js is the whole car.*

- **Code example (the conceptual difference, not runnable):**

  ```text
  PLAIN REACT PROJECT                 NEXT.JS PROJECT
  ───────────────────                 ───────────────
  React            ← UI               React            ← UI
  + react-router   ← routing          (routing built in: the file system)
  + a fetch setup  ← data             (data fetching built in: async components)
  + an image lib   ← images           (next/image built in)
  + a meta lib     ← <title>/SEO      (Metadata API built in)
  + a server       ← SSR (DIY)        (server rendering built in)
  = you wire it all together          = it comes wired together
  ```

- **Mini-exercise:**
  List three features your dream portfolio site needs (e.g. "fast image
  loading", "a `/blog/my-first-post` URL", "a good Google preview"). Next to
  each, write whether plain React gives it to you for free. (Spoiler: mostly
  no — that's the point.)

- **Why this matters:**
  Knowing *why* the framework exists keeps you from fighting it. Every Next.js
  convention you're about to learn is an answer to one of the questions above.
  When a rule feels arbitrary, ask "which of these problems is this solving?" —
  there's always an answer.

> **COMMON MISTAKE TO AVOID**
> Treating Next.js like "React but the imports are different." It's not. It has
> opinions about *where files go* and *where code runs* (server vs. browser).
> Fighting those opinions is the #1 source of beginner frustration. Lean in.

---

### MODULE 2: Rendering Strategies — CSR, SSR, SSG, ISR
*[ADDED — foundations coverage explicitly requires CSR/SSR/SSG/ISR "in plain English with real use-case examples".]*

- **Learning objective:** Tell the four rendering strategies apart and pick the right one for a given page using a real example.

- **Plain-English explanation:**
  "Rendering" just means *turning your components into the HTML a user sees.*
  The only real questions are **where** that happens (the user's browser or a
  server) and **when** (at build time, or on each request). Four common answers:

  - **CSR — Client-Side Rendering.** The server sends a nearly empty HTML shell;
    the browser downloads JavaScript and builds the page. *Use case:* a logged-in
    dashboard that's different for every user and doesn't need SEO — e.g. an
    analytics screen behind a login.
  - **SSR — Server-Side Rendering.** The server builds the full HTML *on every
    request*, then sends it ready-to-show. *Use case:* a page whose data changes
    constantly and must be fresh per visit — e.g. a live sports scoreboard or a
    personalized feed.
  - **SSG — Static Site Generation.** The HTML is built *once, ahead of time*
    (at build/deploy), and the same file is served to everyone. *Use case:*
    content that rarely changes — e.g. a marketing homepage or a blog post.
  - **ISR — Incremental Static Regeneration.** Like SSG, but the page can quietly
    rebuild itself in the background on a schedule (e.g. "at most once every 60
    seconds"). You get static speed *and* reasonably fresh data. *Use case:* a
    product page or a blog index that updates occasionally but gets heavy traffic.

  A homey analogy: SSG is a printed brochure (made once, handed to everyone).
  SSR is a barista making your coffee to order each time. ISR is a bakery that
  re-bakes a fresh batch every hour no matter who's asking. CSR is a flat-pack
  kit you assemble at home after it's delivered.

- **Code example (how Next.js expresses these — preview, deep-dived later):**

  ```jsx
  // SSG (the default): no special data call → built once at build time.
  export default function Page() {
    return <h1>About me</h1>;
  }

  // SSR: opt into per-request rendering by reading request-time data
  // or setting the dynamic flag.
  export const dynamic = "force-dynamic"; // render on every request

  // ISR: revalidate (rebuild) at most once every 60 seconds.
  export const revalidate = 60;

  // CSR: a component that renders in the browser only.
  "use client";
  import { useState } from "react";
  // ...interactive, browser-side UI
  ```

- **Mini-exercise:**
  For your portfolio, classify each planned page: Home, About, Blog index, an
  individual Blog post, and a (hypothetical) logged-in "draft editor". Which
  rendering strategy fits each, and why? Write one sentence per page.

- **Why this matters:**
  Choosing the right strategy is the difference between a site that's instant and
  SEO-friendly and one that's slow and invisible to Google. In the App Router you
  rarely pick these by name — you pick them by *how you fetch data* — so building
  the mental model now makes those later choices obvious.

> **COMMON MISTAKE TO AVOID**
> Assuming everything must be SSR "to be modern." Most portfolio/blog pages should
> be **static (SSG)** — it's the fastest and cheapest. Reach for SSR/ISR only when
> data genuinely needs to be fresh.

---

### MODULE 3: Where Next.js Fits in the Modern Web Stack
*[ADDED — foundations coverage requires "how Next.js fits into the modern web development stack".]*

- **Learning objective:** Place Next.js correctly among the other tools in a typical modern web project.

- **Plain-English explanation:**
  Next.js doesn't replace your whole toolbox — it sits in the middle of it. A
  typical modern stack looks like layers:
  - **Language:** JavaScript (or TypeScript later).
  - **UI library:** React (Next.js bundles this for you).
  - **Framework:** **Next.js** — routing, rendering, data, optimization.
  - **Styling:** plain CSS / CSS Modules / Tailwind CSS (your choice).
  - **Runtime:** Node.js on the server side, the browser on the client side.
  - **Data source (later):** a CMS, a database, or third-party APIs.
  - **Hosting:** Vercel (the company behind Next.js), or Netlify, etc.

  Next.js is the conductor. It decides what runs on the server, what ships to the
  browser, how routes resolve, and how everything is bundled for production.

- **Code example (a real project's `package.json`, trimmed):**

  ```json
  {
    "scripts": {
      "dev": "next dev",      // start the local dev server
      "build": "next build",  // create the optimized production build
      "start": "next start"   // run the production build locally
    },
    "dependencies": {
      "next": "15.x",          // the framework
      "react": "19.x",         // the UI library Next.js builds on
      "react-dom": "19.x"      // React's renderer for the web
    }
  }
  ```

- **Mini-exercise:**
  Draw (on paper is fine) the stack layers above and circle the ones Next.js
  provides or manages directly. You should circle React, routing, rendering,
  bundling, and the dev/build/start scripts.

- **Why this matters:**
  Beginners often can't tell where React ends and Next.js begins, so they don't
  know which docs to read when stuck. Knowing the layer each problem lives in
  ("this is a CSS question", "this is a Next.js routing question") makes you
  dramatically faster at finding answers.

---

### MODULE 4: File-Based Routing & Project Structure (App Router)
*[ADDED — foundations coverage requires file-based routing (App Router) and the real folder structure.]*

- **Learning objective:** Read a Next.js App Router project tree and predict the URL each route file produces.

- **Plain-English explanation:**
  In Next.js (App Router), **your folder structure *is* your routing table.**
  There's no separate routes config to maintain — you create a folder inside
  `app/`, drop a `page.js` in it, and that folder's path becomes the URL.

  - `app/page.js` → `/` (the home page)
  - `app/about/page.js` → `/about`
  - `app/blog/page.js` → `/blog`
  - `app/blog/[slug]/page.js` → `/blog/anything` (a dynamic route — Module 11)

  We use the **App Router** (the `app/` directory) throughout this course — it's
  the current, recommended approach. The older **Pages Router** (a `pages/`
  directory) still exists in legacy projects, but we don't mix them. (More on why
  not in Module 16's common-mistakes callout.)

  A real, freshly generated project looks roughly like this:

  ```text
  my-portfolio/
  ├─ app/                  ← all routes and UI live here (App Router)
  │  ├─ layout.js          ← the root layout: wraps every page (Module 8)
  │  ├─ page.js            ← the home page at "/"
  │  └─ globals.css        ← global styles
  ├─ public/               ← static files served as-is (images, favicon)
  ├─ next.config.js        ← Next.js configuration
  ├─ package.json          ← scripts and dependencies
  └─ node_modules/         ← installed packages (never edit; never commit)
  ```

- **Code example (the same idea, as routes → URLs):**

  ```text
  app/
  ├─ page.js                 →  /
  ├─ about/
  │  └─ page.js              →  /about
  ├─ projects/
  │  └─ page.js              →  /projects
  └─ blog/
     ├─ page.js              →  /blog
     └─ [slug]/
        └─ page.js           →  /blog/<slug>   (e.g. /blog/hello-world)
  ```

- **Mini-exercise:**
  Sketch the `app/` folder tree for your portfolio with these URLs: `/`,
  `/about`, `/projects`, `/blog`, and `/blog/[slug]`. Don't write code yet — just
  the folders and which `page.js` files go where.

- **Why this matters:**
  This is the single most important mental shift in Next.js. Once "folder path =
  URL" clicks, routing stops being a thing you configure and becomes a thing you
  *see*. Half of the App Router is just files with special names; you're learning
  the vocabulary of those names.

> **COMMON MISTAKE TO AVOID**
> Putting a component file in `app/` and expecting a route. A folder only becomes
> a navigable URL when it contains a `page.js` (or `route.js` for APIs). A bare
> `Button.js` inside `app/` is just a file, not a page.

---

## SECTION 2: Getting Started

### MODULE 5: Installing Next.js with create-next-app
*[ADDED — core concept: installing Next.js with create-next-app.]*

- **Learning objective:** Scaffold and run a new Next.js App Router project locally.

- **Plain-English explanation:**
  You don't build a Next.js project by hand — you generate it with the official
  tool, **`create-next-app`**. It asks a few setup questions and produces a
  working project with sensible defaults. Run it, answer the prompts (we keep it
  beginner-simple: **JavaScript, App Router, no TypeScript yet**), then start the
  dev server.

- **Code example (run these in your terminal):**

  ```bash
  # 1. Generate the project (creates a folder called my-portfolio).
  npx create-next-app@latest my-portfolio

  # Answer the prompts roughly like this (exact wording varies by Next version):
  #   Would you like to use TypeScript?        → No   (we add TS in the intermediate track)
  #   Would you like to use ESLint?            → Yes
  #   Would you like to use Tailwind CSS?      → Yes  (handy, optional)
  #   Would you like to use `src/` directory?  → No   (keeps app/ at the root for now)
  #   Would you like to use App Router?        → Yes  (required for this course)
  #   Would you like to use Turbopack for next dev? → Yes  (faster dev server; safe to accept)
  #   Would you like to customize import alias? → No
  #
  # Newer create-next-app versions scaffold the App Router by default and may
  # show fewer prompts — that's fine, just keep App Router enabled.

  # 2. Move into the project.
  cd my-portfolio

  # 3. Start the local development server.
  npm run dev

  # 4. Open the printed URL (usually http://localhost:3000) in your browser.
  ```

- **Mini-exercise:**
  Scaffold `my-portfolio`, run `npm run dev`, and open it in the browser. Then
  open `app/page.js`, change the main heading text to your name, save, and watch
  the browser update **without a manual refresh** (that's Fast Refresh).

- **Why this matters:**
  This is your project thread's first commit. Everything else in the course adds
  to this exact project. Getting a green "running on localhost:3000" is the
  foundation every later module stands on.

> **COMMON MISTAKE TO AVOID**
> Running `npm run dev` from the wrong folder. If you see "missing script: dev",
> you're probably one directory above (or below) the project. `cd` into the folder
> that contains `package.json` and try again.

---

### MODULE 6: Project Anatomy — What Each File and Folder Does
*[ADDED — foundations coverage requires explaining what each folder does, applied here to the real generated project.]*

- **Learning objective:** Open a freshly generated project and explain the purpose of every top-level file and folder.

- **Plain-English explanation:**
  Before writing features, tour the house you just built. Knowing what each part
  does means you'll never wonder "where does this code go?"

  - **`app/`** — every route and page. This is where you'll spend 90% of your time.
  - **`app/layout.js`** — the root layout: shared shell (e.g. `<html>`, `<body>`, nav, footer) wrapped around every page.
  - **`app/page.js`** — the home page (`/`).
  - **`app/globals.css`** — global styles loaded everywhere.
  - **`public/`** — static assets served at the root path. `public/me.jpg` is reachable at `/me.jpg`.
  - **`next.config.js`** — framework configuration (image domains, redirects, etc.).
  - **`package.json`** — scripts (`dev`/`build`/`start`) and dependency list.
  - **`node_modules/`** — installed packages. Never edit by hand; it's git-ignored.
  - **`.next/`** — build output, auto-generated. Never edit; git-ignored.

- **Code example (a minimal root layout, annotated):**

  ```jsx
  // app/layout.js — wraps EVERY page in the app.
  import "./globals.css"; // load global styles once, here

  export default function RootLayout({ children }) {
    return (
      <html lang="en">
        <body>
          {/* `children` is whatever page is currently active */}
          {children}
        </body>
      </html>
    );
  }
  ```

- **Mini-exercise:**
  Open your generated `my-portfolio` and, in a notes file, write one sentence for
  each top-level item explaining what it's for. Then delete the boilerplate
  content inside `app/page.js` and replace it with a simple `<h1>` and a short
  intro paragraph — your portfolio's first real content.

- **Why this matters:**
  "Where does this code go?" is the question that stalls beginners most. A
  ten-minute tour now saves hours of misplaced files later.

---

## SECTION 3: Routing, Pages & Layouts

### MODULE 7: Pages — `page.js` and Creating Routes
*[ADDED — core concept: pages and the App Router; routes via the file system.]*

- **Learning objective:** Create multiple navigable pages by adding folders and `page.js` files.

- **Plain-English explanation:**
  A `page.js` file makes its folder a real, visitable URL. To add a page, create
  a folder under `app/` and put a `page.js` inside that default-exports a React
  component. That's the entire ritual.

- **Code example:**

  ```jsx
  // app/about/page.js  →  available at /about
  export default function AboutPage() {
    return (
      <main>
        <h1>About Me</h1>
        <p>I'm a developer learning Next.js by building this site.</p>
      </main>
    );
  }
  ```

- **Mini-exercise:**
  Add three pages to `my-portfolio`: `/about`, `/projects`, and `/blog`. Give each
  a heading and a sentence. Visit each URL directly in the browser to confirm it
  resolves.

- **Why this matters:**
  These pages are the skeleton of your portfolio. Every later feature (layouts,
  links, dynamic blog posts, metadata) hangs off this skeleton.

> **COMMON MISTAKE TO AVOID**
> Forgetting `export default`. A `page.js` whose component isn't the *default*
> export will throw an error. Each `page.js` needs exactly one default-exported
> component.

---

### MODULE 8: Layouts — Shared Shells with `layout.js`
*[ADDED — core concept: layouts (layout.js).]*

- **Learning objective:** Use layouts to share UI (like a nav bar) across pages without repeating it.

- **Plain-English explanation:**
  A `layout.js` wraps the pages in its folder (and all nested folders) in shared
  UI. The root layout (`app/layout.js`) wraps the whole site — perfect for a nav
  bar and footer that should appear everywhere. Layouts receive a `children` prop:
  the currently active page. Crucially, **layouts don't re-render when you
  navigate between their child pages** — only the `children` swap out, which keeps
  navigation fast and preserves things like scroll position in the shared shell.

- **Code example:**

  ```jsx
  // app/layout.js — a site-wide shell with a nav and footer.
  import "./globals.css";

  export default function RootLayout({ children }) {
    return (
      <html lang="en">
        <body>
          <nav>
            {/* We'll make these real links in the next module */}
            <span>My Portfolio</span>
          </nav>

          <main>{children}</main>  {/* the active page renders here */}

          <footer>© {new Date().getFullYear()} My Name</footer>
        </body>
      </html>
    );
  }
  ```

- **Mini-exercise:**
  Add a nav bar and footer to your root layout so they appear on every page.
  Confirm that visiting `/about` and `/projects` both show the same nav and
  footer with only the middle content changing.

- **Why this matters:**
  Layouts are how real sites avoid copy-pasting the header onto every page. They
  also unlock *nested* layouts later (e.g. a blog-specific sidebar that only wraps
  `/blog/*`).

> **COMMON MISTAKE TO AVOID**
> Forgetting to render `{children}` in a layout. If you omit it, your pages simply
> won't appear — the layout will render its own UI and silently swallow every page.

---

### MODULE 9: Navigation — `<Link>` and the `useRouter` Hook
*[ADDED — core concept: navigation with Link and useRouter.]*

- **Learning objective:** Move between pages using `<Link>` for declarative navigation and `useRouter` for programmatic navigation.

- **Plain-English explanation:**
  Don't use a plain `<a href>` for internal links — it triggers a full page
  reload and throws away Next.js's fast client-side navigation. Use the built-in
  **`<Link>`** component instead; it fetches and swaps pages without a full
  reload. When you need to navigate *from code* (e.g. after a button click or form
  submit), use the **`useRouter`** hook's `push()` method. Because `useRouter` is
  a hook, the component using it must be a Client Component (`"use client"` —
  introduced properly in Module 10).

- **Code example:**

  ```jsx
  // Declarative navigation in the nav bar (works in a Server Component).
  import Link from "next/link";

  export function Nav() {
    return (
      <nav>
        <Link href="/">Home</Link>
        <Link href="/about">About</Link>
        <Link href="/projects">Projects</Link>
        <Link href="/blog">Blog</Link>
      </nav>
    );
  }
  ```

  ```jsx
  // Programmatic navigation after an action (must be a Client Component).
  "use client";
  import { useRouter } from "next/navigation"; // note: next/navigation, not next/router

  export function HomeButton() {
    const router = useRouter();
    return <button onClick={() => router.push("/")}>Take me home</button>;
  }
  ```

- **Mini-exercise:**
  Replace the plain text in your nav bar with real `<Link>`s to all your pages.
  Then add a "Back to home" button on the `/about` page that uses `useRouter` to
  navigate programmatically. Notice how `<Link>` navigation feels instant.

- **Why this matters:**
  Snappy, no-flash navigation is a headline Next.js benefit, and `<Link>` is how
  you get it. Mixing in raw `<a>` tags for internal routes quietly downgrades your
  whole site's feel.

> **COMMON MISTAKE TO AVOID**
> Importing `useRouter` from `next/router` (the old Pages Router) instead of
> `next/navigation` (the App Router). The Pages Router import will error or behave
> unexpectedly. In the App Router it's always `next/navigation`.

---

### MODULE 10: Server Components vs. Client Components
*[ADDED — core concept: Client vs Server Components, when and why to use each. Placed before data fetching because data fetching depends on it.]*

- **Learning objective:** Decide whether a component should be a Server Component or a Client Component, and convert one with `"use client"`.

- **Plain-English explanation:**
  This is the concept that most distinguishes the App Router. **By default, every
  component in `app/` is a Server Component** — it runs on the server, never ships
  its code to the browser, and can directly fetch data and read secrets. That's
  great for performance and security, but Server Components **cannot** use
  interactivity: no `useState`, no `useEffect`, no event handlers like `onClick`,
  no browser-only APIs.

  When you need interactivity, you opt a component into being a **Client
  Component** by adding the string `"use client"` as the very first line of the
  file. Client Components run in the browser and *can* use hooks and event
  handlers — but their code ships to the browser, so use them only where you
  actually need interactivity.

  Rule of thumb: **Server by default; go Client only for the interactive leaves of
  your tree** (a like button, a search box, a theme toggle). Keep `"use client"`
  as far down the tree as possible.

- **Code example:**

  ```jsx
  // Server Component (default — no directive needed).
  // Can fetch data directly, runs on the server, ships zero JS for itself.
  export default function ProjectsList({ projects }) {
    return (
      <ul>
        {projects.map((p) => (
          <li key={p.id}>{p.name}</li>
        ))}
      </ul>
    );
  }
  ```

  ```jsx
  // Client Component (opt in with "use client").
  // Needed because it uses useState + an onClick handler.
  "use client";
  import { useState } from "react";

  export function LikeButton() {
    const [likes, setLikes] = useState(0);
    return <button onClick={() => setLikes(likes + 1)}>♥ {likes}</button>;
  }
  ```

- **Mini-exercise:**
  Add a `LikeButton` Client Component and drop it onto your home page (which stays
  a Server Component). Then, *as an experiment*, try adding `useState` to a Server
  Component **without** `"use client"` and read the error message — learning to
  recognize that error now saves you later.

- **Why this matters:**
  Almost every confusing Next.js error a beginner hits ("useState is not allowed
  in Server Components", "Hooks can only be used in Client Components") traces back
  to this one distinction. Internalize "server by default, client for
  interactivity" and most of those errors stop happening.

> **COMMON MISTAKE TO AVOID**
> **Forgetting `"use client"` when using hooks.** This is the #1 beginner error.
> The moment you reach for `useState`, `useEffect`, `useRouter`, or an `onClick`,
> the file needs `"use client"` as its first line. Equally: don't slap
> `"use client"` on *everything* "to be safe" — that ships unnecessary JavaScript
> and forfeits the server-rendering benefits.

---

### MODULE 11: Dynamic Routes — `[slug]`, `[...catchAll]`, `[[...optional]]`
*[ADDED — core concept: dynamic routes.]*

- **Learning objective:** Build routes whose URLs aren't known ahead of time, like individual blog posts.

- **Plain-English explanation:**
  Your blog will have many posts, but you won't create a folder per post. Instead
  you create **one** dynamic route that matches any value in that URL position. A
  folder named with square brackets becomes a parameter:

  - **`[slug]`** — matches a single segment. `app/blog/[slug]/page.js` matches
    `/blog/hello` and `/blog/my-trip`. The matched value arrives as `params.slug`.
  - **`[...slug]`** (catch-all) — matches *one or more* segments.
    `app/docs/[...slug]/page.js` matches `/docs/a`, `/docs/a/b`, `/docs/a/b/c`.
  - **`[[...slug]]`** (optional catch-all) — like catch-all, but **also** matches
    the bare parent path with zero segments (e.g. `/docs` itself).

- **Code example:**

  ```jsx
  // app/blog/[slug]/page.js  →  matches /blog/anything
  export default async function BlogPost({ params }) {
    const { slug } = await params; // in current Next.js, params is awaited
    return (
      <article>
        <h1>Post: {slug}</h1>
        <p>This is the page for the "{slug}" post.</p>
      </article>
    );
  }
  ```

- **Mini-exercise:**
  Create `app/blog/[slug]/page.js` that displays the slug from the URL. Visit
  `/blog/hello-world` and `/blog/learning-nextjs` and confirm each shows its own
  slug. (In the next data module, you'll swap the slug for real post content.)

- **Why this matters:**
  Dynamic routes are how every content site on earth works — one template, many
  URLs. Your blog can't exist without this, and it's the bridge to real data
  fetching.

> **COMMON MISTAKE TO AVOID**
> Confusing `[slug]` (one segment) with `[...slug]` (many segments). If
> `/blog/2024/march` 404s, you probably used `[slug]` where you needed
> `[...slug]`. Start with `[slug]` for a flat blog; reach for catch-alls only when
> you genuinely have nested paths.

---

### MODULE 12: Route Groups and Private Folders
*[ADDED — core concept: route groups and private folders.]*

- **Learning objective:** Organize the `app/` directory using route groups and private folders without affecting URLs.

- **Plain-English explanation:**
  As your site grows, you'll want to organize folders *without* changing URLs.
  Two tools do this:

  - **Route groups — `(name)`.** A folder wrapped in parentheses organizes routes
    but is **omitted from the URL**. `app/(marketing)/about/page.js` still serves
    `/about`, not `/marketing/about`. Great for grouping pages that share a layout
    (e.g. all marketing pages vs. all app pages).
  - **Private folders — `_name`.** A folder prefixed with an underscore is **not
    routable at all** — Next.js ignores it for routing. Use it to colocate helper
    files (components, utilities) inside `app/` without accidentally creating a
    route. `app/_components/Card.js` is just a component file.

- **Code example:**

  ```text
  app/
  ├─ (marketing)/          ← route GROUP — not in the URL
  │  ├─ layout.js          ← a layout shared by just these pages
  │  ├─ about/page.js      → /about        (note: NOT /marketing/about)
  │  └─ contact/page.js    → /contact
  ├─ _components/          ← PRIVATE folder — never a route
  │  ├─ Nav.js
  │  └─ Footer.js
  └─ page.js               → /
  ```

- **Mini-exercise:**
  Move your `Nav` and `Footer` components into `app/_components/` and import them
  into your root layout. Confirm the site still works and that
  `/_components/Nav` is *not* a reachable URL.

- **Why this matters:**
  A flat, messy `app/` becomes unmanageable fast. These two tools let you keep a
  tidy, professional structure while keeping clean URLs — a real-world skill
  reviewers notice.

> **COMMON MISTAKE TO AVOID**
> Expecting `(marketing)` to appear in the URL, or expecting `_components` to be
> visitable. Parentheses disappear from URLs; underscore folders are invisible to
> routing entirely. That's the whole point — but it surprises people the first
> time.

---

## SECTION 4: Data, Loading & Errors

### MODULE 13: Fetching Data in Server Components
*[ADDED — core concept: fetching data in Server Components (async/await directly).]*

- **Learning objective:** Fetch data directly inside a Server Component using `async`/`await`, with no `useEffect`.

- **Plain-English explanation:**
  Here's a genuinely delightful App Router feature: **Server Components can be
  `async` functions and `await` data directly.** No `useEffect`, no loading-state
  juggling, no `useState`. You fetch on the server, and the page arrives already
  filled with data. This is simpler *and* faster than the old client-side pattern,
  and it keeps API keys on the server.

- **Code example:**

  ```jsx
  // app/blog/page.js — a Server Component that fetches the post list.
  async function getPosts() {
    const res = await fetch("https://api.example.com/posts");
    if (!res.ok) throw new Error("Failed to load posts");
    return res.json();
  }

  export default async function BlogIndex() {
    const posts = await getPosts(); // await directly — we're on the server
    return (
      <ul>
        {posts.map((post) => (
          <li key={post.id}>{post.title}</li>
        ))}
      </ul>
    );
  }
  ```

- **Mini-exercise:**
  Make your `/blog` index fetch a list of posts (use a free placeholder API like
  `jsonplaceholder.typicode.com/posts`, or a local array to start) and render the
  titles as a list of `<Link>`s to `/blog/[slug]`. No `useEffect` allowed.

- **Why this matters:**
  This pattern eliminates an entire category of beginner bugs (loading flags, race
  conditions, effect dependency arrays) for the common case of "show data on page
  load." It's the single biggest day-to-day quality-of-life win in the App Router.

> **COMMON MISTAKE TO AVOID**
> **Reaching for `useEffect` + `useState` to fetch data when a Server Component
> would do.** If the data is needed at render time and doesn't depend on user
> interaction, fetch it in an `async` Server Component instead. Save `useEffect`
> for genuinely client-side, post-interaction needs.

---

### MODULE 14: Static vs. Dynamic Data Fetching
*[ADDED — core concept: static vs dynamic data fetching; connects back to Module 2's strategies.]*

- **Learning objective:** Control whether a fetch is cached (static) or fresh on every request (dynamic), and pick the right one.

- **Plain-English explanation:**
  In **Next.js 15, `fetch` is *not* cached by default** — each request re-fetches
  the data (this changed from older versions, where `fetch` was cached unless you
  opted out, so older tutorials will tell you the opposite). You opt *into*
  caching per fetch with options, or set behavior per route with segment config:

  - **Cached (static, SSG):** opt in with `fetch(url, { cache: "force-cache" })`;
    the result is reused; fast and cheap.
  - **Revalidated (ISR):** re-fetch at most every N seconds with
    `fetch(url, { next: { revalidate: 60 } })` or `export const revalidate = 60`.
  - **Dynamic (always fresh, SSR):** the default; or make it explicit with
    `fetch(url, { cache: "no-store" })` or `export const dynamic = "force-dynamic"`.

- **Code example:**

  ```jsx
  // Cached (static): opt in with force-cache so the result is reused.
  const a = await fetch("https://api.example.com/stable-data", {
    cache: "force-cache",
  });

  // ISR: refresh at most once per 60 seconds.
  const b = await fetch("https://api.example.com/posts", {
    next: { revalidate: 60 },
  });

  // Dynamic (default in Next 15): fetch fresh on every single request.
  const c = await fetch("https://api.example.com/live-prices");
  ```

- **Mini-exercise:**
  Set your `/blog` index to revalidate every 60 seconds. In a notes file, justify
  why a blog index is a good fit for ISR rather than fully dynamic SSR (hint:
  traffic vs. freshness trade-off from Module 2).

- **Why this matters:**
  This is *how you actually pick a rendering strategy in the App Router* — not by
  naming SSR/SSG/ISR, but by choosing caching behavior on your fetches. Getting
  this right is the difference between a blazing static site and one that
  needlessly rebuilds on every request.

> **COMMON MISTAKE TO AVOID**
> **Not knowing whether your data is cached.** In Next.js 15 a plain `fetch` is
> *uncached*, so beginners are sometimes surprised their site re-fetches on every
> request. The opposite trap bites too: once you add `cache: "force-cache"`, the
> data is frozen and "won't update" until you redeploy — so reach for
> `revalidate` (ISR) when cached data still needs to refresh on a schedule.
> Knowing *which* caching behavior you opted into is essential.

---

### MODULE 15: Loading UI and Suspense (`loading.js`)
*[ADDED — core concept: loading UI and Suspense.]*

- **Learning objective:** Show an instant loading state while a page's data is being fetched.

- **Plain-English explanation:**
  When a Server Component is fetching data, you don't want users staring at a
  blank screen. Drop a **`loading.js`** file next to a `page.js`, and Next.js
  automatically shows it while that route's data loads — it's built on React
  **Suspense** under the hood, but you get it for free just by creating the file.
  The `loading.js` default-exports a component (a spinner, skeleton, or message).

- **Code example:**

  ```jsx
  // app/blog/loading.js — shown automatically while /blog fetches its data.
  export default function Loading() {
    return <p>Loading posts…</p>; // swap for a nicer skeleton later
  }
  ```

- **Mini-exercise:**
  Add `loading.js` to your `/blog` route. To actually *see* it, temporarily add an
  artificial delay in your data fetch (e.g. `await new Promise(r =>
  setTimeout(r, 1500))`). Confirm the loading UI flashes before the posts appear,
  then remove the delay.

- **Why this matters:**
  Perceived performance is real performance to users. A loading state makes your
  site feel responsive instead of broken, and Next.js makes it a one-file feature
  instead of manual state management.

> **COMMON MISTAKE TO AVOID**
> Expecting `loading.js` to appear on fully static pages — there's nothing to wait
> for, so it won't show. It applies to routes that do real async work at request
> time. If you never see it, your route may be fully static (which is fine!).

---

### MODULE 16: Error Handling — `error.js` and `not-found.js`
*[ADDED — core concept: error handling with error.js; not-found.js bundled here as the brief lists both file conventions.]*

- **Learning objective:** Gracefully catch runtime errors and handle missing content with dedicated files.

- **Plain-English explanation:**
  Two special files keep a broken page from breaking the whole site:

  - **`error.js`** — an automatic error boundary for its route. If a page throws,
    Next.js renders this instead of crashing. It **must** be a Client Component
    (`"use client"`) and receives `error` and a `reset()` function to retry.
  - **`not-found.js`** — shown when content doesn't exist. You trigger it by
    calling `notFound()` from `next/navigation`, or it renders automatically for
    unmatched URLs.

- **Code example:**

  ```jsx
  // app/blog/error.js — catches errors thrown anywhere in /blog.
  "use client"; // error boundaries must be Client Components

  export default function Error({ error, reset }) {
    return (
      <div>
        <h2>Something went wrong loading the blog.</h2>
        <button onClick={() => reset()}>Try again</button>
      </div>
    );
  }
  ```

  ```jsx
  // app/blog/[slug]/page.js — show the 404 page for a missing post.
  import { notFound } from "next/navigation";

  export default async function BlogPost({ params }) {
    const { slug } = await params;
    const post = await getPostBySlug(slug);
    if (!post) notFound(); // renders the nearest not-found.js
    return <article>{post.title}</article>;
  }
  ```

- **Mini-exercise:**
  Add `app/not-found.js` with a friendly "Post not found" message, and call
  `notFound()` in your `[slug]` page when the slug doesn't match a real post.
  Also add an `error.js` to `/blog` and force an error to see it catch.

- **Why this matters:**
  Real users hit broken links and flaky APIs. Handling these gracefully is the
  line between a hobby project and a production-minded one — and reviewers/employers
  look for exactly this.

> **COMMON MISTAKE TO AVOID**
> **Mixing App Router and Pages Router patterns.** `error.js`/`not-found.js` are
> App Router conventions; the old Pages Router used `_error.js`/`404.js` in a
> `pages/` folder. Don't follow a Pages Router tutorial inside an `app/` project —
> the file names and APIs differ and won't work. Pick App Router and stay in it.

---

## SECTION 5: Optimization & Production Features

### MODULE 17: Metadata API — Titles, Descriptions & Social Previews
*[ADDED — core concept: Metadata API (static and dynamic titles, descriptions, OG tags).]*

- **Learning objective:** Set per-page titles, descriptions, and Open Graph tags both statically and dynamically.

- **Plain-English explanation:**
  Good page titles and social-share previews are SEO and shareability basics.
  Next.js handles them with the **Metadata API** — no manual `<head>` editing.
  Two ways:

  - **Static metadata:** `export const metadata = {...}` from a `layout.js` or
    `page.js`.
  - **Dynamic metadata:** `export async function generateMetadata({ params })`
    when the title depends on data (e.g. a blog post's title).

- **Code example:**

  ```jsx
  // Static metadata on a regular page.
  export const metadata = {
    title: "About | My Portfolio",
    description: "Who I am and what I build.",
    openGraph: { title: "About Me", description: "Who I am and what I build." },
  };
  export default function AboutPage() {
    return <h1>About</h1>;
  }
  ```

  ```jsx
  // Dynamic metadata for a blog post — title comes from the data.
  export async function generateMetadata({ params }) {
    const { slug } = await params;
    const post = await getPostBySlug(slug);
    return {
      title: `${post.title} | My Blog`,
      description: post.excerpt,
    };
  }
  ```

- **Mini-exercise:**
  Give every page a unique, descriptive `<title>` via static metadata. Then add
  `generateMetadata` to your `[slug]` blog page so each post's browser tab shows
  the post's title. Verify by checking the browser tab text on different posts.

- **Why this matters:**
  A site with `localhost` or "Create Next App" as its title looks unfinished and
  ranks poorly. Per-page metadata is a small effort with an outsized impact on how
  professional and discoverable your portfolio is.

---

### MODULE 18: Image Optimization with `next/image`
*[ADDED — core concept: image optimization with next/image.]*

- **Learning objective:** Use the `<Image>` component to serve optimized, responsive images.

- **Plain-English explanation:**
  Images are usually a site's heaviest assets. Next.js's **`<Image>`** component
  (from `next/image`) automatically resizes, compresses, lazy-loads, and serves
  modern formats — and it reserves space to prevent layout shift. You give it a
  `src`, `alt`, and dimensions; Next.js does the heavy lifting.

- **Code example:**

  ```jsx
  import Image from "next/image";

  export default function Avatar() {
    return (
      <Image
        src="/me.jpg"     // a file in /public
        alt="A photo of me" // required for accessibility
        width={200}        // intrinsic size (prevents layout shift)
        height={200}
        priority           // load eagerly for above-the-fold images
      />
    );
  }
  ```

- **Mini-exercise:**
  Add a profile photo to `public/` and display it on your `/about` page using
  `<Image>`. Open the browser dev tools Network tab and note that the served image
  is optimized (smaller than the original).

- **Why this matters:**
  Fast image loading directly affects Core Web Vitals, SEO ranking, and user
  perception. Using `<Image>` instead of `<img>` is one of the easiest big wins in
  the whole framework.

> **COMMON MISTAKE TO AVOID**
> Using external image URLs without configuring them. To use `<Image src="https://…">`
> from another domain, you must whitelist that domain in `next.config.js` under
> `images.remotePatterns`, or Next.js will refuse to optimize it.

---

### MODULE 19: Font Optimization with `next/font`
*[ADDED — core concept: font optimization with next/font.]*

- **Learning objective:** Load web fonts efficiently with zero layout shift using `next/font`.

- **Plain-English explanation:**
  Web fonts can be slow and cause text to "flash" or jump as they load.
  **`next/font`** self-hosts fonts (including Google Fonts) automatically, removes
  the extra network request to Google, and eliminates layout shift — all by
  importing the font and applying its `className`.

- **Code example:**

  ```jsx
  // app/layout.js
  import { Inter } from "next/font/google";

  const inter = Inter({ subsets: ["latin"] }); // optimized at build time

  export default function RootLayout({ children }) {
    return (
      <html lang="en">
        {/* Apply the font class on <body> — the canonical next/font idiom. */}
        <body className={inter.className}>{children}</body>
      </html>
    );
  }
  ```

- **Mini-exercise:**
  Apply a Google font (e.g. Inter) to your whole site via the root layout. Reload
  and confirm there's no flash of a different font on load.

- **Why this matters:**
  Typography sets the entire feel of a site, and font loading is a common source
  of jank. `next/font` makes professional, performant typography a two-line change.

---

### MODULE 20: Environment Variables — `.env.local` and `NEXT_PUBLIC_`
*[ADDED — core concept: environment variables and when to use NEXT_PUBLIC_.]*

- **Learning objective:** Store configuration and secrets correctly, and know which variables are safe to expose to the browser.

- **Plain-English explanation:**
  Things like API base URLs and keys don't belong hard-coded in your components.
  Put them in a **`.env.local`** file (which is git-ignored by default — never
  commit secrets). The critical rule:

  - Variables **without** the `NEXT_PUBLIC_` prefix are **server-only** — safe for
    secrets. They're available in Server Components and Route Handlers, never sent
    to the browser.
  - Variables **with** the `NEXT_PUBLIC_` prefix are **bundled into the browser
    code** — readable by anyone. Use this prefix *only* for non-secret values you
    intentionally expose to client code.

- **Code example:**

  ```bash
  # .env.local  (git-ignored — never commit this file)
  API_SECRET_KEY=super-secret-do-not-expose      # server-only
  NEXT_PUBLIC_SITE_URL=https://myportfolio.com    # safe to expose to the browser
  ```

  ```jsx
  // In a Server Component — both are readable here.
  const key = process.env.API_SECRET_KEY;          // OK, stays on the server
  const url = process.env.NEXT_PUBLIC_SITE_URL;     // OK
  // In a Client Component — only NEXT_PUBLIC_ ones exist.
  ```

- **Mini-exercise:**
  Create a `.env.local` with a `NEXT_PUBLIC_SITE_URL` and use it somewhere (e.g.
  in your metadata's canonical URL). Confirm `.env.local` is listed in
  `.gitignore` so you never accidentally commit it.

- **Why this matters:**
  Exposing a secret key to the browser is a real security incident that happens to
  beginners constantly. The `NEXT_PUBLIC_` rule is the guardrail — understanding it
  protects you and any API you connect to.

> **COMMON MISTAKE TO AVOID**
> **Incorrect environment variable naming.** Two failure modes: (1) prefixing a
> secret with `NEXT_PUBLIC_` and leaking it to the browser, and (2) expecting a
> *non*-`NEXT_PUBLIC_` variable to be readable in a Client Component (it'll be
> `undefined`). Also: after editing `.env.local`, **restart the dev server** —
> env changes aren't hot-reloaded.

---

### MODULE 21: API Routes / Route Handlers (`app/api/`)
*[ADDED — core concept: API Routes / Route Handlers.]*

- **Learning objective:** Create your own backend endpoints inside the same project using Route Handlers.

- **Plain-English explanation:**
  Next.js isn't just frontend — you can build API endpoints in the same project. A
  **`route.js`** file inside `app/api/` (any nested path) becomes an HTTP endpoint.
  You export functions named after HTTP methods (`GET`, `POST`, etc.). This is
  where you'd handle a contact-form submission, proxy a third-party API with your
  secret key safely on the server, or serve JSON.

- **Code example:**

  ```jsx
  // app/api/contact/route.js  →  endpoint at /api/contact
  import { NextResponse } from "next/server";

  // Handles GET /api/contact
  export async function GET() {
    return NextResponse.json({ status: "ok" });
  }

  // Handles POST /api/contact
  export async function POST(request) {
    const data = await request.json(); // read the submitted body
    // ...do something with data (e.g. send an email) — secret keys are safe here
    return NextResponse.json({ received: true });
  }
  ```

- **Mini-exercise:**
  Create a `/api/hello` Route Handler that returns `{ message: "Hello from the
  API" }` as JSON. Visit `/api/hello` in your browser to see the response. (Bonus:
  fetch it from a Client Component button.)

- **Why this matters:**
  Route Handlers let your portfolio do real backend things — a working contact
  form, a safe proxy to a paid API — without standing up a separate server. It's
  the gateway to full-stack work in the intermediate track.

> **COMMON MISTAKE TO AVOID**
> Naming the file `page.js` instead of `route.js` for an API endpoint (or vice
> versa). A folder can have *one or the other*, not both serving the same path:
> `page.js` renders UI; `route.js` serves data. Mixing them up yields confusing
> errors.

---

### MODULE 22: Middleware Basics
*[ADDED — core concept: middleware basics.]*

- **Learning objective:** Run code before a request completes — e.g. to redirect or set headers — using `middleware.js`.

- **Plain-English explanation:**
  **Middleware** is code that runs *before* a request reaches a page or API route.
  It lives in a single `middleware.js` file at the project root and is great for
  cross-cutting concerns: redirects, basic gating, setting headers, or rewriting
  URLs. It runs on every matching request, so keep it fast and simple. (Full auth
  belongs in the intermediate track — here we just learn the shape.)

- **Code example:**

  ```jsx
  // middleware.js (project root)
  import { NextResponse } from "next/server";

  export function middleware(request) {
    // Example: redirect an old URL to a new one.
    if (request.nextUrl.pathname === "/old-blog") {
      return NextResponse.redirect(new URL("/blog", request.url));
    }
    return NextResponse.next(); // otherwise, continue as normal
  }

  // Only run this middleware on these paths.
  export const config = {
    matcher: ["/old-blog", "/blog/:path*"],
  };
  ```

- **Mini-exercise:**
  Add middleware that redirects `/old-blog` to `/blog`. Visit `/old-blog` and
  confirm the URL changes to `/blog` automatically.

- **Why this matters:**
  Middleware is your first taste of controlling the request lifecycle — a concept
  that scales into authentication, A/B testing, and localization later. Knowing it
  exists (and its single-file convention) prevents you from reinventing it badly in
  each page.

> **COMMON MISTAKE TO AVOID**
> Forgetting the `matcher` config and accidentally running middleware on *every*
> request (including static assets), which slows things down. Scope it with
> `matcher` to only the paths that need it.

---

## SECTION 6: Ship It

### MODULE 23: Deploying to Vercel
*[ADDED — core concept: deploying to Vercel (the standard beginner path).]*

- **Learning objective:** Deploy your finished portfolio to the public internet via Vercel.

- **Plain-English explanation:**
  Vercel is the company that builds Next.js, so deploying there is the smoothest,
  free, beginner path. The flow: push your project to a GitHub repo, import that
  repo into Vercel, and Vercel builds and hosts it — redeploying automatically
  every time you push. You also set your environment variables in Vercel's
  dashboard (since `.env.local` isn't committed).

- **Code example (the deploy workflow, as commands + steps):**

  ```bash
  # 1. Make sure it builds locally first — fix any errors here, not in production.
  npm run build

  # 2. Commit and push to GitHub.
  git add .
  git commit -m "Portfolio ready to deploy"
  git push origin main
  ```

  ```text
  # 3. In the browser:
  #    - Go to vercel.com and sign in with GitHub.
  #    - "Add New… → Project" → import your portfolio repo.
  #    - Add env vars (e.g. NEXT_PUBLIC_SITE_URL) in Project Settings → Environment Variables.
  #    - Click Deploy. Vercel gives you a live URL like my-portfolio.vercel.app.
  #    - Every future "git push" auto-deploys.
  ```

- **Mini-exercise:**
  Run `npm run build` locally and resolve any errors. Push to GitHub, import to
  Vercel, set your env var(s), and deploy. Share your live URL — it's now a real,
  linkable portfolio.

- **Why this matters:**
  A project that isn't deployed can't go on a résumé or be shared with an employer.
  This module turns "code on my laptop" into "a live website with my name on it" —
  the entire point of the course.

> **COMMON MISTAKE TO AVOID**
> Forgetting to set environment variables in the Vercel dashboard. `.env.local`
> isn't committed, so the deployed site won't have those values unless you add them
> in Vercel. A build that works locally but breaks in production is very often a
> missing env var.

---

## SECTION 7: Glossary & Cheatsheet

### MODULE 24: Glossary of Next.js Terms
*[ADDED — brief requires a glossary covering all Next.js-specific terms introduced.]*

- **Learning objective:** Have a single, plain-English reference for every Next.js term used in this course.

| Term | What it means |
|---|---|
| **Next.js** | A React framework that adds routing, rendering, data fetching, and optimization on top of React. |
| **React** | The UI library Next.js is built on; you compose UI from components. |
| **App Router** | The current routing system based on the `app/` directory (used throughout this course). |
| **Pages Router** | The older routing system based on a `pages/` directory; legacy — don't mix it with the App Router. |
| **Server Component** | A component that runs on the server (the default in `app/`); can fetch data directly, ships no JS for itself, can't use hooks/interactivity. |
| **Client Component** | A component marked `"use client"` that runs in the browser; can use hooks, state, and event handlers. |
| **`"use client"`** | The directive (first line of a file) that opts a component into being a Client Component. |
| **`page.js`** | Makes its folder a visitable route/URL. |
| **`layout.js`** | Shared UI shell that wraps a route and its children; doesn't re-render on navigation between children. |
| **`loading.js`** | Auto-shown loading UI (Suspense fallback) while a route's data loads. |
| **`error.js`** | An error boundary for a route; must be a Client Component. |
| **`not-found.js`** | UI shown for missing content / unmatched URLs; triggered by `notFound()`. |
| **`route.js`** | Defines an API endpoint (Route Handler) via exported HTTP-method functions. |
| **Dynamic route** | A bracketed folder (`[slug]`) whose URL segment is a variable. |
| **Catch-all route** | `[...slug]` — matches one or more URL segments. |
| **Optional catch-all** | `[[...slug]]` — matches zero or more URL segments (including the bare parent). |
| **Route group** | A `(name)` folder that organizes routes without appearing in the URL. |
| **Private folder** | A `_name` folder excluded from routing; for colocating helpers. |
| **`params`** | The object holding dynamic route values (e.g. `params.slug`); awaited in current Next.js. |
| **CSR** | Client-Side Rendering — the browser builds the page from JS. |
| **SSR** | Server-Side Rendering — the server builds full HTML on every request. |
| **SSG** | Static Site Generation — HTML built once at build time (a route renders this way when it does no dynamic/uncached data work). |
| **ISR** | Incremental Static Regeneration — static pages that re-build on a schedule (`revalidate`). |
| **`revalidate`** | Time (seconds) after which cached/static data is refreshed (enables ISR). |
| **`cache: "no-store"`** | A fetch option forcing fresh, uncached data on every request (dynamic/SSR). |
| **Metadata API** | The `metadata` export / `generateMetadata` function for titles, descriptions, and OG tags. |
| **`next/image`** | The `<Image>` component for automatic image optimization. |
| **`next/font`** | Utility for self-hosted, layout-shift-free web fonts. |
| **`next/link`** | The `<Link>` component for fast client-side navigation. |
| **`useRouter`** | Hook (from `next/navigation`) for programmatic navigation in Client Components. |
| **Route Handler** | An API endpoint defined in a `route.js` file under `app/`. |
| **Middleware** | Code in `middleware.js` that runs before a request reaches a route. |
| **`NEXT_PUBLIC_`** | Env-var prefix that exposes a value to browser code; omit it for server-only secrets. |
| **`.env.local`** | Git-ignored file for environment variables and secrets. |
| **Fast Refresh** | Dev feature that updates the browser instantly on save, preserving state. |
| **Vercel** | The hosting platform (by Next.js's makers) used for the standard deploy path. |

---

### MODULE 25: Quick-Reference Cheatsheet
*[ADDED — brief requires a cheatsheet covering file conventions, data fetching patterns, and routing patterns.]*

- **Learning objective:** Have a one-page lookup for the conventions you'll use most.

**File conventions (inside `app/`):**

| File | Purpose |
|---|---|
| `layout.js` | Shared shell wrapping a route + its children |
| `page.js` | Makes the folder a visitable route |
| `loading.js` | Loading UI shown while the route loads |
| `error.js` | Error boundary (must be `"use client"`) |
| `not-found.js` | UI for missing content / 404 |
| `route.js` | API endpoint (Route Handler) |
| `middleware.js` | Runs before requests (project root, not in `app/`) |

**Routing patterns:**

| Folder | Matches | Example URL |
|---|---|---|
| `about/` | `/about` | `/about` |
| `blog/[slug]/` | one dynamic segment | `/blog/hello` |
| `docs/[...slug]/` | one or more segments | `/docs/a/b/c` |
| `shop/[[...slug]]/` | zero or more segments | `/shop` and `/shop/a/b` |
| `(group)/` | organizes; not in URL | child paths only |
| `_folder/` | not routable | (none — ignored) |

**Data fetching patterns:**

```jsx
// Cached (static): opt in — Next 15 does NOT cache fetch by default.
await fetch(url, { cache: "force-cache" });

// ISR: refresh at most every 60s.
await fetch(url, { next: { revalidate: 60 } });
// or, per route:  export const revalidate = 60;

// Dynamic (SSR, the Next 15 default): always fresh, never cached.
await fetch(url, { cache: "no-store" });
// or, per route:  export const dynamic = "force-dynamic";

// Fetch directly in an async Server Component — no useEffect:
export default async function Page() {
  const data = await fetch(url).then((r) => r.json());
  return <pre>{JSON.stringify(data)}</pre>;
}
```

**The "use client" decision in one line:**
> Server by default. Add `"use client"` only when you use `useState`, `useEffect`,
> `useRouter`, an event handler (`onClick`, …), or a browser-only API.

---

## What's Next — The Intermediate Track

These topics are genuinely useful but would overwhelm a true beginner and were
deliberately kept out of this track. They're listed here so students know where
they're headed.

- **[MOVED TO INTERMEDIATE — TypeScript adds a second new language layer on top of an already-new framework; introducing it here doubles the cognitive load. Learn Next.js in JS first, then convert.]** TypeScript with Next.js (typing props, `params`, Route Handlers).
- **[MOVED TO INTERMEDIATE — Authentication is a deep, security-sensitive topic requiring sessions, providers, and middleware mastery; premature exposure leads to insecure copy-paste auth.]** Authentication (NextAuth/Auth.js, sessions, protected routes).
- **[MOVED TO INTERMEDIATE — Databases and ORMs introduce schema design, migrations, and connection management — a whole discipline orthogonal to learning the framework itself.]** Databases and ORMs (Prisma, Drizzle, Postgres).
- **[MOVED TO INTERMEDIATE — Server Actions and mutations build directly on solid Server/Client Component fundamentals and data-fetching intuition that this track is establishing first.]** Server Actions and form mutations.
- **[MOVED TO INTERMEDIATE — Advanced caching/revalidation tactics (tag-based revalidation, `revalidatePath`/`revalidateTag`) are refinements that only make sense after the static-vs-dynamic basics land.]** Advanced caching and on-demand revalidation.
- **[MOVED TO INTERMEDIATE — Testing, CI, and performance profiling are professional-workflow skills best layered on once a student can already build and ship.]** Testing (Playwright/Vitest), CI, and performance profiling.

> **YOU'VE COMPLETED THE BEGINNER TRACK WHEN…**
> - [ ] You can scaffold a Next.js App Router project and explain its folder structure.
> - [ ] You can create static, dynamic (`[slug]`), and grouped routes.
> - [ ] You can explain Server vs. Client Components and choose correctly.
> - [ ] You can fetch data in a Server Component and pick static/ISR/dynamic deliberately.
> - [ ] You can add loading, error, and not-found states.
> - [ ] You can set metadata, optimize images and fonts, and use env vars safely.
> - [ ] You can build a Route Handler and a basic middleware redirect.
> - [ ] **You have a live, deployed portfolio + blog on Vercel with your name on it.**
