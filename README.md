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
├── index.html    ← The full website (single file)
├── Sammy.png     ← Your avatar emoji image
└── README.md
```

## 🛠 Tech

- Pure HTML/CSS/JS — no build step, no dependencies
- Fonts loaded from Google Fonts (JetBrains Mono + Outfit)
- Binary rain animation via Canvas API
- Fully responsive
