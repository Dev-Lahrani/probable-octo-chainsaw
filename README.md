# 📚 100-Day Syllabus Tracker

A sharp, professional web app for tracking your college syllabus completion in 100 days. Built for parallel study across multiple subjects with cross-device cloud sync.

**🔗 Live:** [dev-lahrani.github.io/probable-octo-chainsaw](https://dev-lahrani.github.io/probable-octo-chainsaw/)

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| **📊 Progress Tracking** | Visual progress bars for overall and per-subject completion |
| **📅 Parallel Study** | All subjects distributed together, not sequentially |
| **☁️ Cloud Sync** | Sync progress across devices via JSONBin.io (no signup required) |
| **🔥 Streak Counter** | Track consecutive days of study |
| **📱 Responsive** | Works on desktop, tablet, and mobile |
| **⌨️ Keyboard Shortcuts** | Quick actions with ?, S, E, Esc |
| **💾 Export/Import** | Backup and restore your progress |
| **🎯 100-Day Grid** | Bird's eye view of your entire journey |

---

## 📖 Subjects

### College (High Priority)
- **TOC** - Theory of Computation
- **OS** - Operating Systems  
- **SE** - Software Engineering
- **DS** - Data Structures
- **MAD** - Mobile App Development

### Personal Learning
- **Basics** - C++, Git, GitHub fundamentals
- **CyberSec** - Cybersecurity basics (slow pace)

---

## ☁️ Cloud Sync

Sync your progress across multiple devices using free JSONBin.io storage.

### First Device (Create)
1. Click **"Create New"** in the Cloud Sync section
2. A unique Bin ID is generated and **copied to your clipboard**
3. Save this ID somewhere safe

### Other Devices (Connect)
1. Paste your Bin ID into the input field
2. Click **"Connect"**
3. Your progress syncs automatically

### Multiple Users
- **Separate progress**: Each person creates their own Bin ID
- **Shared progress**: Share the same Bin ID to collaborate

---

## ⌨️ Keyboard Shortcuts

| Key | Action |
|-----|--------|
| ? | Show help modal |
| S | Sync to cloud |
| E | Export backup |
| Esc | Close modals |

---

## 📁 Project Structure

```
├── index.html          # Main HTML
├── favicon.svg         # Diamond favicon
├── css/
│   └── style.css       # Sharp dark theme
├── js/
│   └── app.js          # App logic + cloud sync
├── data/
│   └── syllabus.json   # 100-day schedule
└── README.md
```

---

## 🚀 Self-Hosting

### GitHub Pages
1. Fork this repository
2. Go to **Settings → Pages**
3. Set source to **main** branch
4. Access at `https://YOUR_USERNAME.github.io/REPO_NAME/`

### Local Development
```bash
# Clone the repo
git clone https://github.com/Dev-Lahrani/probable-octo-chainsaw.git
cd probable-octo-chainsaw

# Serve locally (Python 3)
python -m http.server 8080

# Open http://localhost:8080
```

---

## 📆 Schedule Info

- **Duration**: 100 days (Jan 5 - Apr 15, 2026)
- **Daily Study**: ~4 hours max
- **Buffer Days**: 12 catch-up days (7, 14, 21, 28, 35, 42, 49, 56, 63, 70, 77, 91)
- **Study Style**: Parallel (all subjects together throughout)

---

## 🛠️ Tech Stack

- **Frontend**: Pure HTML/CSS/JS (no frameworks)
- **Cloud Storage**: JSONBin.io (free tier)
- **Hosting**: GitHub Pages
- **Fonts**: Inter + JetBrains Mono
- **Theme**: Sharp dark (#0a0a0f, #00d4ff cyan accent)

---

## 📝 License

MIT - Use it however you want.
