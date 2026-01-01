// ===== Global State =====
let syllabusData = null;
let completionData = {};
const LOCAL_STORAGE_KEY = 'syllabus_completion_data';
const SYNC_CONFIG_KEY = 'syllabus_sync_config';

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
}

function saveLocalData() {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(completionData));
    localStorage.setItem(SYNC_CONFIG_KEY, JSON.stringify(syncConfig));
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
    const startDate = new Date(syllabusData.metadata.startDate);
    const diffTime = today - startDate;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
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
                 onclick="toggleTopic('${item.topic.id}')"></div>
            <div class="topic-info">
                <div class="topic-name">${item.topic.name}</div>
                <div class="topic-meta">
                    <span class="topic-subject" style="border-color: ${item.subject.color}; color: ${item.subject.color}">
                        ${item.subject.shortName}
                    </span>
                    <span>D${item.topic.day}</span>
                </div>
            </div>
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
                        <div class="unit-topic ${completionData[topic.id] ? 'completed' : ''}" data-topic-id="${topic.id}">
                            <div class="topic-checkbox ${completionData[topic.id] ? 'checked' : ''}" 
                                 onclick="toggleTopic('${topic.id}')"></div>
                            <span class="topic-name">${topic.name}</span>
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
    
    // Help modal close
    document.getElementById('helpModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'helpModal') closeHelpModal();
    });
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeModal();
            closeHelpModal();
        }
        // Keyboard shortcuts
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
                     onclick="toggleTopic('${item.topic.id}')"></div>
                <div class="topic-info">
                    <div class="topic-name">${item.topic.name}</div>
                    <div class="topic-meta">
                        <span class="topic-subject" style="border-color: ${item.subject.color}; color: ${item.subject.color}">
                            ${item.subject.shortName}
                        </span>
                        <span>D${item.topic.day}</span>
                    </div>
                </div>
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

// Global functions
window.toggleTopic = toggleTopic;
window.openSubjectModal = openSubjectModal;
window.showDayDetails = showDayDetails;
window.exportProgress = exportProgress;
window.importProgress = importProgress;
