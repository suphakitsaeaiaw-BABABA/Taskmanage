// --- Profiles & State Management ---
let profiles = JSON.parse(localStorage.getItem('taskflow_profiles')) || [{ id: 'default', name: 'Default Profile' }];
let activeProfileId = localStorage.getItem('taskflow_active_profile') || 'default';

// Migration config
if (localStorage.getItem('taskflow_tasks') && !localStorage.getItem('taskflow_tasks_default')) {
    let oldTasks = JSON.parse(localStorage.getItem('taskflow_tasks')) || [];
    localStorage.setItem('taskflow_tasks_default', JSON.stringify(oldTasks));
}

let tasks = JSON.parse(localStorage.getItem(`taskflow_tasks_${activeProfileId}`)) || [];
let statusChartInstance = null;
let priorityChartInstance = null;
let categoryChartInstance = null;
let cloudApiUrl = localStorage.getItem('taskflow_cloud_api') || '';

// --- DOM Elements ---
const navItems = document.querySelectorAll('.nav-item');
const viewSections = document.querySelectorAll('.view-section');
const pageTitle = document.getElementById('page-title');
const pageSubtitle = document.getElementById('page-subtitle');

const btnNewTask = document.getElementById('btn-new-task');
const modalOverlay = document.getElementById('task-modal');
const closeModal = document.getElementById('close-modal');
const cancelTaskBtn = document.getElementById('cancel-task');
const taskForm = document.getElementById('task-form');

const taskGrid = document.getElementById('task-grid');
const filterStatus = document.getElementById('filter-status');
const searchTask = document.getElementById('search-task');

const sourcesContainer = document.getElementById('sources-container');
const btnAddSource = document.getElementById('btn-add-source');

const progressContainer = document.getElementById('progress-container');
const btnAddProgress = document.getElementById('btn-add-progress');

const btnExportData = document.getElementById('btn-export-data');
const btnImportData = document.getElementById('btn-import-data');
const importFileInput = document.getElementById('import-file-input');

// Cloud Sync Elements
const cloudModal = document.getElementById('cloud-modal');
const btnCloudSettings = document.getElementById('btn-cloud-settings');
const closeCloudModal = document.getElementById('close-cloud-modal');
const btnCancelCloud = document.getElementById('btn-cancel-cloud');
const btnSaveCloud = document.getElementById('btn-save-cloud');
const cloudUrlInput = document.getElementById('cloud-api-url');
const cloudSyncStatus = document.getElementById('cloud-sync-status');

// --- Profile DOM Elements ---
const profileDropdown = document.getElementById('profile-dropdown');
const btnOpenProfileManager = document.getElementById('btn-open-profile-manager');
const profileModal = document.getElementById('profile-modal');
const closeProfileModal = document.getElementById('close-profile-modal');
const btnCreateProfile = document.getElementById('btn-create-profile');
const newProfileName = document.getElementById('new-profile-name');
const profileListContainer = document.getElementById('profile-list-container');

// --- Profile Picture Elements ---
const profileUpload = document.getElementById('profile-upload');
const userProfileImg = document.getElementById('user-profile-img');

if (userProfileImg) {
    const savedPic = localStorage.getItem('taskflow_profile_pic');
    if (savedPic) {
        userProfileImg.src = savedPic;
    }
}

if (profileUpload) {
    profileUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const dataUrl = event.target.result;
                if (userProfileImg) userProfileImg.src = dataUrl;
                localStorage.setItem('taskflow_profile_pic', dataUrl);
            };
            reader.readAsDataURL(file);
        }
    });
}

// --- Mobile Sidebar Elements ---
const sidebar = document.querySelector('.sidebar');
const btnToggleSidebar = document.getElementById('btn-toggle-sidebar');
const sidebarOverlay = document.getElementById('sidebar-overlay');

// --- Theme Elements ---
const themeBtns = document.querySelectorAll('.theme-btn');
const rootElement = document.documentElement;

const savedTheme = localStorage.getItem('taskflow_theme') || 'red';
rootElement.setAttribute('data-theme', savedTheme);

themeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const theme = btn.getAttribute('data-set-theme');
        rootElement.setAttribute('data-theme', theme);
        localStorage.setItem('taskflow_theme', theme);
        if (typeof updateDashboard === 'function') updateDashboard();
    });
});

function getThemeColor(varName) {
    return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
}

// --- Cloud Sync API ---
if (btnCloudSettings) {
    btnCloudSettings.addEventListener('click', () => {
        cloudUrlInput.value = cloudApiUrl;
        cloudModal.classList.add('active');
    });
}

const hideCloudModal = () => cloudModal.classList.remove('active');
if (closeCloudModal) closeCloudModal.addEventListener('click', hideCloudModal);
if (btnCancelCloud) btnCancelCloud.addEventListener('click', hideCloudModal);
if (cloudModal) {
    cloudModal.addEventListener('click', (e) => {
        if (e.target === cloudModal) hideCloudModal();
    });
}

if (btnSaveCloud) {
    btnSaveCloud.addEventListener('click', () => {
        let url = cloudUrlInput.value.trim();
        
        if (!url) {
            cloudApiUrl = '';
            localStorage.removeItem('taskflow_cloud_api');
            hideCloudModal();
            return;
        }

        // URL Validation Warning
        if (url.includes('docs.google.com/spreadsheets')) {
            alert('❌ ใส่ลิงก์ผิดประเภทครับ!\nคุณนำลิงก์ของหน้าตาราง Google Sheet มาใส่\n\nต้องไปที่แท็บ "ส่วนขยาย > Apps Script" แล้วกด Deploy (การทำให้ใช้งานได้) แล้วนำลิงก์ "เว็บแอป" มาใส่ครับ');
            return;
        }
        
        if (!url.startsWith('https://script.google.com/macros/s/')) {
            alert('❌ ลิงก์ไม่ถูกต้อง!\nURL ต้องขึ้นต้นด้วย https://script.google.com/macros/s/...\nกรุณากลับไปก๊อปปี้ลิงก์ Web App ใหม่อีกครั้งครับ');
            return;
        }

        cloudApiUrl = url;
        localStorage.setItem('taskflow_cloud_api', cloudApiUrl);
        hideCloudModal();
        syncFromCloud();
    });
}

function updateSyncStatusUI(status, message) {
    if (!cloudSyncStatus) return;
    cloudSyncStatus.style.display = 'flex';
    if (status === 'syncing') {
        cloudSyncStatus.innerHTML = '<i class="ph ph-arrows-clockwise ph-spin"></i> ' + message;
        cloudSyncStatus.style.color = '#eab308'; // Warning/Yellow
    } else if (status === 'success') {
        cloudSyncStatus.innerHTML = '<i class="ph ph-check-circle"></i> ' + message;
        cloudSyncStatus.style.color = '#4ade80'; // Success/Green
        setTimeout(() => { cloudSyncStatus.style.display = 'none'; }, 2000);
    } else if (status === 'error') {
        cloudSyncStatus.innerHTML = '<i class="ph ph-warning-circle"></i> ' + message;
        cloudSyncStatus.style.color = '#ef4444'; // Error/Red
        setTimeout(() => { cloudSyncStatus.style.display = 'none'; }, 4000);
    }
}

async function syncToCloud() {
    if (!cloudApiUrl) return;
    try {
        updateSyncStatusUI('syncing', 'Syncing to Cloud...');
        
        const allTasks = {};
        for (const prof of profiles) {
            allTasks[prof.id] = JSON.parse(localStorage.getItem(`taskflow_tasks_${prof.id}`)) || [];
        }

        const response = await fetch(cloudApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
                action: 'saveData',
                profiles: profiles,
                tasks: allTasks
            })
        });
        
        if (!response.ok) throw new Error("HTTP Status Error");
        updateSyncStatusUI('success', 'Cloud Synced!');
    } catch (err) {
        console.error("Cloud Error:", err);
        updateSyncStatusUI('error', 'Sync Failed');
    }
}

async function syncFromCloud() {
    if (!cloudApiUrl) return;
    try {
        updateSyncStatusUI('syncing', 'Fetching Data...');
        const res = await fetch(`${cloudApiUrl}?action=getData`);
        
        // Handle Google Apps authentication/HTML redirect error pages
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("text/html")) {
            throw new Error("HTML_RECEIVED");
        }

        const data = await res.json();
        
        if (data && data.profiles && data.tasks) {
            // MAGIC FIX: If Google Sheet is completely empty, it means we must upload our local tasks there!
            if (data.profiles.length === 0 && Object.keys(data.tasks).length === 0) {
                console.log("Cloud is fresh/empty. Starting initial push to cloud...");
                await syncToCloud();
                return;
            }

            // Reconstruct profiles
            if (Array.isArray(data.profiles) && data.profiles.length > 0) {
                profiles = data.profiles;
                localStorage.setItem('taskflow_profiles', JSON.stringify(profiles));
            }
            
            // Validate if activeProfileId still exists, otherwise default to first
            const profileExists = profiles.find(p => p.id === activeProfileId);
            if (!profileExists) {
                activeProfileId = profiles[0].id;
                localStorage.setItem('taskflow_active_profile', activeProfileId);
            }

            // Sync all tasks over
            for (const profId in data.tasks) {
                localStorage.setItem(`taskflow_tasks_${profId}`, JSON.stringify(data.tasks[profId]));
            }
            
            // Reload active tasks
            tasks = JSON.parse(localStorage.getItem(`taskflow_tasks_${activeProfileId}`)) || [];
            
            // Update UI
            if (profileDropdown) renderProfiles();
            if (profileListContainer) renderProfilesList();
            renderTasks();
            updateCategoryOptions();
            if (document.getElementById('view-dashboard').classList.contains('active')) updateDashboard();
            updateSyncStatusUI('success', 'Up to date');
        } else {
            updateSyncStatusUI('error', 'Invalid Format');
        }
    } catch (err) {
         console.error("Cloud Error:", err);
         if (err.message === "HTML_RECEIVED") {
             alert("❌ เชื่อมต่อล้มเหลว!\nโปรดตรวจสอบตอนที่คุณกด Deploy สิทธิ์การเข้าถึง (Who has access) ต้องตั้งเป็น 'ทุกคน (Anyone)' เท่านั้นครับ");
         }
         updateSyncStatusUI('error', 'Fetch Failed');
    }
}

function updateCategoryOptions() {
    const categories = new Set();
    tasks.forEach(t => {
        if (t.category) categories.add(t.category);
    });
    
    const datalist = document.getElementById('category-list');
    if (datalist) {
        datalist.innerHTML = '';
        categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat;
            datalist.appendChild(option);
        });
    }

    const filterCat = document.getElementById('filter-category');
    if (filterCat) {
        const currentVal = filterCat.value;
        filterCat.innerHTML = '<option value="All">All Categories</option>';
        [...categories].sort().forEach(cat => {
            const option = document.createElement('option');
            option.value = cat;
            option.innerText = cat;
            filterCat.appendChild(option);
        });
        if (categories.has(currentVal)) {
            filterCat.value = currentVal;
        } else {
            filterCat.value = 'All';
        }
    }
}

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    initProfiles();
    updateCategoryOptions();
    updateDashboard();
    renderTasks();
});

// --- Profile Logic ---
function initProfiles() {
    renderProfiles();
    
    if(profileDropdown) {
        profileDropdown.addEventListener('change', (e) => {
            switchProfile(e.target.value);
        });
    }

    if(btnOpenProfileManager) {
        btnOpenProfileManager.addEventListener('click', () => {
            profileModal.classList.add('active');
            renderProfiles();
        });
    }

    if(closeProfileModal) {
        closeProfileModal.addEventListener('click', () => {
            profileModal.classList.remove('active');
        });
    }

    if(profileModal) {
        profileModal.addEventListener('click', (e) => {
            if (e.target === profileModal) profileModal.classList.remove('active');
        });
    }

    if(btnCreateProfile) {
        btnCreateProfile.addEventListener('click', () => {
            const name = newProfileName.value.trim();
            if (!name) return;
            const newId = 'profile_' + Date.now();
            profiles.push({ id: newId, name });
            newProfileName.value = '';
            saveProfiles();
            switchProfile(newId);
            renderProfiles();
        });
    }
}

window.renameProfile = function(id) {
    const p = profiles.find(x => x.id === id);
    if (!p) return;
    const newName = prompt('Enter new profile name:', p.name);
    if (newName && newName.trim()) {
        p.name = newName.trim();
        saveProfiles();
        renderProfiles();
    }
};

window.deleteProfile = function(id) {
    if (profiles.length <= 1) return;
    if (confirm('Are you sure you want to delete this profile and ALL its tasks?')) {
        profiles = profiles.filter(x => x.id !== id);
        localStorage.removeItem(`taskflow_tasks_${id}`);
        if (activeProfileId === id) {
            switchProfile('default');
        }
        saveProfiles();
        renderProfiles();
    }
};

function saveProfiles() {
    localStorage.setItem('taskflow_profiles', JSON.stringify(profiles));
    if (cloudApiUrl) {
        syncToCloud();
    }
}

function switchProfile(id) {
    activeProfileId = id;
    localStorage.setItem('taskflow_active_profile', id);
    // Reload local tasks first for instant UI response
    tasks = JSON.parse(localStorage.getItem(`taskflow_tasks_${id}`)) || [];
    renderProfiles(); // to update dropdown select
    updateCategoryOptions();
    const dashboardView = document.getElementById('view-dashboard');
    if (dashboardView && dashboardView.classList.contains('active')) {
        updateDashboard();
    } else {
        renderTasks();
    }
    
    // Sync from cloud if configured
    if (cloudApiUrl) {
        // Just reload tasks if we are switching, normally we'd fetch all again, but let's fetch to be safe
        syncFromCloud();
    }
}

function renderProfiles() {
    // Render Dropdown
    if (profileDropdown) {
        profileDropdown.innerHTML = '';
        profiles.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.innerText = p.name;
            if (p.id === activeProfileId) opt.selected = true;
            profileDropdown.appendChild(opt);
        });
    }

    // Render Modal List
    if (profileListContainer) {
        profileListContainer.innerHTML = '';
        profiles.forEach(p => {
            const item = document.createElement('div');
            item.style.display = 'flex';
            item.style.alignItems = 'center';
            item.style.justifyContent = 'space-between';
            item.style.padding = '0.75rem';
            item.style.background = 'rgba(255,255,255,0.05)';
            item.style.borderRadius = '0.5rem';

            const nameSpan = document.createElement('span');
            nameSpan.innerText = p.name;
            nameSpan.style.fontWeight = '500';
            
            const actDiv = document.createElement('div');
            actDiv.style.display = 'flex';
            actDiv.style.gap = '0.5rem';

            if (p.id !== 'default') {
                const btnRename = document.createElement('button');
                btnRename.innerHTML = '<i class="ph ph-pencil-simple"></i>';
                btnRename.className = 'btn-icon edit';
                btnRename.onclick = () => window.renameProfile(p.id);

                const btnDel = document.createElement('button');
                btnDel.innerHTML = '<i class="ph ph-trash"></i>';
                btnDel.className = 'btn-icon delete';
                btnDel.onclick = () => window.deleteProfile(p.id);

                actDiv.appendChild(btnRename);
                actDiv.appendChild(btnDel);
            } else {
                const defSpan = document.createElement('span');
                defSpan.innerText = '(Default)';
                defSpan.style.opacity = '0.5';
                defSpan.style.fontSize = '0.8rem';
                actDiv.appendChild(defSpan);
            }

            item.appendChild(nameSpan);
            item.appendChild(actDiv);
            profileListContainer.appendChild(item);
        });
    }
}

// --- Navigation ---
navItems.forEach(item => {
    item.addEventListener('click', () => {
        // Update Active Nav
        navItems.forEach(nav => nav.classList.remove('active'));
        item.classList.add('active');

        // Update View
        const targetView = item.getAttribute('data-target');
        viewSections.forEach(section => section.classList.remove('active'));
        document.getElementById(`view-${targetView}`).classList.add('active');

        // Update Header texts
        if (targetView === 'dashboard') {
            pageTitle.innerText = 'Dashboard';
            pageSubtitle.innerText = 'Welcome back! Here is your task summary.';
            updateDashboard();
        } else {
            pageTitle.innerText = 'My Tasks';
            pageSubtitle.innerText = 'Manage and track all your tasks here.';
            renderTasks();
        }
        
        // Close sidebar on mobile after clicking
        if (window.innerWidth <= 768 && sidebar.classList.contains('open')) {
            sidebar.classList.remove('open');
            sidebarOverlay.classList.remove('active');
        }
    });
});

// --- Mobile Sidebar Handling ---
if (btnToggleSidebar) {
    btnToggleSidebar.addEventListener('click', () => {
        sidebar.classList.toggle('open');
        sidebarOverlay.classList.toggle('active');
    });
}
if (sidebarOverlay) {
    sidebarOverlay.addEventListener('click', () => {
        sidebar.classList.remove('open');
        sidebarOverlay.classList.remove('active');
    });
}

// --- Modal Handling ---
function openModal(taskId = null) {
    document.getElementById('modal-title').innerText = taskId ? 'Edit Task' : 'Create New Task';
    
    if (taskId) {
        const task = tasks.find(t => t.id === taskId);
        if (task) {
            document.getElementById('task-id').value = task.id;
            document.getElementById('task-desc').value = task.description;
            document.getElementById('task-category').value = task.category || '';
            document.getElementById('task-status').value = task.status;
            document.getElementById('task-priority').value = task.priority || 'Medium';
            
            const dueTypeInput = document.getElementById('task-due-type');
            if (dueTypeInput) dueTypeInput.value = task.dueType || 'date';
            
            const dueDateInput = document.getElementById('task-due');
            if (dueDateInput) {
                dueDateInput.value = task.dueDate || '';
                dueDateInput.style.display = (task.dueType === 'daily') ? 'none' : 'block';
            }
            
            document.getElementById('task-note').value = task.note;
            
            sourcesContainer.innerHTML = '';
            const taskSources = task.sources || (task.relevantSrc ? [{title: '', url: task.relevantSrc}] : []);
            if (taskSources.length > 0) {
                taskSources.forEach(src => addSourceInput(src.title, src.url));
            } else {
                addSourceInput();
            }

            progressContainer.innerHTML = '';
            const taskProgress = task.progressLogs || [];
            if (taskProgress.length > 0) {
                taskProgress.forEach(p => addProgressInput(p.detail, p.date));
            } else {
                addProgressInput();
            }
        }
    } else {
        taskForm.reset();
        document.getElementById('task-id').value = '';
        document.getElementById('task-category').value = '';
        document.getElementById('task-priority').value = 'Medium';
        document.getElementById('task-status').value = 'To Do';
        
        const dueTypeInput = document.getElementById('task-due-type');
        if (dueTypeInput) dueTypeInput.value = 'date';
        
        const dueDateInput = document.getElementById('task-due');
        if (dueDateInput) {
            dueDateInput.value = '';
            dueDateInput.style.display = 'block';
        }
        
        sourcesContainer.innerHTML = '';
        addSourceInput();

        progressContainer.innerHTML = '';
        addProgressInput();
    }
    
    modalOverlay.classList.add('active');
}

function addSourceInput(title = '', url = '') {
    const div = document.createElement('div');
    div.className = 'source-item';
    div.innerHTML = `
        <input type="text" placeholder="Label (e.g. Figma)" class="source-title" value="${title}">
        <input type="text" placeholder="URL or Ref" class="source-url" value="${url}">
        <button type="button" class="btn-icon delete-source"><i class="ph ph-trash"></i></button>
    `;
    div.querySelector('.delete-source').addEventListener('click', () => {
        div.remove();
    });
    sourcesContainer.appendChild(div);
}

function addProgressInput(detail = '', date = '') {
    const div = document.createElement('div');
    div.className = 'progress-log-input';
    const defaultDate = date || new Date().toISOString().split('T')[0]; // Auto fill today
    
    div.innerHTML = `
        <input type="date" class="progress-date" value="${defaultDate}">
        <textarea placeholder="What progress was made?" class="progress-detail" rows="2">${detail}</textarea>
        <button type="button" class="btn-icon delete-progress"><i class="ph ph-trash"></i></button>
    `;
    div.querySelector('.delete-progress').addEventListener('click', () => {
        div.remove();
    });
    progressContainer.appendChild(div);
}

// Handle Due Date Type change
const dueTypeSelect = document.getElementById('task-due-type');
if (dueTypeSelect) {
    dueTypeSelect.addEventListener('change', (e) => {
        const dateInput = document.getElementById('task-due');
        if (dateInput) {
            dateInput.style.display = e.target.value === 'daily' ? 'none' : 'block';
        }
    });
}

function closeTaskModal() {
    modalOverlay.classList.remove('active');
}

btnNewTask.addEventListener('click', () => openModal());
closeModal.addEventListener('click', closeTaskModal);
cancelTaskBtn.addEventListener('click', closeTaskModal);
btnAddSource.addEventListener('click', () => addSourceInput());
btnAddProgress.addEventListener('click', () => addProgressInput());
modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeTaskModal();
});

// --- Create / Edit Task ---
taskForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const id = document.getElementById('task-id').value;
    
    const sources = [];
    document.querySelectorAll('.source-item').forEach(item => {
        const title = item.querySelector('.source-title').value.trim();
        const url = item.querySelector('.source-url').value.trim();
        if (title || url) {
            sources.push({ title, url });
        }
    });

    const progressLogs = [];
    document.querySelectorAll('.progress-log-input').forEach(item => {
        const date = item.querySelector('.progress-date').value;
        const detail = item.querySelector('.progress-detail').value.trim();
        if (detail) {
            progressLogs.push({ date, detail });
        }
    });

    const dueTypeVal = document.getElementById('task-due-type') ? document.getElementById('task-due-type').value : 'date';
    const dueDateVal = dueTypeVal === 'daily' ? '' : document.getElementById('task-due').value;

    const taskData = {
        id: id ? id : Date.now().toString(),
        description: document.getElementById('task-desc').value,
        category: document.getElementById('task-category').value.trim(),
        status: document.getElementById('task-status').value,
        priority: document.getElementById('task-priority').value,
        dueType: dueTypeVal,
        dueDate: dueDateVal,
        sources: sources,
        progressLogs: progressLogs,
        note: document.getElementById('task-note').value,
        updatedAt: new Date().toISOString()
    };

    if (id) {
        // Update
        tasks = tasks.map(t => t.id === id ? taskData : t);
    } else {
        // Create
        tasks.unshift(taskData);
    }

    saveData();
    updateCategoryOptions();
    closeTaskModal();
    
    // Refresh current view
    if(document.getElementById('view-dashboard').classList.contains('active')){
         updateDashboard();
    } else {
         renderTasks();
    }
});

// --- Delete Task ---
function deleteTask(id) {
    if (confirm('Are you sure you want to delete this task?')) {
        tasks = tasks.filter(t => t.id !== id);
        saveData();
        updateCategoryOptions();
        renderTasks();
        updateDashboard();
    }
}

// --- Save Data ---
function saveData() {
    localStorage.setItem(`taskflow_tasks_${activeProfileId}`, JSON.stringify(tasks));
    if (cloudApiUrl) {
        syncToCloud();
    }
}

// --- Export Data ---
if (btnExportData) {
    btnExportData.addEventListener('click', () => {
        if (tasks.length === 0) {
            alert('No tasks to export.');
            return;
        }
        const dataStr = JSON.stringify(tasks, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        const dateStr = new Date().toISOString().split('T')[0];
        a.download = `taskflow_backup_${dateStr}.json`;
        document.body.appendChild(a);
        a.click();
        
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });
}

// --- Import Data ---
if (btnImportData && importFileInput) {
    btnImportData.addEventListener('click', () => {
        importFileInput.click();
    });

    importFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const importedTasks = JSON.parse(event.target.result);
                if (Array.isArray(importedTasks)) {
                    // Ask user if they want to merge or overwrite
                    if (confirm('Do you want to MERGE imported tasks with existing ones? (Cancel to OVERWRITE completely)')) {
                        // Merge logic: avoid duplicate IDs
                        const existingIds = new Set(tasks.map(t => t.id));
                        importedTasks.forEach(task => {
                            if (!task.id) task.id = Date.now().toString() + Math.random().toString(36).substr(2, 5);
                            if (existingIds.has(task.id)) {
                                task.id = Date.now().toString() + Math.random().toString(36).substr(2, 5);
                            }
                            tasks.push(task);
                        });
                    } else {
                        // Overwrite
                        tasks = importedTasks;
                    }
                    
                    saveData();
                    updateCategoryOptions();
                    
                    if (document.getElementById('view-dashboard').classList.contains('active')) {
                        updateDashboard();
                    } else {
                        renderTasks();
                    }
                    alert('Data imported successfully!');
                } else {
                    alert('Invalid configuration file format.');
                }
            } catch (error) {
                alert('Error parsing JSON file. Please ensure it is a valid Taskflow backup.');
                console.error(error);
            }
            // Reset input
            importFileInput.value = '';
        };
        reader.readAsText(file);
    });
}

// --- Render Tasks ---
function renderTasks() {
    taskGrid.innerHTML = '';
    
    const searchTerm = searchTask.value.toLowerCase();
    const statusFilter = filterStatus.value;
    const categoryFilter = document.getElementById('filter-category') ? document.getElementById('filter-category').value : 'All';
    
    const filteredTasks = tasks.filter(task => {
        const matchSearch = task.description.toLowerCase().includes(searchTerm) || task.note.toLowerCase().includes(searchTerm);
        const matchStatus = statusFilter === 'All' || task.status === statusFilter;
        const matchCategory = categoryFilter === 'All' || task.category === categoryFilter;
        return matchSearch && matchStatus && matchCategory;
    });

    if (filteredTasks.length === 0) {
        taskGrid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-secondary); padding: 3rem;">No tasks found.</div>`;
        return;
    }

    filteredTasks.forEach(task => {
        const badgeClass = {
            'To Do': 'badge-todo',
            'In Progress': 'badge-progress',
            'Done': 'badge-done',
            'Close': 'badge-close'
        }[task.status];
        
        const priorityClass = {
            'Low': 'badge-low',
            'Medium': 'badge-medium',
            'High': 'badge-high'
        }[task.priority || 'Medium'];

        // Format Due Date
        let dueDateHtml = '';
        if (task.dueType === 'daily') {
            dueDateHtml = `
                <div class="task-due-date" style="color: #60a5fa;">
                    <i class="ph ph-arrows-clockwise"></i> Daily Task
                </div>
            `;
        } else if (task.dueDate) {
            // Check if overdue (ignoring time)
            const dueNum = new Date(task.dueDate).setHours(0,0,0,0);
            const todayNum = new Date().setHours(0,0,0,0);
            const isOverdue = dueNum < todayNum && task.status !== 'Done';
            dueDateHtml = `
                <div class="task-due-date ${isOverdue ? 'overdue' : ''}">
                    <i class="ph ph-calendar-blank"></i> Due: ${new Date(dueNum).toLocaleDateString()}
                </div>
            `;
        }
        
        // Format Progress Logs
        let progressHtml = '';
        const logs = task.progressLogs || [];
        if (logs.length > 0) {
            progressHtml = `<div class="task-progress-log">`;
            logs.forEach(log => {
                progressHtml += `
                    <div class="log-item">
                        <span class="log-date">[${new Date(log.date).toLocaleDateString()}]</span>
                        <span class="log-detail">${log.detail}</span>
                    </div>
                `;
            });
            progressHtml += `</div>`;
        } else {
            progressHtml = `<div class="task-progress-log" style="color: var(--text-secondary); opacity: 0.5; font-style: italic;">No progress logged.</div>`;
        }

        // Format link parsing
        let sourceHtml = '';
        const taskSources = task.sources || (task.relevantSrc ? [{title: '', url: task.relevantSrc}] : []);
        
        if (taskSources.length > 0) {
            sourceHtml = `<div style="display: flex; flex-direction: column; gap: 0.5rem; width: 100%; overflow: hidden;">`;
            taskSources.forEach(src => {
                const isUrl = src.url && src.url.startsWith('http');
                const titleBadge = src.title ? `<span class="source-label">${src.title}</span>` : '';
                const content = isUrl 
                    ? `<a href="${src.url}" target="_blank">${src.url}</a>`
                    : `<span>${src.url || src.title}</span>`;
                const icon = isUrl ? '<i class="ph ph-link" style="margin-right:0.25rem;"></i>' : '<i class="ph ph-book-bookmark" style="margin-right:0.25rem;"></i>';
                sourceHtml += `<div style="display: flex; align-items: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${icon}${titleBadge}${content}</div>`;
            });
            sourceHtml += `</div>`;
        } else {
            sourceHtml = `<i class="ph ph-minus"></i> <span style="color: var(--text-secondary)">No source</span>`;
        }

        const card = document.createElement('div');
        card.className = 'task-card';
        card.setAttribute('data-status', task.status);
        
        card.innerHTML = `
            <div class="task-header">
                <div>
                    ${task.category ? `<div class="category-tag"><i class="ph ph-folder"></i> ${task.category}</div>` : ''}
                    <h3 class="task-title">${task.description}</h3>
                </div>
                <div class="task-badges-container">
                    <span class="task-badge ${priorityClass}">${task.priority || 'Medium'}</span>
                    <span class="task-badge ${badgeClass}">${task.status}</span>
                </div>
            </div>
            
            ${dueDateHtml}
            ${progressHtml}

            <div class="task-source">
                ${sourceHtml}
            </div>

            <div class="task-note-preview">
                ${task.note || '<span style="font-style:italic; opacity: 0.5;">No additional notes</span>'}
            </div>

            <div class="task-actions">
                <button class="btn-icon edit" onclick="openModal('${task.id}')" title="Edit"><i class="ph ph-pencil-simple"></i></button>
                <button class="btn-icon delete" onclick="deleteTask('${task.id}')" title="Delete"><i class="ph ph-trash"></i></button>
            </div>
        `;
        taskGrid.appendChild(card);
    });
}

// --- Filtering Events ---
searchTask.addEventListener('input', renderTasks);
filterStatus.addEventListener('change', renderTasks);
const filterCatEl = document.getElementById('filter-category');
if (filterCatEl) filterCatEl.addEventListener('change', renderTasks);

// --- Dashboard Logic ---
function updateDashboard() {
    // Basic stats
    const total = tasks.length;
    const inProgress = tasks.filter(t => t.status === 'In Progress').length;
    const completed = tasks.filter(t => t.status === 'Done').length;
    const todo = tasks.filter(t => t.status === 'To Do').length;
    const closed = tasks.filter(t => t.status === 'Close').length;
    
    let overdueCount = 0;
    const todayNum = new Date().setHours(0,0,0,0);
    
    tasks.forEach(t => {
        if (t.status !== 'Done' && t.status !== 'Close' && t.dueDate && t.dueType !== 'daily') {
            const dueNum = new Date(t.dueDate).setHours(0,0,0,0);
            if (dueNum < todayNum) overdueCount++;
        }
    });

    document.getElementById('stat-total').innerText = total;
    document.getElementById('stat-progress').innerText = inProgress;
    document.getElementById('stat-completed').innerText = completed;
    document.getElementById('stat-overdue').innerText = overdueCount;

    // Render Recent List (Ordered by updatedAt)
    const recentList = document.getElementById('recent-tasks-list');
    recentList.innerHTML = '';
    const sortedTasks = [...tasks].sort((a,b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    const recentTasks = sortedTasks.slice(0, 5);
    
    if(recentTasks.length === 0) {
        recentList.innerHTML = '<p style="color: var(--text-secondary); text-align: center; margin-top: 2rem;">No tasks yet.</p>';
    } else {
        recentTasks.forEach(task => {
            const lastLog = task.progressLogs && task.progressLogs.length > 0 
                ? task.progressLogs[task.progressLogs.length - 1].detail 
                : 'No progress logged yet.';
            
            recentList.innerHTML += `
                <div class="recent-item" style="padding: 0.75rem; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; align-items: center; justify-content: space-between;">
                    <div style="flex:1; overflow: hidden; padding-right: 0.5rem;" title="${task.description}">
                        <strong style="display:block; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 0.9rem;">${task.description}</strong>
                        <span style="font-size: 0.75rem; color: var(--text-secondary); display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">└ ${lastLog}</span>
                    </div>
                </div>
            `;
        });
    }

    // Chart Cleanups
    if (statusChartInstance) statusChartInstance.destroy();
    if (priorityChartInstance) priorityChartInstance.destroy();
    if (categoryChartInstance) categoryChartInstance.destroy();
    
    if(total === 0) return;

    // --- Status Chart ---
    const ctxStatus = document.getElementById('statusChart').getContext('2d');
    statusChartInstance = new Chart(ctxStatus, {
        type: 'doughnut',
        data: {
            labels: ['To Do', 'In Progress', 'Done', 'Close'],
            datasets: [{
                data: [todo, inProgress, completed, closed],
                backgroundColor: [
                    getThemeColor('--status-todo') || '#52525b', 
                    getThemeColor('--status-progress') || '#ea580c', 
                    getThemeColor('--status-done') || '#16a34a', 
                    getThemeColor('--status-close') || '#27272a'
                ],
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { color: '#f8fafc', font: { family: "'Inter', sans-serif" } } }
            },
            cutout: '70%'
        }
    });

    // --- Priority Chart ---
    const high = tasks.filter(t => t.priority === 'High' && t.status !== 'Close').length;
    const medium = tasks.filter(t => t.priority === 'Medium' && t.status !== 'Close').length;
    const low = tasks.filter(t => t.priority === 'Low' && t.status !== 'Close').length;
    
    const ctxPriority = document.getElementById('priorityChart').getContext('2d');
    priorityChartInstance = new Chart(ctxPriority, {
        type: 'doughnut',
        data: {
            labels: ['High', 'Medium', 'Low'],
            datasets: [{
                data: [high, medium, low],
                backgroundColor: [
                    getThemeColor('--overdue-color') || '#dc2626', 
                    getThemeColor('--status-progress') || '#ea580c', 
                    '#3b82f6'
                ],
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { color: '#f8fafc', font: { family: "'Inter', sans-serif" } } }
            },
            cutout: '70%'
        }
    });

    // --- Category Chart ---
    const activeTasks = tasks.filter(t => t.status !== 'Close');
    const categoriesMap = {};
    activeTasks.forEach(t => {
        const cat = t.category || 'Uncategorized';
        categoriesMap[cat] = (categoriesMap[cat] || 0) + 1;
    });
    
    // Sort categories by count
    const sortedCategories = Object.keys(categoriesMap).sort((a, b) => categoriesMap[b] - categoriesMap[a]).slice(0, 7); // Top 7
    const categoryData = sortedCategories.map(cat => categoriesMap[cat]);

    const ctxCategory = document.getElementById('categoryChart').getContext('2d');
    categoryChartInstance = new Chart(ctxCategory, {
        type: 'bar',
        data: {
            labels: sortedCategories,
            datasets: [{
                label: 'Active Tasks',
                data: categoryData,
                backgroundColor: getThemeColor('--primary') || '#dc2626',
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { color: '#94a3b8', stepSize: 1 },
                    grid: { color: 'rgba(255,255,255,0.05)' }
                },
                x: {
                    ticks: { color: '#94a3b8' },
                    grid: { display: false }
                }
            }
        }
    });
}
