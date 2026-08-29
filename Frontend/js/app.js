// ==========================================================================
// CLOUDASSET — FRONTEND APPLICATION LOGIC
// AI-Powered Cloud Operations Center
// ==========================================================================

// ==========================================================================
// API CONFIGURATION (PRESERVED EXACTLY)
// ==========================================================================
const API_BASE_URL = "http://34.201.59.22/api";

// ==========================================================================
// AUTHENTICATION & SESSION MANAGEMENT
// ==========================================================================
let authToken = localStorage.getItem("cloudasset_token");
let currentUser = JSON.parse(localStorage.getItem("cloudasset_user") || "null");

// Get headers for protected API requests
function getAuthHeaders() {
    const headers = {
        "Content-Type": "application/json"
    };

    if (authToken) {
        headers["Authorization"] = `Bearer ${authToken}`;
    }

    return headers;
}

// Check whether current user is Admin
function isAdmin() {
    return currentUser && currentUser.role === "admin";
}

// Logout
function logout() {
    localStorage.removeItem("cloudasset_token");
    localStorage.removeItem("cloudasset_user");

    authToken = null;
    currentUser = null;

    window.location.reload();
}

// Handle expired or invalid login token
function handleUnauthorized() {
    alert("Your session has expired. Please login again.");
    logout();
}

// ==========================================================================
// ROLE-BASED PERMISSIONS
// ==========================================================================
function applyRolePermissions() {
    const adminOnlyElements = document.querySelectorAll('[data-admin-only="true"]');

    adminOnlyElements.forEach((element) => {
        element.style.display = isAdmin() ? "" : "none";
    });
}

// ==========================================================================
// COST ESTIMATION MATRIX & REGION MULTIPLIERS
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
// APPLICATION STATE
// ==========================================================================
let allAssets = [];
let filteredAssets = [];
let currentPage = 1;
const assetsPerPage = 6;

// ==========================================================================
// DOM ELEMENTS
// ==========================================================================
const addAssetForm = document.getElementById("addAssetForm");
const editAssetForm = document.getElementById("editAssetForm");
const assetsContainer = document.getElementById("assetsContainer");
const loadingMessage = document.getElementById("loadingMessage");
const errorMessage = document.getElementById("errorMessage");
const successMessage = document.getElementById("successMessage");
const refreshBtn = document.getElementById("refreshBtn");
const editModal = document.getElementById("editModal");
const closeModal = document.querySelector(".close");
const cancelEditBtn = document.getElementById("cancelEdit");

// LOGIN ELEMENTS
const loginScreen = document.getElementById("loginScreen");
const loginForm = document.getElementById("loginForm");
const loginError = document.getElementById("loginError");
const appLayout = document.getElementById("appLayout") || document.querySelector(".app-layout");

// ==========================================================================
// INITIALIZE APPLICATION
// ==========================================================================
document.addEventListener("DOMContentLoaded", () => {
    // Check initial authentication state
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

    // Main event listeners
    setupEventListeners();
    setupPasswordToggle();
    setupNavigation();
    setupCostEstimator();
    setupEditCostEstimator();
    setupProfileDropdown();
    setupThemeToggle();
    setupSidebarToggle();
    loadTheme();
});

// ==========================================================================
// LOGIN HANDLER
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
            throw new Error(data.error || data.message || "Login failed. Please verify credentials.");
        }

        if (!data.access_token || !data.user) {
            throw new Error("Invalid login response from server");
        }

        // Save token & user profile
        authToken = data.access_token;
        localStorage.setItem("cloudasset_token", authToken);

        currentUser = data.user;
        localStorage.setItem("cloudasset_user", JSON.stringify(currentUser));

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
// USER PROFILE UI
// ==========================================================================
function updateUserProfile() {
    if (!currentUser) return;

    const username = currentUser.username || currentUser.name || "User";
    const role = currentUser.role || "User";
    const avatarLetter = username.charAt(0).toUpperCase();

    // Top-right profile
    setText("profileUsername", username);
    setText("profileRole", role === "admin" ? "Administrator" : "Employee");
    setText("userAvatar", avatarLetter);

    // Dropdown profile
    setText("dropdownUsername", username);
    setText("dropdownRole", role === "admin" ? "Administrator" : "Employee");
    setText("dropdownAvatar", avatarLetter);
}

// ==========================================================================
// EVENT LISTENERS SETUP
// ==========================================================================
function setupEventListeners() {
    // Dashboard - Add New Asset Quick Action
    const dashboardAddAssetBtn = document.getElementById("dashboardAddAssetBtn");
    if (dashboardAddAssetBtn) {
        dashboardAddAssetBtn.addEventListener("click", () => {
            navigateToAssets();
        });
    }

    // Dashboard - View All Assets Quick Action
    const viewAllAssetsBtn = document.getElementById("viewAllAssetsBtn");
    if (viewAllAssetsBtn) {
        viewAllAssetsBtn.addEventListener("click", () => {
            navigateToAssets();
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
        });
    }

    // Close Modal Button
    if (closeModal) {
        closeModal.addEventListener("click", closeEditModal);
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
// LOAD ASSETS FROM BACKEND
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
// LOAD DASHBOARD STATISTICS FROM API
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

        setText("runningCount", data.running || 0);
        setText("stoppedCount", data.stopped || 0);
        setText("inactiveCount", data.inactive || 0);
        setText("overdueCount", data.overdue || 0);
        setText("terminatedCount", data.terminated || 0);
        setText("totalCount", data.total || 0);

    } catch (error) {
        console.error("Dashboard stats error:", error);
    }
}

// ==========================================================================
// UPDATE ALL PAGE TELEMETRY
// ==========================================================================
function updateAllPages() {
    updateDashboard();
    updateCostOverview();
    updateAnalytics();
}

// ==========================================================================
// DASHBOARD VIEW UPDATES
// ==========================================================================
function updateDashboard() {
    const totalAssets = allAssets.length;

    const activeAssets = allAssets.filter(
        asset => asset.status === "Running" || asset.status === "Active"
    ).length;

    const totalCost = allAssets.reduce(
        (total, asset) => total + (parseFloat(asset.cost) || 0),
        0
    );

    const providers = new Set(
        allAssets.map(asset => asset.provider).filter(Boolean)
    ).size;

    setText("dashTotalAssets", totalAssets);
    setText("dashActiveAssets", activeAssets);
    setText("dashTotalCost", `$${totalCost.toFixed(2)}`);
    setText("dashProviders", providers);

    // Synchronize stopped & inactive counters from active asset array if needed
    const stoppedCount = allAssets.filter(a => a.status === "Stopped").length;
    const inactiveCount = allAssets.filter(a => a.status === "Inactive" || a.status === "Terminated").length;

    if (stoppedCount > 0) setText("stoppedCount", stoppedCount);
    if (inactiveCount > 0) setText("inactiveCount", inactiveCount);

    updateRecentAssets();
}

// ==========================================================================
// RECENT ASSETS FEED
// ==========================================================================
function updateRecentAssets() {
    const container = document.getElementById("recentAssets");
    if (!container) return;

    if (allAssets.length === 0) {
        container.innerHTML = `<p class="empty-state">No cloud assets provisioned yet.</p>`;
        return;
    }

    const recentAssets = [...allAssets]
        .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
        .slice(0, 5);

    container.innerHTML = recentAssets.map(asset => `
        <div class="recent-asset">
            <div>
                <strong>${escapeHTML(asset.asset_name || "Unnamed Resource")}</strong>
                <span>${escapeHTML(asset.provider || "Multi-Cloud")} • ${escapeHTML(asset.service || "Compute")} • ${escapeHTML(asset.region || "Global")}</span>
            </div>
            <div class="recent-asset-cost">
                $${formatCost(asset.cost)}/mo
            </div>
        </div>
    `).join("");
}

// ==========================================================================
// DISPLAY ASSETS (CARDS GRID)
// ==========================================================================
function displayAssets(assets) {
    if (!assetsContainer) return;

    if (!assets || assets.length === 0) {
        assetsContainer.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1; padding: 48px; background: var(--bg-surface); border-radius: var(--radius-lg); border: 1px dashed var(--border-medium);">
                <div style="font-size: 36px; margin-bottom: 12px;">☁️</div>
                <h3 style="margin-bottom: 6px;">No Assets Found</h3>
                <p>No resources match your active search filters, or none have been registered yet.</p>
            </div>
        `;
        updatePagination(0);
        return;
    }

    const startIndex = (currentPage - 1) * assetsPerPage;
    const endIndex = startIndex + assetsPerPage;
    const pageAssets = assets.slice(startIndex, endIndex);

    assetsContainer.innerHTML = pageAssets.map(asset => {
        const statusKey = String(asset.status || "Unknown").toLowerCase();
        const isRunning = statusKey === "running" || statusKey === "active";
        
        return `
            <div class="asset-card">
                <div class="asset-card-header">
                    <div>
                        <h3>${escapeHTML(asset.asset_name || "Unnamed Resource")}</h3>
                        <span class="asset-id">ID #${asset.id}</span>
                    </div>
                    <span class="status-badge status-${statusKey}">
                        ${escapeHTML(asset.status || "Unknown")}
                    </span>
                </div>

                <div class="asset-info">
                    <div class="asset-info-item">
                        <span>Provider</span>
                        <strong>${escapeHTML(asset.provider || "N/A")}</strong>
                    </div>

                    <div class="asset-info-item">
                        <span>Service</span>
                        <strong>${escapeHTML(asset.service || "N/A")}</strong>
                    </div>

                    <div class="asset-info-item">
                        <span>Region</span>
                        <strong>${escapeHTML(asset.region || "N/A")}</strong>
                    </div>

                    <div class="asset-info-item">
                        <span>Owner</span>
                        <strong>${escapeHTML(asset.owner || "N/A")}</strong>
                    </div>

                    <div class="asset-info-item" style="grid-column: 1 / -1;">
                        <span>Lifecycle Due Date</span>
                        <strong>${asset.due_date ? escapeHTML(asset.due_date) : "No expiration set"}</strong>
                    </div>
                </div>

                <div class="asset-cost">
                    <span>Monthly Telemetry Cost</span>
                    <strong>$${formatCost(asset.cost)}</strong>
                </div>

                <div class="asset-actions">
                    ${isAdmin() ? `
                        <button class="btn btn-edit edit-btn" onclick="openEditModal(${asset.id})">
                            Edit
                        </button>
                        <button class="btn btn-danger delete-btn" onclick="deleteAsset(${asset.id})">
                            Delete
                        </button>
                    ` : `
                        <span class="view-only-label">Role: View Only</span>
                    `}
                </div>
            </div>
        `;
    }).join("");

    updatePagination(assets.length);
}

// ==========================================================================
// PAGINATION
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
// SEARCH & FILTER LOGIC
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
            (String(asset.id) === searchTerm)
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
// ADD ASSET HANDLER
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
// EDIT ASSET MODAL & UPDATE
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

        if (editModal) editModal.style.display = "block";

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
// DELETE ASSET HANDLER
// ==========================================================================
async function deleteAsset(assetId) {
    if (!isAdmin()) {
        showMessage("error", "Admin access required");
        return;
    }

    const confirmed = confirm("Are you sure you want to permanently delete this cloud asset from operations?");
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

        showMessage("success", "Asset deleted successfully!");
        await loadAssets();
        loadDashboardStats();

    } catch (error) {
        console.error("Delete error:", error);
        showMessage("error", error.message || "Unable to delete asset");
    }
}

// ==========================================================================
// MESSAGE TOAST FEEDBACK
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

// Helper: Set text content of element safely
function setText(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = value;
    }
}

// Helper: Set form value safely
function setValue(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) {
        element.value = value ?? "";
    }
}

// Helper: Format numerical cost safely
function formatCost(cost) {
    const value = parseFloat(cost) || 0;
    return value.toFixed(2);
}

// Helper: Escape HTML strings safely
function escapeHTML(value) {
    if (value === null || value === undefined) return "";
    const div = document.createElement("div");
    div.textContent = String(value);
    return div.innerHTML;
}

// ==========================================================================
// COST OVERVIEW CALCULATIONS & VISUALIZATION
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
        highestNameElement.textContent = highestAsset ? (highestAsset.asset_name || highestAsset.name || "Unnamed Resource") : "No assets";
    }

    // Provider cost breakdown with telemetry progress bars
    if (providerContainer) {
        const providerEntries = Object.entries(providerCosts).sort((a, b) => b[1] - a[1]);
        providerContainer.innerHTML = providerEntries.map(([provider, cost]) => {
            const percentage = totalCost > 0 ? ((cost / totalCost) * 100).toFixed(1) : "0";
            return `
                <div class="analytics-row">
                    <div class="analytics-label">
                        <span><strong>${escapeHTML(provider)}</strong></span>
                        <strong>$${cost.toFixed(2)} (${percentage}%)</strong>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${percentage}%"></div>
                    </div>
                </div>
            `;
        }).join("");
    }

    // Service cost breakdown
    if (serviceContainer) {
        const serviceEntries = Object.entries(serviceCosts).sort((a, b) => b[1] - a[1]);
        serviceContainer.innerHTML = serviceEntries.map(([service, cost]) => {
            const percentage = totalCost > 0 ? ((cost / totalCost) * 100).toFixed(1) : "0";
            return `
                <div class="analytics-row">
                    <div class="analytics-label">
                        <span><strong>${escapeHTML(service)}</strong></span>
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
            const name = asset.asset_name || asset.name || "Unnamed Resource";

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
// ANALYTICS CALCULATIONS & VISUALIZATION
// ==========================================================================
function updateAnalytics() {
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
// NAVIGATION & PAGE ROUTING
// ==========================================================================
function setupNavigation() {
    const navItems = document.querySelectorAll(".nav-item");
    const pages = document.querySelectorAll(".page");

    const pageTitles = {
        dashboard: {
            title: "Dashboard",
            subtitle: "Overview of your multi-cloud infrastructure"
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
            subtitle: "Infrastructure distribution and operational telemetry"
        },
        settings: {
            title: "Settings",
            subtitle: "Manage system preferences and appearance"
        }
    };

    function showPage(pageName) {
        pages.forEach(page => page.classList.remove("active-page"));

        const selectedPage = document.getElementById(pageName);
        if (!selectedPage) {
            console.error("Page not found:", pageName);
            return;
        }

        selectedPage.classList.add("active-page");

        if (pageName === "costs") updateCostOverview();
        if (pageName === "analytics") updateAnalytics();

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
    }

    navItems.forEach(item => {
        item.addEventListener("click", () => {
            const pageName = item.dataset.page;
            showPage(pageName);
        });
    });

    showPage("dashboard");
}

function navigateToAssets() {
    const assetsButton = document.querySelector('[data-page="assets"]');
    if (assetsButton) {
        assetsButton.click();
    }
}

// ==========================================================================
// COST ESTIMATION ENGINE
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
// PASSWORD TOGGLE
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

// ==========================================================================
// PROFILE DROPDOWN
// ==========================================================================
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
// THEME SWITCHER
// ==========================================================================
function loadTheme() {
    const savedTheme = localStorage.getItem("cloudasset_theme") || "dark";
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
// SIDEBAR MOBILE DRAWER TOGGLE
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
// GLOBAL WINDOW EXPORTS (FOR INLINE HANDLERS)
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