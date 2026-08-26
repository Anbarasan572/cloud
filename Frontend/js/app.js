// ============================================
// CLOUASSET - FRONTEND APPLICATION
// ============================================

// API Configuration
const API_BASE_URL =
    window.location.protocol === "file:"
        ? "http://127.0.0.1:5000"
         : `${window.location.origin}/api`;


// ============================================
// COST ESTIMATION
// ============================================

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
        EKS: { running: 80, stopped: 12 }
    },

    GCP: {
        EC2: { running: 48, stopped: 5 },
        RDS: { running: 75, stopped: 8 },
        S3: { running: 20, stopped: 20 },
        Lambda: { running: 12, stopped: 0 },
        ECS: { running: 42, stopped: 5 },
        EKS: { running: 72, stopped: 10 }
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
// INITIALIZE APPLICATION
// ============================================

document.addEventListener("DOMContentLoaded", () => {

    setupEventListeners();

    loadTheme();

    loadAssets();

});


// ============================================
// EVENT LISTENERS
// ============================================

function setupEventListeners() {

    if (addAssetForm) {
        addAssetForm.addEventListener(
            "submit",
            handleAddAsset
        );
    }


    if (editAssetForm) {
        editAssetForm.addEventListener(
            "submit",
            handleEditAsset
        );
    }


    if (refreshBtn) {
        refreshBtn.addEventListener(
            "click",
            loadAssets
        );
    }


    if (closeModal) {
        closeModal.addEventListener(
            "click",
            closeEditModal
        );
    }


    if (cancelEditBtn) {
        cancelEditBtn.addEventListener(
            "click",
            closeEditModal
        );
    }


    // Search

    const searchInput =
        document.getElementById("searchInput");

    if (searchInput) {

        searchInput.addEventListener(
            "input",
            filterAssets
        );

    }


    // Filters

    const filterProvider =
        document.getElementById("filterProvider");

    const filterStatus =
        document.getElementById("filterStatus");

    const filterOwner =
        document.getElementById("filterOwner");


    if (filterProvider) {
        filterProvider.addEventListener(
            "change",
            filterAssets
        );
    }


    if (filterStatus) {
        filterStatus.addEventListener(
            "change",
            filterAssets
        );
    }


    if (filterOwner) {
        filterOwner.addEventListener(
            "change",
            filterAssets
        );
    }


    // Clear filters

    const clearFiltersBtn =
        document.getElementById("clearFiltersBtn");

    if (clearFiltersBtn) {

        clearFiltersBtn.addEventListener(
            "click",
            clearFilters
        );

    }


    // Pagination

    const prevPage =
        document.getElementById("prevPage");

    const nextPage =
        document.getElementById("nextPage");


    if (prevPage) {

        prevPage.addEventListener(
            "click",
            () => {

                if (currentPage > 1) {

                    currentPage--;

                    displayAssets(filteredAssets);

                }

            }
        );

    }


    if (nextPage) {

        nextPage.addEventListener(
            "click",
            () => {

                const totalPages =
                    Math.ceil(
                        filteredAssets.length /
                        assetsPerPage
                    );

                if (currentPage < totalPages) {

                    currentPage++;

                    displayAssets(filteredAssets);

                }

            }
        );

    }


    // Close modal outside click

    window.addEventListener(
        "click",
        (event) => {

            if (event.target === editModal) {

                closeEditModal();

            }

        }
    );


    // Navigation

    setupNavigation();


    // Theme

    setupTheme();

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


        const response =
            await fetch(
                `${API_BASE_URL}/assets`
            );


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


    // Infrastructure summary

    setText(
        "runningCount",
        allAssets.filter(
            a => a.status === "Running"
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


                <div class="asset-actions">

                    <button
                        class="btn btn-edit"
                        onclick="openEditModal(${asset.id})">

                        Edit

                    </button>


                    <button
                        class="btn btn-danger"
                        onclick="deleteAsset(${asset.id})">

                        Delete

                    </button>

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
            formData
                .get("provider"),

        service:
            formData
                .get("service"),

        region:
            formData
                .get("region"),

        status:
            formData
                .get("status"),

        owner:
            formData
                .get("owner"),

        cost:
            parseFloat(
                formData.get("cost")
            ) || 0

    };


    try {

        const response =
            await fetch(
                `${API_BASE_URL}/assets`,
                {

                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

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

    try {

        const response =
            await fetch(
                `${API_BASE_URL}/assets/${assetId}`
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


    const assetId =
        document.getElementById(
            "editAssetId"
        ).value;


    const formData =
        new FormData(
            editAssetForm
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
            ) || 0

    };


    try {

        const response =
            await fetch(
                `${API_BASE_URL}/assets/${assetId}`,
                {

                    method: "PUT",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

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
                "Failed to update asset"
            );

        }


        closeEditModal();


        showMessage(
            "success",
            "Asset updated successfully!"
        );


        await loadAssets();


    } catch (error) {

        showMessage(
            "error",
            error.message
        );

    }

}


// ============================================
// DELETE ASSET
// ============================================

async function deleteAsset(assetId) {

    const confirmed =
        confirm(
            "Are you sure you want to delete this asset?"
        );


    if (!confirmed) return;


    try {

        const response =
            await fetch(
                `${API_BASE_URL}/assets/${assetId}`,
                {

                    method: "DELETE"

                }
            );


        const result =
            await response.json();


        if (!response.ok) {

            throw new Error(
                result.error ||
                "Failed to delete asset"
            );

        }


        showMessage(
            "success",
            "Asset deleted successfully!"
        );


        await loadAssets();


    } catch (error) {

        showMessage(
            "error",
            error.message
        );

    }

}


// ============================================
// COST OVERVIEW
// ============================================

function updateCostOverview() {

    const totalCost =
        allAssets.reduce(
            (total, asset) =>
                total +
                (parseFloat(asset.cost) || 0),
            0
        );


    const averageCost =
        allAssets.length
            ? totalCost /
              allAssets.length
            : 0;


    const highestAsset =
        [...allAssets]
            .sort(
                (a, b) =>
                    (parseFloat(b.cost) || 0) -
                    (parseFloat(a.cost) || 0)
            )[0];


    setText(
        "costOverviewTotal",
        `$${totalCost.toFixed(2)}`
    );


    setText(
        "averageCost",
        `$${averageCost.toFixed(2)}`
    );


    setText(
        "highestCost",
        highestAsset
            ? `$${formatCost(highestAsset.cost)}`
            : "$0.00"
    );


    setText(
        "highestCostName",
        highestAsset
            ? highestAsset.asset_name
            : "No assets"
    );


    updateCostByProvider();

    updateCostByService();

    updateExpensiveAssets();

}


// ============================================
// COST BY PROVIDER
// ============================================

function updateCostByProvider() {

    const container =
        document.getElementById(
            "costByProvider"
        );


    if (!container) return;


    const data = {};


    allAssets.forEach(
        asset => {

            const provider =
                asset.provider ||
                "Unknown";


            data[provider] =
                (data[provider] || 0) +
                (parseFloat(asset.cost) || 0);

        }
    );


    const entries =
        Object.entries(data);


    if (entries.length === 0) {

        container.innerHTML =
            `<p class="empty-state">
                No cost data available.
            </p>`;

        return;

    }


    container.innerHTML =
        entries.map(
            ([provider, cost]) => `

            <div class="cost-item">

                <span>
                    ${escapeHTML(provider)}
                </span>

                <strong>
                    $${cost.toFixed(2)}
                </strong>

            </div>

        `
        ).join("");

}


// ============================================
// COST BY SERVICE
// ============================================

function updateCostByService() {

    const container =
        document.getElementById(
            "costByService"
        );


    if (!container) return;


    const data = {};


    allAssets.forEach(
        asset => {

            const service =
                asset.service ||
                "Unknown";


            data[service] =
                (data[service] || 0) +
                (parseFloat(asset.cost) || 0);

        }
    );


    const entries =
        Object.entries(data);


    if (entries.length === 0) {

        container.innerHTML =
            `<p class="empty-state">
                No cost data available.
            </p>`;

        return;

    }


    container.innerHTML =
        entries.map(
            ([service, cost]) => `

            <div class="cost-item">

                <span>
                    ${escapeHTML(service)}
                </span>

                <strong>
                    $${cost.toFixed(2)}
                </strong>

            </div>

        `
        ).join("");

}


// ============================================
// EXPENSIVE ASSETS
// ============================================

function updateExpensiveAssets() {

    const container =
        document.getElementById(
            "expensiveAssets"
        );


    if (!container) return;


    const expensiveAssets =
        [...allAssets]
            .sort(
                (a, b) =>
                    (parseFloat(b.cost) || 0) -
                    (parseFloat(a.cost) || 0)
            )
            .slice(0, 5);


    if (expensiveAssets.length === 0) {

        container.innerHTML =
            `<p class="empty-state">
                No assets available.
            </p>`;

        return;

    }


    container.innerHTML =
        expensiveAssets.map(
            asset => `

            <div class="cost-item">

                <span>
                    ${escapeHTML(asset.asset_name)}
                </span>

                <strong>
                    $${formatCost(asset.cost)}
                </strong>

            </div>

        `
        ).join("");

}


// ============================================
// ANALYTICS
// ============================================

function updateAnalytics() {

    updateProviderAnalytics();

    updateStatusAnalytics();

}


function updateProviderAnalytics() {

    const container =
        document.getElementById(
            "providerAnalytics"
        );


    if (!container) return;


    const data = {};


    allAssets.forEach(
        asset => {

            const provider =
                asset.provider ||
                "Unknown";


            data[provider] =
                (data[provider] || 0) + 1;

        }
    );


    container.innerHTML =
        createAnalyticsHTML(data);

}


function updateStatusAnalytics() {

    const container =
        document.getElementById(
            "statusAnalytics"
        );


    if (!container) return;


    const data = {};


    allAssets.forEach(
        asset => {

            const status =
                asset.status ||
                "Unknown";


            data[status] =
                (data[status] || 0) + 1;

        }
    );


    container.innerHTML =
        createAnalyticsHTML(data);

}


function createAnalyticsHTML(data) {

    const entries =
        Object.entries(data);


    if (entries.length === 0) {

        return `
            <p class="empty-state">
                No analytics data available.
            </p>
        `;

    }


    const max =
        Math.max(
            ...entries.map(
                ([, value]) => value
            )
        );


    return entries.map(
        ([label, value]) => {

            const percentage =
                max
                    ? (value / max) * 100
                    : 0;


            return `

                <div class="analytics-item">

                    <div class="analytics-label">

                        <span>
                            ${escapeHTML(label)}
                        </span>

                        <strong>
                            ${value}
                        </strong>

                    </div>


                    <div class="analytics-bar">

                        <div
                            class="analytics-progress"
                            style="width:${percentage}%">
                        </div>

                    </div>

                </div>

            `;

        }
    ).join("");

}


// ============================================
// COST ESTIMATION
// ============================================

function estimateCost() {

    const provider =
        document.getElementById(
            "provider"
        ).value;


    const service =
        document.getElementById(
            "service"
        ).value;


    const region =
        document.getElementById(
            "region"
        ).value;


    const status =
        document.getElementById(
            "status"
        ).value;


    const cost =
        calculateCost(
            provider,
            service,
            region,
            status
        );


    document.getElementById(
        "cost"
    ).value =
        cost.toFixed(2);


    showMessage(
        "success",
        `Estimated monthly cost: $${cost.toFixed(2)}`
    );

}


function estimateEditCost() {

    const provider =
        document.getElementById(
            "editProvider"
        ).value;


    const service =
        document.getElementById(
            "editService"
        ).value;


    const region =
        document.getElementById(
            "editRegion"
        ).value;


    const status =
        document.getElementById(
            "editStatus"
        ).value;


    const cost =
        calculateCost(
            provider,
            service,
            region,
            status
        );


    document.getElementById(
        "editCost"
    ).value =
        cost.toFixed(2);

}


function calculateCost(
    provider,
    service,
    region,
    status
) {

    let baseCost = 30;


    if (
        COST_ESTIMATES[provider] &&
        COST_ESTIMATES[provider][service]
    ) {

        const serviceCost =
            COST_ESTIMATES[provider][service];


        if (
            status === "Stopped" ||
            status === "Inactive" ||
            status === "Terminated"
        ) {

            baseCost =
                serviceCost.stopped;

        } else {

            baseCost =
                serviceCost.running;

        }

    }


    const multiplier =
        REGION_MULTIPLIERS[region] ||
        1;


    return (
        baseCost *
        multiplier
    );

}


// ============================================
// NAVIGATION
// ============================================

function setupNavigation() {

    const navItems =
        document.querySelectorAll(
            ".nav-item"
        );


    const pages =
        document.querySelectorAll(
            ".page"
        );


    const pageTitles = {

        dashboard: {
            title: "Dashboard",
            subtitle:
                "Overview of your cloud infrastructure"
        },

        assets: {
            title: "Assets",
            subtitle:
                "Manage your cloud infrastructure"
        },

        costs: {
            title: "Cost Overview",
            subtitle:
                "Monitor your cloud spending"
        },

        analytics: {
            title: "Analytics",
            subtitle:
                "Infrastructure insights and statistics"
        },

        settings: {
            title: "Settings",
            subtitle:
                "Manage your application preferences"
        }

    };


    navItems.forEach(
        item => {

            item.addEventListener(
                "click",
                () => {

                    const pageName =
                        item.dataset.page;


                    navItems.forEach(
                        nav =>
                            nav.classList.remove(
                                "active"
                            )
                    );


                    item.classList.add(
                        "active"
                    );


                    pages.forEach(
                        page =>
                            page.classList.remove(
                                "active-page"
                            )
                    );


                    const selectedPage =
                        document.getElementById(
                            pageName
                        );


                    if (selectedPage) {

                        selectedPage.classList.add(
                            "active-page"
                        );

                    }


                    const titleData =
                        pageTitles[pageName];


                    if (titleData) {

                        setText(
                            "pageTitle",
                            titleData.title
                        );

                        setText(
                            "pageSubtitle",
                            titleData.subtitle
                        );

                    }


                    const sidebar =
                        document.getElementById(
                            "sidebar"
                        );


                    if (sidebar) {

                        sidebar.classList.remove(
                            "mobile-open"
                        );

                    }


                    window.scrollTo({
                        top: 0,
                        behavior: "smooth"
                    });

                }
            );

        }
    );


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
                    "mobile-open"
                );

            }
        );

    }

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

    }

}


// ============================================
// LIGHT / DARK MODE
// ============================================

function loadTheme() {

    const savedTheme =
        localStorage.getItem(
            "cloudasset-theme"
        );


    if (savedTheme === "dark") {

        document.body.classList.add(
            "dark-mode"
        );

        updateThemeIcon(true);

    }

}


function setupTheme() {

    const themeToggle =
        document.getElementById(
            "themeToggle"
        );


    const settingsThemeToggle =
        document.getElementById(
            "settingsThemeToggle"
        );


    if (themeToggle) {

        themeToggle.addEventListener(
            "click",
            toggleTheme
        );

    }


    if (settingsThemeToggle) {

        settingsThemeToggle.addEventListener(
            "click",
            toggleTheme
        );

    }

}


function toggleTheme() {

    document.body.classList.toggle(
        "dark-mode"
    );


    const isDark =
        document.body.classList.contains(
            "dark-mode"
        );


    localStorage.setItem(
        "cloudasset-theme",
        isDark
            ? "dark"
            : "light"
    );


    updateThemeIcon(isDark);

}


function updateThemeIcon(isDark) {

    const themeToggle =
        document.getElementById(
            "themeToggle"
        );


    if (themeToggle) {

        themeToggle.textContent =
            isDark
                ? "☀️"
                : "🌙";

    }

}


// ============================================
// MESSAGE SYSTEM
// ============================================

function showMessage(type, message) {

    hideMessages();


    const element =
        type === "error"
            ? errorMessage
            : successMessage;


    if (!element) return;


    element.textContent =
        message;


    element.style.display =
        "block";


    setTimeout(
        hideMessages,
        5000
    );

}


function hideMessages() {

    if (errorMessage) {

        errorMessage.style.display =
            "none";

    }


    if (successMessage) {

        successMessage.style.display =
            "none";

    }

}


// ============================================
// HELPER FUNCTIONS
// ============================================

function setText(id, value) {

    const element =
        document.getElementById(id);


    if (element) {

        element.textContent =
            value;

    }

}


function setValue(id, value) {

    const element =
        document.getElementById(id);


    if (element) {

        element.value =
            value || "";

    }

}


function formatCost(value) {

    return (
        parseFloat(value) || 0
    ).toFixed(2);

}


function escapeHTML(value) {

    const div =
        document.createElement("div");


    div.textContent =
        value || "";


    return div.innerHTML;

}