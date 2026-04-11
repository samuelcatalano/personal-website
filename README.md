# Samuel Catalano – Personal Website

Personal portfolio / CV website hosted on GitHub Pages.

## 🚀 Deploy to GitHub Pages

### 1. Create the repository

```bash
gh repo create personal-website --public --description "My personal website"
```

Or create it manually at https://github.com/new — name it `personal-website`, set it to **Public**.

### 2. Clone and add the files

```bash
git clone https://github.com/YOUR_USERNAME/personal-website.git
cd personal-website
```

Copy `index.html` and `Sammy.png` into this folder.

### 3. Push

```bash
git add .
git commit -m "Initial commit: personal website"
git push origin main
```

### 4. Enable GitHub Pages

1. Go to the repo → **Settings** → **Pages**
2. Source: **Deploy from a branch**
3. Branch: `main` / `/ (root)`
4. Click **Save**

Your site will be live at: `https://YOUR_USERNAME.github.io/personal-website`

---

## 📁 File structure

```
personal-website/
├── index.html           ← Landing page + metadata + analytics loader
├── social-preview.html  ← Editable social preview source
├── social-preview.png   ← Open Graph / Twitter preview image
├── robots.txt
├── sitemap.xml
├── site.webmanifest
├── Sammy.png            ← Avatar image
└── README.md
```

## 🛠 Tech

- Pure HTML/CSS/JS — no build step, no dependencies
- Fonts loaded from Google Fonts
- Fully responsive
- SEO/social metadata baked into `index.html`
- Static `robots.txt`, `sitemap.xml`, and `site.webmanifest`

## 📈 Analytics

Google Analytics 4 support is scaffolded in `index.html`.

To enable it:

1. Open `index.html`
2. Find `<meta name="google-analytics-id" content="" />`
3. Set the value to your GA4 measurement ID, for example `G-XXXXXXXXXX`

Analytics stay disabled automatically when the ID is empty and on local `file://` previews.

## 🖼 Social Preview

- `social-preview.html` is the editable source layout for link previews
- `social-preview.png` is the asset referenced by Open Graph and Twitter metadata
