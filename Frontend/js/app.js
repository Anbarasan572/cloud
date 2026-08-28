// ============================================
// CLOUDASSET - FRONTEND APPLICATION
// ============================================


// ============================================
// API CONFIGURATION
// ============================================

const API_BASE_URL = "http://34.201.59.22/api";


// ==========================================
// AUTHENTICATION
// ==========================================

let authToken = localStorage.getItem("cloudasset_token");

let currentUser = JSON.parse(
    localStorage.getItem("cloudasset_user") || "null"
);


// Get headers for protected API requests
function getAuthHeaders() {

    const headers = {
        "Content-Type": "application/json"
    };

    if (authToken) {
        headers["Authorization"] =
            `Bearer ${authToken}`;
    }

    return headers;
}


// Check whether current user is Admin
function isAdmin() {

    return currentUser &&
        currentUser.role === "admin";
}


// Logout
function logout() {

    localStorage.removeItem(
        "cloudasset_token"
    );

    localStorage.removeItem(
        "cloudasset_user"
    );

    authToken = null;
    currentUser = null;

    window.location.reload();
}


// Handle expired or invalid login token
function handleUnauthorized() {

    alert(
        "Your session has expired. Please login again."
    );

    logout();
}


// ==========================================
// ROLE-BASED PERMISSIONS
// ==========================================

function applyRolePermissions() {

    // Admin-only elements in HTML
    const adminOnlyElements =
        document.querySelectorAll(
            '[data-admin-only="true"]'
        );

    adminOnlyElements.forEach((element) => {

        element.style.display =
            isAdmin() ? "" : "none";

    });

}


// ============================================
// COST ESTIMATION
// ============================================

const COST_ESTIMATES = {

    AWS: {

        EC2: {
            running: 50,
            stopped: 5
        },

        RDS: {
            running: 80,
            stopped: 8
        },

        S3: {
            running: 23,
            stopped: 23
        },

        Lambda: {
            running: 15,
            stopped: 0
        },

        ECS: {
            running: 45,
            stopped: 5
        },

        EKS: {
            running: 75,
            stopped: 10
        },

        CloudFront: {
            running: 50,
            stopped: 50
        },

        Route53: {
            running: 1,
            stopped: 1
        },

        VPC: {
            running: 0,
            stopped: 0
        },

        "Load Balancer": {
            running: 25,
            stopped: 25
        },

        CloudWatch: {
            running: 10,
            stopped: 10
        }

    },


    Azure: {

        EC2: {
            running: 55,
            stopped: 6
        },

        RDS: {
            running: 85,
            stopped: 9
        },

        S3: {
            running: 25,
            stopped: 25
        },

        Lambda: {
            running: 18,
            stopped: 0
        },

        ECS: {
            running: 50,
            stopped: 6
        },

        EKS: {
            running: 80,
            stopped: 12
        }

    },


    GCP: {

        EC2: {
            running: 48,
            stopped: 5
        },

        RDS: {
            running: 75,
            stopped: 8
        },

        S3: {
            running: 20,
            stopped: 0
        },

        Lambda: {
            running: 12,
            stopped: 0
        },

        ECS: {
            running: 42,
            stopped: 5
        },

        EKS: {
            running: 72,
            stopped: 10
        }

    }

};


// ============================================
// REGION MULTIPLIERS
// ============================================

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


// ============================================
// APPLICATION STATE
// ============================================

let allAssets = [];

let filteredAssets = [];

let currentPage = 1;

const assetsPerPage = 6;


// ============================================
// DOM ELEMENTS
// ============================================

const addAssetForm =
    document.getElementById("addAssetForm");


const editAssetForm =
    document.getElementById("editAssetForm");


const assetsContainer =
    document.getElementById("assetsContainer");


const loadingMessage =
    document.getElementById("loadingMessage");


const errorMessage =
    document.getElementById("errorMessage");


const successMessage =
    document.getElementById("successMessage");


const refreshBtn =
    document.getElementById("refreshBtn");


const editModal =
    document.getElementById("editModal");


const closeModal =
    document.querySelector(".close");


const cancelEditBtn =
    document.getElementById("cancelEdit");


// ============================================
// LOGIN ELEMENTS
// ============================================

const loginScreen =
    document.getElementById("loginScreen");


const loginForm =
    document.getElementById("loginForm");


const loginError =
    document.getElementById("loginError");


const appLayout =
    document.querySelector(".app-layout");
// ============================================
// INITIALIZE APPLICATION
// ============================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        // Main event listeners
        setupEventListeners();

        // Password show / hide
        setupPasswordToggle();

        // Navigation
        setupNavigation();

        // Cost Estimators
        setupCostEstimator();
        setupEditCostEstimator();

        // Profile Dropdown + Logout
        setupProfileDropdown();

    }
);
// ============================================
// LOGIN
// ============================================

async function handleLogin(event) {

    event.preventDefault();


    const username =
        document
            .getElementById("loginUsername")
            .value
            .trim();


    const password =
        document
            .getElementById("loginPassword")
            .value;


    // Clear previous errors
    if (loginError) {

        loginError.style.display = "none";

        loginError.textContent = "";

    }


    try {

        const response = await fetch(

            `${API_BASE_URL}/auth/login`,

            {

                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({

                    username: username,

                    password: password

                })

            }

        );


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(

                data.error ||
                data.message ||
                "Login failed"

            );

        }


        // Validate backend response
        if (
            !data.access_token ||
            !data.user
        ) {

            throw new Error(
                "Invalid login response from server"
            );

        }
        // Save authentication token
authToken = data.access_token;

localStorage.setItem(
    "cloudasset_token",
    authToken
);

// Save logged-in user
currentUser = data.user;

localStorage.setItem(
    "cloudasset_user",
    JSON.stringify(currentUser)
);


        // Hide login screen
        if (loginScreen) {

            loginScreen.style.display =
                "none";

        }


        // Show application
        if (appLayout) {

            appLayout.style.display =
                "flex";

        }


        // Apply Admin / Employee permissions
        applyRolePermissions();


        // Update top-right profile
        
        updateUserProfile();


        // Load assets
        await loadAssets();

        loadDashboardStats();


    } catch (error) {

        console.error(
            "Login error:",
            error
        );


        if (loginError) {

            loginError.textContent =
                error.message ||
                "Unable to login";


            loginError.style.display =
                "block";

        }

    }

}

// ============================================
// UPDATE USER PROFILE UI
// ============================================

function updateUserProfile() {

    if (!currentUser) return;

    const username =
        currentUser.username ||
        currentUser.name ||
        "User";

    const role =
        currentUser.role ||
        "User";

    const avatarLetter =
        username.charAt(0).toUpperCase();


    // Top-right profile
    setText("profileUsername", username);
    setText("profileRole", role);
    setText("userAvatar", avatarLetter);


    // Dropdown profile
    setText("dropdownUsername", username);
    setText("dropdownRole", role);
    setText("dropdownAvatar", avatarLetter);

}

// ============================================
// EVENT LISTENERS
// ============================================

function setupEventListeners() {

    // Dashboard - Add New Asset
    const dashboardAddAssetBtn =
        document.getElementById("dashboardAddAssetBtn");

    if (dashboardAddAssetBtn) {

        dashboardAddAssetBtn.addEventListener(
            "click",
            () => {

                navigateToAssets();

            }
        );

    }


    // Dashboard - View All Assets
    const viewAllAssetsBtn =
        document.getElementById("viewAllAssetsBtn");

    if (viewAllAssetsBtn) {

        viewAllAssetsBtn.addEventListener(
            "click",
            () => {

                navigateToAssets();

            }
        );

    }


    // KEEP ALL YOUR OTHER EXISTING LISTENERS BELOW
    // Login
    if (loginForm) {

        loginForm.addEventListener(
            "submit",
            handleLogin
        );

    }


    // Add asset
    if (addAssetForm) {

        addAssetForm.addEventListener(
            "submit",
            handleAddAsset
        );

    }


    // Edit asset
    if (editAssetForm) {

        editAssetForm.addEventListener(
            "submit",
            handleEditAsset
        );

    }


    // Refresh assets
    if (refreshBtn) {

      refreshBtn.addEventListener(
    "click",
    () => {
        loadAssets();
        loadDashboardStats();
    }
);
    }

    // Close modal
    if (closeModal) {

        closeModal.addEventListener(
            "click",
            closeEditModal
        );

    }


    // Cancel edit
    if (cancelEditBtn) {

        cancelEditBtn.addEventListener(
            "click",
            closeEditModal
        )

    }


    // Close modal when clicking outside
    window.addEventListener(

        "click",

        (event) => {

            if (event.target === editModal) {

                closeEditModal();

            }

        }

    );
}

// ============================================
// LOAD ASSETS FROM BACKEND
// ============================================

async function loadAssets() {

    try {

        if (loadingMessage) {

            loadingMessage.style.display =
                "block";

        }


        if (assetsContainer) {

            assetsContainer.innerHTML = "";

        }

         // DEBUG: Check token before API request
        console.log("TOKEN BEFORE ASSETS:", authToken);

        console.log(
            "STORED TOKEN:",
            localStorage.getItem("cloudasset_token")
        );

        console.log(
            "HEADERS SENT:",
            getAuthHeaders()
        );


        const response =
            await fetch(
                `${API_BASE_URL}/assets`,
                {
                    headers: getAuthHeaders()
                }
            );


        if (response.status === 401) {

            handleUnauthorized();

            return;

        }


        if (!response.ok) {

            throw new Error(
                "Failed to fetch assets"
            );

        }


        const assets =
            await response.json();


        allAssets = assets;

        filteredAssets = assets;

        currentPage = 1;


        if (loadingMessage) {

            loadingMessage.style.display =
                "none";

        }


         updateAllPages();

         await loadDashboardStats();

          displayAssets(filteredAssets);


    } catch (error) {

        console.error(
            "Error loading assets:",
            error
        );


        if (loadingMessage) {

            loadingMessage.style.display =
                "none";

        }


        showMessage(
            "error",
            `Unable to connect to backend: ${error.message}`
        );

    }

}

// ============================================
// LOAD DASHBOARD STATISTICS
// ============================================

async function loadDashboardStats() {

    try {

        const response = await fetch(
            `${API_BASE_URL}/assets/dashboard`,
            {
                headers: getAuthHeaders()
            }
        );

        if (!response.ok) {

            throw new Error(
                "Failed to load dashboard statistics"
            );

        }

        const data = await response.json();

        console.log(
            "Dashboard Stats:",
            data
        );


        // UPDATE RUNNING

        setText(
            "runningCount",
            data.running || 0
        );


        // UPDATE TERMINATED

        setText(
            "terminatedCount",
            data.terminated || 0
        );


        // UPDATE OVERDUE

        setText(
            "overdueCount",
            data.overdue || 0
        );


        // UPDATE TOTAL

        setText(
            "totalCount",
            data.total || 0
        );


    } catch (error) {

        console.error(
            "Dashboard error:",
            error
        );

    }

}


// ============================================
// UPDATE ALL DASHBOARDS
// ============================================

function updateAllPages() {

    updateDashboard();

    updateCostOverview();

    updateAnalytics();

}


// ============================================
// DASHBOARD
// ============================================

function updateDashboard() {

    const totalAssets =
        allAssets.length;


    const activeAssets =
        allAssets.filter(
            asset =>
                asset.status === "Running" ||
                asset.status === "Active"
        ).length;


    const totalCost =
        allAssets.reduce(
            (total, asset) =>
                total +
                (parseFloat(asset.cost) || 0),
            0
        );


    const providers =
        new Set(
            allAssets
                .map(asset => asset.provider)
                .filter(Boolean)
        ).size;


    setText(
        "dashTotalAssets",
        totalAssets
    );


    setText(
        "dashActiveAssets",
        activeAssets
    );


    setText(
        "dashTotalCost",
        `$${totalCost.toFixed(2)}`
    );


    setText(
        "dashProviders",
        providers
    );


    setText(
    "runningCount",
    allAssets.filter(
        a =>
            a.status &&
            a.status.toLowerCase() === "running"
    ).length
);

    setText(
        "stoppedCount",
        allAssets.filter(
            a => a.status === "Stopped"
        ).length
    );


    setText(
        "inactiveCount",
        allAssets.filter(
            a =>
                a.status === "Inactive" ||
                a.status === "Terminated"
        ).length
    );


    updateRecentAssets();

}


// ============================================
// RECENT ASSETS
// ============================================

function updateRecentAssets() {

    const container =
        document.getElementById(
            "recentAssets"
        );


    if (!container) return;


    if (allAssets.length === 0) {

        container.innerHTML = `
            <p class="empty-state">
                No assets available yet.
            </p>
        `;

        return;

    }


    const recentAssets =
        [...allAssets]
            .sort(
                (a, b) =>
                    new Date(
                        b.created_at || 0
                    ) -
                    new Date(
                        a.created_at || 0
                    )
            )
            .slice(0, 5);


    container.innerHTML =
        recentAssets.map(
            asset => `

            <div class="recent-asset">

                <div>

                    <strong>
                        ${escapeHTML(asset.asset_name || "Unnamed Asset")}
                    </strong>

                    <span>
                        ${escapeHTML(asset.provider || "Unknown")}
                        •
                        ${escapeHTML(asset.service || "Unknown")}
                    </span>

                </div>


                <div class="recent-asset-cost">

                    $${formatCost(asset.cost)}

                </div>

            </div>

        `
        ).join("");

}


// ============================================
// ASSET DISPLAY + PAGINATION
// ============================================

function displayAssets(assets) {

    if (!assetsContainer) return;


    if (!assets || assets.length === 0) {

        assetsContainer.innerHTML = `
            <div class="empty-state">

                <h3>No Assets Found</h3>

                <p>
                    Add your first cloud asset
                    or adjust your filters.
                </p>

            </div>
        `;


        updatePagination(0);

        return;

    }


    const startIndex =
        (currentPage - 1) *
        assetsPerPage;


    const endIndex =
        startIndex +
        assetsPerPage;


    const pageAssets =
        assets.slice(
            startIndex,
            endIndex
        );


    assetsContainer.innerHTML =
        pageAssets.map(
            asset => `

            <div class="asset-card">

                <div class="asset-card-header">

                    <div>

                        <h3>
                            ${escapeHTML(asset.asset_name || "Unnamed Asset")}
                        </h3>

                        <span class="asset-id">
                            ID #${asset.id}
                        </span>

                    </div>


                    <span class="status-badge status-${String(asset.status || "").toLowerCase()}">

                        ${escapeHTML(asset.status || "Unknown")}

                    </span>

                </div>


                <div class="asset-info">

                    <div class="asset-info-item">

                        <span>
                            Provider
                        </span>

                        <strong>
                            ${escapeHTML(asset.provider || "N/A")}
                        </strong>

                    </div>


                    <div class="asset-info-item">

                        <span>
                            Service
                        </span>

                        <strong>
                            ${escapeHTML(asset.service || "N/A")}
                        </strong>

                    </div>


                    <div class="asset-info-item">

                        <span>
                            Region
                        </span>

                        <strong>
                            ${escapeHTML(asset.region || "N/A")}
                        </strong>

                    </div>


                    <div class="asset-info-item">

                        <span>
                            Owner
                        </span>

                        <strong>
                            ${escapeHTML(asset.owner || "N/A")}
                        </strong>

                    </div>

                </div>


                <div class="asset-cost">

                    <span>
                        Monthly Cost
                    </span>

                    <strong>
                        $${formatCost(asset.cost)}
                    </strong>

                </div>

                <div class="asset-info-item">

    <span>
        Due Date
    </span>

    <strong>
        ${asset.due_date
            ? escapeHTML(asset.due_date)
            : "No Due Date"}
    </strong>

</div>


                <div class="asset-actions">

                    ${isAdmin() ? `
                        <button
                            class="btn btn-edit edit-btn"
                            onclick="openEditModal(${asset.id})">

                            Edit

                        </button>

                        <button
                            class="btn btn-danger delete-btn"
                            onclick="deleteAsset(${asset.id})">

                            Delete

                        </button>
                    ` : `
                        <span class="view-only-label">
                            View Only
                        </span>
                    `}

                </div>

            </div>

        `
        ).join("");


    updatePagination(assets.length);

}


// ============================================
// PAGINATION
// ============================================

function updatePagination(totalAssets) {

    const paginationContainer =
        document.getElementById(
            "paginationContainer"
        );


    const pageNumbers =
        document.getElementById(
            "pageNumbers"
        );


    const prevPage =
        document.getElementById(
            "prevPage"
        );


    const nextPage =
        document.getElementById(
            "nextPage"
        );


    if (!paginationContainer) return;


    const totalPages =
        Math.ceil(
            totalAssets /
            assetsPerPage
        );


    if (totalPages <= 1) {

        paginationContainer.style.display =
            "none";

        return;

    }


    paginationContainer.style.display =
        "flex";


    if (pageNumbers) {

        pageNumbers.innerHTML = "";


        for (
            let page = 1;
            page <= totalPages;
            page++
        ) {

            const button =
                document.createElement(
                    "button"
                );


            button.textContent = page;

            button.className =
                "page-number";


            if (
                page === currentPage
            ) {

                button.classList.add(
                    "active"
                );

            }


            button.addEventListener(
                "click",
                () => {

                    currentPage = page;

                    displayAssets(
                        filteredAssets
                    );

                }
            );


            pageNumbers.appendChild(
                button
            );

        }

    }


    if (prevPage) {

        prevPage.disabled =
            currentPage === 1;

    }


    if (nextPage) {

        nextPage.disabled =
            currentPage === totalPages;

    }

}


// ============================================
// SEARCH + FILTER
// ============================================

function filterAssets() {

    const searchTerm =
        (
            document
                .getElementById(
                    "searchInput"
                )
                ?.value ||
            ""
        )
            .toLowerCase()
            .trim();


    const provider =
        document
            .getElementById(
                "filterProvider"
            )
            ?.value || "";


    const status =
        document
            .getElementById(
                "filterStatus"
            )
            ?.value || "";


    const owner =
        document
            .getElementById(
                "filterOwner"
            )
            ?.value || "";


    filteredAssets =
        allAssets.filter(
            asset => {

                const matchesSearch =
                    !searchTerm ||
                    (
                        asset.asset_name &&
                        asset.asset_name
                            .toLowerCase()
                            .includes(
                                searchTerm
                            )
                    );


                const matchesProvider =
                    !provider ||
                    asset.provider ===
                    provider;


                const matchesStatus =
                    !status ||
                    asset.status ===
                    status;


                const matchesOwner =
                    !owner ||
                    asset.owner ===
                    owner;


                return (
                    matchesSearch &&
                    matchesProvider &&
                    matchesStatus &&
                    matchesOwner
                );

            }
        );


    currentPage = 1;

    displayAssets(
        filteredAssets
    );

}


// ============================================
// CLEAR FILTERS
// ============================================

function clearFilters() {

    const ids = [

        "searchInput",

        "filterProvider",

        "filterStatus",

        "filterOwner"

    ];


    ids.forEach(
        id => {

            const element =
                document.getElementById(
                    id
                );

            if (element) {

                element.value = "";

            }

        }
    );


    filteredAssets =
        allAssets;


    currentPage = 1;


    displayAssets(
        filteredAssets
    );

}


// ============================================
// ADD ASSET
// ============================================

async function handleAddAsset(event) {

    event.preventDefault();


    if (!isAdmin()) {

        showMessage(
            "error",
            "Admin access required"
        );

        return;

    }


    const formData =
        new FormData(
            addAssetForm
        );


    const assetData = {

    asset_name:
        formData
            .get("assetName")
            .trim(),

    provider:
        formData.get("provider"),

    service:
        formData.get("service"),

    region:
        formData.get("region"),

    status:
        formData.get("status"),

    owner:
        formData.get("owner"),

    cost:
        parseFloat(
            formData.get("cost")
        ) || 0,

    due_date:
        formData.get("due_date") 

};
console.log("DATE:", assetData.due_date);

    try {

        const response =
            await fetch(
                `${API_BASE_URL}/assets`,
                {

                    method: "POST",

                    headers: getAuthHeaders(),

                    body:
                        JSON.stringify(
                            assetData
                        )

                }
            );


        const result =
            await response.json();


        if (!response.ok) {

            throw new Error(
                result.error ||
                "Failed to add asset"
            );

        }


        showMessage(
            "success",
            "Asset added successfully!"
        );


        addAssetForm.reset();


        await loadAssets();

        console.log("LOGIN TOKEN:", authToken);
console.log("STORED TOKEN:", localStorage.getItem("cloudasset_token"));
console.log("AUTH HEADERS:", getAuthHeaders());


    } catch (error) {

        console.error(error);


        showMessage(
            "error",
            error.message
        );

    }

}


// ============================================
// OPEN EDIT MODAL
// ============================================

async function openEditModal(assetId) {

    if (!isAdmin()) {

        showMessage(
            "error",
            "Admin access required"
        );

        return;

    }


    try {

        const response =
            await fetch(
                `${API_BASE_URL}/assets/${assetId}`,
                {
                    headers: getAuthHeaders()
                }
            );


        if (!response.ok) {

            throw new Error(
                "Failed to load asset"
            );

        }


        const asset =
            await response.json();


        setValue(
            "editAssetId",
            asset.id
        );

        setValue(
            "editAssetName",
            asset.asset_name
        );

        setValue(
            "editProvider",
            asset.provider
        );

        setValue(
            "editService",
            asset.service
        );

        setValue(
            "editRegion",
            asset.region
        );

        setValue(
            "editStatus",
            asset.status
        );

        setValue(
            "editOwner",
            asset.owner
        );

        setValue(
            "editCost",
            asset.cost
        );


        editModal.style.display =
            "block";


    } catch (error) {

        showMessage(
            "error",
            error.message
        );

    }

}


// ============================================
// CLOSE EDIT MODAL
// ============================================

function closeEditModal() {

    if (editModal) {

        editModal.style.display =
            "none";

    }


    if (editAssetForm) {

        editAssetForm.reset();

    }

}


// ============================================
// UPDATE ASSET
// ============================================

async function handleEditAsset(event) {

    event.preventDefault();


    if (!isAdmin()) {

        showMessage(
            "error",
            "Admin access required"
        );

        return;

    }


    const assetId =
        document.getElementById(
            "editAssetId"
        ).value;
        const assetData = {
    asset_name: formData.get("assetName").trim(),

    provider: formData.get("provider"),

    service: formData.get("service"),

    region: formData.get("region"),

    status: formData.get("status"),

    owner: formData.get("owner"),

    cost: parseFloat(formData.get("cost")) || 0,

    due_date: formData.get("due_date") || null
};


    try {

        const response =
            await fetch(
                `${API_BASE_URL}/assets/${assetId}`,
                {

                    method: "PUT",

                    headers:
                        getAuthHeaders(),

                    body:
                        JSON.stringify(
                            assetData
                        )

                }
            );


        const result =
            await response.json();


        if (response.status === 401) {

            handleUnauthorized();

            return;

        }


        if (!response.ok) {

            throw new Error(
                result.error ||
                "Failed to update asset"
            );

        }


        showMessage(
            "success",
            "Asset updated successfully!"
        );


        closeEditModal();


        await loadAssets();


    } catch (error) {

        console.error(
            "Update error:",
            error
        );


        showMessage(
            "error",
            error.message ||
            "Unable to update asset"
        );

    }

}


// ============================================
// DELETE ASSET
// ============================================

async function deleteAsset(assetId) {

    if (!isAdmin()) {

        showMessage(
            "error",
            "Admin access required"
        );

        return;

    }


    const confirmed =
        confirm(
            "Are you sure you want to delete this asset?"
        );


    if (!confirmed) {

        return;

    }


    try {

        const response =
            await fetch(
                `${API_BASE_URL}/assets/${assetId}`,
                {

                    method: "DELETE",

                    headers:
                        getAuthHeaders()

                }
            );


        const result =
            await response.json();


        if (response.status === 401) {

            handleUnauthorized();

            return;

        }


        if (!response.ok) {

            throw new Error(
                result.error ||
                result.message ||
                "Failed to delete asset"
            );

        }


        showMessage(
            "success",
            "Asset deleted successfully!"
        );


        await loadAssets();


    } catch (error) {

        console.error(
            "Delete error:",
            error
        );


        showMessage(
            "error",
            error.message ||
            "Unable to delete asset"
        );

    }

}


// ============================================
// MESSAGE HANDLING
// ============================================

function showMessage(
    type,
    message
) {

    const target =
        type === "success"
            ? successMessage
            : errorMessage;


    if (!target) {

        console.log(
            `${type}: ${message}`
        );

        return;

    }


    target.textContent =
        message;


    target.style.display =
        "block";


    setTimeout(
        () => {

            target.style.display =
                "none";

        },
        5000
    );

}


// ============================================
// SET TEXT HELPER
// ============================================

function setText(
    elementId,
    value
) {

    const element =
        document.getElementById(
            elementId
        );


    if (element) {

        element.textContent =
            value;

    }

}


// ============================================
// SET FORM VALUE HELPER
// ============================================

function setValue(
    elementId,
    value
) {

    const element =
        document.getElementById(
            elementId
        );


    if (element) {

        element.value =
            value ?? "";

    }

}


// ============================================
// FORMAT COST
// ============================================

function formatCost(cost) {

    const value =
        parseFloat(cost) || 0;


    return value.toFixed(2);

}


// ============================================
// HTML ESCAPE
// ============================================

function escapeHTML(value) {

    if (
        value === null ||
        value === undefined
    ) {

        return "";

    }


    const div =
        document.createElement(
            "div"
        );


    div.textContent =
        String(value);


    return div.innerHTML;

}


// ============================================
// COST OVERVIEW
// ============================================

function updateCostOverview() {

    const totalCost =
        allAssets.reduce(
            (total, asset) => {

                return (
                    total +
                    (
                        parseFloat(
                            asset.cost
                        ) || 0
                    )
                );

            },
            0
        );


    setText(
        "totalMonthlyCost",
        `$${totalCost.toFixed(2)}`
    );


    setText(
        "totalAnnualCost",
        `$${(totalCost * 12).toFixed(2)}`
    );


    updateProviderCosts();

    updateServiceCosts();

}


// ============================================
// PROVIDER COST BREAKDOWN
// ============================================

function updateProviderCosts() {

    const container =
        document.getElementById(
            "providerCosts"
        );


    if (!container) {

        return;

    }


    const providerData = {};


    allAssets.forEach(
        asset => {

            const provider =
                asset.provider ||
                "Unknown";


            if (!providerData[provider]) {

                providerData[provider] = 0;

            }


            providerData[provider] +=
                parseFloat(
                    asset.cost
                ) || 0;

        }
    );


    const entries =
        Object.entries(
            providerData
        );


    if (entries.length === 0) {

        container.innerHTML = `
            <p class="empty-state">
                No cost data available.
            </p>
        `;

        return;

    }


    container.innerHTML =
        entries.map(
            ([provider, cost]) => `

            <div class="cost-row">

                <span>
                    ${escapeHTML(provider)}
                </span>

                <strong>
                    $${formatCost(cost)}
                </strong>

            </div>

        `
        ).join("");

}


// ============================================
// SERVICE COST BREAKDOWN
// ============================================

function updateServiceCosts() {

    const container =
        document.getElementById(
            "serviceCosts"
        );


    if (!container) {

        return;

    }


    const serviceData = {};


    allAssets.forEach(
        asset => {

            const service =
                asset.service ||
                "Unknown";


            if (!serviceData[service]) {

                serviceData[service] = 0;

            }


            serviceData[service] +=
                parseFloat(
                    asset.cost
                ) || 0;

        }
    );


    const entries =
        Object.entries(
            serviceData
        )
        .sort(
            (a, b) =>
                b[1] - a[1]
        );


    if (entries.length === 0) {

        container.innerHTML = `
            <p class="empty-state">
                No service cost data available.
            </p>
        `;

        return;

    }


    container.innerHTML =
        entries.map(
            ([service, cost]) => `

            <div class="cost-row">

                <span>
                    ${escapeHTML(service)}
                </span>

                <strong>
                    $${formatCost(cost)}
                </strong>

            </div>

        `
        ).join("");

}


// ============================================
// ANALYTICS
// ============================================

function updateAnalytics() {

    updateStatusAnalytics();

    updateProviderAnalytics();

    updateServiceAnalytics();

}


// ============================================
// STATUS ANALYTICS
// ============================================

function updateStatusAnalytics() {

    const container =
        document.getElementById(
            "statusAnalytics"
        );


    if (!container) {

        return;

    }


    const statusData = {};


    allAssets.forEach(
        asset => {

            const status =
                asset.status ||
                "Unknown";


            if (!statusData[status]) {

                statusData[status] = 0;

            }


            statusData[status]++;

        }
    );


    const entries =
        Object.entries(
            statusData
        );


    const total =
        allAssets.length;


    if (total === 0) {

        container.innerHTML = `
            <p class="empty-state">
                No analytics available.
            </p>
        `;

        return;

    }


    container.innerHTML =
        entries.map(
            ([status, count]) => {

                const percentage =
                    (
                        count /
                        total *
                        100
                    ).toFixed(1);


                return `

                <div class="analytics-row">

                    <div class="analytics-label">

                        <span>
                            ${escapeHTML(status)}
                        </span>

                        <strong>
                            ${count}
                        </strong>

                    </div>

                    <div class="progress-bar">

                        <div
                            class="progress-fill"
                            style="width: ${percentage}%"
                        ></div>

                    </div>

                    <small>
                        ${percentage}%
                    </small>

                </div>

                `;

            }
        ).join("");

}
    // ============================================
// PROVIDER ANALYTICS
// ============================================

function updateProviderAnalytics() {

    const container =
        document.getElementById(
            "providerAnalytics"
        );

    if (!container) return;


    const providerData = {};


    allAssets.forEach(
        asset => {

            const provider =
                asset.provider ||
                "Unknown";


            providerData[provider] =
                (providerData[provider] || 0) + 1;

        }
    );


    const entries =
        Object.entries(
            providerData
        );


    if (entries.length === 0) {

        container.innerHTML = `
            <p class="empty-state">
                No provider data available.
            </p>
        `;

        return;

    }


    const total =
        allAssets.length;


    container.innerHTML =
        entries.map(
            ([provider, count]) => {

                const percentage =
                    (
                        count /
                        total *
                        100
                    ).toFixed(1);


                return `

                <div class="analytics-row">

                    <div class="analytics-label">

                        <span>
                            ${escapeHTML(provider)}
                        </span>

                        <strong>
                            ${count}
                        </strong>

                    </div>

                    <div class="progress-bar">

                        <div
                            class="progress-fill"
                            style="width: ${percentage}%"
                        ></div>

                    </div>

                    <small>
                        ${percentage}%
                    </small>

                </div>

                `;

            }
        ).join("");

}


// ============================================
// SERVICE ANALYTICS
// ============================================

function updateServiceAnalytics() {

    const container =
        document.getElementById(
            "serviceAnalytics"
        );


    if (!container) return;


    const serviceData = {};


    allAssets.forEach(
        asset => {

            const service =
                asset.service ||
                "Unknown";


            serviceData[service] =
                (serviceData[service] || 0) + 1;

        }
    );


    const entries =
        Object.entries(
            serviceData
        );


    if (entries.length === 0) {

        container.innerHTML = `
            <p class="empty-state">
                No service data available.
            </p>
        `;

        return;

    }


    container.innerHTML =
        entries.map(
            ([service, count]) => `

            <div class="analytics-row">

                <div class="analytics-label">

                    <span>
                        ${escapeHTML(service)}
                    </span>

                    <strong>
                        ${count}
                    </strong>

                </div>

            </div>

        `
        ).join("");

}
// ============================================
// UPDATE COST OVERVIEW
// ============================================

function updateCostOverview() {

    const totalElement =
        document.getElementById("costOverviewTotal");

    const averageElement =
        document.getElementById("averageCost");

    const highestElement =
        document.getElementById("highestCost");

    const highestNameElement =
        document.getElementById("highestCostName");

    const providerContainer =
        document.getElementById("costByProvider");

    const serviceContainer =
        document.getElementById("costByService");

    const expensiveContainer =
        document.getElementById("expensiveAssets");


    // Safety check
    if (
        !totalElement ||
        !averageElement ||
        !highestElement ||
        !highestNameElement ||
        !providerContainer ||
        !serviceContainer ||
        !expensiveContainer
    ) {

        return;

    }


    const assets =
        Array.isArray(allAssets)
            ? allAssets
            : [];


    // No assets available
    if (assets.length === 0) {

        totalElement.textContent = "$0.00";
        averageElement.textContent = "$0.00";
        highestElement.textContent = "$0.00";
        highestNameElement.textContent = "No assets";

        providerContainer.innerHTML =
            "No cost data available.";

        serviceContainer.innerHTML =
            "No cost data available.";

        expensiveContainer.innerHTML =
            "<p class='empty-state'>No assets available.</p>";

        return;

    }


    // Calculate totals
    let totalCost = 0;

    let highestAsset = null;

    const providerCosts = {};

    const serviceCosts = {};


    assets.forEach((asset) => {

        const cost =
            Number(asset.cost) || 0;


        totalCost += cost;


        // Highest cost asset
        if (
            !highestAsset ||
            cost > (Number(highestAsset.cost) || 0)
        ) {

            highestAsset = asset;

        }


        // Cost by provider
        const provider =
            asset.provider || "Unknown";

        providerCosts[provider] =
            (providerCosts[provider] || 0) +
            cost;


        // Cost by service
        const service =
            asset.service || "Unknown";

        serviceCosts[service] =
            (serviceCosts[service] || 0) +
            cost;

    });


    // Update summary cards
    totalElement.textContent =
        `$${totalCost.toFixed(2)}`;


    averageElement.textContent =
        `$${(totalCost / assets.length).toFixed(2)}`;


    highestElement.textContent =
        highestAsset
            ? `$${(Number(highestAsset.cost) || 0).toFixed(2)}`
            : "$0.00";


    highestNameElement.textContent =
        highestAsset
            ? (
                highestAsset.name ||
                highestAsset.asset_name ||
                "Unnamed Asset"
            )
            : "No assets";


    // Display cost by provider
    providerContainer.innerHTML =
        Object.entries(providerCosts)
            .sort((a, b) => b[1] - a[1])
            .map(
                ([provider, cost]) => `

                    <div class="analytics-row">

                        <div class="analytics-label">

                            <span>
                                ${escapeHTML(provider)}
                            </span>

                            <strong>
                                $${cost.toFixed(2)}
                            </strong>

                        </div>

                    </div>

                `
            )
            .join("");


    // Display cost by service
    serviceContainer.innerHTML =
        Object.entries(serviceCosts)
            .sort((a, b) => b[1] - a[1])
            .map(
                ([service, cost]) => `

                    <div class="analytics-row">

                        <div class="analytics-label">

                            <span>
                                ${escapeHTML(service)}
                            </span>

                            <strong>
                                $${cost.toFixed(2)}
                            </strong>

                        </div>

                    </div>

                `
            )
            .join("");


    // Most expensive assets
    const sortedAssets =
        [...assets]
            .sort(
                (a, b) =>
                    (Number(b.cost) || 0) -
                    (Number(a.cost) || 0)
            )
            .slice(0, 5);


    expensiveContainer.innerHTML =
        sortedAssets.map(
            (asset) => {

                const cost =
                    Number(asset.cost) || 0;

                const name =
                    asset.name ||
                    asset.asset_name ||
                    "Unnamed Asset";


                return `

                    <div class="analytics-row">

                        <div class="analytics-label">

                            <span>
                                ${escapeHTML(name)}
                            </span>

                            <strong>
                                $${cost.toFixed(2)}
                            </strong>

                        </div>

                    </div>

                `;

            }
        ).join("");

}
// ============================================
// PAGE NAVIGATION
// ============================================

function setupNavigation() {

    const navItems =
        document.querySelectorAll(".nav-item");

    const pages =
        document.querySelectorAll(".page");


    const pageTitles = {

        dashboard: {
            title: "Dashboard",
            subtitle: "Overview of your cloud infrastructure"
        },

        assets: {
            title: "Assets",
            subtitle: "Manage your cloud infrastructure"
        },

        costs: {
            title: "Cost Overview",
            subtitle: "Monitor your cloud spending"
        },

        analytics: {
            title: "Analytics",
            subtitle: "Infrastructure insights and statistics"
        },

        settings: {
            title: "Settings",
            subtitle: "Manage your application preferences"
        }

    };


    function showPage(pageName) {

        // Hide all pages
        pages.forEach((page) => {

            page.classList.remove("active-page");

        });


        // Find selected page
        const selectedPage =
            document.getElementById(pageName);


        if (!selectedPage) {

            console.error(
                "Page not found:",
                pageName
            );

            return;

        }


        // Show selected page
        selectedPage.classList.add("active-page");
        if (pageName === "costs") {

    updateCostOverview();

}
   

        // Update sidebar
        navItems.forEach((item) => {

            item.classList.remove("active");

        });


        const activeButton =
            document.querySelector(
                `.nav-item[data-page="${pageName}"]`
            );


        if (activeButton) {

            activeButton.classList.add("active");

        }


        // Update page heading
        const pageTitle =
            document.getElementById("pageTitle");

        const pageSubtitle =
            document.getElementById("pageSubtitle");


        const pageData =
            pageTitles[pageName];


        if (pageData) {

            if (pageTitle) {

                pageTitle.textContent =
                    pageData.title;

            }


            if (pageSubtitle) {

                pageSubtitle.textContent =
                    pageData.subtitle;

            }

        }

    }


    // Navigation button clicks
    navItems.forEach((item) => {

        item.addEventListener(
            "click",
            () => {

                const pageName =
                    item.dataset.page;

                showPage(pageName);

            }
        );

    });


    // Start on Dashboard
    showPage("dashboard");

}
// ============================================
// UPDATE PAGE HEADER
// ============================================

function updatePageHeader(pageName) {

    const pageTitle =
        document.getElementById(
            "pageTitle"
        );


    const pageSubtitle =
        document.getElementById(
            "pageSubtitle"
        );


    if (
        !pageTitle ||
        !pageSubtitle
    ) return;


    const pageData = {

        dashboard: {

            title:
                "Dashboard",

            subtitle:
                "Overview of your cloud infrastructure"

        },


        assets: {

            title:
                "Assets",

            subtitle:
                "Manage your cloud resources"

        },


        costs: {

            title:
                "Cost Overview",

            subtitle:
                "Monitor your cloud spending"

        },


        analytics: {

            title:
                "Analytics",

            subtitle:
                "Analyze your cloud infrastructure"

        },


        settings: {

            title:
                "Settings",

            subtitle:
                "Manage application preferences"

        }

    };


    const current =
        pageData[pageName];


    if (current) {

        pageTitle.textContent =
            current.title;


        pageSubtitle.textContent =
            current.subtitle;

    }

}


// ============================================
// SIDEBAR TOGGLE
// ============================================

const menuToggle =
    document.getElementById(
        "menuToggle"
    );


const sidebar =
    document.getElementById(
        "sidebar"
    );


if (menuToggle && sidebar) {

    menuToggle.addEventListener(
        "click",
        () => {

            sidebar.classList.toggle(
                "collapsed"
            );

        }
    );

}


// ============================================
// THEME
// ============================================

const themeToggle =
    document.getElementById(
        "themeToggle"
    );


function loadTheme() {

    const savedTheme =
        localStorage.getItem(
            "cloudasset_theme"
        );


    if (savedTheme === "dark") {

        document.body.classList.add(
            "dark-mode"
        );


        if (themeToggle) {

            themeToggle.textContent =
                "☀️";

        }

    }

}


if (themeToggle) {

    themeToggle.addEventListener(
        "click",
        () => {

            document.body.classList.toggle(
                "dark-mode"
            );


            const isDark =
                document.body.classList.contains(
                    "dark-mode"
                );


            localStorage.setItem(

                "cloudasset_theme",

                isDark
                    ? "dark"
                    : "light"

            );


            themeToggle.textContent =
                isDark
                    ? "☀️"
                    : "🌙";

        }
    );

}


// ============================================
// COST ESTIMATION
// ============================================

function calculateEstimatedCost(
    provider,
    service,
    status,
    region
) {

    if (
        !provider ||
        !service
    ) {

        return 0;

    }


    const providerData =
        COST_ESTIMATES[
            provider
        ];


    if (!providerData) {

        return 0;

    }


    const serviceData =
        providerData[
            service
        ];


    if (!serviceData) {

        return 0;

    }


    const normalizedStatus =
        String(status || "")
            .toLowerCase();


    let baseCost =
        serviceData[
            normalizedStatus
        ];


    if (
        baseCost === undefined
    ) {

        baseCost =
            serviceData.running || 0;

    }


    const multiplier =
        REGION_MULTIPLIERS[
            region
        ] || 1;


    return (
        baseCost *
        multiplier
    ).toFixed(2);

}


// ============================================
// AUTO COST ESTIMATION
// ============================================

function setupCostEstimator() {

    const providerInput =
        document.getElementById(
            "provider"
        );


    const serviceInput =
        document.getElementById(
            "service"
        );


    const statusInput =
        document.getElementById(
            "status"
        );


    const regionInput =
        document.getElementById(
            "region"
        );


    const costInput =
        document.getElementById(
            "cost"
        );


    if (
        !providerInput ||
        !serviceInput ||
        !statusInput ||
        !regionInput ||
        !costInput
    ) {

        return;

    }


    const updateEstimatedCost =
        () => {

            const estimatedCost =
                calculateEstimatedCost(

                    providerInput.value,

                    serviceInput.value,

                    statusInput.value,

                    regionInput.value

                );


            if (
                estimatedCost > 0
            ) {

                costInput.value =
                    estimatedCost;

            }

        };


    providerInput.addEventListener(
        "change",
        updateEstimatedCost
    );


    serviceInput.addEventListener(
        "change",
        updateEstimatedCost
    );


    statusInput.addEventListener(
        "change",
        updateEstimatedCost
    );


    regionInput.addEventListener(
        "change",
        updateEstimatedCost
    );

}


// ============================================
// EDIT FORM COST ESTIMATION
// ============================================

function setupEditCostEstimator() {

    const providerInput =
        document.getElementById(
            "editProvider"
        );


    const serviceInput =
        document.getElementById(
            "editService"
        );


    const statusInput =
        document.getElementById(
            "editStatus"
        );


    const regionInput =
        document.getElementById(
            "editRegion"
        );


    const costInput =
        document.getElementById(
            "editCost"
        );


    if (
        !providerInput ||
        !serviceInput ||
        !statusInput ||
        !regionInput ||
        !costInput
    ) {

        return;

    }


    const updateEstimatedCost =
        () => {

            const estimatedCost =
                calculateEstimatedCost(

                    providerInput.value,

                    serviceInput.value,

                    statusInput.value,

                    regionInput.value

                );


            if (
                estimatedCost > 0
            ) {

                costInput.value =
                    estimatedCost;

            }

        };


    providerInput.addEventListener(
        "change",
        updateEstimatedCost
    );


    serviceInput.addEventListener(
        "change",
        updateEstimatedCost
    );


    statusInput.addEventListener(
        "change",
        updateEstimatedCost
    );


    regionInput.addEventListener(
        "change",
        updateEstimatedCost
    );

}


// ============================================
// INITIALIZE COST ESTIMATORS
// ============================================
document.addEventListener(
    "DOMContentLoaded",
    () => {

        // Password show/hide
        setupPasswordToggle();

        // Cost estimators
        setupCostEstimator();

        setupEditCostEstimator();

    }
);
// ============================================
// SEARCH INPUT LISTENER
// ============================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        const searchInput =
            document.getElementById(
                "searchInput"
            );


        if (searchInput) {

            searchInput.addEventListener(
                "input",
                filterAssets
            );

        }


        const providerFilter =
            document.getElementById(
                "filterProvider"
            );


        if (providerFilter) {

            providerFilter.addEventListener(
                "change",
                filterAssets
            );

        }


        const statusFilter =
            document.getElementById(
                "filterStatus"
            );


        if (statusFilter) {

            statusFilter.addEventListener(
                "change",
                filterAssets
            );

        }


        const ownerFilter =
            document.getElementById(
                "filterOwner"
            );


        if (ownerFilter) {

            ownerFilter.addEventListener(
                "change",
                filterAssets
            );

        }

    }
);


// ============================================
// PREVIOUS / NEXT PAGE
// ============================================

function previousPage() {

    if (currentPage > 1) {

        currentPage--;

        displayAssets(
            filteredAssets
        );

    }

}


function nextPage() {

    const totalPages =
        Math.ceil(
            filteredAssets.length /
            assetsPerPage
        );


    if (currentPage < totalPages) {

        currentPage++;

        displayAssets(
            filteredAssets
        );

    }

}


// ============================================
// WINDOW FUNCTIONS
// Required for HTML onclick events
// ============================================

window.openEditModal =
    openEditModal;


window.deleteAsset =
    deleteAsset;


window.logout =
    logout;


window.filterAssets =
    filterAssets;


window.clearFilters =
    clearFilters;


window.previousPage =
    previousPage;


window.nextPage =
    nextPage;


// ============================================
// REFRESH BUTTON
// ============================================

function refreshAssets() {

    loadAssets();

}


// ============================================
// UPDATE USER INTERFACE
// ============================================

function updateUserInterface() {

    if (!currentUser) {

        return;

    }


    // User name
    const userNameElements =
        document.querySelectorAll(
            "[data-user-name]"
        );


    userNameElements.forEach(
        element => {

            element.textContent =
                currentUser.username ||
                currentUser.name ||
                "User";

        }
    );


    // User role
    const userRoleElements =
        document.querySelectorAll(
            "[data-user-role]"
        );


    userRoleElements.forEach(
        element => {

            element.textContent =
                currentUser.role === "admin"
                    ? "Administrator"
                    : "Employee";

        }
    );


    applyRolePermissions();

}


// ============================================
// INITIALIZE APPLICATION
// ============================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        // Navigation
        setupNavigation();

        // Cost Estimators
        setupCostEstimator();
        setupEditCostEstimator();

        // Profile Dropdown + Logout
        setupProfileDropdown();

    }
);


// ============================================
// SECURITY NOTE
// ============================================
// Frontend role checks only control the UI.
// Your Flask backend must enforce permissions too.
//
// Admin:
//   GET assets
//   POST assets
//   PUT assets
//   DELETE assets
//
// Employee:
//   GET assets only
//
// Your backend JWT role protection is the
// actual security layer.
// ==========================================

// ============================================
// PASSWORD SHOW / HIDE TOGGLE
// ============================================

function setupPasswordToggle() {

    const passwordInput =
        document.getElementById("loginPassword");

    const passwordToggle =
        document.getElementById("passwordToggle");

    if (!passwordInput || !passwordToggle) {
        return;
    }

    passwordToggle.addEventListener("click", () => {

        if (passwordInput.type === "password") {

            passwordInput.type = "text";

            passwordToggle.setAttribute(
                "aria-label",
                "Hide password"
            );

        } else {

            passwordInput.type = "password";

            passwordToggle.setAttribute(
                "aria-label",
                "Show password"
            );

        }

    });

}
// ============================================
// NAVIGATE TO ASSETS
// ============================================

function navigateToAssets() {

    const assetsButton =
        document.querySelector(
            '[data-page="assets"]'
        );

    if (assetsButton) {

        assetsButton.click();

    } else {

        console.error(
            "Assets navigation button not found"
        );

    }

}

// ============================================
// PROFILE DROPDOWN + LOGOUT
// ============================================

function setupProfileDropdown() {

    const profileButton =
        document.getElementById("profileButton");

    const profileDropdown =
        document.getElementById("profileDropdown");

    const logoutButton =
        document.getElementById("logoutButton");


    if (!profileButton || !profileDropdown) {

        console.error(
            "Profile button or dropdown not found"
        );

        return;

    }


    // Open / Close dropdown
    profileButton.addEventListener(
        "click",
        (event) => {

            event.stopPropagation();

            profileDropdown.classList.toggle("show");

            profileButton.classList.toggle("active");

        }
    );


    // Logout
    if (logoutButton) {

        logoutButton.addEventListener(
            "click",
            (event) => {

                event.stopPropagation();

                logout();

            }
        );

    }


    // Close dropdown when clicking outside
    document.addEventListener(
        "click",
        (event) => {

            if (
                !profileButton.contains(event.target) &&
                !profileDropdown.contains(event.target)
            ) {

                profileDropdown.classList.remove("show");

                profileButton.classList.remove("active");

            }

        }
    );

}
// ============================================
// PROFILE DROPDOWN + LOGOUT
// ============================================

function setupProfileDropdown() {

    const profileButton =
        document.getElementById("profileButton");

    const profileDropdown =
        document.getElementById("profileDropdown");

    const logoutButton =
        document.getElementById("logoutButton");


    if (!profileButton || !profileDropdown) {

        console.error(
            "Profile button or dropdown not found"
        );

        return;

    }


    // Open / Close dropdown
    profileButton.addEventListener(
        "click",
        (event) => {

            event.stopPropagation();

            profileDropdown.classList.toggle("show");

            profileButton.classList.toggle("active");

        }
    );


    // Logout
    if (logoutButton) {

        logoutButton.addEventListener(
            "click",
            (event) => {

                event.stopPropagation();

                logout();

            }
        );

    }


    // Close dropdown when clicking outside
    document.addEventListener(
        "click",
        (event) => {

            if (
                !profileButton.contains(event.target) &&
                !profileDropdown.contains(event.target)
            ) {

                profileDropdown.classList.remove("show");

                profileButton.classList.remove("active");

            }

        }
    );
}