# 📚 100-Day Learning Journey - Syllabus Tracker

A responsive web application for tracking your educational syllabus completion across 100 days. Perfect for students managing multiple subjects, with support for both college curriculum and personal learning goals.

## 🌟 Features

- **📊 Progress Tracking**: Visual progress bars for overall and per-subject completion
- **📅 Daily Focus**: See what topics are scheduled for today
- **🎯 100-Day Schedule Grid**: Bird's eye view of your entire journey
- **📱 Fully Responsive**: Works on desktop, tablet, and mobile
- **💾 Local Storage**: Progress saves automatically in your browser
- **🔍 Filters**: Filter by subject, day, priority, or completion status
- **🌓 Dark/Light Mode**: Automatically adapts to your system preference
- **📤 Export/Import**: Backup your progress data

## 📖 Subjects Covered

### College Syllabus (High Priority)
| Subject | Hours | Days |
|---------|-------|------|
| Theory of Computation (TOC) | 28h | Day 1-28 |
| Operating Systems (OS) | 28h | Day 29-50 |
| Software Engineering (SE) | 27h | Day 51-66 |
| Data Structures (DS) | 30h | Day 67-87 |
| Mobile App Development (MAD) | 20h | Throughout |

### Personal Learning
| Subject | Hours | Days |
|---------|-------|------|
| C++ & Git/GitHub Fundamentals | 15h | Throughout |
| Cybersecurity Basics | 20h | Throughout (slow pace) |

## 📆 Schedule Overview

- **Total Duration**: 100 days (January 5 - April 15, 2026)
- **Daily Study**: ~4 hours maximum
- **Buffer Days**: 12 catch-up days for missed topics or revision
  - Days: 7, 14, 21, 28, 35, 42, 49, 56, 63, 70, 77, 91

## 🚀 Deployment on GitHub Pages

### Step 1: Create a GitHub Repository

1. Go to [GitHub](https://github.com) and log in
2. Click the **+** icon → **New repository**
3. Name it: `syllabus-tracker` (or any name you prefer)
4. Make it **Public** (required for free GitHub Pages)
5. Click **Create repository**

### Step 2: Upload Your Files

**Option A: Using Git Command Line**
```bash
# Navigate to your project folder
cd "/home/dev-lahrani/Desktop/Projects/Syllabus to do completion list"

# Initialize git repository
git init

# Add all files
git add .

# Commit the files
git commit -m "Initial commit: Syllabus tracker"

# Add your GitHub repository as remote
git remote add origin https://github.com/YOUR_USERNAME/syllabus-tracker.git

# Push to GitHub
git branch -M main
git push -u origin main
```

**Option B: Using GitHub Web Interface**
1. In your new repository, click **Add file** → **Upload files**
2. Drag and drop all project files
3. Click **Commit changes**

### Step 3: Enable GitHub Pages

1. Go to your repository on GitHub
2. Click **Settings** (gear icon)
3. Scroll down to **Pages** in the left sidebar
4. Under **Source**, select **Deploy from a branch**
5. Select **main** branch and **/ (root)** folder
6. Click **Save**

### Step 4: Access Your Site

After a few minutes, your site will be live at:
```
https://YOUR_USERNAME.github.io/syllabus-tracker/
```

## 📁 Project Structure

```
syllabus-tracker/
├── index.html          # Main HTML file
├── css/
│   └── style.css       # Responsive styles
├── js/
│   └── app.js          # Application logic
├── data/
│   └── syllabus.json   # Syllabus data structure
└── README.md           # This file
```

## 🔧 Customization

### Changing Start Date
Edit `data/syllabus.json`:
```json
"metadata": {
    "startDate": "2026-01-05",  // Change this
    ...
}
```

### Adding New Subjects
Add a new object to the `subjects` array in `data/syllabus.json`:
```json
{
    "id": "new-subject",
    "name": "New Subject Name",
    "shortName": "NS",
    "color": "#hex-color",
    "totalHours": 20,
    "priority": "high|medium|low",
    "units": [...]
}
```

### Modifying Buffer Days
Edit the `bufferDays` array in `data/syllabus.json`:
```json
"schedule": {
    "bufferDays": [7, 14, 21, ...]
}
```

## 💡 Tips for Success

1. **Be Consistent**: Try to complete topics daily, even if just a few
2. **Use Buffer Days**: If you miss something, catch up on buffer days
3. **Track Progress**: Check off topics as you complete them
4. **Review Weekly**: Use the "This Week" filter to plan ahead
5. **Prioritize**: Focus on college subjects (high priority) first
6. **Cybersecurity**: This is your interest subject - go at your own pace!

## 🔒 Data Privacy

- All progress data is stored **locally** in your browser
- No data is sent to any server
- Use the export feature to backup your progress
- Data persists across browser sessions

## 📱 Mobile Usage

The site is fully responsive! Access it from your phone's browser and:
- Bookmark it for quick access
- Add to home screen for app-like experience (PWA-ready)

## 🛠️ Technical Details

- **Pure HTML/CSS/JS** - No frameworks required
- **LocalStorage API** - For data persistence
- **CSS Grid & Flexbox** - For responsive layouts
- **CSS Variables** - For easy theming
- **Fetch API** - For loading syllabus data

## 📄 License

This project is open source. Feel free to modify and use it for your learning journey!

---

**Good luck with your studies! 🎓 You've got this! 💪**
