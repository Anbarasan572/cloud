// ==========================================================================
// CLOUDASSET — ENTERPRISE CLOUD ASSET OPERATIONS PLATFORM
// Frontend Application Logic & Operations Controller
// ==========================================================================

// ==========================================================================
// 1. API CONFIGURATION
// ==========================================================================
const API_BASE_URL = (typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" || window.location.protocol === "file:"))
    ? "http://127.0.0.1:5000"
    : "http://34.201.59.22/api";

// ==========================================================================
// 2. AUTHENTICATION & SESSION MANAGEMENT
// ==========================================================================
let authToken = localStorage.getItem("cloudasset_token");
let currentUser = JSON.parse(localStorage.getItem("cloudasset_user") || "null");

function getAuthHeaders() {
    const headers = {
        "Content-Type": "application/json"
    };

    if (authToken) {
        headers["Authorization"] = `Bearer ${authToken}`;
    }

    return headers;
}

function isAdmin() {
    return Boolean(currentUser && currentUser.role === "admin");
}

function logout() {
    recordActivity("LOGOUT", "User Session", `Signed out ${currentUser ? currentUser.username : "user"}`);
    localStorage.removeItem("cloudasset_token");
    localStorage.removeItem("cloudasset_user");

    authToken = null;
    currentUser = null;

    window.location.reload();
}

function handleUnauthorized() {
    alert("Your session has expired. Please sign in again.");
    logout();
}

function applyRolePermissions() {
    const adminOnlyElements = document.querySelectorAll('[data-admin-only="true"]');

    adminOnlyElements.forEach((element) => {
        element.style.display = isAdmin() ? "" : "none";
    });

    if (isAdmin()) {
        loadAutomationStatus();
        loadAutomationHistory();
    }
}

// ==========================================================================
// 3. ACTIVITY LOGGING ENGINE (LOCAL AUDIT TRAIL)
// ==========================================================================
const ACTIVITY_STORAGE_KEY = "cloudasset_activity_logs";

function getStoredActivityLogs() {
    try {
        const raw = localStorage.getItem(ACTIVITY_STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch (e) {
        return [];
    }
}

function recordActivity(action, assetName, details) {
    const logs = getStoredActivityLogs();
    const newEntry = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        user: currentUser ? currentUser.username : "System",
        role: currentUser ? currentUser.role : "System",
        action: action, // LOGIN, CREATE, UPDATE, DELETE, AUTOMATION, VIEW
        asset: assetName || "—",
        details: details || "Action executed successfully"
    };

    logs.unshift(newEntry);
    // Keep up to 100 entries
    if (logs.length > 100) logs.pop();

    try {
        localStorage.setItem(ACTIVITY_STORAGE_KEY, JSON.stringify(logs));
    } catch (e) {
        console.warn("Storage quota exceeded for activity logs", e);
    }

    updateRecentActivityFeed();
    renderActivityLogsTable();
}

function seedActivityLogsFromAssets(assets) {
    let logs = getStoredActivityLogs();
    if (logs.length > 0) return;

    // If empty, generate initial baseline activity from existing assets
    const initialLogs = [];
    if (Array.isArray(assets) && assets.length > 0) {
        assets.slice(0, 5).forEach((asset) => {
            initialLogs.push({
                id: Date.now() - Math.floor(Math.random() * 1000000),
                timestamp: asset.created_at || new Date().toISOString(),
                user: asset.owner || "Admin",
                role: "admin",
                action: "CREATE",
                asset: asset.asset_name,
                details: `Registered ${asset.provider} ${asset.service} in ${asset.region || "us-east-1"}`
            });
        });
    }

    if (initialLogs.length > 0) {
        localStorage.setItem(ACTIVITY_STORAGE_KEY, JSON.stringify(initialLogs));
        updateRecentActivityFeed();
        renderActivityLogsTable();
    }
}

// ==========================================================================
// 4. COST ESTIMATION MATRIX & REGION MULTIPLIERS
// ==========================================================================
const COST_ESTIMATES = {
    AWS: {
        EC2: { running: 50, stopped: 5 },
        RDS: { running: 80, stopped: 8 },
        S3: { running: 23, stopped: 23 },
        Lambda: { running: 15, stopped: 0 },
        ECS: { running: 45, stopped: 5 },
        EKS: { running: 75, stopped: 10 },
        CloudFront: { running: 50, stopped: 50 },
        Route53: { running: 1, stopped: 1 },
        VPC: { running: 0, stopped: 0 },
        "Load Balancer": { running: 25, stopped: 25 },
        CloudWatch: { running: 10, stopped: 10 }
    },
    Azure: {
        EC2: { running: 55, stopped: 6 },
        RDS: { running: 85, stopped: 9 },
        S3: { running: 25, stopped: 25 },
        Lambda: { running: 18, stopped: 0 },
        ECS: { running: 50, stopped: 6 },
        EKS: { running: 80, stopped: 12 },
        CloudFront: { running: 48, stopped: 48 },
        Route53: { running: 1, stopped: 1 },
        VPC: { running: 0, stopped: 0 },
        "Load Balancer": { running: 28, stopped: 28 },
        CloudWatch: { running: 12, stopped: 12 }
    },
    GCP: {
        EC2: { running: 48, stopped: 5 },
        RDS: { running: 75, stopped: 8 },
        S3: { running: 20, stopped: 0 },
        Lambda: { running: 12, stopped: 0 },
        ECS: { running: 42, stopped: 5 },
        EKS: { running: 72, stopped: 10 },
        CloudFront: { running: 45, stopped: 45 },
        Route53: { running: 1, stopped: 1 },
        VPC: { running: 0, stopped: 0 },
        "Load Balancer": { running: 22, stopped: 22 },
        CloudWatch: { running: 9, stopped: 9 }
    },
    "Oracle Cloud": {
        EC2: { running: 42, stopped: 4 },
        RDS: { running: 70, stopped: 7 },
        S3: { running: 18, stopped: 18 },
        Lambda: { running: 10, stopped: 0 },
        ECS: { running: 38, stopped: 4 },
        EKS: { running: 65, stopped: 8 }
    },
    "IBM Cloud": {
        EC2: { running: 52, stopped: 6 },
        RDS: { running: 82, stopped: 9 },
        S3: { running: 24, stopped: 24 },
        Lambda: { running: 16, stopped: 0 },
        ECS: { running: 48, stopped: 5 },
        EKS: { running: 78, stopped: 11 }
    },
    "Alibaba Cloud": {
        EC2: { running: 40, stopped: 4 },
        RDS: { running: 68, stopped: 6 },
        S3: { running: 16, stopped: 16 },
        Lambda: { running: 10, stopped: 0 },
        ECS: { running: 35, stopped: 4 },
        EKS: { running: 60, stopped: 8 }
    }
};

const REGION_MULTIPLIERS = {
    "us-east-1": 1.0,
    "us-east-2": 1.0,
    "us-west-1": 1.10,
    "us-west-2": 1.05,
    "ap-south-1": 1.15,
    "ap-southeast-1": 1.15,
    "ap-northeast-1": 1.20,
    "eu-west-1": 1.10,
    "eu-central-1": 1.12
};

// ==========================================================================
// 5. APPLICATION STATE
// ==========================================================================
let allAssets = [];
let filteredAssets = [];
let currentPage = 1;
const assetsPerPage = 8;

// DOM Elements
const addAssetForm = document.getElementById("addAssetForm");
const editAssetForm = document.getElementById("editAssetForm");
const assetsContainer = document.getElementById("assetsContainer");
const loadingMessage = document.getElementById("loadingMessage");
const errorMessage = document.getElementById("errorMessage");
const successMessage = document.getElementById("successMessage");
const refreshBtn = document.getElementById("refreshBtn");
const editModal = document.getElementById("editModal");
const closeModalBtn = document.querySelector(".close");
const cancelEditBtn = document.getElementById("cancelEdit");

// LOGIN ELEMENTS
const loginScreen = document.getElementById("loginScreen");
const loginForm = document.getElementById("loginForm");
const loginError = document.getElementById("loginError");
const appLayout = document.getElementById("appLayout") || document.querySelector(".app-layout");

// ==========================================================================
// 6. APPLICATION INITIALIZATION
// ==========================================================================
document.addEventListener("DOMContentLoaded", () => {
    // Check initial authentication
    if (authToken && currentUser) {
        if (loginScreen) loginScreen.style.display = "none";
        if (appLayout) appLayout.style.display = "flex";
        updateUserProfile();
        applyRolePermissions();
        loadAssets();
        loadDashboardStats();
    } else {
        if (loginScreen) loginScreen.style.display = "flex";
        if (appLayout) appLayout.style.display = "none";
    }

    // Set up listeners
    setupEventListeners();
    setupPasswordToggle();
    setupNavigation();
    setupCostEstimator();
    setupEditCostEstimator();
    setupProfileDropdown();
    setupThemeToggle();
    setupSidebarToggle();
    setupActivityLogControls();
    loadTheme();
});

// ==========================================================================
// 7. LOGIN HANDLER
// ==========================================================================
async function handleLogin(event) {
    event.preventDefault();

    const usernameInput = document.getElementById("loginUsername");
    const passwordInput = document.getElementById("loginPassword");

    const username = usernameInput ? usernameInput.value.trim() : "";
    const password = passwordInput ? passwordInput.value : "";

    if (loginError) {
        loginError.style.display = "none";
        loginError.textContent = "";
    }

    try {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                username: username,
                password: password
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || data.message || "Invalid credentials. Please verify your username and password.");
        }

        if (!data.access_token || !data.user) {
            throw new Error("Invalid response received from server.");
        }

        // Save token & user profile
        authToken = data.access_token;
        localStorage.setItem("cloudasset_token", authToken);

        currentUser = data.user;
        localStorage.setItem("cloudasset_user", JSON.stringify(currentUser));

        recordActivity("LOGIN", "User Session", `Signed in as ${currentUser.username} (${currentUser.role})`);

        // Reveal Operations Center
        if (loginScreen) loginScreen.style.display = "none";
        if (appLayout) appLayout.style.display = "flex";

        applyRolePermissions();
        updateUserProfile();

        await loadAssets();
        loadDashboardStats();

    } catch (error) {
        console.error("Login error:", error);
        if (loginError) {
            loginError.textContent = error.message || "Unable to authenticate";
            loginError.style.display = "flex";
        }
    }
}

// ==========================================================================
// 8. USER PROFILE UI
// ==========================================================================
function updateUserProfile() {
    if (!currentUser) return;

    const username = currentUser.username || currentUser.name || "User";
    const role = currentUser.role || "User";
    const avatarLetter = username.charAt(0).toUpperCase();

    // Top-right profile
    setText("profileUsername", username);
    setText("profileRole", role === "admin" ? "Administrator" : "Employee (View Only)");
    setText("userAvatar", avatarLetter);

    // Dropdown profile
    setText("dropdownUsername", username);
    setText("dropdownRole", role === "admin" ? "Administrator" : "Employee (View Only)");
    setText("dropdownAvatar", avatarLetter);

    // Settings page
    setText("settingsSessionInfo", `Signed in as ${username} • Role: ${role === "admin" ? "Administrator" : "Employee"}`);
}

// ==========================================================================
// 9. EVENT LISTENERS SETUP
// ==========================================================================
function setupEventListeners() {
    // Dashboard quick actions
    const dashboardAddAssetBtn = document.getElementById("dashboardAddAssetBtn");
    if (dashboardAddAssetBtn) {
        dashboardAddAssetBtn.addEventListener("click", () => {
            navigateToAssets();
            const nameInput = document.getElementById("assetName");
            if (nameInput) nameInput.focus();
        });
    }

    const viewAllAssetsBtn = document.getElementById("viewAllAssetsBtn");
    if (viewAllAssetsBtn) {
        viewAllAssetsBtn.addEventListener("click", () => {
            navigateToAssets();
        });
    }

    const dashViewAllActivityBtn = document.getElementById("dashViewAllActivityBtn");
    if (dashViewAllActivityBtn) {
        dashViewAllActivityBtn.addEventListener("click", () => {
            showPage("activity");
        });
    }

    // Login Form Submit
    if (loginForm) {
        loginForm.addEventListener("submit", handleLogin);
    }

    // Add Asset Form Submit
    if (addAssetForm) {
        addAssetForm.addEventListener("submit", handleAddAsset);
    }

    // Edit Asset Form Submit
    if (editAssetForm) {
        editAssetForm.addEventListener("submit", handleEditAsset);
    }

    // Refresh Assets Button
    if (refreshBtn) {
        refreshBtn.addEventListener("click", () => {
            loadAssets();
            loadDashboardStats();
            if (isAdmin()) {
                loadAutomationStatus();
                loadAutomationHistory();
            }
        });
    }

    // Trigger Automation Button
    const triggerAutomationBtn = document.getElementById("triggerAutomationBtn");
    if (triggerAutomationBtn) {
        triggerAutomationBtn.addEventListener("click", triggerAutomationRun);
    }

    // Refresh Automation History Button
    const refreshHistoryBtn = document.getElementById("refreshHistoryBtn");
    if (refreshHistoryBtn) {
        refreshHistoryBtn.addEventListener("click", () => {
            loadAutomationStatus();
            loadAutomationHistory();
        });
    }

    // Close Modal Button
    if (closeModalBtn) {
        closeModalBtn.addEventListener("click", closeEditModal);
    }

    // Cancel Edit Button
    if (cancelEditBtn) {
        cancelEditBtn.addEventListener("click", closeEditModal);
    }

    // Close Modal when clicking outside content
    window.addEventListener("click", (event) => {
        if (event.target === editModal) {
            closeEditModal();
        }
    });

    // Search and Filters
    const searchInput = document.getElementById("searchInput");
    if (searchInput) {
        searchInput.addEventListener("input", filterAssets);
    }

    const providerFilter = document.getElementById("filterProvider");
    if (providerFilter) {
        providerFilter.addEventListener("change", filterAssets);
    }

    const statusFilter = document.getElementById("filterStatus");
    if (statusFilter) {
        statusFilter.addEventListener("change", filterAssets);
    }

    const ownerFilter = document.getElementById("filterOwner");
    if (ownerFilter) {
        ownerFilter.addEventListener("change", filterAssets);
    }

    const clearFiltersBtn = document.getElementById("clearFiltersBtn");
    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener("click", clearFilters);
    }

    const prevPageBtn = document.getElementById("prevPage");
    if (prevPageBtn) {
        prevPageBtn.addEventListener("click", previousPage);
    }

    const nextPageBtn = document.getElementById("nextPage");
    if (nextPageBtn) {
        nextPageBtn.addEventListener("click", nextPage);
    }
}

// ==========================================================================
// 10. LOAD ASSETS FROM BACKEND
// ==========================================================================
async function loadAssets() {
    try {
        if (loadingMessage) loadingMessage.style.display = "flex";
        if (assetsContainer) assetsContainer.innerHTML = "";

        const response = await fetch(`${API_BASE_URL}/assets`, {
            headers: getAuthHeaders()
        });

        if (response.status === 401) {
            handleUnauthorized();
            return;
        }

        if (!response.ok) {
            throw new Error("Failed to fetch assets from server");
        }

        const assets = await response.json();
        allAssets = Array.isArray(assets) ? assets : [];
        filteredAssets = allAssets;
        currentPage = 1;

        if (loadingMessage) loadingMessage.style.display = "none";

        seedActivityLogsFromAssets(allAssets);
        displayAssets(filteredAssets);
        updateAllPages();
        await loadDashboardStats();

    } catch (error) {
        console.error("Error loading assets:", error);
        if (loadingMessage) loadingMessage.style.display = "none";
        showMessage("error", `Unable to connect to telemetry backend: ${error.message}`);
    }
}

// ==========================================================================
// 11. LOAD DASHBOARD STATISTICS FROM API
// ==========================================================================
async function loadDashboardStats() {
    try {
        const response = await fetch(`${API_BASE_URL}/assets/dashboard`, {
            headers: getAuthHeaders()
        });

        if (!response.ok) {
            throw new Error("Failed to load dashboard statistics");
        }

        const data = await response.json();

        // Synchronize counters
        updateDashboard();

    } catch (error) {
        console.error("Dashboard stats error:", error);
    }
}

// ==========================================================================
// 12. UPDATE ALL PAGES
// ==========================================================================
function updateAllPages() {
    updateDashboard();
    updateCostOverview();
    updateAnalytics();
    renderActivityLogsTable();
}

// ==========================================================================
// 13. DASHBOARD VIEW & WIDGETS
// ==========================================================================
function updateDashboard() {
    const totalAssets = allAssets.length;
    const today = new Date().toISOString().split("T")[0];

    // Active Assets (Running or Active)
    const activeAssets = allAssets.filter(
        asset => {
            const st = (asset.status || "").toLowerCase();
            return st === "running" || st === "active";
        }
    ).length;

    // Total Cost
    const totalCost = allAssets.reduce(
        (total, asset) => total + (parseFloat(asset.cost) || 0),
        0
    );

    // Need Attention calculation: Overdue + Pending + Stopped
    const overdueAssetsList = allAssets.filter(asset => Boolean(asset.due_date && asset.due_date < today));
    const pendingAssetsList = allAssets.filter(asset => (asset.status || "").toLowerCase() === "pending");
    const stoppedAssetsList = allAssets.filter(asset => (asset.status || "").toLowerCase() === "stopped");

    const needAttentionCount = overdueAssetsList.length + pendingAssetsList.length + stoppedAssetsList.length;

    // 4 KPI Cards
    setText("dashTotalAssets", totalAssets);
    setText("dashActiveAssets", activeAssets);
    setText("dashNeedAttention", needAttentionCount);
    setText("dashTotalCost", `$${totalCost.toFixed(2)}`);

    // Render Status Donut Chart & Legend
    renderStatusDonutChart();

    // Render Recent Activity list
    updateRecentActivityFeed();

    // Render Attention Required Grid
    renderAttentionRequiredSection(overdueAssetsList, pendingAssetsList, stoppedAssetsList);

    // Render Recent Resources Table
    renderRecentResourcesTable();
}

// ==========================================================================
// 14. STATUS DONUT CHART GENERATOR (CLEAN SVG)
// ==========================================================================
function renderStatusDonutChart() {
    const svg = document.getElementById("donutChartSvg");
    const legend = document.getElementById("donutLegend");
    const centerCount = document.getElementById("donutTotalCount");

    if (!svg || !legend) return;

    const total = allAssets.length;
    if (centerCount) centerCount.textContent = total;

    if (total === 0) {
        svg.innerHTML = `
            <circle cx="18" cy="18" r="15.91549430918954" fill="transparent" stroke="var(--border-subtle)" stroke-width="3.2"></circle>
        `;
        legend.innerHTML = `<p class="empty-state" style="padding: 12px 0;">No assets registered yet.</p>`;
        return;
    }

    // Categories calculation
    const statusCounts = {
        Active: 0,
        Stopped: 0,
        Pending: 0,
        Overdue: 0,
        Inactive: 0,
        Terminated: 0
    };

    const today = new Date().toISOString().split("T")[0];

    allAssets.forEach(asset => {
        const isOverdue = asset.due_date && asset.due_date < today;
        const rawStatus = (asset.status || "Active").toLowerCase();

        if (isOverdue) {
            statusCounts.Overdue++;
        } else if (rawStatus === "running" || rawStatus === "active") {
            statusCounts.Active++;
        } else if (rawStatus === "stopped") {
            statusCounts.Stopped++;
        } else if (rawStatus === "pending") {
            statusCounts.Pending++;
        } else if (rawStatus === "terminated") {
            statusCounts.Terminated++;
        } else {
            statusCounts.Inactive++;
        }
    });

    const categoryColors = {
        Active: "var(--status-running)",
        Stopped: "var(--status-stopped)",
        Pending: "var(--status-pending)",
        Overdue: "var(--status-overdue)",
        Inactive: "var(--status-inactive)",
        Terminated: "var(--status-terminated)"
    };

    // Filter categories that have > 0 assets
    const activeCategories = Object.entries(statusCounts).filter(([_, count]) => count > 0);

    let accumulatedPercentage = 0;
    let svgArcs = `
        <circle cx="18" cy="18" r="15.91549430918954" fill="transparent" stroke="var(--border-subtle)" stroke-width="3.2"></circle>
    `;

    legend.innerHTML = "";

    activeCategories.forEach(([category, count]) => {
        const percentage = (count / total) * 100;
        const strokeDasharray = `${percentage} ${100 - percentage}`;
        const strokeDashoffset = 100 - accumulatedPercentage;
        const color = categoryColors[category] || "var(--primary)";

        svgArcs += `
            <circle cx="18" cy="18" r="15.91549430918954"
                fill="transparent"
                stroke="${color}"
                stroke-width="3.2"
                stroke-dasharray="${strokeDasharray}"
                stroke-dashoffset="${strokeDashoffset}"
                stroke-linecap="round"
                style="transition: all 0.5s ease;">
            </circle>
        `;

        accumulatedPercentage += percentage;

        // Add legend row
        const legendRow = document.createElement("div");
        legendRow.className = "legend-item";
        legendRow.innerHTML = `
            <div class="legend-left">
                <span class="legend-color-dot" style="background-color: ${color};"></span>
                <span>${escapeHTML(category)}</span>
            </div>
            <div class="legend-right">${count} (${percentage.toFixed(0)}%)</div>
        `;
        legend.appendChild(legendRow);
    });

    svg.innerHTML = svgArcs;
}

// ==========================================================================
// 15. RECENT ACTIVITY FEED
// ==========================================================================
function updateRecentActivityFeed() {
    const container = document.getElementById("dashRecentActivityList");
    if (!container) return;

    const logs = getStoredActivityLogs().slice(0, 5);

    if (logs.length === 0) {
        container.innerHTML = `<p class="empty-state">No recent activity recorded.</p>`;
        return;
    }

    container.innerHTML = logs.map(log => {
        const timeAgo = formatTimeAgo(log.timestamp);
        let icon = "⚡";
        if (log.action === "CREATE") icon = "➕";
        else if (log.action === "UPDATE") icon = "✏️";
        else if (log.action === "DELETE") icon = "🗑️";
        else if (log.action === "LOGIN") icon = "🔑";
        else if (log.action === "AUTOMATION") icon = "🔄";

        return `
            <div class="activity-feed-item">
                <div class="activity-feed-icon">${icon}</div>
                <div class="activity-feed-content">
                    <div class="activity-feed-title">${escapeHTML(log.details || log.action)}</div>
                    <div class="activity-feed-meta">${escapeHTML(log.user)} • ${timeAgo}</div>
                </div>
            </div>
        `;
    }).join("");
}

// ==========================================================================
// 16. ATTENTION REQUIRED SECTION
// ==========================================================================
function renderAttentionRequiredSection(overdue, pending, stopped) {
    const container = document.getElementById("attentionRequiredGrid");
    if (!container) return;

    const attentionItems = [];

    overdue.forEach(asset => {
        attentionItems.push({
            asset: asset,
            type: "overdue",
            typeLabel: "Overdue Expiration",
            reason: `Due: ${asset.due_date}`
        });
    });

    pending.forEach(asset => {
        attentionItems.push({
            asset: asset,
            type: "pending",
            typeLabel: "Pending Provision",
            reason: "Needs approval / activation"
        });
    });

    stopped.forEach(asset => {
        attentionItems.push({
            asset: asset,
            type: "stopped",
            typeLabel: "Resource Stopped",
            reason: "Offline in " + (asset.region || "us-east-1")
        });
    });

    if (attentionItems.length === 0) {
        container.innerHTML = `<p class="empty-state">All assets are operational. No pending actions required.</p>`;
        return;
    }

    container.innerHTML = attentionItems.slice(0, 6).map(item => `
        <div class="attention-card ${item.type}">
            <div class="attention-info">
                <strong>${escapeHTML(item.asset.asset_name)}</strong>
                <span>${item.typeLabel} • ${escapeHTML(item.reason)} • Owner: ${escapeHTML(item.asset.owner || "N/A")}</span>
            </div>
            ${isAdmin() ? `
                <button class="btn btn-secondary btn-sm" onclick="openEditModal(${item.asset.id})">
                    Review →
                </button>
            ` : `
                <button class="btn btn-secondary btn-sm" onclick="navigateToAssets()">
                    View →
                </button>
            `}
        </div>
    `).join("");
}

// ==========================================================================
// 17. RECENT RESOURCES TABLE
// ==========================================================================
function renderRecentResourcesTable() {
    const tbody = document.getElementById("dashRecentAssetsTableBody");
    if (!tbody) return;

    if (allAssets.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="empty-state">No cloud assets provisioned yet.</td></tr>`;
        return;
    }

    const recent = [...allAssets]
        .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
        .slice(0, 5);

    const today = new Date().toISOString().split("T")[0];

    tbody.innerHTML = recent.map(asset => {
        const isOverdue = asset.due_date && asset.due_date < today;
        const statusClass = isOverdue ? "status-overdue" : `status-${String(asset.status || "active").toLowerCase()}`;
        const displayStatus = isOverdue ? "Overdue" : (asset.status || "Active");
        const providerLower = (asset.provider || "aws").toLowerCase().split(" ")[0];

        return `
            <tr>
                <td>
                    <div class="table-asset-name">${escapeHTML(asset.asset_name || "Unnamed Resource")}</div>
                    <div class="table-asset-meta font-mono">ID #${asset.id} • ${escapeHTML(asset.region || "Global")}</div>
                </td>
                <td>
                    <span class="provider-pill">
                        <span class="provider-dot ${providerLower}"></span>
                        ${escapeHTML(asset.provider || "Cloud")}
                    </span>
                </td>
                <td>${escapeHTML(asset.service || "Compute")}</td>
                <td>
                    <span class="status-badge ${statusClass}">
                        ${escapeHTML(displayStatus)}
                    </span>
                </td>
                <td>${escapeHTML(asset.owner || "N/A")}</td>
                <td class="${isOverdue ? 'font-mono' : ''}" style="${isOverdue ? 'color: var(--status-overdue-text); font-weight: 600;' : ''}">
                    ${asset.due_date ? escapeHTML(asset.due_date) : "—"}
                </td>
                <td class="font-mono" style="font-weight: 600;">$${formatCost(asset.cost)}</td>
                <td>
                    ${isAdmin() ? `
                        <button class="btn btn-secondary btn-sm" onclick="openEditModal(${asset.id})">Edit</button>
                    ` : `
                        <span class="table-asset-meta">View Only</span>
                    `}
                </td>
            </tr>
        `;
    }).join("");
}

// ==========================================================================
// 18. DISPLAY ASSETS (ENTERPRISE DATA TABLE)
// ==========================================================================
function displayAssets(assets) {
    if (!assetsContainer) return;

    if (!assets || assets.length === 0) {
        assetsContainer.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">☁️</div>
                <h3>No Cloud Assets Found</h3>
                <p>No resources match your active search filters, or none have been registered yet.</p>
            </div>
        `;
        updatePagination(0);
        return;
    }

    const startIndex = (currentPage - 1) * assetsPerPage;
    const endIndex = startIndex + assetsPerPage;
    const pageAssets = assets.slice(startIndex, endIndex);
    const today = new Date().toISOString().split("T")[0];

    const rowsHTML = pageAssets.map(asset => {
        const isOverdue = asset.due_date && asset.due_date < today;
        const statusClass = isOverdue ? "status-overdue" : `status-${String(asset.status || "active").toLowerCase()}`;
        const displayStatus = isOverdue ? "Overdue" : (asset.status || "Active");
        const providerLower = (asset.provider || "aws").toLowerCase().split(" ")[0];

        return `
            <tr>
                <td>
                    <div class="table-asset-name">${escapeHTML(asset.asset_name || "Unnamed Resource")}</div>
                    <div class="table-asset-meta font-mono">ID #${asset.id}</div>
                </td>
                <td>
                    <span class="provider-pill">
                        <span class="provider-dot ${providerLower}"></span>
                        ${escapeHTML(asset.provider || "N/A")}
                    </span>
                </td>
                <td>${escapeHTML(asset.service || "N/A")}</td>
                <td>${escapeHTML(asset.region || "Global")}</td>
                <td>
                    <span class="status-badge ${statusClass}">
                        ${escapeHTML(displayStatus)}
                    </span>
                </td>
                <td>${escapeHTML(asset.owner || "N/A")}</td>
                <td class="${isOverdue ? 'font-mono' : ''}" style="${isOverdue ? 'color: var(--status-overdue-text); font-weight: 600;' : ''}">
                    ${asset.due_date ? escapeHTML(asset.due_date) : "No expiration set"}
                </td>
                <td class="font-mono" style="font-weight: 600;">$${formatCost(asset.cost)}</td>
                <td>
                    <div class="table-actions">
                        ${isAdmin() ? `
                            <button class="btn btn-secondary btn-sm" onclick="openEditModal(${asset.id})">
                                Edit
                            </button>
                            <button class="btn btn-danger btn-sm" onclick="deleteAsset(${asset.id})">
                                Delete
                            </button>
                        ` : `
                            <span class="role-badge employee">View Only</span>
                        `}
                    </div>
                </td>
            </tr>
        `;
    }).join("");

    assetsContainer.innerHTML = `
        <div class="table-responsive">
            <table class="enterprise-table">
                <thead>
                    <tr>
                        <th>Asset Name</th>
                        <th>Provider</th>
                        <th>Service</th>
                        <th>Region</th>
                        <th>Status</th>
                        <th>Owner</th>
                        <th>Due Date</th>
                        <th>Monthly Cost</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHTML}
                </tbody>
            </table>
        </div>
    `;

    updatePagination(assets.length);
}

// ==========================================================================
// 19. PAGINATION
// ==========================================================================
function updatePagination(totalAssets) {
    const paginationContainer = document.getElementById("paginationContainer");
    const pageNumbers = document.getElementById("pageNumbers");
    const prevPage = document.getElementById("prevPage");
    const nextPage = document.getElementById("nextPage");

    if (!paginationContainer) return;

    const totalPages = Math.ceil(totalAssets / assetsPerPage);

    if (totalPages <= 1) {
        paginationContainer.style.display = "none";
        return;
    }

    paginationContainer.style.display = "flex";

    if (pageNumbers) {
        pageNumbers.innerHTML = "";

        for (let page = 1; page <= totalPages; page++) {
            const button = document.createElement("button");
            button.textContent = page;
            button.className = "page-number";

            if (page === currentPage) {
                button.classList.add("active");
            }

            button.addEventListener("click", () => {
                currentPage = page;
                displayAssets(filteredAssets);
            });

            pageNumbers.appendChild(button);
        }
    }

    if (prevPage) {
        prevPage.disabled = currentPage === 1;
    }

    if (nextPage) {
        nextPage.disabled = currentPage === totalPages;
    }
}

function previousPage() {
    if (currentPage > 1) {
        currentPage--;
        displayAssets(filteredAssets);
    }
}

function nextPage() {
    const totalPages = Math.ceil(filteredAssets.length / assetsPerPage);
    if (currentPage < totalPages) {
        currentPage++;
        displayAssets(filteredAssets);
    }
}

// ==========================================================================
// 20. SEARCH & FILTER LOGIC
// ==========================================================================
function filterAssets() {
    const searchTerm = (document.getElementById("searchInput")?.value || "").toLowerCase().trim();
    const provider = document.getElementById("filterProvider")?.value || "";
    const status = document.getElementById("filterStatus")?.value || "";
    const owner = document.getElementById("filterOwner")?.value || "";
    const today = new Date().toISOString().split("T")[0];

    filteredAssets = allAssets.filter(asset => {
        const matchesSearch = !searchTerm || (
            (asset.asset_name && asset.asset_name.toLowerCase().includes(searchTerm)) ||
            (String(asset.id) === searchTerm) ||
            (asset.service && asset.service.toLowerCase().includes(searchTerm)) ||
            (asset.region && asset.region.toLowerCase().includes(searchTerm))
        );

        const matchesProvider = !provider || asset.provider === provider;

        let matchesStatus = true;
        if (status === "Overdue") {
            matchesStatus = Boolean(asset.due_date && asset.due_date < today);
        } else if (status) {
            matchesStatus = asset.status === status;
        }

        const matchesOwner = !owner || asset.owner === owner;

        return matchesSearch && matchesProvider && matchesStatus && matchesOwner;
    });

    currentPage = 1;
    displayAssets(filteredAssets);
}

function clearFilters() {
    const ids = ["searchInput", "filterProvider", "filterStatus", "filterOwner"];

    ids.forEach(id => {
        const element = document.getElementById(id);
        if (element) element.value = "";
    });

    filteredAssets = allAssets;
    currentPage = 1;
    displayAssets(filteredAssets);
}

// ==========================================================================
// 21. ADD ASSET HANDLER
// ==========================================================================
async function handleAddAsset(event) {
    event.preventDefault();

    if (!isAdmin()) {
        showMessage("error", "Admin access required to register resources");
        return;
    }

    const formData = new FormData(addAssetForm);

    const assetData = {
        asset_name: (formData.get("assetName") || "").trim(),
        provider: formData.get("provider") || null,
        service: formData.get("service") || null,
        region: formData.get("region") || null,
        status: formData.get("status") || null,
        owner: formData.get("owner") || null,
        cost: parseFloat(formData.get("cost")) || 0,
        due_date: formData.get("due_date") || null
    };

    try {
        const response = await fetch(`${API_BASE_URL}/assets`, {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify(assetData)
        });

        const result = await response.json();

        if (response.status === 401) {
            handleUnauthorized();
            return;
        }

        if (!response.ok) {
            throw new Error(result.error || "Failed to register asset");
        }

        recordActivity("CREATE", assetData.asset_name, `Registered new asset ${assetData.asset_name} (${assetData.provider} ${assetData.service})`);

        showMessage("success", "Cloud asset registered successfully!");
        addAssetForm.reset();

        await loadAssets();
        loadDashboardStats();

    } catch (error) {
        console.error("Add asset error:", error);
        showMessage("error", error.message || "Failed to register asset");
    }
}

// ==========================================================================
// 22. EDIT ASSET MODAL & UPDATE
// ==========================================================================
async function openEditModal(assetId) {
    if (!isAdmin()) {
        showMessage("error", "Admin access required");
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/assets/${assetId}`, {
            headers: getAuthHeaders()
        });

        if (response.status === 401) {
            handleUnauthorized();
            return;
        }

        if (!response.ok) {
            throw new Error("Failed to load asset details");
        }

        const asset = await response.json();

        setValue("editAssetId", asset.id);
        setValue("editAssetName", asset.asset_name);
        setValue("editProvider", asset.provider);
        setValue("editService", asset.service);
        setValue("editRegion", asset.region);
        setValue("editStatus", asset.status);
        setValue("editOwner", asset.owner);
        setValue("editCost", asset.cost);
        setValue("editDueDate", asset.due_date || "");

        if (editModal) editModal.style.display = "flex";

    } catch (error) {
        console.error("Edit modal error:", error);
        showMessage("error", error.message);
    }
}

function closeEditModal() {
    if (editModal) editModal.style.display = "none";
    if (editAssetForm) editAssetForm.reset();
}

async function handleEditAsset(event) {
    event.preventDefault();

    if (!isAdmin()) {
        showMessage("error", "Admin access required");
        return;
    }

    const formData = new FormData(editAssetForm);
    const assetId = document.getElementById("editAssetId")?.value;

    const assetData = {
        asset_name: (formData.get("assetName") || "").trim(),
        provider: formData.get("provider") || null,
        service: formData.get("service") || null,
        region: formData.get("region") || null,
        status: formData.get("status") || null,
        owner: formData.get("owner") || null,
        cost: parseFloat(formData.get("cost")) || 0,
        due_date: formData.get("due_date") || null
    };

    try {
        const response = await fetch(`${API_BASE_URL}/assets/${assetId}`, {
            method: "PUT",
            headers: getAuthHeaders(),
            body: JSON.stringify(assetData)
        });

        const result = await response.json();

        if (response.status === 401) {
            handleUnauthorized();
            return;
        }

        if (!response.ok) {
            throw new Error(result.error || "Failed to update asset");
        }

        recordActivity("UPDATE", assetData.asset_name, `Updated asset #${assetId} (${assetData.asset_name})`);

        showMessage("success", "Asset updated successfully!");
        closeEditModal();

        await loadAssets();
        loadDashboardStats();

    } catch (error) {
        console.error("Update error:", error);
        showMessage("error", error.message || "Unable to update asset");
    }
}

// ==========================================================================
// 23. DELETE ASSET HANDLER
// ==========================================================================
async function deleteAsset(assetId) {
    if (!isAdmin()) {
        showMessage("error", "Admin access required");
        return;
    }

    const assetToDelete = allAssets.find(a => a.id === assetId);
    const name = assetToDelete ? assetToDelete.asset_name : `ID #${assetId}`;

    const confirmed = confirm(`Are you sure you want to permanently delete '${name}' from inventory?`);
    if (!confirmed) return;

    try {
        const response = await fetch(`${API_BASE_URL}/assets/${assetId}`, {
            method: "DELETE",
            headers: getAuthHeaders()
        });

        const result = await response.json();

        if (response.status === 401) {
            handleUnauthorized();
            return;
        }

        if (!response.ok) {
            throw new Error(result.error || result.message || "Failed to delete asset");
        }

        recordActivity("DELETE", name, `Deleted asset #${assetId} (${name})`);

        showMessage("success", "Asset deleted successfully!");
        await loadAssets();
        loadDashboardStats();

    } catch (error) {
        console.error("Delete error:", error);
        showMessage("error", error.message || "Unable to delete asset");
    }
}

// ==========================================================================
// 24. COST OVERVIEW CALCULATIONS
// ==========================================================================
function updateCostOverview() {
    const totalElement = document.getElementById("costOverviewTotal");
    const averageElement = document.getElementById("averageCost");
    const highestElement = document.getElementById("highestCost");
    const highestNameElement = document.getElementById("highestCostName");
    const providerContainer = document.getElementById("costByProvider");
    const serviceContainer = document.getElementById("costByService");
    const expensiveContainer = document.getElementById("expensiveAssets");

    const assets = Array.isArray(allAssets) ? allAssets : [];

    if (assets.length === 0) {
        if (totalElement) totalElement.textContent = "$0.00";
        if (averageElement) averageElement.textContent = "$0.00";
        if (highestElement) highestElement.textContent = "$0.00";
        if (highestNameElement) highestNameElement.textContent = "No assets";
        if (providerContainer) providerContainer.innerHTML = `<p class="empty-state">No cost data available.</p>`;
        if (serviceContainer) serviceContainer.innerHTML = `<p class="empty-state">No cost data available.</p>`;
        if (expensiveContainer) expensiveContainer.innerHTML = `<p class="empty-state">No assets available.</p>`;
        return;
    }

    let totalCost = 0;
    let highestAsset = null;
    const providerCosts = {};
    const serviceCosts = {};

    assets.forEach(asset => {
        const cost = Number(asset.cost) || 0;
        totalCost += cost;

        if (!highestAsset || cost > (Number(highestAsset.cost) || 0)) {
            highestAsset = asset;
        }

        const provider = asset.provider || "Unknown";
        providerCosts[provider] = (providerCosts[provider] || 0) + cost;

        const service = asset.service || "Unknown";
        serviceCosts[service] = (serviceCosts[service] || 0) + cost;
    });

    if (totalElement) totalElement.textContent = `$${totalCost.toFixed(2)}`;
    if (averageElement) averageElement.textContent = `$${(totalCost / assets.length).toFixed(2)}`;
    if (highestElement) {
        highestElement.textContent = highestAsset ? `$${(Number(highestAsset.cost) || 0).toFixed(2)}` : "$0.00";
    }
    if (highestNameElement) {
        highestNameElement.textContent = highestAsset ? (highestAsset.asset_name || "Unnamed Resource") : "No assets";
    }

    // Provider breakdown
    if (providerContainer) {
        const providerEntries = Object.entries(providerCosts).sort((a, b) => b[1] - a[1]);
        providerContainer.innerHTML = providerEntries.map(([provider, cost]) => {
            const percentage = totalCost > 0 ? ((cost / totalCost) * 100).toFixed(1) : "0";
            return `
                <div class="analytics-row">
                    <div class="analytics-label">
                        <span>${escapeHTML(provider)}</span>
                        <strong>$${cost.toFixed(2)} (${percentage}%)</strong>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${percentage}%"></div>
                    </div>
                </div>
            `;
        }).join("");
    }

    // Service breakdown
    if (serviceContainer) {
        const serviceEntries = Object.entries(serviceCosts).sort((a, b) => b[1] - a[1]);
        serviceContainer.innerHTML = serviceEntries.map(([service, cost]) => {
            const percentage = totalCost > 0 ? ((cost / totalCost) * 100).toFixed(1) : "0";
            return `
                <div class="analytics-row">
                    <div class="analytics-label">
                        <span>${escapeHTML(service)}</span>
                        <strong>$${cost.toFixed(2)} (${percentage}%)</strong>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${percentage}%"></div>
                    </div>
                </div>
            `;
        }).join("");
    }

    // Top expensive assets
    if (expensiveContainer) {
        const sortedAssets = [...assets].sort((a, b) => (Number(b.cost) || 0) - (Number(a.cost) || 0)).slice(0, 5);
        expensiveContainer.innerHTML = sortedAssets.map((asset, index) => {
            const cost = Number(asset.cost) || 0;
            const percentage = totalCost > 0 ? ((cost / totalCost) * 100).toFixed(1) : "0";
            const name = asset.asset_name || "Unnamed Resource";

            return `
                <div class="analytics-row">
                    <div class="analytics-label">
                        <span>#${index + 1} <strong>${escapeHTML(name)}</strong> (${escapeHTML(asset.provider || "Cloud")} • ${escapeHTML(asset.service || "")})</span>
                        <strong>$${cost.toFixed(2)}/mo</strong>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${percentage}%"></div>
                    </div>
                </div>
            `;
        }).join("");
    }
}

// ==========================================================================
// 25. ANALYTICS CALCULATIONS
// ==========================================================================
function updateAnalytics() {
    const total = allAssets.length;
    const today = new Date().toISOString().split("T")[0];

    const active = allAssets.filter(a => (a.status || "").toLowerCase() === "running" || (a.status || "").toLowerCase() === "active").length;
    const pending = allAssets.filter(a => (a.status || "").toLowerCase() === "pending").length;
    const overdue = allAssets.filter(a => Boolean(a.due_date && a.due_date < today)).length;

    setText("analyticsTotalAssets", total);
    setText("analyticsActiveAssets", active);
    setText("analyticsPendingAssets", pending);
    setText("analyticsOverdueAssets", overdue);

    updateProviderAnalytics();
    updateStatusAnalytics();
    updateServiceAnalytics();
}

function updateProviderAnalytics() {
    const container = document.getElementById("providerAnalytics");
    if (!container) return;

    if (allAssets.length === 0) {
        container.innerHTML = `<p class="empty-state">No provider analytics available.</p>`;
        return;
    }

    const providerData = {};
    allAssets.forEach(asset => {
        const provider = asset.provider || "Unknown";
        providerData[provider] = (providerData[provider] || 0) + 1;
    });

    const entries = Object.entries(providerData).sort((a, b) => b[1] - a[1]);
    const total = allAssets.length;

    container.innerHTML = entries.map(([provider, count]) => {
        const percentage = ((count / total) * 100).toFixed(1);
        return `
            <div class="analytics-row">
                <div class="analytics-label">
                    <span>${escapeHTML(provider)}</span>
                    <strong>${count} assets (${percentage}%)</strong>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${percentage}%"></div>
                </div>
            </div>
        `;
    }).join("");
}

function updateStatusAnalytics() {
    const container = document.getElementById("statusAnalytics");
    if (!container) return;

    if (allAssets.length === 0) {
        container.innerHTML = `<p class="empty-state">No status analytics available.</p>`;
        return;
    }

    const statusData = {};
    allAssets.forEach(asset => {
        const status = asset.status || "Unknown";
        statusData[status] = (statusData[status] || 0) + 1;
    });

    const entries = Object.entries(statusData).sort((a, b) => b[1] - a[1]);
    const total = allAssets.length;

    container.innerHTML = entries.map(([status, count]) => {
        const percentage = ((count / total) * 100).toFixed(1);
        return `
            <div class="analytics-row">
                <div class="analytics-label">
                    <span>${escapeHTML(status)}</span>
                    <strong>${count} resources (${percentage}%)</strong>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${percentage}%"></div>
                </div>
            </div>
        `;
    }).join("");
}

function updateServiceAnalytics() {
    const container = document.getElementById("serviceAnalytics");
    if (!container) return;

    if (allAssets.length === 0) {
        container.innerHTML = `<p class="empty-state">No service analytics available.</p>`;
        return;
    }

    const serviceData = {};
    allAssets.forEach(asset => {
        const service = asset.service || "Unknown";
        serviceData[service] = (serviceData[service] || 0) + 1;
    });

    const entries = Object.entries(serviceData).sort((a, b) => b[1] - a[1]);
    const total = allAssets.length;

    container.innerHTML = entries.map(([service, count]) => {
        const percentage = ((count / total) * 100).toFixed(1);
        return `
            <div class="analytics-row">
                <div class="analytics-label">
                    <span>${escapeHTML(service)}</span>
                    <strong>${count} services (${percentage}%)</strong>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${percentage}%"></div>
                </div>
            </div>
        `;
    }).join("");
}

// ==========================================================================
// 26. AUTOMATION MONITORING & HISTORY
// ==========================================================================
async function loadAutomationStatus() {
    if (!isAdmin()) return;

    try {
        const response = await fetch(`${API_BASE_URL}/automation/status`, {
            headers: getAuthHeaders()
        });

        if (response.status === 401) {
            handleUnauthorized();
            return;
        }

        if (!response.ok) return;

        const data = await response.json();

        setText("autoStatus", data.status || "Running");
        setText("autoStatusDesc", data.status === "Running" ? "Background worker active" : "Check logs");

        let formattedTime = "Just now";
        if (data.last_check) {
            const dateObj = new Date(data.last_check);
            formattedTime = isNaN(dateObj.getTime())
                ? data.last_check
                : dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + " (" + dateObj.toLocaleDateString() + ")";
        }
        setText("autoLastCheck", formattedTime);
        setText("autoAssetsChecked", data.assets_checked ?? 0);
        setText("autoOverdueDetected", data.overdue_detected ?? 0);

        // Update attention list
        const attentionContainer = document.getElementById("autoAttentionList");
        if (attentionContainer) {
            const today = new Date().toISOString().split("T")[0];
            const overdue = allAssets.filter(a => a.due_date && a.due_date < today);

            if (overdue.length === 0) {
                attentionContainer.innerHTML = `<p class="empty-state">No overdue policy violations detected.</p>`;
            } else {
                attentionContainer.innerHTML = overdue.map(a => `
                    <div class="attention-card overdue" style="margin-bottom: 8px;">
                        <div class="attention-info">
                            <strong>${escapeHTML(a.asset_name)}</strong>
                            <span>Due Date: ${escapeHTML(a.due_date)} • Owner: ${escapeHTML(a.owner || "N/A")} • Region: ${escapeHTML(a.region || "Global")}</span>
                        </div>
                        <button class="btn btn-secondary btn-sm" onclick="openEditModal(${a.id})">Review →</button>
                    </div>
                `).join("");
            }
        }

    } catch (error) {
        console.error("Automation status fetch error:", error);
    }
}

async function loadAutomationHistory() {
    if (!isAdmin()) return;

    const tbody = document.getElementById("automationHistoryTableBody");
    if (!tbody) return;

    try {
        const response = await fetch(`${API_BASE_URL}/automation/history?limit=15`, {
            headers: getAuthHeaders()
        });

        if (response.status === 401) {
            handleUnauthorized();
            return;
        }

        if (!response.ok) return;

        const records = await response.json();

        if (!Array.isArray(records) || records.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="empty-state">No execution history recorded yet.</td></tr>`;
            return;
        }

        tbody.innerHTML = records.map((record) => {
            const dateStr = record.timestamp ? new Date(record.timestamp).toLocaleString() : "Unknown";
            const isSuccess = record.status === "SUCCESS";
            const statusClass = isSuccess ? "status-running" : "status-overdue";

            return `
                <tr>
                    <td>
                        <span class="status-badge ${statusClass}">
                            ${escapeHTML(record.status)}
                        </span>
                    </td>
                    <td class="font-mono">${escapeHTML(dateStr)}</td>
                    <td class="font-mono">${record.assets_checked}</td>
                    <td class="font-mono" style="${record.overdue_detected > 0 ? 'color: var(--status-overdue-text); font-weight: 600;' : ''}">
                        ${record.overdue_detected}
                    </td>
                    <td>
                        ${record.error_message ? `<span style="color: var(--status-overdue-text);">${escapeHTML(record.error_message)}</span>` : 'Scan cycle completed normally'}
                    </td>
                </tr>
            `;
        }).join("");

    } catch (error) {
        console.error("Automation history fetch error:", error);
    }
}

async function triggerAutomationRun() {
    if (!isAdmin()) return;

    const btn = document.getElementById("triggerAutomationBtn");

    try {
        if (btn) btn.disabled = true;

        const response = await fetch(`${API_BASE_URL}/automation/run-now`, {
            method: "POST",
            headers: getAuthHeaders()
        });

        if (response.status === 401) {
            handleUnauthorized();
            return;
        }

        if (response.ok) {
            const data = await response.json();
            recordActivity("AUTOMATION", "Lifecycle Scanner", `Executed manual overdue scan (Checked: ${data.assets_checked || 0}, Overdue: ${data.overdue_detected || 0})`);
            showMessage("success", "Overdue automation check executed successfully!");
            await loadAutomationStatus();
            await loadAutomationHistory();
            await loadDashboardStats();
        } else {
            const err = await response.json();
            showMessage("error", err.error || "Failed to trigger automation");
        }
    } catch (error) {
        console.error("Trigger automation error:", error);
        showMessage("error", error.message || "Failed to trigger automation");
    } finally {
        if (btn) btn.disabled = false;
    }
}

// ==========================================================================
// 27. ACTIVITY LOGS PAGE
// ==========================================================================
function renderActivityLogsTable() {
    const tbody = document.getElementById("activityLogsTableBody");
    if (!tbody) return;

    const searchInput = document.getElementById("activitySearchInput");
    const filterAction = document.getElementById("activityActionFilter");

    const query = searchInput ? searchInput.value.toLowerCase().trim() : "";
    const actionFilter = filterAction ? filterAction.value : "";

    let logs = getStoredActivityLogs();

    if (query || actionFilter) {
        logs = logs.filter(log => {
            const matchesQuery = !query || (
                (log.user && log.user.toLowerCase().includes(query)) ||
                (log.asset && log.asset.toLowerCase().includes(query)) ||
                (log.details && log.details.toLowerCase().includes(query))
            );
            const matchesAction = !actionFilter || log.action === actionFilter;
            return matchesQuery && matchesAction;
        });
    }

    if (logs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="empty-state">No user activity matches the criteria.</td></tr>`;
        return;
    }

    tbody.innerHTML = logs.map(log => {
        const timeStr = log.timestamp ? new Date(log.timestamp).toLocaleString() : "—";
        let badgeClass = "role-badge";
        if (log.action === "CREATE") badgeClass = "status-badge status-running";
        else if (log.action === "UPDATE") badgeClass = "status-badge status-stopped";
        else if (log.action === "DELETE") badgeClass = "status-badge status-overdue";
        else if (log.action === "AUTOMATION") badgeClass = "status-badge status-pending";
        else badgeClass = "role-badge admin";

        return `
            <tr>
                <td class="font-mono">${escapeHTML(timeStr)}</td>
                <td>
                    <strong>${escapeHTML(log.user || "System")}</strong>
                    <div style="font-size: 0.725rem; color: var(--text-muted);">${escapeHTML(log.role || "User")}</div>
                </td>
                <td>
                    <span class="${badgeClass}">${escapeHTML(log.action)}</span>
                </td>
                <td><strong>${escapeHTML(log.asset || "—")}</strong></td>
                <td>${escapeHTML(log.details || "—")}</td>
            </tr>
        `;
    }).join("");
}

function setupActivityLogControls() {
    const searchInput = document.getElementById("activitySearchInput");
    const filterAction = document.getElementById("activityActionFilter");
    const clearBtn = document.getElementById("clearActivityLogsBtn");

    if (searchInput) searchInput.addEventListener("input", renderActivityLogsTable);
    if (filterAction) filterAction.addEventListener("change", renderActivityLogsTable);
    if (clearBtn) {
        clearBtn.addEventListener("click", () => {
            if (confirm("Clear local activity logs?")) {
                localStorage.removeItem(ACTIVITY_STORAGE_KEY);
                renderActivityLogsTable();
                updateRecentActivityFeed();
            }
        });
    }
}

// ==========================================================================
// 28. NAVIGATION & ROUTING
// ==========================================================================
function setupNavigation() {
    const navItems = document.querySelectorAll(".nav-item");
    const pages = document.querySelectorAll(".page");

    const pageTitles = {
        dashboard: {
            title: "Dashboard",
            subtitle: "Cloud asset operations overview"
        },
        assets: {
            title: "Cloud Resources",
            subtitle: "Inventory and management of active cloud assets"
        },
        costs: {
            title: "Cost Overview",
            subtitle: "Financial analytics and expenditure governance"
        },
        analytics: {
            title: "Analytics",
            subtitle: "Multi-cloud resource distribution and operational breakdown"
        },
        automation: {
            title: "Automation",
            subtitle: "Lifecycle & overdue checks"
        },
        activity: {
            title: "Activity Logs",
            subtitle: "Audit trail of operations and asset lifecycle events"
        },
        settings: {
            title: "Settings",
            subtitle: "Manage system preferences and display options"
        }
    };

    window.showPage = function(pageName) {
        pages.forEach(page => page.classList.remove("active-page"));

        const selectedPage = document.getElementById(pageName);
        if (!selectedPage) {
            console.error("Page not found:", pageName);
            return;
        }

        selectedPage.classList.add("active-page");

        if (pageName === "costs") updateCostOverview();
        if (pageName === "analytics") updateAnalytics();
        if (pageName === "activity") renderActivityLogsTable();
        if (pageName === "automation" && isAdmin()) {
            loadAutomationStatus();
            loadAutomationHistory();
        }

        navItems.forEach(item => item.classList.remove("active"));
        const activeButton = document.querySelector(`.nav-item[data-page="${pageName}"]`);
        if (activeButton) activeButton.classList.add("active");

        const pageTitle = document.getElementById("pageTitle");
        const pageSubtitle = document.getElementById("pageSubtitle");
        const pageData = pageTitles[pageName];

        if (pageData) {
            if (pageTitle) pageTitle.textContent = pageData.title;
            if (pageSubtitle) pageSubtitle.textContent = pageData.subtitle;
        }

        // Close mobile drawer on navigation
        const sidebar = document.getElementById("sidebar");
        if (sidebar && window.innerWidth <= 992) {
            sidebar.classList.remove("mobile-open");
        }
    };

    navItems.forEach(item => {
        item.addEventListener("click", () => {
            const pageName = item.dataset.page;
            showPage(pageName);
        });
    });

    showPage("dashboard");
}

function navigateToAssets() {
    showPage("assets");
}

// ==========================================================================
// 29. COST ESTIMATION HELPER FUNCTIONS
// ==========================================================================
function calculateEstimatedCost(provider, service, status, region) {
    if (!provider || !service) return 0;

    const providerData = COST_ESTIMATES[provider];
    if (!providerData) return 0;

    const serviceData = providerData[service];
    if (!serviceData) return 0;

    const normalizedStatus = String(status || "").toLowerCase();
    let baseCost = serviceData[normalizedStatus];

    if (baseCost === undefined) {
        baseCost = serviceData.running || 0;
    }

    const multiplier = REGION_MULTIPLIERS[region] || 1;
    return (baseCost * multiplier).toFixed(2);
}

function setupCostEstimator() {
    const providerInput = document.getElementById("provider");
    const serviceInput = document.getElementById("service");
    const statusInput = document.getElementById("status");
    const regionInput = document.getElementById("region");
    const costInput = document.getElementById("cost");

    if (!providerInput || !serviceInput || !statusInput || !regionInput || !costInput) return;

    const updateEstimatedCost = () => {
        const estimatedCost = calculateEstimatedCost(
            providerInput.value,
            serviceInput.value,
            statusInput.value,
            regionInput.value
        );

        if (estimatedCost > 0) {
            costInput.value = estimatedCost;
        }
    };

    providerInput.addEventListener("change", updateEstimatedCost);
    serviceInput.addEventListener("change", updateEstimatedCost);
    statusInput.addEventListener("change", updateEstimatedCost);
    regionInput.addEventListener("change", updateEstimatedCost);
}

function estimateCost() {
    const providerInput = document.getElementById("provider");
    const serviceInput = document.getElementById("service");
    const statusInput = document.getElementById("status");
    const regionInput = document.getElementById("region");
    const costInput = document.getElementById("cost");

    if (!providerInput || !serviceInput || !statusInput || !regionInput || !costInput) return;

    const estimatedCost = calculateEstimatedCost(
        providerInput.value,
        serviceInput.value,
        statusInput.value,
        regionInput.value
    );

    if (estimatedCost > 0) {
        costInput.value = estimatedCost;
    }
}

function setupEditCostEstimator() {
    const providerInput = document.getElementById("editProvider");
    const serviceInput = document.getElementById("editService");
    const statusInput = document.getElementById("editStatus");
    const regionInput = document.getElementById("editRegion");
    const costInput = document.getElementById("editCost");

    if (!providerInput || !serviceInput || !statusInput || !regionInput || !costInput) return;

    const updateEstimatedCost = () => {
        const estimatedCost = calculateEstimatedCost(
            providerInput.value,
            serviceInput.value,
            statusInput.value,
            regionInput.value
        );

        if (estimatedCost > 0) {
            costInput.value = estimatedCost;
        }
    };

    providerInput.addEventListener("change", updateEstimatedCost);
    serviceInput.addEventListener("change", updateEstimatedCost);
    statusInput.addEventListener("change", updateEstimatedCost);
    regionInput.addEventListener("change", updateEstimatedCost);
}

function estimateEditCost() {
    const providerInput = document.getElementById("editProvider");
    const serviceInput = document.getElementById("editService");
    const statusInput = document.getElementById("editStatus");
    const regionInput = document.getElementById("editRegion");
    const costInput = document.getElementById("editCost");

    if (!providerInput || !serviceInput || !statusInput || !regionInput || !costInput) return;

    const estimatedCost = calculateEstimatedCost(
        providerInput.value,
        serviceInput.value,
        statusInput.value,
        regionInput.value
    );

    if (estimatedCost > 0) {
        costInput.value = estimatedCost;
    }
}

// ==========================================================================
// 30. PASSWORD TOGGLE & DROPDOWNS
// ==========================================================================
function setupPasswordToggle() {
    const passwordInput = document.getElementById("loginPassword");
    const passwordToggle = document.getElementById("passwordToggle");

    if (!passwordInput || !passwordToggle) return;

    passwordToggle.addEventListener("click", () => {
        if (passwordInput.type === "password") {
            passwordInput.type = "text";
            passwordToggle.setAttribute("aria-label", "Hide password");
        } else {
            passwordInput.type = "password";
            passwordToggle.setAttribute("aria-label", "Show password");
        }
    });
}

function setupProfileDropdown() {
    const profileButton = document.getElementById("profileButton");
    const profileDropdown = document.getElementById("profileDropdown");
    const logoutButton = document.getElementById("logoutButton");

    if (!profileButton || !profileDropdown) return;

    profileButton.addEventListener("click", (event) => {
        event.stopPropagation();
        profileDropdown.classList.toggle("show");
        profileButton.classList.toggle("active");
    });

    if (logoutButton) {
        logoutButton.addEventListener("click", (event) => {
            event.stopPropagation();
            logout();
        });
    }

    document.addEventListener("click", (event) => {
        if (!profileButton.contains(event.target) && !profileDropdown.contains(event.target)) {
            profileDropdown.classList.remove("show");
            profileButton.classList.remove("active");
        }
    });
}

// ==========================================================================
// 31. THEME SWITCHER (LIGHT DEFAULT / DARK ENTERPRISE)
// ==========================================================================
function loadTheme() {
    const savedTheme = localStorage.getItem("cloudasset_theme") || "light";
    const themeToggle = document.getElementById("themeToggle");

    if (savedTheme === "dark") {
        document.body.classList.add("dark-mode");
        if (themeToggle) themeToggle.textContent = "☀️";
    } else {
        document.body.classList.remove("dark-mode");
        if (themeToggle) themeToggle.textContent = "🌙";
    }
}

function toggleTheme() {
    document.body.classList.toggle("dark-mode");
    const isDark = document.body.classList.contains("dark-mode");
    localStorage.setItem("cloudasset_theme", isDark ? "dark" : "light");

    const themeToggle = document.getElementById("themeToggle");
    if (themeToggle) {
        themeToggle.textContent = isDark ? "☀️" : "🌙";
    }
}

function setupThemeToggle() {
    const themeToggle = document.getElementById("themeToggle");
    if (themeToggle) {
        themeToggle.addEventListener("click", toggleTheme);
    }

    const settingsThemeToggle = document.getElementById("settingsThemeToggle");
    if (settingsThemeToggle) {
        settingsThemeToggle.addEventListener("click", toggleTheme);
    }
}

// ==========================================================================
// 32. SIDEBAR MOBILE DRAWER TOGGLE
// ==========================================================================
function setupSidebarToggle() {
    const menuToggle = document.getElementById("menuToggle");
    const sidebar = document.getElementById("sidebar");

    if (menuToggle && sidebar) {
        menuToggle.addEventListener("click", (e) => {
            e.stopPropagation();
            sidebar.classList.toggle("mobile-open");
        });

        document.addEventListener("click", (e) => {
            if (window.innerWidth <= 992 && !sidebar.contains(e.target) && !menuToggle.contains(e.target)) {
                sidebar.classList.remove("mobile-open");
            }
        });
    }
}

// ==========================================================================
// 33. HELPER UTILITIES
// ==========================================================================
function showMessage(type, message) {
    const target = type === "success" ? successMessage : errorMessage;

    if (!target) {
        console.log(`${type}: ${message}`);
        return;
    }

    target.textContent = message;
    target.style.display = "block";

    setTimeout(() => {
        target.style.display = "none";
    }, 5000);
}

function setText(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = value;
    }
}

function setValue(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) {
        element.value = value ?? "";
    }
}

function formatCost(cost) {
    const value = parseFloat(cost) || 0;
    return value.toFixed(2);
}

function escapeHTML(value) {
    if (value === null || value === undefined) return "";
    const div = document.createElement("div");
    div.textContent = String(value);
    return div.innerHTML;
}

function formatTimeAgo(timestamp) {
    if (!timestamp) return "Just now";
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return "Recently";

    const seconds = Math.floor((new Date() - date) / 1000);
    if (seconds < 60) return "Just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

// ==========================================================================
// 34. GLOBAL WINDOW EXPORTS FOR INLINE HANDLERS
// ==========================================================================
window.openEditModal = openEditModal;
window.deleteAsset = deleteAsset;
window.logout = logout;
window.filterAssets = filterAssets;
window.clearFilters = clearFilters;
window.previousPage = previousPage;
window.nextPage = nextPage;
window.estimateCost = estimateCost;
window.estimateEditCost = estimateEditCost;
window.refreshAssets = loadAssets;
window.loadAutomationStatus = loadAutomationStatus;
window.loadAutomationHistory = loadAutomationHistory;
window.triggerAutomationRun = triggerAutomationRun;
window.navigateToAssets = navigateToAssets;