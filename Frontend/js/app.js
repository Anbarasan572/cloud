// API Base URL
// Auto-detects environment:
//  - Local file testing (file://) -> uses localhost:5000
//  - Hosted (http/https)        -> uses same host the page came from
const API_BASE_URL = window.location.protocol === 'file:'
    ? 'http://127.0.0.1:5000'
    : window.location.origin;

// Cost Estimation Database (Based on typical cloud pricing)
const COST_ESTIMATES = {
    'AWS': {
        'EC2': { base: 50, running: 50, stopped: 5 },
        'RDS': { base: 80, running: 80, stopped: 8 },
        'S3': { base: 23, running: 23, stopped: 23 },
        'Lambda': { base: 15, running: 15, stopped: 0 },
        'ECS': { base: 45, running: 45, stopped: 5 },
        'EKS': { base: 75, running: 75, stopped: 10 },
        'CloudFront': { base: 50, running: 50, stopped: 50 },
        'Route53': { base: 0.5, running: 0.5, stopped: 0.5 },
        'VPC': { base: 0, running: 0, stopped: 0 },
        'Load Balancer': { base: 25, running: 25, stopped: 25 },
        'CloudWatch': { base: 10, running: 10, stopped: 10 }
    },
    'Azure': {
        'EC2': { base: 55, running: 55, stopped: 6 },
        'RDS': { base: 85, running: 85, stopped: 9 },
        'S3': { base: 25, running: 25, stopped: 25 },
        'Lambda': { base: 18, running: 18, stopped: 0 },
        'ECS': { base: 50, running: 50, stopped: 6 },
        'EKS': { base: 80, running: 80, stopped: 12 }
    },
    'GCP': {
        'EC2': { base: 48, running: 48, stopped: 5 },
        'RDS': { base: 75, running: 75, stopped: 8 },
        'S3': { base: 20, running: 20, stopped: 20 },
        'Lambda': { base: 12, running: 12, stopped: 0 },
        'ECS': { base: 42, running: 42, stopped: 5 },
        'EKS': { base: 72, running: 72, stopped: 10 }
    }
};

// Region cost multipliers (some regions are more expensive)
const REGION_MULTIPLIERS = {
    'us-east-1': 1.0,      // Baseline (cheapest)
    'us-east-2': 1.0,
    'us-west-1': 1.1,
    'us-west-2': 1.05,
    'ap-south-1': 1.15,     // Asia Pacific more expensive
    'ap-northeast-1': 1.2,
    'ap-southeast-1': 1.15,
    'ap-southeast-2': 1.18,
    'eu-central-1': 1.12,
    'eu-west-1': 1.1,
    'eu-west-2': 1.12
};

// DOM Elements
const addAssetForm = document.getElementById('addAssetForm');
const editAssetForm = document.getElementById('editAssetForm');
const assetsContainer = document.getElementById('assetsContainer');
const loadingMessage = document.getElementById('loadingMessage');
const errorMessage = document.getElementById('errorMessage');
const successMessage = document.getElementById('successMessage');
const refreshBtn = document.getElementById('refreshBtn');
const editModal = document.getElementById('editModal');
const closeModal = document.querySelector('.close');
const cancelEditBtn = document.getElementById('cancelEdit');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadAssets();
    setupEventListeners();
});

// Setup Event Listeners
function setupEventListeners() {
    addAssetForm.addEventListener('submit', handleAddAsset);
    editAssetForm.addEventListener('submit', handleEditAsset);
    refreshBtn.addEventListener('click', loadAssets);
    closeModal.addEventListener('click', closeEditModal);
    cancelEditBtn.addEventListener('click', closeEditModal);
    
    // Close modal when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target === editModal) {
            closeEditModal();
        }
    });
}

// Show/Hide Messages
function showMessage(type, message) {
    hideAllMessages();
    
    if (type === 'error') {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
    } else if (type === 'success') {
        successMessage.textContent = message;
        successMessage.style.display = 'block';
    }
    
    // Auto-hide after 5 seconds
    setTimeout(hideAllMessages, 5000);
}

function hideAllMessages() {
    errorMessage.style.display = 'none';
    successMessage.style.display = 'none';
}

// Load All Assets
async function loadAssets() {
    try {
        loadingMessage.style.display = 'block';
        assetsContainer.innerHTML = '';
        hideAllMessages();
        
        const response = await fetch(`${API_BASE_URL}/assets`);
        
        if (!response.ok) {
            throw new Error('Failed to fetch assets');
        }
        
        const assets = await response.json();
        loadingMessage.style.display = 'none';
        
        // Store all assets globally for filtering
        window.allAssets = assets;
        
        // Update dashboard statistics
        updateDashboardStats(assets);
        
        if (assets.length === 0) {
            assetsContainer.innerHTML = `
                <div class="empty-state">
                    <h3>No Assets Found</h3>
                    <p>Add your first cloud asset using the form above.</p>
                </div>
            `;
        } else {
            displayAssets(assets);
        }
    } catch (error) {
        loadingMessage.style.display = 'none';
        showMessage('error', `Error loading assets: ${error.message}`);
        console.error('Error loading assets:', error);
    }
}

// Update Dashboard Statistics
function updateDashboardStats(assets) {
    const totalAssets = assets.length;
    const totalCost = assets.reduce((sum, asset) => sum + (parseFloat(asset.cost) || 0), 0);
    const activeAssets = assets.filter(asset => 
        asset.status === 'Running' || asset.status === 'Active'
    ).length;
    
    document.getElementById('totalAssets').textContent = totalAssets;
    document.getElementById('totalCost').textContent = `$${totalCost.toFixed(2)}`;
    document.getElementById('activeAssets').textContent = activeAssets;
}

// Display Assets
function displayAssets(assets) {
    assetsContainer.innerHTML = assets.map(asset => `
        <div class="asset-card" data-id="${asset.id}">
            <h3>${asset.asset_name || 'Unnamed Asset'}</h3>
            <div class="asset-info">
                <div class="asset-info-item">
                    <span class="asset-info-label">ID:</span>
                    <span class="asset-info-value">${asset.id}</span>
                </div>
                <div class="asset-info-item">
                    <span class="asset-info-label">Provider:</span>
                    <span class="asset-info-value">${asset.provider || 'N/A'}</span>
                </div>
                <div class="asset-info-item">
                    <span class="asset-info-label">Service:</span>
                    <span class="asset-info-value">${asset.service || 'N/A'}</span>
                </div>
                <div class="asset-info-item">
                    <span class="asset-info-label">Region:</span>
                    <span class="asset-info-value">${asset.region || 'N/A'}</span>
                </div>
                <div class="asset-info-item">
                    <span class="asset-info-label">Status:</span>
                    <span class="asset-info-value">${asset.status || 'N/A'}</span>
                </div>
                <div class="asset-info-item">
                    <span class="asset-info-label">Owner:</span>
                    <span class="asset-info-value">${asset.owner || 'N/A'}</span>
                </div>
                <div class="asset-info-item">
                    <span class="asset-info-label">Monthly Cost:</span>
                    <span class="asset-info-value">$${asset.cost ? parseFloat(asset.cost).toFixed(2) : '0.00'}</span>
                </div>
                <div class="asset-info-item">
                    <span class="asset-info-label">Created:</span>
                    <span class="asset-info-value">${formatDate(asset.created_at)}</span>
                </div>
                <div class="asset-info-item">
                    <span class="asset-info-label">Updated:</span>
                    <span class="asset-info-value">${formatDate(asset.updated_at)}</span>
                </div>
            </div>
            <div class="asset-actions">
                <button class="btn btn-edit" onclick="openEditModal(${asset.id})">Edit</button>
                <button class="btn btn-danger" onclick="deleteAsset(${asset.id})">Delete</button>
            </div>
        </div>
    `).join('');
}

// Format date helper function
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Handle Add Asset
async function handleAddAsset(e) {
    e.preventDefault();
    
    const formData = new FormData(addAssetForm);
    
    // Parse cost properly (handle both comma and period)
    let costValue = formData.get('cost') || '0';
    costValue = costValue.toString().replace(',', '.'); // Convert comma to period
    
    const assetData = {
        asset_name: formData.get('assetName').trim(),
        provider: formData.get('provider').trim() || null,
        service: formData.get('service').trim() || null,
        region: formData.get('region').trim() || null,
        status: formData.get('status').trim() || null,
        owner: formData.get('owner').trim() || null,
        cost: parseFloat(costValue) || 0
    };
    
    // Remove empty values
    Object.keys(assetData).forEach(key => {
        if (assetData[key] === '' || assetData[key] === null) {
            delete assetData[key];
        }
    });
    
    try {
        const response = await fetch(`${API_BASE_URL}/assets`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(assetData)
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.error || 'Failed to add asset');
        }
        
        showMessage('success', 'Asset added successfully!');
        addAssetForm.reset();
        loadAssets();
    } catch (error) {
        showMessage('error', `Error adding asset: ${error.message}`);
        console.error('Error adding asset:', error);
    }
}

// Open Edit Modal
async function openEditModal(assetId) {
    try {
        const response = await fetch(`${API_BASE_URL}/assets/${assetId}`);
        
        if (!response.ok) {
            throw new Error('Failed to fetch asset details');
        }
        
        const asset = await response.json();
        
        // Populate form
        document.getElementById('editAssetId').value = asset.id;
        document.getElementById('editAssetName').value = asset.asset_name || '';
        document.getElementById('editProvider').value = asset.provider || '';
        document.getElementById('editService').value = asset.service || '';
        document.getElementById('editRegion').value = asset.region || '';
        document.getElementById('editStatus').value = asset.status || '';
        document.getElementById('editOwner').value = asset.owner || '';
        document.getElementById('editCost').value = asset.cost || 0;
        
        // Show modal
        editModal.style.display = 'block';
    } catch (error) {
        showMessage('error', `Error loading asset: ${error.message}`);
        console.error('Error loading asset:', error);
    }
}

// Close Edit Modal
function closeEditModal() {
    editModal.style.display = 'none';
    editAssetForm.reset();
}

// Handle Edit Asset
async function handleEditAsset(e) {
    e.preventDefault();
    
    const assetId = document.getElementById('editAssetId').value;
    const formData = new FormData(editAssetForm);
    
    // Parse cost properly (handle both comma and period)
    let costValue = formData.get('cost') || '0';
    costValue = costValue.toString().replace(',', '.'); // Convert comma to period
    
    const assetData = {
        asset_name: formData.get('assetName').trim(),
        provider: formData.get('provider').trim() || null,
        service: formData.get('service').trim() || null,
        region: formData.get('region').trim() || null,
        status: formData.get('status').trim() || null,
        owner: formData.get('owner').trim() || null,
        cost: parseFloat(costValue) || 0
    };
    
    // Remove empty values
    Object.keys(assetData).forEach(key => {
        if (assetData[key] === '' || assetData[key] === null) {
            delete assetData[key];
        }
    });
    
    try {
        const response = await fetch(`${API_BASE_URL}/assets/${assetId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(assetData)
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.error || 'Failed to update asset');
        }
        
        showMessage('success', 'Asset updated successfully!');
        closeEditModal();
        loadAssets();
    } catch (error) {
        showMessage('error', `Error updating asset: ${error.message}`);
        console.error('Error updating asset:', error);
    }
}

// Delete Asset
async function deleteAsset(assetId) {
    if (!confirm('Are you sure you want to delete this asset?')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/assets/${assetId}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.error || 'Failed to delete asset');
        }
        
        showMessage('success', 'Asset deleted successfully!');
        loadAssets();
    } catch (error) {
        showMessage('error', `Error deleting asset: ${error.message}`);
        console.error('Error deleting asset:', error);
    }
}

// Cost Estimation Functions
function estimateCost() {
    const provider = document.getElementById('provider').value;
    const service = document.getElementById('service').value;
    const region = document.getElementById('region').value;
    const status = document.getElementById('status').value;
    
    const estimatedCost = calculateCost(provider, service, region, status);
    // Force US format with period as decimal separator
    const costField = document.getElementById('cost');
    costField.value = estimatedCost.toFixed(2);
    
    showMessage('success', `Estimated monthly cost: $${estimatedCost.toFixed(2)}`);
}

function estimateEditCost() {
    const provider = document.getElementById('editProvider').value;
    const service = document.getElementById('editService').value;
    const region = document.getElementById('editRegion').value;
    const status = document.getElementById('editStatus').value;
    
    const estimatedCost = calculateCost(provider, service, region, status);
    // Force US format with period as decimal separator
    const costField = document.getElementById('editCost');
    costField.value = estimatedCost.toFixed(2);
    
    showMessage('success', `Estimated monthly cost: $${estimatedCost.toFixed(2)}`);
}

function calculateCost(provider, service, region, status) {
    // Get base cost for provider and service
    let baseCost = 0;
    
    if (COST_ESTIMATES[provider] && COST_ESTIMATES[provider][service]) {
        const serviceData = COST_ESTIMATES[provider][service];
        
        // Use stopped cost if status is Stopped, Terminated, or Inactive
        if (status === 'Stopped' || status === 'Terminated' || status === 'Inactive') {
            baseCost = serviceData.stopped;
        } else {
            baseCost = serviceData.running;
        }
    } else {
        // Default cost if service not in database
        baseCost = 30;
    }
    
    // Apply regional multiplier
    const regionMultiplier = REGION_MULTIPLIERS[region] || 1.0;
    const finalCost = baseCost * regionMultiplier;
    
    return finalCost;
}

// Search and Filter Functions
function filterAssets() {
    if (!window.allAssets) return;
    
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const filterProvider = document.getElementById('filterProvider').value;
    const filterStatus = document.getElementById('filterStatus').value;
    const filterOwner = document.getElementById('filterOwner').value;
    
    let filteredAssets = window.allAssets.filter(asset => {
        // Search by name
        const matchesSearch = !searchTerm || 
            (asset.asset_name && asset.asset_name.toLowerCase().includes(searchTerm));
        
        // Filter by provider
        const matchesProvider = !filterProvider || asset.provider === filterProvider;
        
        // Filter by status
        const matchesStatus = !filterStatus || asset.status === filterStatus;
        
        // Filter by owner
        const matchesOwner = !filterOwner || asset.owner === filterOwner;
        
        return matchesSearch && matchesProvider && matchesStatus && matchesOwner;
    });
    
    // Update stats with filtered data
    updateDashboardStats(filteredAssets);
    
    // Display filtered assets
    if (filteredAssets.length === 0) {
        assetsContainer.innerHTML = `
            <div class="empty-state">
                <h3>No Assets Match Your Filters</h3>
                <p>Try adjusting your search or filter criteria.</p>
            </div>
        `;
    } else {
        displayAssets(filteredAssets);
    }
}

function clearFilters() {
    document.getElementById('searchInput').value = '';
    document.getElementById('filterProvider').value = '';
    document.getElementById('filterStatus').value = '';
    document.getElementById('filterOwner').value = '';
    
    filterAssets();
}
