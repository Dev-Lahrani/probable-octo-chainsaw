// ===== Global State =====
let syllabusData = null;
let completionData = {};
let questionsData = null;
let quizAttempts = {};
const LOCAL_STORAGE_KEY = 'syllabus_completion_data';
const SYNC_CONFIG_KEY = 'syllabus_sync_config';
const QUIZ_ATTEMPTS_KEY = 'syllabus_quiz_attempts';

// Quiz state
let currentQuiz = {
    topicId: null,
    questions: [],
    shuffledOptions: [], // Store shuffled options with original answer mapping
    currentIndex: 0,
    answers: [],
    correct: 0,
    wrong: 0
};

// Analytics data
const ANALYTICS_KEY = 'syllabus_analytics';
let analyticsData = {
    totalQuizzesTaken: 0,
    totalQuestionAnswered: 0,
    correctByDifficulty: { easy: 0, medium: 0, hard: 0 },
    totalByDifficulty: { easy: 0, medium: 0, hard: 0 },
    topicAttempts: {},
    studyTime: 0
};

// JSONBin.io configuration (free, no signup required for public bins)
let syncConfig = {
    binId: null,
    apiKey: null, // Optional: for private bins
    lastSync: null,
    autoSync: true
};

// ===== Initialize App =====
document.addEventListener('DOMContentLoaded', async () => {
    await loadSyllabusData();
    await loadQuestionsData();
    loadLocalData();
    await attemptCloudSync();
    initializeApp();
    setupEventListeners();
});

// ===== Data Loading =====
async function loadSyllabusData() {
    try {
        const response = await fetch('data/syllabus.json');
        syllabusData = await response.json();
    } catch (error) {
        console.error('Error loading syllabus data:', error);
        showError('Failed to load syllabus data');
    }
}

async function loadQuestionsData() {
    try {
        const response = await fetch('data/questions.json');
        questionsData = await response.json();
    } catch (error) {
        console.error('Error loading questions data:', error);
        // Continue without questions - will use default questions
        questionsData = { topicQuestions: {}, defaultQuestions: getDefaultQuestions() };
    }
}

function getDefaultQuestions() {
    return {
        subtopics: ["Core concepts", "Practical applications", "Related theory", "Common use cases"],
        questions: [
            {"id": "dq1", "difficulty": "easy", "question": "What is the main purpose of studying this topic?", "options": ["To understand fundamental concepts", "To memorize facts", "To skip the next topic", "It has no purpose"], "answer": 0},
            {"id": "dq2", "difficulty": "easy", "question": "This topic is important because:", "options": ["It builds foundation for advanced concepts", "It's easy to skip", "It's not related to anything", "It's outdated"], "answer": 0},
            {"id": "dq3", "difficulty": "easy", "question": "The best way to learn this topic is:", "options": ["Practice with examples and problems", "Only reading", "Skipping it", "Memorization without understanding"], "answer": 0},
            {"id": "dq4", "difficulty": "medium", "question": "This topic connects to other subjects by:", "options": ["Providing shared concepts and terminology", "Having no connections", "Being completely isolated", "Replacing other topics"], "answer": 0},
            {"id": "dq5", "difficulty": "medium", "question": "Understanding this topic helps in:", "options": ["Solving related problems effectively", "Nothing practical", "Only exams", "Only interviews"], "answer": 0},
            {"id": "dq6", "difficulty": "medium", "question": "The key takeaway from this topic is:", "options": ["Core principles that apply broadly", "Random facts", "Outdated information", "Nothing useful"], "answer": 0},
            {"id": "dq7", "difficulty": "medium", "question": "This topic requires prerequisite knowledge of:", "options": ["Basic fundamentals of the subject", "Nothing at all", "Advanced mathematics only", "Programming only"], "answer": 0},
            {"id": "dq8", "difficulty": "hard", "question": "Advanced applications of this topic include:", "options": ["Real-world problem solving and research", "No applications exist", "Only theoretical use", "Only historical interest"], "answer": 0},
            {"id": "dq9", "difficulty": "hard", "question": "Common misconceptions about this topic:", "options": ["Should be identified and corrected through study", "Don't exist", "Should be ignored", "Are always correct"], "answer": 0},
            {"id": "dq10", "difficulty": "hard", "question": "Mastery of this topic is demonstrated by:", "options": ["Ability to apply concepts to new problems", "Memorizing definitions", "Passing one test", "Reading once"], "answer": 0}
        ]
    };
}

function loadLocalData() {
    // Load completion data
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (stored) {
        completionData = JSON.parse(stored);
    }
    
    // Load sync config
    const syncStored = localStorage.getItem(SYNC_CONFIG_KEY);
    if (syncStored) {
        syncConfig = { ...syncConfig, ...JSON.parse(syncStored) };
    }
    
    // Load quiz attempts
    const quizStored = localStorage.getItem(QUIZ_ATTEMPTS_KEY);
    if (quizStored) {
        quizAttempts = JSON.parse(quizStored);
    }
    
    // Load analytics
    const analyticsStored = localStorage.getItem(ANALYTICS_KEY);
    if (analyticsStored) {
        analyticsData = { ...analyticsData, ...JSON.parse(analyticsStored) };
    }
}

function saveLocalData() {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(completionData));
    localStorage.setItem(SYNC_CONFIG_KEY, JSON.stringify(syncConfig));
    localStorage.setItem(QUIZ_ATTEMPTS_KEY, JSON.stringify(quizAttempts));
    localStorage.setItem(ANALYTICS_KEY, JSON.stringify(analyticsData));
}

// ===== Cloud Sync Functions (JSONBin.io) =====
const JSONBIN_ACCESS_KEY = '$2a$10$F79qVIOU.UdA0d5bqC096uN.ZQHROg4DcFvy7Ng6nwdHWNgKghAdK';
const JSONBIN_MASTER_KEY = '$2a$10$8wnGIGLKnWkOUBtXsF4eIeZfQTQWz/0mw0xX0/.m/NQ/UKNEHOSVe';

async function attemptCloudSync() {
    if (!syncConfig.binId) return;
    
    try {
        updateSyncStatus('syncing');
        const cloudData = await fetchFromCloud();
        if (cloudData) {
            // Merge: cloud wins if newer, local wins if local has more completions
            const localCount = Object.keys(completionData).filter(k => completionData[k]).length;
            const cloudCount = Object.keys(cloudData.completion || {}).filter(k => cloudData.completion[k]).length;
            
            if (cloudCount > localCount || (cloudData.lastUpdated && new Date(cloudData.lastUpdated) > new Date(syncConfig.lastSync || 0))) {
                completionData = cloudData.completion || {};
                quizAttempts = cloudData.quizAttempts || {};
                saveLocalData();
            }
        }
        updateSyncStatus('synced');
    } catch (error) {
        console.error('Sync failed:', error);
        updateSyncStatus('error');
    }
}

async function fetchFromCloud() {
    if (!syncConfig.binId) return null;
    
    try {
        const response = await fetch(`https://api.jsonbin.io/v3/b/${syncConfig.binId}/latest`, {
            method: 'GET',
            headers: {
                'X-Access-Key': JSONBIN_ACCESS_KEY
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            return data.record;
        }
    } catch (error) {
        console.error('Fetch from cloud failed:', error);
    }
    return null;
}

async function saveToCloud() {
    if (!syncConfig.binId) return false;
    
    updateSyncStatus('syncing');
    
    try {
        const response = await fetch(`https://api.jsonbin.io/v3/b/${syncConfig.binId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-Access-Key': JSONBIN_ACCESS_KEY
            },
            body: JSON.stringify({
                completion: completionData,
                quizAttempts: quizAttempts,
                lastUpdated: new Date().toISOString()
            })
        });
        
        if (response.ok) {
            syncConfig.lastSync = new Date().toISOString();
            saveLocalData();
            updateSyncStatus('synced');
            return true;
        }
    } catch (error) {
        console.error('Save to cloud failed:', error);
    }
    
    updateSyncStatus('error');
    return false;
}

async function createNewBin() {
    updateSyncStatus('syncing');
    
    try {
        const response = await fetch('https://api.jsonbin.io/v3/b', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Master-Key': JSONBIN_MASTER_KEY,
                'X-Bin-Private': 'false',
                'X-Bin-Name': `syllabus-${Date.now()}`
            },
            body: JSON.stringify({
                completion: completionData,
                quizAttempts: quizAttempts,
                lastUpdated: new Date().toISOString()
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            const binId = data.metadata.id;
            syncConfig.binId = binId;
            syncConfig.lastSync = new Date().toISOString();
            saveLocalData();
            updateSyncStatus('synced');
            updateSyncUI();
            return binId;
        } else {
            const error = await response.json();
            console.error('Create bin failed:', error);
        }
    } catch (error) {
        console.error('Create bin failed:', error);
    }
    
    updateSyncStatus('error');
    return null;
}

function updateSyncStatus(status) {
    const indicator = document.getElementById('syncIndicator');
    const text = document.getElementById('syncText');
    
    if (!indicator || !text) return;
    
    indicator.className = 'sync-indicator';
    
    switch (status) {
        case 'synced':
            indicator.classList.add('synced');
            text.textContent = 'Synced';
            break;
        case 'syncing':
            indicator.classList.add('syncing');
            text.textContent = 'Syncing...';
            break;
        case 'error':
            indicator.classList.add('error');
            text.textContent = 'Sync Error';
            break;
        default:
            text.textContent = 'Local Only';
    }
}

function updateSyncUI() {
    const binInput = document.getElementById('binIdInput');
    if (binInput) {
        binInput.value = syncConfig.binId || '';
    }
}

// ===== Calculate Current Day =====
function getCurrentDay() {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize to midnight local time
    const startDate = new Date(syllabusData.metadata.startDate + 'T00:00:00'); // Parse as local time
    startDate.setHours(0, 0, 0, 0);
    const diffTime = today - startDate;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 because Day 1 is the start date
    return Math.max(1, Math.min(diffDays, 100));
}

function getDaysLeft() {
    const currentDay = getCurrentDay();
    return Math.max(0, 100 - currentDay);
}

// ===== Initialize UI =====
function initializeApp() {
    updateHeaderStats();
    updateOverallProgress();
    updateStreakCounter();
    populateFilters();
    renderTodaySection();
    renderSubjectCards();
    renderScheduleGrid();
    updateSyncUI();
    
    if (!syncConfig.binId) {
        updateSyncStatus('local');
    }
}

function updateStreakCounter() {
    const streak = calculateStreak();
    const streakEl = document.getElementById('streakCount');
    if (streakEl) {
        streakEl.textContent = streak > 0 ? `${streak}🔥` : '0';
    }
}

function calculateStreak() {
    // Calculate streak based on consecutive days with at least one completion
    // Group completions by day
    const completionsByDay = {};
    
    syllabusData.subjects.forEach(subject => {
        subject.units.forEach(unit => {
            unit.topics.forEach(topic => {
                if (completionData[topic.id]) {
                    const day = topic.day;
                    completionsByDay[day] = true;
                }
            });
        });
    });
    
    // Count streak from current day backwards
    const currentDay = getCurrentDay();
    let streak = 0;
    
    for (let day = currentDay; day >= 1; day--) {
        if (completionsByDay[day]) {
            streak++;
        } else {
            break;
        }
    }
    
    return streak;
}

function updateHeaderStats() {
    const currentDay = getCurrentDay();
    const daysLeft = getDaysLeft();
    
    document.getElementById('currentDay').textContent = `Day ${currentDay}`;
    document.getElementById('daysLeft').textContent = daysLeft;
}

function updateOverallProgress() {
    const stats = calculateOverallStats();
    
    document.getElementById('overallPercentage').textContent = `${stats.percentage}%`;
    document.getElementById('overallProgressBar').style.width = `${stats.percentage}%`;
    document.getElementById('completedTopics').textContent = stats.completed;
    document.getElementById('totalTopics').textContent = stats.total;
    
    const avgPerDay = stats.completed / Math.max(1, getCurrentDay());
    const remainingTopics = stats.total - stats.completed;
    const estimatedDays = Math.ceil(remainingTopics / Math.max(0.1, avgPerDay));
    
    if (stats.completed > 0) {
        document.getElementById('estimatedCompletion').textContent = 
            `${estimatedDays}d remaining at current pace`;
    } else {
        document.getElementById('estimatedCompletion').textContent = 'Start to see estimate';
    }
}

function calculateOverallStats() {
    let total = 0;
    let completed = 0;
    
    syllabusData.subjects.forEach(subject => {
        subject.units.forEach(unit => {
            unit.topics.forEach(topic => {
                total++;
                if (completionData[topic.id]) {
                    completed++;
                }
            });
        });
    });
    
    return {
        total,
        completed,
        percentage: total > 0 ? Math.round((completed / total) * 100) : 0
    };
}

function calculateSubjectStats(subject) {
    let total = 0;
    let completed = 0;
    
    subject.units.forEach(unit => {
        unit.topics.forEach(topic => {
            total++;
            if (completionData[topic.id]) {
                completed++;
            }
        });
    });
    
    return {
        total,
        completed,
        percentage: total > 0 ? Math.round((completed / total) * 100) : 0
    };
}

function calculateUnitStats(unit) {
    let total = 0;
    let completed = 0;
    
    unit.topics.forEach(topic => {
        total++;
        if (completionData[topic.id]) {
            completed++;
        }
    });
    
    return {
        total,
        completed,
        percentage: total > 0 ? Math.round((completed / total) * 100) : 0
    };
}

// ===== Populate Filters =====
function populateFilters() {
    const subjectFilter = document.getElementById('subjectFilter');
    
    syllabusData.subjects.forEach(subject => {
        const option = document.createElement('option');
        option.value = subject.id;
        option.textContent = `${subject.shortName} - ${subject.name}`;
        subjectFilter.appendChild(option);
    });
}

// ===== Render Today Section =====
function renderTodaySection() {
    const currentDay = getCurrentDay();
    const todayTopics = getTodayTopics(currentDay);
    const container = document.getElementById('todayTopics');
    const dateDisplay = document.getElementById('todayDate');
    
    const today = new Date();
    dateDisplay.textContent = today.toLocaleDateString('en-US', { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric' 
    });
    
    if (todayTopics.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">◇</div>
                <p>Buffer day - catch up or revise</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = todayTopics.map(item => `
        <div class="today-topic-card ${completionData[item.topic.id] ? 'completed' : ''}" data-topic-id="${item.topic.id}">
            <div class="topic-checkbox ${completionData[item.topic.id] ? 'checked' : ''}" 
                 onclick="event.stopPropagation();" style="pointer-events: none; opacity: 0.5;"></div>
            <div class="topic-info" onclick="openTopicModal('${item.topic.id}')">
                <div class="topic-name">${item.topic.name}</div>
                <div class="topic-meta">
                    <span class="topic-subject" style="border-color: ${item.subject.color}; color: ${item.subject.color}">
                        ${item.subject.shortName}
                    </span>
                    <span>D${item.topic.day}</span>
                </div>
            </div>
            ${!completionData[item.topic.id] ? `<button class="topic-quiz-btn" onclick="event.stopPropagation(); openTopicModal('${item.topic.id}')">Take Quiz</button>` : ''}
        </div>
    `).join('');
}

function getTodayTopics(day) {
    const topics = [];
    
    syllabusData.subjects.forEach(subject => {
        subject.units.forEach(unit => {
            unit.topics.forEach(topic => {
                if (topic.day === day) {
                    topics.push({ subject, unit, topic });
                }
            });
        });
    });
    
    return topics;
}

// ===== Render Subject Cards =====
function renderSubjectCards() {
    const container = document.getElementById('subjectCards');
    const subjectFilter = document.getElementById('subjectFilter').value;
    const priorityFilter = document.getElementById('priorityFilter').value;
    
    let subjects = syllabusData.subjects;
    
    if (subjectFilter !== 'all') {
        subjects = subjects.filter(s => s.id === subjectFilter);
    }
    
    if (priorityFilter !== 'all') {
        subjects = subjects.filter(s => s.priority === priorityFilter);
    }
    
    container.innerHTML = subjects.map(subject => {
        const stats = calculateSubjectStats(subject);
        return `
            <div class="subject-card" onclick="openSubjectModal('${subject.id}')" data-subject-id="${subject.id}">
                <div class="subject-card-header" style="border-left-color: ${subject.color}">
                    <div>
                        <div class="subject-name">${subject.name}</div>
                        <div class="subject-short">${subject.shortName}</div>
                    </div>
                    <span class="subject-priority priority-${subject.priority}">${subject.priority}</span>
                </div>
                <div class="subject-card-body">
                    <div class="subject-progress">
                        <div class="subject-progress-header">
                            <span>${stats.completed}/${stats.total}</span>
                            <span>${stats.percentage}%</span>
                        </div>
                        <div class="subject-progress-bar">
                            <div class="subject-progress-fill" style="width: ${stats.percentage}%; background: ${subject.color}"></div>
                        </div>
                    </div>
                    <div class="subject-stats">
                        <span>${subject.units.length} units</span>
                        <span>${subject.totalHours}h</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// ===== Subject Modal =====
function openSubjectModal(subjectId) {
    const subject = syllabusData.subjects.find(s => s.id === subjectId);
    if (!subject) return;
    
    const modal = document.getElementById('subjectModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    
    modalTitle.textContent = subject.name;
    modalTitle.style.color = subject.color;
    
    modalBody.innerHTML = subject.units.map(unit => {
        const unitStats = calculateUnitStats(unit);
        return `
            <div class="unit-section">
                <div class="unit-header">
                    <span class="unit-name">${unit.name}</span>
                    <span class="unit-progress">${unitStats.completed}/${unitStats.total}</span>
                </div>
                <div class="unit-topics">
                    ${unit.topics.map(topic => `
                        <div class="unit-topic ${completionData[topic.id] ? 'completed' : ''}" data-topic-id="${topic.id}" onclick="closeModal(); openTopicModal('${topic.id}')">
                            <div class="topic-checkbox ${completionData[topic.id] ? 'checked' : ''}" 
                                 onclick="event.stopPropagation();" style="pointer-events: none;"></div>
                            <span class="topic-name">${topic.name}</span>
                            <span class="topic-quiz-indicator ${completionData[topic.id] ? 'unlocked' : ''}">${completionData[topic.id] ? '✓ Done' : 'Quiz'}</span>
                            <span class="topic-day">D${topic.day}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }).join('');
    
    modal.classList.add('active');
}

function closeModal() {
    document.getElementById('subjectModal').classList.remove('active');
}

// ===== Toggle Topic Completion =====
async function toggleTopic(topicId) {
    completionData[topicId] = !completionData[topicId];
    saveLocalData();
    
    // Update UI
    updateCheckbox(topicId);
    updateOverallProgress();
    updateStreakCounter();
    renderSubjectCards();
    renderScheduleGrid();
    
    // Update modal if open
    const modalTopic = document.querySelector(`.modal .unit-topic[data-topic-id="${topicId}"]`);
    if (modalTopic) {
        modalTopic.classList.toggle('completed', completionData[topicId]);
        modalTopic.querySelector('.topic-checkbox').classList.toggle('checked', completionData[topicId]);
    }
    
    // Sync to cloud (debounced)
    if (syncConfig.binId && syncConfig.autoSync) {
        debouncedSync();
    }
}

// Debounce cloud sync to avoid too many requests
let syncTimeout = null;
function debouncedSync() {
    if (syncTimeout) clearTimeout(syncTimeout);
    syncTimeout = setTimeout(() => {
        saveToCloud();
    }, 2000);
}

function updateCheckbox(topicId) {
    const checkboxes = document.querySelectorAll(`[data-topic-id="${topicId}"] .topic-checkbox`);
    const cards = document.querySelectorAll(`[data-topic-id="${topicId}"]`);
    
    checkboxes.forEach(checkbox => {
        checkbox.classList.toggle('checked', completionData[topicId]);
    });
    
    cards.forEach(card => {
        if (card.classList.contains('today-topic-card') || card.classList.contains('unit-topic')) {
            card.classList.toggle('completed', completionData[topicId]);
        }
    });
}

// ===== Render Schedule Grid =====
function renderScheduleGrid() {
    const container = document.getElementById('scheduleGrid');
    const currentDay = getCurrentDay();
    const bufferDays = syllabusData.schedule.bufferDays;
    
    let html = '';
    
    for (let day = 1; day <= 100; day++) {
        const dayTopics = getTodayTopics(day);
        const isBuffer = bufferDays.includes(day);
        const isCurrent = day === currentDay;
        
        let dayClass = '';
        let completedCount = 0;
        
        if (isCurrent) {
            dayClass = 'current';
        } else if (isBuffer && dayTopics.length === 0) {
            dayClass = 'buffer';
        } else if (dayTopics.length > 0) {
            completedCount = dayTopics.filter(t => completionData[t.topic.id]).length;
            if (completedCount === dayTopics.length) {
                dayClass = 'completed';
            } else if (completedCount > 0) {
                dayClass = 'partial';
            }
        }
        
        html += `<div class="schedule-day ${dayClass}" data-day="${day}" onclick="showDayDetails(${day})">${day}</div>`;
    }
    
    container.innerHTML = html;
}

function showDayDetails(day) {
    const topics = getTodayTopics(day);
    const isBuffer = syllabusData.schedule.bufferDays.includes(day);
    
    if (topics.length === 0) {
        alert(`Day ${day}: Buffer day for catch-up`);
        return;
    }
    
    const message = topics.map(t => `[${t.subject.shortName}] ${t.topic.name}`).join('\n');
    alert(`Day ${day} (${topics.length} topics):\n\n${message}`);
}

// ===== Event Listeners =====
function setupEventListeners() {
    // Modal close
    document.getElementById('modalClose').addEventListener('click', closeModal);
    document.getElementById('subjectModal').addEventListener('click', (e) => {
        if (e.target.id === 'subjectModal') closeModal();
    });
    
    // Topic modal close
    document.getElementById('topicModalClose')?.addEventListener('click', closeTopicModal);
    document.getElementById('topicModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'topicModal') closeTopicModal();
    });
    
    // Quiz modal close
    document.getElementById('quizModalClose')?.addEventListener('click', closeQuizModal);
    document.getElementById('quizModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'quizModal') {
            if (confirm('Are you sure you want to exit the quiz? Your progress will be lost.')) {
                closeQuizModal();
            }
        }
    });
    
    // Help modal close
    document.getElementById('helpModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'helpModal') closeHelpModal();
    });
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeModal();
            closeHelpModal();
            closeTopicModal();
            // Don't close quiz modal on escape to prevent accidental exit
        }
        
        // Quiz keyboard shortcuts (1-4 for options, Enter to submit)
        const quizModal = document.getElementById('quizModal');
        if (quizModal?.classList.contains('active')) {
            const options = document.querySelectorAll('.quiz-option:not(.disabled)');
            if (options.length > 0) {
                if (e.key >= '1' && e.key <= '4') {
                    e.preventDefault();
                    const index = parseInt(e.key) - 1;
                    if (index < options.length) {
                        selectQuizOption(index);
                    }
                }
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const submitBtn = document.getElementById('submitAnswerBtn');
                    if (submitBtn && !submitBtn.disabled) {
                        submitBtn.click();
                    }
                }
            }
            return; // Don't process other shortcuts during quiz
        }
        
        // General keyboard shortcuts
        if (e.key === '?' || (e.shiftKey && e.key === '/')) {
            e.preventDefault();
            toggleHelpModal();
        }
        if (e.key.toLowerCase() === 's' && !e.ctrlKey && !e.metaKey && !e.target.matches('input, textarea')) {
            e.preventDefault();
            document.getElementById('syncNowBtn')?.click();
        }
        if (e.key.toLowerCase() === 'e' && !e.ctrlKey && !e.metaKey && !e.target.matches('input, textarea')) {
            e.preventDefault();
            exportProgress();
        }
        if (e.key.toLowerCase() === 'a' && !e.ctrlKey && !e.metaKey && !e.target.matches('input, textarea')) {
            e.preventDefault();
            openAnalyticsModal();
        }
    });
    
    // Filters
    document.getElementById('subjectFilter').addEventListener('change', () => {
        renderSubjectCards();
        applyDayFilter();
    });
    
    document.getElementById('dayFilter').addEventListener('change', applyDayFilter);
    document.getElementById('priorityFilter').addEventListener('change', renderSubjectCards);
    
    // Reset progress
    document.getElementById('resetProgress').addEventListener('click', async () => {
        if (confirm('Reset all progress? This cannot be undone.')) {
            completionData = {};
            saveLocalData();
            if (syncConfig.binId) await saveToCloud();
            initializeApp();
        }
    });
    
    // Cloud sync controls
    document.getElementById('createBinBtn')?.addEventListener('click', async () => {
        const binId = await createNewBin();
        if (binId) {
            // Copy to clipboard
            try {
                await navigator.clipboard.writeText(binId);
                alert(`Sync enabled! Your Bin ID:\n\n${binId}\n\n✓ Copied to clipboard!\nPaste this ID on other devices to sync.`);
            } catch {
                alert(`Sync enabled! Your Bin ID:\n\n${binId}\n\nCopy this ID to sync on other devices.`);
            }
        }
    });
    
    document.getElementById('connectBinBtn')?.addEventListener('click', async () => {
        const binId = document.getElementById('binIdInput').value.trim();
        if (binId) {
            syncConfig.binId = binId;
            saveLocalData();
            await attemptCloudSync();
            initializeApp();
            alert('Connected to cloud sync!');
        }
    });
    
    document.getElementById('syncNowBtn')?.addEventListener('click', async () => {
        if (syncConfig.binId) {
            await saveToCloud();
        } else {
            alert('Set up cloud sync first.');
        }
    });
    
    // Export/Import
    document.getElementById('exportBtn')?.addEventListener('click', exportProgress);
    document.getElementById('importFile')?.addEventListener('change', (e) => {
        if (e.target.files[0]) {
            importProgress(e.target.files[0]);
            e.target.value = ''; // Reset for future imports
        }
    });
}

// Help modal functions
function toggleHelpModal() {
    const modal = document.getElementById('helpModal');
    if (modal) {
        modal.classList.toggle('active');
    }
}

function closeHelpModal() {
    const modal = document.getElementById('helpModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

function applyDayFilter() {
    const filter = document.getElementById('dayFilter').value;
    const currentDay = getCurrentDay();
    const container = document.getElementById('todayTopics');
    const section = document.getElementById('todaySection');
    
    let topics = [];
    let title = "TODAY";
    
    switch (filter) {
        case 'today':
            topics = getTodayTopics(currentDay);
            title = "TODAY";
            break;
        case 'week':
            for (let d = currentDay; d <= Math.min(currentDay + 6, 100); d++) {
                topics.push(...getTodayTopics(d));
            }
            title = "THIS WEEK";
            break;
        case 'pending':
            syllabusData.subjects.forEach(subject => {
                subject.units.forEach(unit => {
                    unit.topics.forEach(topic => {
                        if (!completionData[topic.id]) {
                            topics.push({ subject, unit, topic });
                        }
                    });
                });
            });
            title = "PENDING";
            break;
        case 'completed':
            syllabusData.subjects.forEach(subject => {
                subject.units.forEach(unit => {
                    unit.topics.forEach(topic => {
                        if (completionData[topic.id]) {
                            topics.push({ subject, unit, topic });
                        }
                    });
                });
            });
            title = "COMPLETED";
            break;
        default:
            topics = getTodayTopics(currentDay);
    }
    
    // Apply subject filter
    const subjectFilter = document.getElementById('subjectFilter').value;
    if (subjectFilter !== 'all') {
        topics = topics.filter(t => t.subject.id === subjectFilter);
    }
    
    section.querySelector('h2').innerHTML = `${title} <span class="today-date" id="todayDate"></span>`;
    
    if (topics.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">◇</div>
                <p>No topics</p>
            </div>
        `;
    } else {
        container.innerHTML = topics.map(item => `
            <div class="today-topic-card ${completionData[item.topic.id] ? 'completed' : ''}" data-topic-id="${item.topic.id}">
                <div class="topic-checkbox ${completionData[item.topic.id] ? 'checked' : ''}" 
                     onclick="event.stopPropagation();" style="pointer-events: none; opacity: 0.5;"></div>
                <div class="topic-info" onclick="openTopicModal('${item.topic.id}')">
                    <div class="topic-name">${item.topic.name}</div>
                    <div class="topic-meta">
                        <span class="topic-subject" style="border-color: ${item.subject.color}; color: ${item.subject.color}">
                            ${item.subject.shortName}
                        </span>
                        <span>D${item.topic.day}</span>
                    </div>
                </div>
                ${!completionData[item.topic.id] ? `<button class="topic-quiz-btn" onclick="event.stopPropagation(); openTopicModal('${item.topic.id}')">Take Quiz</button>` : ''}
            </div>
        `).join('');
    }
}

// ===== Utility Functions =====
function showError(message) {
    document.body.innerHTML = `
        <div class="empty-state" style="padding: 4rem;">
            <div class="empty-state-icon">✕</div>
            <p>${message}</p>
        </div>
    `;
}

// Export for backup
function exportProgress() {
    const data = JSON.stringify({
        completion: completionData,
        quizAttempts: quizAttempts,
        exportDate: new Date().toISOString()
    }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `syllabus_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function importProgress(file) {
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = JSON.parse(e.target.result);
            completionData = data.completion || data;
            if (data.quizAttempts) {
                quizAttempts = data.quizAttempts;
            }
            saveLocalData();
            if (syncConfig.binId) await saveToCloud();
            initializeApp();
            alert('Progress imported!');
        } catch (error) {
            alert('Invalid file format.');
        }
    };
    reader.readAsText(file);
}

// ===== Topic Modal Functions =====
function openTopicModal(topicId) {
    const topicInfo = findTopicById(topicId);
    if (!topicInfo) return;
    
    const { subject, unit, topic } = topicInfo;
    const modal = document.getElementById('topicModal');
    const modalTitle = document.getElementById('topicModalTitle');
    const modalBody = document.getElementById('topicModalBody');
    
    // Get subtopics for this topic
    const topicQuestions = questionsData?.topicQuestions?.[topicId] || questionsData?.defaultQuestions;
    const subtopics = topicQuestions?.subtopics || ['Core concepts', 'Practical applications', 'Key definitions', 'Examples'];
    
    // Get quiz attempt history
    const attempts = quizAttempts[topicId] || [];
    const isCompleted = completionData[topicId];
    
    modalTitle.textContent = topic.name;
    modalTitle.style.color = subject.color;
    
    modalBody.innerHTML = `
        <div class="topic-details-header">
            <div class="topic-details-info">
                <div class="topic-details-meta">
                    <span class="topic-details-badge" style="border-color: ${subject.color}; color: ${subject.color}">${subject.shortName}</span>
                    <span class="topic-details-badge">Day ${topic.day}</span>
                    <span class="topic-details-badge">${unit.name}</span>
                </div>
            </div>
            <div class="topic-details-status ${isCompleted ? 'completed' : 'pending'}">
                ${isCompleted ? '✓ Completed' : 'Pending'}
            </div>
        </div>
        
        <div class="subtopics-section">
            <div class="subtopics-title">📚 Subtopics to Study</div>
            <div class="subtopics-list">
                ${subtopics.map(st => `
                    <div class="subtopic-item">
                        <div class="subtopic-bullet"></div>
                        <span>${st}</span>
                    </div>
                `).join('')}
            </div>
        </div>
        
        <div class="topic-quiz-section">
            <div class="topic-quiz-info">
                <h4>${isCompleted ? '✓ Topic Completed!' : '🎯 Complete the Quiz'}</h4>
                <p>${isCompleted ? 'You have successfully completed this topic by passing the quiz.' : 'Study the subtopics above, then take the quiz to mark this topic complete.'}</p>
            </div>
            
            <div class="quiz-requirement">
                <strong>Requirement:</strong> Score 8 out of 10 questions correctly to complete this topic.
                Questions include Easy, Medium, and Hard difficulty levels.
            </div>
            
            ${isCompleted ? 
                `<button class="start-quiz-btn" onclick="startQuiz('${topicId}')" style="background: var(--bg-tertiary); border: 1px solid var(--success); color: var(--success);">Retake Quiz</button>` :
                `<button class="start-quiz-btn" onclick="startQuiz('${topicId}')">Start Quiz →</button>`
            }
            
            ${attempts.length > 0 ? `
                <div class="quiz-history">
                    <div class="quiz-history-title">Previous Attempts (${attempts.length})</div>
                    ${attempts.slice(-5).reverse().map(a => `
                        <div class="quiz-history-item">
                            <span>${new Date(a.date).toLocaleDateString()}</span>
                            <span class="quiz-history-score ${a.score >= 8 ? 'pass' : 'fail'}">${a.score}/10</span>
                        </div>
                    `).join('')}
                </div>
            ` : ''}
        </div>
    `;
    
    modal.classList.add('active');
}

function closeTopicModal() {
    document.getElementById('topicModal').classList.remove('active');
}

function findTopicById(topicId) {
    for (const subject of syllabusData.subjects) {
        for (const unit of subject.units) {
            for (const topic of unit.topics) {
                if (topic.id === topicId) {
                    return { subject, unit, topic };
                }
            }
        }
    }
    return null;
}

// ===== Quiz Functions =====
function startQuiz(topicId) {
    closeTopicModal();
    
    // Get questions for this topic
    const topicQuestions = questionsData?.topicQuestions?.[topicId]?.questions || questionsData?.defaultQuestions?.questions;
    
    if (!topicQuestions || topicQuestions.length < 10) {
        alert('Quiz questions are being prepared. Please try again.');
        return;
    }
    
    // Select 10 questions with mixed difficulty (3 easy, 4 medium, 3 hard)
    const easyQs = topicQuestions.filter(q => q.difficulty === 'easy');
    const mediumQs = topicQuestions.filter(q => q.difficulty === 'medium');
    const hardQs = topicQuestions.filter(q => q.difficulty === 'hard');
    
    const selectedQuestions = [
        ...shuffleArray(easyQs).slice(0, 3),
        ...shuffleArray(mediumQs).slice(0, 4),
        ...shuffleArray(hardQs).slice(0, 3)
    ];
    
    // If we don't have enough of any difficulty, fill with whatever we have
    while (selectedQuestions.length < 10 && topicQuestions.length >= 10) {
        const remaining = topicQuestions.filter(q => !selectedQuestions.includes(q));
        if (remaining.length === 0) break;
        selectedQuestions.push(remaining[0]);
    }
    
    // Shuffle the final selection of questions
    const shuffledQuestions = shuffleArray(selectedQuestions).slice(0, 10);
    
    // Shuffle options for each question and track correct answer
    const shuffledOptions = shuffledQuestions.map(q => {
        const optionsWithIndex = q.options.map((opt, idx) => ({ text: opt, originalIndex: idx }));
        const shuffled = shuffleArray(optionsWithIndex);
        const newCorrectIndex = shuffled.findIndex(opt => opt.originalIndex === q.answer);
        return {
            options: shuffled.map(opt => opt.text),
            correctIndex: newCorrectIndex
        };
    });
    
    // Initialize quiz state
    currentQuiz = {
        topicId,
        questions: shuffledQuestions,
        shuffledOptions,
        currentIndex: 0,
        answers: [],
        correct: 0,
        wrong: 0
    };
    
    // Update analytics
    analyticsData.totalQuizzesTaken++;
    saveLocalData();
    
    renderQuizQuestion();
    document.getElementById('quizModal').classList.add('active');
}

function renderQuizQuestion() {
    const modal = document.getElementById('quizModal');
    const modalTitle = document.getElementById('quizModalTitle');
    const modalBody = document.getElementById('quizModalBody');
    
    const topicInfo = findTopicById(currentQuiz.topicId);
    const question = currentQuiz.questions[currentQuiz.currentIndex];
    const shuffledOpts = currentQuiz.shuffledOptions[currentQuiz.currentIndex];
    const questionNum = currentQuiz.currentIndex + 1;
    const totalQuestions = currentQuiz.questions.length;
    
    modalTitle.textContent = topicInfo ? topicInfo.topic.name : 'Quiz';
    
    modalBody.innerHTML = `
        <div class="quiz-header">
            <div class="quiz-progress">
                <span class="quiz-progress-text">Question ${questionNum} of ${totalQuestions}</span>
                <div class="quiz-progress-bar">
                    <div class="quiz-progress-fill" style="width: ${(questionNum / totalQuestions) * 100}%"></div>
                </div>
            </div>
            <div class="quiz-score">
                <span class="quiz-score-correct">✓ ${currentQuiz.correct}</span>
                <span class="quiz-score-wrong">✗ ${currentQuiz.wrong}</span>
            </div>
        </div>
        
        <div class="quiz-question-container">
            <span class="quiz-difficulty ${question.difficulty}">${question.difficulty}</span>
            <div class="quiz-question-text">${question.question}</div>
            <div class="quiz-options">
                ${shuffledOpts.options.map((option, index) => `
                    <div class="quiz-option" data-index="${index}" onclick="selectQuizOption(${index})">
                        <div class="quiz-option-marker">${index + 1}</div>
                        <div class="quiz-option-text">${option}</div>
                    </div>
                `).join('')}
            </div>
            <div class="quiz-keyboard-hint">Press 1-4 to select, Enter to submit</div>
        </div>
        
        <div class="quiz-actions">
            <button class="quiz-btn" onclick="closeQuizModal()">Exit Quiz</button>
            <button class="quiz-btn primary" id="submitAnswerBtn" onclick="submitAnswer()" disabled>Submit Answer</button>
        </div>
    `;
}

let selectedAnswer = null;

function selectQuizOption(index) {
    const options = document.querySelectorAll('.quiz-option');
    options.forEach(opt => opt.classList.remove('selected'));
    options[index].classList.add('selected');
    selectedAnswer = index;
    document.getElementById('submitAnswerBtn').disabled = false;
}

function submitAnswer() {
    const question = currentQuiz.questions[currentQuiz.currentIndex];
    const shuffledOpts = currentQuiz.shuffledOptions[currentQuiz.currentIndex];
    const options = document.querySelectorAll('.quiz-option');
    const correctIndex = shuffledOpts.correctIndex;
    
    // Disable all options
    options.forEach(opt => opt.classList.add('disabled'));
    
    // Update analytics for this difficulty
    analyticsData.totalQuestionAnswered++;
    analyticsData.totalByDifficulty[question.difficulty]++;
    
    // Show correct/wrong
    options[correctIndex].classList.add('correct');
    if (selectedAnswer !== correctIndex) {
        options[selectedAnswer].classList.add('wrong');
        currentQuiz.wrong++;
    } else {
        currentQuiz.correct++;
        analyticsData.correctByDifficulty[question.difficulty]++;
    }
    
    saveLocalData();
    
    currentQuiz.answers.push({
        questionId: question.id,
        questionText: question.question,
        selected: selectedAnswer,
        selectedText: shuffledOpts.options[selectedAnswer],
        correct: correctIndex,
        correctText: shuffledOpts.options[correctIndex],
        isCorrect: selectedAnswer === correctIndex,
        difficulty: question.difficulty
    });
    
    // Update score display
    document.querySelector('.quiz-score-correct').textContent = `✓ ${currentQuiz.correct}`;
    document.querySelector('.quiz-score-wrong').textContent = `✗ ${currentQuiz.wrong}`;
    
    // Change button to next
    const submitBtn = document.getElementById('submitAnswerBtn');
    if (currentQuiz.currentIndex < currentQuiz.questions.length - 1) {
        submitBtn.textContent = 'Next Question →';
        submitBtn.onclick = nextQuestion;
    } else {
        submitBtn.textContent = 'See Results';
        submitBtn.onclick = showQuizResults;
    }
    submitBtn.disabled = false;
}

function nextQuestion() {
    currentQuiz.currentIndex++;
    selectedAnswer = null;
    renderQuizQuestion();
}

function showQuizResults() {
    const modal = document.getElementById('quizModal');
    const modalTitle = document.getElementById('quizModalTitle');
    const modalBody = document.getElementById('quizModalBody');
    
    const passed = currentQuiz.correct >= 8;
    const topicInfo = findTopicById(currentQuiz.topicId);
    const wrongAnswers = currentQuiz.answers.filter(a => !a.isCorrect);
    
    // Save attempt
    if (!quizAttempts[currentQuiz.topicId]) {
        quizAttempts[currentQuiz.topicId] = [];
    }
    quizAttempts[currentQuiz.topicId].push({
        date: new Date().toISOString(),
        score: currentQuiz.correct,
        passed,
        wrongAnswers: wrongAnswers.map(a => ({ question: a.questionText, yourAnswer: a.selectedText, correct: a.correctText }))
    });
    saveLocalData();
    
    // If passed, mark topic as complete and show confetti
    if (passed && !completionData[currentQuiz.topicId]) {
        completionData[currentQuiz.topicId] = true;
        saveLocalData();
        
        // Sync to cloud
        if (syncConfig.binId && syncConfig.autoSync) {
            debouncedSync();
        }
        
        // Show confetti!
        triggerConfetti();
    }
    
    modalTitle.textContent = passed ? '🎉 Quiz Passed!' : '📚 Keep Studying';
    
    // Build wrong answers review section
    const wrongAnswersHtml = wrongAnswers.length > 0 ? `
        <div class="quiz-review-section">
            <div class="quiz-review-title">📝 Review Incorrect Answers (${wrongAnswers.length})</div>
            <div class="quiz-review-list">
                ${wrongAnswers.map((a, i) => `
                    <div class="quiz-review-item">
                        <div class="quiz-review-question">
                            <span class="quiz-review-num">${i + 1}.</span>
                            <span class="quiz-review-difficulty ${a.difficulty}">${a.difficulty}</span>
                            ${a.questionText}
                        </div>
                        <div class="quiz-review-answers">
                            <div class="quiz-review-wrong">
                                <span class="review-label">Your answer:</span>
                                <span class="review-text wrong">${a.selectedText}</span>
                            </div>
                            <div class="quiz-review-correct">
                                <span class="review-label">Correct:</span>
                                <span class="review-text correct">${a.correctText}</span>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    ` : '';
    
    modalBody.innerHTML = `
        <div class="quiz-results">
            <div class="quiz-results-icon ${passed ? 'success' : 'fail'}">
                ${passed ? '🏆' : '📖'}
            </div>
            <div class="quiz-results-title">
                ${passed ? 'Congratulations!' : 'Not Quite There'}
            </div>
            <div class="quiz-results-score ${passed ? 'pass' : 'fail'}">
                ${currentQuiz.correct}/10
            </div>
            <div class="quiz-results-breakdown">
                <span class="breakdown-item easy">Easy: ${currentQuiz.answers.filter(a => a.difficulty === 'easy' && a.isCorrect).length}/${currentQuiz.answers.filter(a => a.difficulty === 'easy').length}</span>
                <span class="breakdown-item medium">Medium: ${currentQuiz.answers.filter(a => a.difficulty === 'medium' && a.isCorrect).length}/${currentQuiz.answers.filter(a => a.difficulty === 'medium').length}</span>
                <span class="breakdown-item hard">Hard: ${currentQuiz.answers.filter(a => a.difficulty === 'hard' && a.isCorrect).length}/${currentQuiz.answers.filter(a => a.difficulty === 'hard').length}</span>
            </div>
            <div class="quiz-results-message">
                ${passed ? 
                    `You scored ${currentQuiz.correct} out of 10! This topic "${topicInfo?.topic.name}" has been marked as complete.` : 
                    `You scored ${currentQuiz.correct} out of 10. You need at least 8 correct answers to complete this topic. Review the questions below and try again!`
                }
            </div>
            ${wrongAnswersHtml}
            <div class="quiz-results-actions">
                ${!passed ? 
                    `<button class="quiz-btn" onclick="startQuiz('${currentQuiz.topicId}')">Retry Quiz</button>` : 
                    ''
                }
                <button class="quiz-btn primary" onclick="closeQuizModal(); ${passed ? 'refreshUI()' : ''}">
                    ${passed ? 'Continue' : 'Back to Study'}
                </button>
            </div>
        </div>
    `;
}

// Confetti animation
function triggerConfetti() {
    const canvas = document.createElement('canvas');
    canvas.id = 'confetti-canvas';
    canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:10000;';
    document.body.appendChild(canvas);
    
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    const confettiPieces = [];
    const colors = ['#00d4ff', '#00ff88', '#ff6b35', '#ffcc00', '#ff3366', '#a855f7'];
    
    // Create confetti pieces
    for (let i = 0; i < 150; i++) {
        confettiPieces.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height - canvas.height,
            w: Math.random() * 10 + 5,
            h: Math.random() * 6 + 4,
            color: colors[Math.floor(Math.random() * colors.length)],
            speed: Math.random() * 3 + 2,
            angle: Math.random() * Math.PI * 2,
            spin: (Math.random() - 0.5) * 0.2
        });
    }
    
    let animationFrame;
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        let allDone = true;
        confettiPieces.forEach(p => {
            p.y += p.speed;
            p.angle += p.spin;
            
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.angle);
            ctx.fillStyle = p.color;
            ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
            ctx.restore();
            
            if (p.y < canvas.height + 50) allDone = false;
        });
        
        if (!allDone) {
            animationFrame = requestAnimationFrame(animate);
        } else {
            cancelAnimationFrame(animationFrame);
            canvas.remove();
        }
    }
    
    animate();
    
    // Remove canvas after 5 seconds as fallback
    setTimeout(() => {
        if (canvas.parentNode) canvas.remove();
    }, 5000);
}

function closeQuizModal() {
    document.getElementById('quizModal').classList.remove('active');
    selectedAnswer = null;
    currentQuiz = {
        topicId: null,
        questions: [],
        shuffledOptions: [],
        currentIndex: 0,
        answers: [],
        correct: 0,
        wrong: 0
    };
}

// ===== Analytics Modal =====
function openAnalyticsModal() {
    const modal = document.getElementById('analyticsModal');
    if (!modal) return;
    
    const modalBody = document.getElementById('analyticsModalBody');
    
    // Calculate stats
    const overallStats = calculateOverallStats();
    const easyAcc = analyticsData.totalByDifficulty.easy > 0 
        ? Math.round((analyticsData.correctByDifficulty.easy / analyticsData.totalByDifficulty.easy) * 100) : 0;
    const mediumAcc = analyticsData.totalByDifficulty.medium > 0 
        ? Math.round((analyticsData.correctByDifficulty.medium / analyticsData.totalByDifficulty.medium) * 100) : 0;
    const hardAcc = analyticsData.totalByDifficulty.hard > 0 
        ? Math.round((analyticsData.correctByDifficulty.hard / analyticsData.totalByDifficulty.hard) * 100) : 0;
    const overallAcc = analyticsData.totalQuestionAnswered > 0
        ? Math.round(((analyticsData.correctByDifficulty.easy + analyticsData.correctByDifficulty.medium + analyticsData.correctByDifficulty.hard) / analyticsData.totalQuestionAnswered) * 100) : 0;
    
    // Get subject progress
    const subjectProgress = syllabusData.subjects.map(s => ({
        name: s.shortName,
        color: s.color,
        ...calculateSubjectStats(s)
    }));
    
    modalBody.innerHTML = `
        <div class="analytics-grid">
            <div class="analytics-card">
                <div class="analytics-card-title">📊 Overall Progress</div>
                <div class="analytics-stat-big">${overallStats.percentage}%</div>
                <div class="analytics-stat-sub">${overallStats.completed}/${overallStats.total} topics completed</div>
            </div>
            
            <div class="analytics-card">
                <div class="analytics-card-title">📝 Quiz Performance</div>
                <div class="analytics-stat-big">${overallAcc}%</div>
                <div class="analytics-stat-sub">${analyticsData.totalQuizzesTaken} quizzes taken • ${analyticsData.totalQuestionAnswered} questions answered</div>
            </div>
            
            <div class="analytics-card full-width">
                <div class="analytics-card-title">🎯 Accuracy by Difficulty</div>
                <div class="analytics-difficulty-bars">
                    <div class="difficulty-bar-item">
                        <span class="difficulty-label easy">Easy</span>
                        <div class="difficulty-bar-track">
                            <div class="difficulty-bar-fill easy" style="width: ${easyAcc}%"></div>
                        </div>
                        <span class="difficulty-percent">${easyAcc}%</span>
                        <span class="difficulty-count">(${analyticsData.correctByDifficulty.easy}/${analyticsData.totalByDifficulty.easy})</span>
                    </div>
                    <div class="difficulty-bar-item">
                        <span class="difficulty-label medium">Medium</span>
                        <div class="difficulty-bar-track">
                            <div class="difficulty-bar-fill medium" style="width: ${mediumAcc}%"></div>
                        </div>
                        <span class="difficulty-percent">${mediumAcc}%</span>
                        <span class="difficulty-count">(${analyticsData.correctByDifficulty.medium}/${analyticsData.totalByDifficulty.medium})</span>
                    </div>
                    <div class="difficulty-bar-item">
                        <span class="difficulty-label hard">Hard</span>
                        <div class="difficulty-bar-track">
                            <div class="difficulty-bar-fill hard" style="width: ${hardAcc}%"></div>
                        </div>
                        <span class="difficulty-percent">${hardAcc}%</span>
                        <span class="difficulty-count">(${analyticsData.correctByDifficulty.hard}/${analyticsData.totalByDifficulty.hard})</span>
                    </div>
                </div>
            </div>
            
            <div class="analytics-card full-width">
                <div class="analytics-card-title">📚 Subject Progress</div>
                <div class="analytics-subjects">
                    ${subjectProgress.map(s => `
                        <div class="analytics-subject-item">
                            <span class="subject-name" style="color: ${s.color}">${s.name}</span>
                            <div class="subject-bar-track">
                                <div class="subject-bar-fill" style="width: ${s.percentage}%; background: ${s.color}"></div>
                            </div>
                            <span class="subject-percent">${s.percentage}%</span>
                            <span class="subject-count">${s.completed}/${s.total}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
        
        <div class="analytics-tip">
            💡 <strong>Tip:</strong> Focus on improving your ${hardAcc < mediumAcc ? 'hard' : mediumAcc < easyAcc ? 'medium' : 'easy'} question accuracy!
        </div>
    `;
    
    modal.classList.add('active');
}

function closeAnalyticsModal() {
    document.getElementById('analyticsModal')?.classList.remove('active');
}

function refreshUI() {
    updateOverallProgress();
    updateStreakCounter();
    renderTodaySection();
    renderSubjectCards();
    renderScheduleGrid();
}

function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

// Global functions
window.toggleTopic = toggleTopic;
window.openSubjectModal = openSubjectModal;
window.showDayDetails = showDayDetails;
window.exportProgress = exportProgress;
window.importProgress = importProgress;
window.openTopicModal = openTopicModal;
window.closeTopicModal = closeTopicModal;
window.startQuiz = startQuiz;
window.selectQuizOption = selectQuizOption;
window.submitAnswer = submitAnswer;
window.nextQuestion = nextQuestion;
window.showQuizResults = showQuizResults;
window.closeQuizModal = closeQuizModal;
window.refreshUI = refreshUI;
window.openAnalyticsModal = openAnalyticsModal;
window.closeAnalyticsModal = closeAnalyticsModal;
