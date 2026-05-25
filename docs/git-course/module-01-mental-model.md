# Module 01 — The Mental Model

Before you touch a terminal, before you type a single Git command, you need a picture in your head. Not a diagram from a textbook — a real mental model of what Git is doing and why. Developers who skip this step spend months knowing the commands but not knowing what they mean. This module gives you the picture. Module 02 gives you the practice.

> **WHAT YOU'LL BE ABLE TO DO**
> Explain what version control is, why it exists, what Git actually is (and what it isn't), and how the three core areas of a Git repo relate to each other — in plain English, to anyone who asks.

---

## 1.1 The problem Git solves

**READ**

You've already invented version control. You just called it something else.

If you've ever saved a file as `resume_final.docx`, then later as `resume_final_2.docx`, then `resume_final_ACTUAL_FINAL.docx`, then `resume_SEND_THIS_ONE.docx` — congratulations. You were doing version control manually, without a system, and it was chaos.

The problem isn't that you were doing something wrong. The problem is that the *need* you were solving — keeping a history of changes so you can go back, compare, or branch off into something new without losing what you had — is real, universal, and important. You just didn't have a tool for it.

Git is that tool. It keeps a complete history of every intentional save point you make in a project. It lets you go backward to any of them. It lets you branch off into an experiment without touching the working version. It lets you collaborate with other people without overwriting each other's work. And it does all of this automatically, precisely, and in a way that doesn't rely on you remembering to duplicate a folder.

> **THE REAL POINT**
> Git doesn't create a new workflow. It formalizes one you already have instinctively — the urge to save your work at meaningful points, keep a record of what changed, and be able to go back when something breaks. The commands are just the names for moves you already want to make.

---

## 1.2 What Git is — and what it isn't

**READ**

Git is a **version control system** — software that tracks changes to files over time and lets you move through that history. It runs entirely on your local machine. It doesn't need the internet. It doesn't need a GitHub account. It doesn't need anything except Git itself and a folder of files.

It's also worth clearing up the most common confusion before you hit it.

**Git is not GitHub.**

Git is the tool. GitHub is a website that hosts Git repositories online and adds collaboration features on top. You can use Git without GitHub. You can push code to GitHub, GitLab, Bitbucket, or nowhere at all. GitHub didn't build Git — Linus Torvalds (the creator of Linux) did, in 2005, to manage the Linux kernel's development.

The relationship: Git is the engine. GitHub is one of many garages that engine can park in.

| Git | GitHub |
|---|---|
| Software on your computer | A website |
| Tracks changes locally | Hosts repos online |
| Works offline | Requires the internet |
| Free, open-source | Free tier + paid plans |
| Built in 2005 | Founded in 2008 |

> **WHY THIS MATTERS**
> New developers conflate Git and GitHub constantly, then get confused when something "Git" doesn't require signing in, or something "GitHub" isn't actually a Git command. The distinction is worth keeping clear: Git is the skill. GitHub is a platform where that skill is visible to employers, collaborators, and clients.

---

## 1.3 The three trees — the mental model everything else runs on

**UNDERSTAND**

Every Git repo has three areas where your files can live at any moment. Understanding these three areas is the key to understanding every Git command you'll ever use. They're sometimes called the three trees.

**1. The Working Directory**

This is your project folder — the files as they exist right now on your computer. When you open a file and edit it, you're working in the working directory. Git knows this area exists, but it isn't automatically tracking every keystroke you make. It's watching, not recording.

**2. The Staging Area** *(also called the Index)*

This is the middle step — a holding area where you place changes you've decided to include in your next snapshot. Think of it as a shopping cart. Edited a file? You decide whether to put it in the cart. When you're ready, you check out — and that cart becomes one clean, complete snapshot.

The staging area is why you can make five unrelated changes in a session and commit them as two separate, meaningful snapshots instead of one messy blob. It gives you control over the *shape* of your history, not just the fact that you saved something.

**3. The Repository** *(the `.git` folder)*

This is where Git stores every snapshot you've committed. It lives in a hidden folder called `.git/` inside your project. Your entire history — every commit, every branch, every tag — is in there. Delete it, and you've deleted the history. Leave it alone, and you have a complete record of every intentional save point you've ever made.

```
┌─────────────────────────────────────────────────┐
│                                                 │
│  WORKING DIRECTORY      STAGING AREA            │
│  ─────────────────      ────────────            │
│  Files as they are      Files ready to commit   │
│  right now on disk      (the cart)              │
│                                                 │
│  You edit here  →  git add  →  staged here  →  │
│                                                 │
│                         git commit              │
│                              │                  │
│                              ↓                  │
│                    REPOSITORY (.git/)           │
│                    ───────────────────          │
│                    Permanent history            │
│                    of every commit              │
│                                                 │
└─────────────────────────────────────────────────┘
```

> **THE REAL POINT**
> Every Git command moves files between these three areas, or shows you the difference between them. That's the whole model. `git add` moves from working directory to staging. `git commit` moves from staging to the repository. `git status` shows you what's in each area right now. Once you have this picture, the commands stop being random incantations and start being obvious moves.

---

## 1.4 What a commit actually is

**UNDERSTAND**

When you commit, Git doesn't save a copy of each file in full. It saves a **snapshot** — the complete state of every tracked file at that moment — plus a small envelope of metadata: who made it, when, and a message describing what changed.

Each snapshot is identified by a **commit hash** — a long string like `a3f8d72c1b9e4f0...` that's automatically generated. You don't type these; Git creates them. Each one is unique. Each one points to the exact snapshot you committed.

Your repository history is a chain of these snapshots:

```
[Initial commit]  →  [Add nav bar]  →  [Style hero section]  →  [Fix mobile layout]
     a3f8d72             c1b9e4f             72d8a1b                  e0f3c9a
```

Each commit knows which commit came before it. That chain is your history. You can travel to any point in it.

> **WHY THIS MATTERS**
> Because commits are snapshots, not diffs, you can always reconstruct the exact state of your project at any point. Not "here's what changed" — the actual files, exactly as they were. This is what makes time travel possible in Git: you're not rewinding a tape, you're loading a save file.

---

## 1.5 Why the staging area exists

**UNDERSTAND**

The staging area feels like an extra step the first time you use it. "Why can't I just commit directly from the working directory?" You can — other version control systems work that way. Git chose the extra step deliberately, and once you understand why, you'll be glad.

Here's the scenario. You're working on a project. In one afternoon, you:

- Fix a bug in the login form
- Add a new section to the homepage
- Update three outdated comments in a utility file

All three of these changes are in your working directory, mixed together in different files. If you committed everything at once, you'd have one commit that reads "do a bunch of stuff" — which is nearly useless as history.

With the staging area, you can:

1. Stage just the login fix → commit it as `fix: prevent empty form submission`
2. Stage just the homepage section → commit it as `add: features section to homepage`
3. Stage just the comment updates → commit it as `chore: update outdated utility comments`

Three focused, readable commits — from one afternoon of mixed work. The staging area gave you that control.

> **TIP**
> You don't have to use the staging area to do surgical, file-by-file commits every single time. For small solo projects, `git add .` followed by `git commit -m "a clear message"` is fine. The staging area earns its keep when your changes get complex — multiple features, mixed contexts, or collaboration with others. Know it's there; reach for it when you need it.

---

## 1.6 What a repository actually is

**READ**

A repository — usually called a **repo** — is a project that Git is tracking. Specifically, it's a folder with a hidden `.git/` directory inside it. That `.git/` folder is the entire database: every commit, every branch, every config setting for this project.

There are two kinds of repo you'll work with:

**Local repo** — the one on your machine. This is where you do your work. Everything in this module lives here.

**Remote repo** — a copy of the repo hosted somewhere else, typically GitHub. When you push your code, you're sending your local commits to the remote. When you pull, you're bringing the remote's new commits down to your local copy.

The remote doesn't exist until you create it. Your local repo is complete and functional without one — you can commit, branch, and read history entirely offline. The remote is how you back up your work, collaborate with others, and make your portfolio visible.

> **THE REAL POINT**
> A repo is not a folder on GitHub. It starts on your machine. GitHub is a copy. Knowing this matters for the way you think about pushing, pulling, and branching: you're always syncing two versions of the same history — local and remote — not uploading files to a folder in the cloud.

---

## 1.7 The vocabulary map

**READ**

Git has its own language, and the first week is mostly learning what the words mean. Here's a glossary of the terms that appear in every conversation about Git — defined once, plainly, so you can move through the rest of this course without stopping to look them up.

| Term | What it means |
|---|---|
| **repository (repo)** | A project folder that Git is tracking |
| **working directory** | The files as they currently exist on your machine |
| **staging area (index)** | The holding area for changes you've decided to commit |
| **commit** | A saved snapshot of your staged files, with a message and metadata |
| **hash** | The unique ID Git assigns to each commit (e.g. `a3f8d72`) |
| **HEAD** | A pointer to the commit you're currently working from — usually the latest commit on your current branch |
| **branch** | A separate line of commits that diverges from the main line — covered in Module 03 |
| **main** | The default branch name in modern Git repos (older repos use `master`) |
| **remote** | A copy of the repo hosted somewhere else (GitHub, GitLab, etc.) |
| **push** | Send your local commits to the remote |
| **pull** | Bring the remote's new commits down to your local repo |
| **clone** | Copy an existing remote repo to your local machine |
| **origin** | The default name Git gives to the remote your local repo was cloned from or connected to |

> **TIP**
> Don't try to memorize this list. Come back to it when a word confuses you. The terms that matter now are: repo, commit, working directory, staging area, and HEAD. The rest will become obvious as you use them.

---

## Lab 1 · Read before you run

**DO**

This lab has no commands. That's intentional.

Open a real GitHub repository — pick any project that interests you. Here are three good starting points:

- `github.com/sindresorhus/awesome` — a simple, readable repo
- `github.com/nicedoc/onepage` — small enough to see everything at once
- Any open-source project you've used or heard of

Spend 15 minutes reading the repository, not the code. Look at:

1. **The commit history** — click "X commits" at the top of the file list. Read the messages. Can you follow the story of how the project got built?
2. **A single commit** — click any commit in the history. What changed? Can you read the diff?
3. **The branches** — click the branch dropdown. How many branches are there? What are they named?
4. **The README** — what does the project do? Is it clear?

Then write three sentences in a note somewhere:

- What the project is
- What you can learn from its commit history
- One thing you'd do differently if this were your repo

> **YOU'VE GOT IT WHEN**
> You can look at a GitHub commit history and see a story — not random noise. You can tell a well-maintained repo from a messy one by the shape of its commits. That eye develops fast once you know what to look for.

---

## MODULE 01 — CHECK YOURSELF

You have the picture now. In Module 02, you'll run the commands that move files through these three areas — and each command will make immediate sense because you already know what it's trying to do.

1. In your own words: what problem does Git solve? Don't use the word "Git" in your answer.
2. What are the three trees in a Git repo, and what role does each one play?
3. What's the difference between Git and GitHub? Could you use one without the other?
4. A commit is a snapshot — not a diff. What's the practical consequence of that? What does it let you do?
5. Why does the staging area exist? Describe a situation where it earns its keep.
