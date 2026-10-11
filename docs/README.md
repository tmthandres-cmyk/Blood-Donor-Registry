# LifeLine Blood Donor Registry — GitHub Pages build

A static, client-side blood donor registry. Deploys to GitHub Pages with **no build
step, no server and no database**.

This is the same application as the PowerShell version in the parent folder, rewritten
to run entirely in the browser so it can be hosted on GitHub Pages.

---

## Deploy it

### 1. Create the repository

Make a new repository on GitHub (it can be empty — don't add a README).

### 2. Drag this one folder into it

Drag the **`docs` folder** (this folder) into your repo's main page.

That is the whole upload. Do **not** drag the individual files inside it, and do not
drag the parent `BloodDonorRegistry` folder.

Your repo should end up looking like this:

```
your-repo/
├── README.md          <- the one GitHub created
└── docs/
    ├── index.html
    ├── 404.html
    ├── robots.txt
    ├── .nojekyll
    ├── README.md
    ├── assets/
    └── tests/
```

### 3. Point GitHub Pages at the folder

**Repository → Settings → Pages → Build and deployment → Source: "Deploy from a branch"**
→ choose branch `main` and folder **`/docs`** → Save.

> This is the one setting people miss. If you leave it on `/ (root)` the site will
> 404, because `index.html` lives inside `docs`, not at the repo root.

Your site is live at `https://YOUR-USERNAME.github.io/YOUR-REPO/` within a minute.

**No GitHub Actions workflow is needed** — the "Deploy from a branch" setting above
publishes the site on its own.

---

## Demo accounts

Created automatically on first visit — nothing to set up.

| Role | Email | Password |
| --- | --- | --- |
| Administrator | `admin@stmichaelblood.org` | `Admin@12345` |
| Donor | `donor@stmichaelblood.org` | `Donor@12345` |

You can also just register your own account; it will be a **Donor**. Administrators
grant roles from the **Accounts** page.

---

## What is where

```
docs/
├── index.html              the whole app shell
├── 404.html                styled "page not found" (self-contained)
├── .nojekyll               stops Jekyll ignoring underscore folders
├── robots.txt
├── README.md
├── assets/
│   ├── css/styles.css      design system, mobile first
│   ├── img/                logo, favicon, hero illustration (SVG)
│   └── js/
│       ├── crypto.js         PBKDF2 password hashing
│       ├── store.js          localStorage data layer
│       ├── eligibility.js    donor screening rules
│       ├── validate.js       field-level validation
│       ├── auth.js           accounts and sessions
│       ├── ui.js             escaping and HTML components
│       ├── layout.js         header, nav, footer
│       ├── seed.js           first-run demo data
│       ├── router.js         hash routing and page guards
│       ├── app.js            bootstrap
│       └── views/            one file per feature area
└── tests/
    ├── run.html             open this in a browser to run the suite
    ├── __suite.js           assertion helper
    └── __tests.js           the tests
```

**Routes use the hash** (`#/donors`, `#/donors/abc/edit`) because GitHub Pages serves
only static files — there is no server to rewrite clean URLs.

Every path in the site is **relative**, so the app works whether it is served from
`user.github.io/` or `user.github.io/your-repo/`.

---

## Running the tests

Open `tests/run.html` on your deployed site and press **Run the tests**, or start a
local preview from the parent folder:

```powershell
..\serve.ps1          # then open http://localhost:8123/docs/
```

Latest run: **27 checks passing**, plus 32 route checks and 25 end-to-end CRUD/auth
checks verified in a real browser, with zero console errors.

---

## Honest limitations

This is a static site, and that has real consequences worth stating plainly.

**Data lives in one browser.** Records are kept in `localStorage`. They are not shared
between devices, not shared between people, and clearing your browsing data deletes
them. The app says this on the Data tools page and offers **Export** so you can keep a
backup. To share records you would need a hosted database.

**Login is not real security.** Passwords *are* hashed properly — PBKDF2-HMAC-SHA256,
a unique random salt per account, 150,000 rounds, and the plain text is never written
anywhere. But verification happens in the browser and the hashes sit in `localStorage`,
so anyone with dev tools can read them. That is fine for a demonstration or coursework
submission and **is not** a substitute for server-side authentication.

**Single-file version.** `..\build-single-file.ps1` bundles everything — CSS, all 19
scripts and every SVG as a data URI — into one self-contained `index.html` (284 KB, no
external requests). Useful for handing in, or for hosting somewhere that serves a
single file.

---

## Credits

Artwork is hand-authored SVG. No frameworks, no CDN libraries, no build tooling — just
HTML, CSS and vanilla JavaScript, so the site cannot break because a dependency moved.