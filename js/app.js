// ===== Global State =====
let usersData = null;
let currentUser = null;
let syllabusData = null;
let questionsData = null;
let completionData = {};
let quizAttempts = {};

const STORAGE_PREFIX = 'syllabus_';
const CURRENT_USER_KEY = 'syllabus_current_user';

// ===== Initialize =====
document.addEventListener('DOMContentLoaded', init);

async function init() {
    await loadUsers();
    checkExistingUser();
    setupEventListeners();
}

// ===== User Management =====
async function loadUsers() {
    try {
        const response = await fetch('data/users.json');
        usersData = await response.json();
        renderUserCards();
    } catch (error) {
        console.error('Failed to load users:', error);
    }
}

function renderUserCards() {
    const container = document.getElementById('userCardsGrid');
    if (!container || !usersData) return;

    container.innerHTML = '';
    
    usersData.users.forEach(user => {
        const card = document.createElement('div');
        card.className = `user-card ${user.theme}`;
        card.innerHTML = `
            <div class="user-card-icon">${user.icon}</div>
            <h3>${user.name}</h3>
            <p>${user.description}</p>
            <span class="user-card-days">${user.totalDays} Days</span>
        `;
        card.addEventListener('click', () => selectUser(user.id));
        container.appendChild(card);
    });
}

function checkExistingUser() {
    const savedUserId = localStorage.getItem(CURRENT_USER_KEY);
    if (savedUserId && usersData) {
        const user = usersData.users.find(u => u.id === savedUserId);
        if (user) {
            selectUser(user.id);
        }
    }
}

async function selectUser(userId) {
    const user = usersData.users.find(u => u.id === userId);
    if (!user) return;

    currentUser = user;
    localStorage.setItem(CURRENT_USER_KEY, userId);

    // Load user data
    await loadSyllabus();
    await loadQuestions();
    loadProgress();

    // Update UI
    updateUserUI();
    showMainApp();
    navigateTo('dashboard');
}

function switchUser() {
    localStorage.removeItem(CURRENT_USER_KEY);
    document.getElementById('userSelectionPage').style.display = 'flex';
    document.getElementById('mainApp').style.display = 'none';
    renderUserCards();
}

function updateUserUI() {
    document.getElementById('currentUserIcon').textContent = currentUser.icon;
    document.getElementById('currentUserName').textContent = currentUser.name;
}

// ===== Data Loading =====
async function loadSyllabus() {
    try {
        const file = currentUser.syllabusFile || 'syllabus.json';
        const response = await fetch(`data/${file}`);
        syllabusData = await response.json();
    } catch (error) {
        console.error('Failed to load syllabus:', error);
    }
}

async function loadQuestions() {
    try {
        const file = currentUser.questionsFile || 'questions.json';
        const response = await fetch(`data/${file}`);
        questionsData = await response.json();
    } catch (error) {
        console.error('Failed to load questions:', error);
        questionsData = { defaultQuestions: { questions: [] } };
    }
}

function loadProgress() {
    const key = `${STORAGE_PREFIX}${currentUser.id}_progress`;
    const saved = localStorage.getItem(key);
    completionData = saved ? JSON.parse(saved) : {};
    
    const quizKey = `${STORAGE_PREFIX}${currentUser.id}_quiz`;
    const savedQuiz = localStorage.getItem(quizKey);
    quizAttempts = savedQuiz ? JSON.parse(savedQuiz) : {};
}

function saveProgress() {
    const key = `${STORAGE_PREFIX}${currentUser.id}_progress`;
    localStorage.setItem(key, JSON.stringify(completionData));
    
    const quizKey = `${STORAGE_PREFIX}${currentUser.id}_quiz`;
    localStorage.setItem(quizKey, JSON.stringify(quizAttempts));
}

// ===== Navigation =====
function showMainApp() {
    document.getElementById('userSelectionPage').style.display = 'none';
    document.getElementById('mainApp').style.display = 'flex';
}

function navigateTo(section) {
    // Update nav items
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.section === section) {
            item.classList.add('active');
        }
    });

    // Update sections
    document.querySelectorAll('.content-section').forEach(sec => {
        sec.classList.remove('active');
    });
    const targetSection = document.getElementById(`${section}Section`);
    if (targetSection) {
        targetSection.classList.add('active');
    }

    // Close mobile sidebar
    closeSidebar();

    // Render section content
    renderSection(section);
}

function renderSection(section) {
    switch (section) {
        case 'dashboard':
            renderDashboard();
            break;
        case 'today':
            renderToday();
            break;
        case 'subjects':
            renderSubjects();
            break;
        case 'schedule':
            renderSchedule();
            break;
        case 'analytics':
            renderAnalytics();
            break;
    }
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    
    if (window.innerWidth <= 768) {
        sidebar.classList.toggle('open');
        overlay.classList.toggle('active');
    } else {
        sidebar.classList.toggle('collapsed');
    }
}

function closeSidebar() {
    if (window.innerWidth <= 768) {
        document.getElementById('sidebar').classList.remove('open');
        document.getElementById('sidebarOverlay').classList.remove('active');
    }
}

// ===== Dashboard =====
function renderDashboard() {
    const stats = getOverallStats();
    const today = getCurrentDay();
    const daysLeft = Math.max(0, currentUser.totalDays - today);

    // Update stats
    document.getElementById('progressValue').textContent = `${stats.percentage}%`;
    document.getElementById('completedCount').textContent = stats.completed;
    document.getElementById('totalCount').textContent = stats.total;
    document.getElementById('currentDayNum').textContent = today;
    document.getElementById('daysLeft').textContent = daysLeft;
    document.getElementById('streakCount').textContent = getStreak();

    // Update sidebar
    document.getElementById('sidebarDay').textContent = `D${String(today).padStart(2, '0')}`;
    document.getElementById('sidebarProgress').textContent = `${stats.percentage}%`;
    document.getElementById('mobileDay').textContent = `D${String(today).padStart(2, '0')}`;

    // Update date
    const now = new Date();
    document.getElementById('currentDate').textContent = now.toLocaleDateString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric'
    });

    // Today badge
    const todayTopics = getTodayTopics();
    const pending = todayTopics.filter(t => !completionData[t.id]).length;
    document.getElementById('todayBadge').textContent = pending;
    document.getElementById('todayBadge').style.display = pending > 0 ? 'inline' : 'none';

    // Today preview
    renderTodayPreview();
}

function renderTodayPreview() {
    const container = document.getElementById('todayPreview');
    const topics = getTodayTopics().slice(0, 3);

    if (topics.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted)">No topics scheduled for today</p>';
        return;
    }

    container.innerHTML = topics.map(topic => `
        <div class="preview-item ${completionData[topic.id] ? 'completed' : ''}">
            <span class="preview-status">${completionData[topic.id] ? '✓' : '○'}</span>
            <span class="preview-title">${topic.title}</span>
            <span class="preview-subject">${topic.subjectName}</span>
        </div>
    `).join('');
}

// ===== Today Section =====
function renderToday() {
    const container = document.getElementById('todayTopics');
    const topics = getTodayTopics();
    const day = getCurrentDay();

    document.getElementById('todayDate').textContent = `Day ${day}`;

    if (topics.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 2rem;">No topics scheduled for today</p>';
        return;
    }

    container.innerHTML = topics.map(topic => `
        <div class="topic-card ${completionData[topic.id] ? 'completed' : ''}" data-topic-id="${topic.id}">
            <div class="topic-header">
                <span class="topic-title">${topic.title}</span>
                <span class="topic-subject" style="color: ${topic.subjectColor}">${topic.subjectName}</span>
            </div>
            <div class="topic-subtopics">
                ${(topic.subtopics || []).map(st => `<span class="subtopic">${st}</span>`).join('')}
            </div>
            <div class="topic-actions">
                ${completionData[topic.id] 
                    ? `<button class="btn btn-success" disabled>✓ Completed</button>`
                    : `<button class="btn btn-primary" onclick="startQuiz('${topic.id}')">Take Quiz</button>`
                }
            </div>
        </div>
    `).join('');
}

// ===== Subjects Section =====
function renderSubjects() {
    const container = document.getElementById('subjectsGrid');
    
    container.innerHTML = syllabusData.subjects.map(subject => {
        const stats = getSubjectStats(subject);
        return `
            <div class="subject-card" onclick="openSubjectModal('${subject.id}')">
                <div class="subject-header">
                    <span class="subject-name" style="color: ${subject.color}">${subject.name}</span>
                    <span class="subject-progress">${stats.percentage}%</span>
                </div>
                <div class="subject-bar">
                    <div class="subject-bar-fill" style="width: ${stats.percentage}%; background: ${subject.color}"></div>
                </div>
                <div class="subject-stats">
                    <span>${stats.completed}/${stats.total} topics</span>
                    <span>${subject.units.length} units</span>
                </div>
            </div>
        `;
    }).join('');
}

function openSubjectModal(subjectId) {
    const subject = syllabusData.subjects.find(s => s.id === subjectId);
    if (!subject) return;

    document.getElementById('subjectTitle').textContent = subject.name;
    
    const body = document.getElementById('subjectBody');
    body.innerHTML = subject.units.map(unit => `
        <div class="unit-section">
            <h3 style="margin-bottom: 1rem; color: ${subject.color}">${unit.name}</h3>
            <div class="unit-topics">
                ${unit.topics.map(topic => `
                    <div class="topic-card ${completionData[topic.id] ? 'completed' : ''}">
                        <div class="topic-header">
                            <span class="topic-title">${topic.title}</span>
                            <span class="topic-subject">Day ${topic.day}</span>
                        </div>
                        <div class="topic-subtopics">
                            ${(topic.subtopics || []).map(st => `<span class="subtopic">${st}</span>`).join('')}
                        </div>
                        <div class="topic-actions">
                            ${completionData[topic.id] 
                                ? `<button class="btn btn-success" disabled>✓ Completed</button>`
                                : `<button class="btn btn-primary" onclick="startQuiz('${topic.id}'); closeSubjectModal();">Take Quiz</button>`
                            }
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('');

    document.getElementById('subjectModal').classList.add('active');
}

function closeSubjectModal() {
    document.getElementById('subjectModal').classList.remove('active');
}

// ===== Schedule Section =====
function renderSchedule() {
    const container = document.getElementById('scheduleGrid');
    const totalDays = currentUser.totalDays;
    const currentDay = getCurrentDay();
    const completedDays = getCompletedDays();

    let html = '';
    for (let day = 1; day <= totalDays; day++) {
        const isCompleted = completedDays.has(day);
        const isCurrent = day === currentDay;
        const dayClass = isCompleted ? 'completed' : (isCurrent ? 'current' : '');
        
        html += `<div class="schedule-day ${dayClass}" onclick="showDayTopics(${day})">${day}</div>`;
    }
    container.innerHTML = html;
}

function showDayTopics(day) {
    const topics = getTopicsForDay(day);
    if (topics.length === 0) {
        alert(`No topics scheduled for Day ${day}`);
        return;
    }
    
    const topicList = topics.map(t => `• ${t.title} (${t.subjectName})`).join('\n');
    alert(`Day ${day} Topics:\n\n${topicList}`);
}

// ===== Analytics Section =====
function renderAnalytics() {
    const stats = getOverallStats();
    const container = document.getElementById('analyticsContent');

    container.innerHTML = `
        <div class="analytics-card">
            <h3>Overall Progress</h3>
            <div class="analytics-value">${stats.percentage}%</div>
            <div class="analytics-label">${stats.completed} of ${stats.total} topics</div>
        </div>
        <div class="analytics-card">
            <h3>Current Streak</h3>
            <div class="analytics-value">${getStreak()}</div>
            <div class="analytics-label">consecutive days</div>
        </div>
        <div class="analytics-card">
            <h3>Quizzes Taken</h3>
            <div class="analytics-value">${Object.keys(quizAttempts).length}</div>
            <div class="analytics-label">topics completed</div>
        </div>
        <div class="analytics-card">
            <h3>Days Remaining</h3>
            <div class="analytics-value">${Math.max(0, currentUser.totalDays - getCurrentDay())}</div>
            <div class="analytics-label">of ${currentUser.totalDays} total</div>
        </div>
    `;
}

// ===== Quiz System =====
let currentQuiz = {
    topicId: null,
    questions: [],
    currentIndex: 0,
    answers: [],
    correct: 0
};

function startQuiz(topicId) {
    const topic = findTopic(topicId);
    if (!topic) return;

    // Get questions
    const questions = questionsData.topicQuestions?.[topicId] || questionsData.defaultQuestions?.questions || [];
    if (questions.length === 0) {
        // No questions, mark complete directly
        markTopicComplete(topicId);
        return;
    }

    currentQuiz = {
        topicId,
        questions: shuffleArray([...questions]).slice(0, 10),
        currentIndex: 0,
        answers: [],
        correct: 0
    };

    document.getElementById('quizTitle').textContent = topic.title;
    renderQuizQuestion();
    document.getElementById('quizModal').classList.add('active');
}

function renderQuizQuestion() {
    const body = document.getElementById('quizBody');
    const q = currentQuiz.questions[currentQuiz.currentIndex];
    const total = currentQuiz.questions.length;
    const current = currentQuiz.currentIndex + 1;

    body.innerHTML = `
        <div class="quiz-progress">
            <span>Question ${current} of ${total}</span>
            <span>Score: ${currentQuiz.correct}/${currentQuiz.currentIndex}</span>
        </div>
        <div class="quiz-question">
            <div class="quiz-question-text">${q.question}</div>
            <div class="quiz-options">
                ${q.options.map((opt, i) => `
                    <div class="quiz-option" data-index="${i}">${opt}</div>
                `).join('')}
            </div>
        </div>
        <div class="quiz-actions">
            <button class="btn" id="nextQuizBtn" disabled>Next</button>
        </div>
    `;

    // Add option click handlers
    body.querySelectorAll('.quiz-option').forEach(opt => {
        opt.addEventListener('click', () => selectAnswer(parseInt(opt.dataset.index)));
    });

    document.getElementById('nextQuizBtn').addEventListener('click', nextQuestion);
}

function selectAnswer(index) {
    const q = currentQuiz.questions[currentQuiz.currentIndex];
    const options = document.querySelectorAll('.quiz-option');
    
    // Disable further selection
    options.forEach(opt => {
        opt.style.pointerEvents = 'none';
        const optIndex = parseInt(opt.dataset.index);
        if (optIndex === q.answer) {
            opt.classList.add('correct');
        } else if (optIndex === index) {
            opt.classList.add('wrong');
        }
    });

    if (index === q.answer) {
        currentQuiz.correct++;
    }
    currentQuiz.answers.push(index);

    document.getElementById('nextQuizBtn').disabled = false;
}

function nextQuestion() {
    currentQuiz.currentIndex++;
    
    if (currentQuiz.currentIndex >= currentQuiz.questions.length) {
        showQuizResult();
    } else {
        renderQuizQuestion();
    }
}

function showQuizResult() {
    const body = document.getElementById('quizBody');
    const passed = currentQuiz.correct >= 8;
    const total = currentQuiz.questions.length;

    body.innerHTML = `
        <div class="quiz-result">
            <div class="quiz-result-score" style="color: ${passed ? 'var(--secondary)' : 'var(--danger)'}">${currentQuiz.correct}/${total}</div>
            <div class="quiz-result-text">${passed ? '🎉 Congratulations! Topic completed!' : '😔 You need 8/10 to pass. Try again!'}</div>
            <div class="quiz-actions" style="justify-content: center">
                ${passed 
                    ? `<button class="btn btn-success" onclick="closeQuiz()">Done</button>`
                    : `<button class="btn btn-primary" onclick="retryQuiz()">Try Again</button>
                       <button class="btn" onclick="closeQuiz()">Close</button>`
                }
            </div>
        </div>
    `;

    if (passed) {
        markTopicComplete(currentQuiz.topicId);
    }
}

function markTopicComplete(topicId) {
    completionData[topicId] = true;
    quizAttempts[topicId] = { completed: true, date: new Date().toISOString() };
    saveProgress();
    refreshUI();
}

function retryQuiz() {
    currentQuiz.currentIndex = 0;
    currentQuiz.answers = [];
    currentQuiz.correct = 0;
    currentQuiz.questions = shuffleArray([...currentQuiz.questions]);
    renderQuizQuestion();
}

function closeQuiz() {
    document.getElementById('quizModal').classList.remove('active');
}

// ===== Helper Functions =====
function getCurrentDay() {
    const startDate = new Date(syllabusData?.metadata?.startDate || Date.now());
    const today = new Date();
    const diff = Math.ceil((today - startDate) / (1000 * 60 * 60 * 24));
    return Math.max(1, Math.min(diff, currentUser.totalDays));
}

function getTodayTopics() {
    const day = getCurrentDay();
    return getTopicsForDay(day);
}

function getTopicsForDay(day) {
    const topics = [];
    syllabusData.subjects.forEach(subject => {
        subject.units.forEach(unit => {
            unit.topics.forEach(topic => {
                if (topic.day === day) {
                    topics.push({
                        ...topic,
                        subjectName: subject.shortName,
                        subjectColor: subject.color
                    });
                }
            });
        });
    });
    return topics;
}

function findTopic(topicId) {
    for (const subject of syllabusData.subjects) {
        for (const unit of subject.units) {
            for (const topic of unit.topics) {
                if (topic.id === topicId) {
                    return { ...topic, subjectName: subject.shortName };
                }
            }
        }
    }
    return null;
}

function getOverallStats() {
    let total = 0;
    let completed = 0;
    syllabusData.subjects.forEach(subject => {
        subject.units.forEach(unit => {
            unit.topics.forEach(topic => {
                total++;
                if (completionData[topic.id]) completed++;
            });
        });
    });
    return {
        total,
        completed,
        percentage: total > 0 ? Math.round((completed / total) * 100) : 0
    };
}

function getSubjectStats(subject) {
    let total = 0;
    let completed = 0;
    subject.units.forEach(unit => {
        unit.topics.forEach(topic => {
            total++;
            if (completionData[topic.id]) completed++;
        });
    });
    return {
        total,
        completed,
        percentage: total > 0 ? Math.round((completed / total) * 100) : 0
    };
}

function getCompletedDays() {
    const days = new Set();
    syllabusData.subjects.forEach(subject => {
        subject.units.forEach(unit => {
            unit.topics.forEach(topic => {
                if (completionData[topic.id]) {
                    days.add(topic.day);
                }
            });
        });
    });
    return days;
}

function getStreak() {
    const completedDays = getCompletedDays();
    const currentDay = getCurrentDay();
    let streak = 0;
    
    for (let day = currentDay; day >= 1; day--) {
        if (completedDays.has(day)) {
            streak++;
        } else {
            break;
        }
    }
    return streak;
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function refreshUI() {
    renderDashboard();
    renderToday();
    renderSubjects();
    renderSchedule();
}

// ===== Event Listeners =====
function setupEventListeners() {
    // Sidebar toggle
    document.getElementById('sidebarToggle').addEventListener('click', toggleSidebar);
    document.getElementById('menuBtn').addEventListener('click', toggleSidebar);
    document.getElementById('sidebarOverlay').addEventListener('click', closeSidebar);

    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const section = item.dataset.section;
            if (section) navigateTo(section);
        });
    });

    // View all links
    document.querySelectorAll('.view-all').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const section = link.dataset.section;
            if (section) navigateTo(section);
        });
    });

    // Switch user
    document.getElementById('switchUserBtn').addEventListener('click', switchUser);

    // Modal close buttons
    document.getElementById('closeQuiz').addEventListener('click', closeQuiz);
    document.getElementById('closeSubject').addEventListener('click', closeSubjectModal);

    // Settings
    document.getElementById('resetBtn')?.addEventListener('click', () => {
        if (confirm('Are you sure you want to reset all progress?')) {
            completionData = {};
            quizAttempts = {};
            saveProgress();
            refreshUI();
            alert('Progress reset!');
        }
    });

    // Close modals on escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeQuiz();
            closeSubjectModal();
        }
    });
}
