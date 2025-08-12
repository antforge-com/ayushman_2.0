// product-price.js
// Import necessary Firebase modules from the shared config file
import { db, auth, appId, initializeFirebase, collection, getDocs, addDoc, Timestamp } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Access DOM elements
const materialRowsDiv = document.getElementById('materialRows');
const totalMaterialCostSpan = document.getElementById('totalMaterialCost');
const totalBottleCostSpan = document.getElementById('totalBottleCost');
const totalCostSpan = document.getElementById('totalCost');
const numBottlesInput = document.getElementById('numBottles');
const costPerBottleInput = document.getElementById('costPerBottle');
const calcBtn = document.getElementById('calcBtn');
const pricingResultsDiv = document.getElementById('pricingResults');
const statusMessageDiv = document.getElementById('statusMessage');
const buttonText = document.getElementById('buttonText');
const loadingIndicator = document.getElementById('loadingIndicator');


let materialRows = []; // Stores the current rows for material selection
let materials = []; // Stores all materials fetched from Firestore

// Drawer toggle elements
const hamburgerBtn = document.getElementById('hamburgerBtn');
const drawerNav = document.getElementById('drawerNav');
const backdrop = document.getElementById('backdrop');


/**
 * User ko message dikhata hai.
 * @param {string} message Dikhane wala message.
 * @param {string} type Message ka prakar ('success', 'error', 'info').
 */
function showMessage(message, type) {
    statusMessageDiv.textContent = message;
    statusMessageDiv.className = `message-box message-${type}`;
    statusMessageDiv.classList.remove('hidden');
    setTimeout(() => {
        statusMessageDiv.classList.add('hidden');
    }, 5000);
}


/**
 * Fetches all materials from Firebase.
 * @param {string} currentUserId - The ID of the currently logged-in user.
 */
async function fetchMaterials(currentUserId) {
    console.log('fetchMaterials: Attempting to fetch materials...');
    try {
        // Reference the collection using the correct user-specific path
        const collectionPath = `/artifacts/${appId}/users/${currentUserId}/materials`;
        const materialsCollectionRef = collection(db, collectionPath);
        const materialsSnap = await getDocs(materialsCollectionRef);
        console.log('fetchMaterials: Firestore query completed.');

        materials = [];
        materialsSnap.forEach(doc => materials.push({ id: doc.id, ...doc.data() }));

        console.log('Loaded materials:', materials);

        // Sort materials by name
        materials.sort((a, b) => ((a.material || '').localeCompare(b.material || '')));

        // If no materials are found, display a message
        if (materials.length === 0) {
            materialRowsDiv.innerHTML = '<tr><td colspan="6" class="text-center italic text-gray-500 py-4">No materials found. Please add materials first.</td></tr>';
        } else {
            // If no material rows exist, add one
            if (materialRows.length === 0) {
                materialRows.push({ materialId: '', quantity: 0, unit: 'kg', costPerUnit: 0, totalCost: 0 });
            }
            renderRows();
        }
    } catch (err) {
        console.error("Error fetching materials for calculator:", err);
        materialRowsDiv.innerHTML = '<tr><td colspan="6" class="text-center italic text-red-700 py-4">Error loading materials.</td></tr>';
    }
}

/**
 * Renders the material input rows on the page.
 */
function renderRows() {
    materialRowsDiv.innerHTML = materialRows.map((row, idx) => `
        <tr style="border-bottom:1px solid #eee;">
            <td style="padding:0.75rem 0.5rem;">
                <select class="materialSelect" data-idx="${idx}" style="width:100%;padding:0.5rem;border:1px solid #ddd;border-radius:4px;">
                    <option value="">Select Material</option>
                    ${materials.map(m => `<option value="${m.id}" ${row.materialId === m.id ? 'selected' : ''}>${m.material || ''}</option>`).join('')}
                </select>
            </td>
            <td style="padding:0.75rem 0.5rem;">
                <input class="qtyInput text-center" data-idx="${idx}" type="number" min="0" step="any" value="${row.quantity || ''}" style="width:80px;padding:0.5rem;border:1px solid #ddd;border-radius:4px;">
            </td>
            <td style="padding:0.75rem 0.5rem;">
                <select class="unitSelect text-center" data-idx="${idx}" style="width:70px;padding:0.5rem;border:1px solid #ddd;border-radius:4px;">
                    <option value="kg" ${row.unit === 'kg' ? 'selected' : ''}>kg</option>
                    <option value="gram" ${row.unit === 'gram' ? 'selected' : ''}>gram</option>
                </select>
            </td>
            <td style="padding:0.75rem 0.5rem;">
                <input class="costInput text-center" data-idx="${idx}" type="number" min="0" step="0.01" value="${(row.costPerUnit || 0).toFixed(2)}" style="width:80px;padding:0.5rem;border:1px solid #ddd;border-radius:4px;" disabled>
            </td>
            <td style="padding:0.75rem 0.5rem;">
                <span id="totalCost-${idx}">₹${(row.totalCost || 0).toFixed(2)}</span>
            </td>
            <td style="padding:0.75rem 0.5rem;text-align:right;">
                <button class="remove-btn" data-idx="${idx}" onclick="removeRow(${idx})"><i class="fa-solid fa-trash-can"></i></button>
            </td>
        </tr>
    `).join('');

    // Attach event listeners to the new elements
    document.querySelectorAll('.materialSelect').forEach(sel => sel.onchange = onRowChange);
    document.querySelectorAll('.qtyInput').forEach(inp => inp.oninput = onRowChange);
    document.querySelectorAll('.unitSelect').forEach(sel => sel.onchange = onRowChange);

    updateTotals();
}

/**
 * Handles changes in the material row inputs.
 * @param {Event} e - the change event.
 */
function onRowChange(e) {
    const idx = +e.target.dataset.idx;
    const row = materialRows[idx];

    if (e.target.classList.contains('materialSelect')) {
        row.materialId = e.target.value;
        const mat = materials.find(m => m.id === row.materialId);
        
        if (mat) {
            // Firestore mein unit `quantityUnit` hai aur price per unit `pricePerUnit`.
            row.unit = mat.quantityUnit;
            row.quantity = mat.quantity;
            row.costPerUnit = mat.pricePerUnit;
        } else {
            row.quantity = 0;
            row.costPerUnit = 0;
        }

    } else if (e.target.classList.contains('qtyInput')) {
        row.quantity = +e.target.value;
    } else if (e.target.classList.contains('unitSelect')) {
        const mat = materials.find(m => m.id === row.materialId);
        const newUnit = e.target.value;

        if (mat) {
            const totalCalculatedPrice = mat.price;
            let quantityInGrams = mat.quantityUnit === 'kg' ? mat.quantity * 1000 : mat.quantity;

            if (newUnit === 'kg') {
                row.costPerUnit = totalCalculatedPrice / (quantityInGrams / 1000);
            } else if (newUnit === 'gram') {
                row.costPerUnit = totalCalculatedPrice / quantityInGrams;
            }
            row.unit = newUnit;
        }
    }
    
    row.totalCost = row.quantity * (row.costPerUnit || 0);
    renderRows();
}

/**
 * Removes a material row.
 * @param {number} idx - The index of the row to remove.
 */
window.removeRow = function(idx) {
    materialRows.splice(idx, 1);
    renderRows();
};

/**
 * Updates the total costs displayed on the page.
 */
function updateTotals() {
    const totalMaterial = materialRows.reduce((sum, r) => sum + (r.totalCost || 0), 0);
    totalMaterialCostSpan.textContent = `₹${totalMaterial.toFixed(2)}`;

    const numBottles = +numBottlesInput.value || 0;
    const costPerBottle = +costPerBottleInput.value || 0;
    const totalBottleCost = numBottles * costPerBottle;
    totalBottleCostSpan.textContent = `₹${totalBottleCost.toFixed(2)}`;

    const overallTotalCost = totalMaterial + totalBottleCost;
    totalCostSpan.textContent = `₹${overallTotalCost.toFixed(2)}`;
}

// Add a new material row button
document.getElementById('addRowBtn').onclick = () => {
    materialRows.push({ materialId: '', quantity: 0, unit: 'kg', costPerUnit: 0, totalCost: 0 });
    renderRows();
};

// Update totals when bottle information changes
numBottlesInput.oninput = updateTotals;
costPerBottleInput.oninput = updateTotals;

/**
 * Saves the product price calculation to Firestore.
 * @param {object} productData - The object containing all product pricing information.
 */
async function saveProductPrice(productData) {
    try {
        await initializeFirebase();
        if (!db || !auth.currentUser) {
            throw new Error("User is not authenticated. Please log in and try again.");
        }
        
        const collectionPath = `/artifacts/${appId}/users/${auth.currentUser.uid}/products`;
        await addDoc(collection(db, collectionPath), productData);
        showMessage('Product price saved successfully!', 'success');
    } catch (error) {
        console.error("Error saving product price:", error);
        if (error.code === 'permission-denied') {
            showMessage('Permission denied. Please check your Firestore security rules.', 'error');
        } else {
            showMessage('Failed to save product price. Please try again.', 'error');
        }
    }
}


// Calculate price when the button is clicked
calcBtn.onclick = async () => {
    // Show loading state
    calcBtn.disabled = true;
    buttonText.classList.add('hidden');
    loadingIndicator.classList.remove('hidden');

    const totalMaterial = materialRows.reduce((sum, r) => sum + (r.totalCost || 0), 0);
    const numBottles = +numBottlesInput.value;
    const costPerBottle = +costPerBottleInput.value;

    if (numBottles <= 0) {
        pricingResultsDiv.style.display = 'block';
        pricingResultsDiv.innerHTML = `
            <div style="padding:1rem;background:#fee2e2;color:#991b1b;border-radius:8px;text-align:center;">
                Please enter a valid number of bottles (greater than 0).
            </div>
        `;
        calcBtn.disabled = false;
        buttonText.classList.remove('hidden');
        loadingIndicator.classList.add('hidden');
        return;
    }

    const bottleCost = numBottles * costPerBottle;
    const baseCost = totalMaterial + bottleCost;

    // Your margin calculations
    const margin1 = baseCost * 0.13; // 13% margin on base cost
    const margin2 = (baseCost + margin1) * 0.12; // 12% margin on (baseCost + margin1)
    const totalSellingPrice = baseCost + margin1 + margin2;
    const grossPerBottle = totalSellingPrice / numBottles;

    pricingResultsDiv.style.display = 'block';

    document.getElementById('resultBasePrice').textContent = `₹${baseCost.toFixed(2)}`;
    document.getElementById('resultMargin1').textContent = `₹${margin1.toFixed(2)}`;
    document.getElementById('resultMargin2').textContent = `₹${margin2.toFixed(2)}`;
    document.getElementById('resultTotalPrice').textContent = `₹${totalSellingPrice.toFixed(2)}`;
    document.getElementById('resultPricePerBottle').textContent = `₹${grossPerBottle.toFixed(2)}`;

    // Prepare data for saving
    const productData = {
        name: `Product Calculation - ${new Date().toLocaleString()}`,
        materialsUsed: materialRows.map(row => {
            const materialInfo = materials.find(m => m.id === row.materialId) || {};
            return {
                materialId: row.materialId,
                materialName: materialInfo.material,
                quantity: row.quantity,
                unit: row.unit,
                costPerUnit: row.costPerUnit,
                totalCost: row.totalCost,
            };
        }),
        bottleInfo: {
            numBottles: numBottles,
            costPerBottle: costPerBottle,
        },
        calculations: {
            baseCost: baseCost,
            margin1: margin1,
            margin2: margin2,
            totalSellingPrice: totalSellingPrice,
            grossPerBottle: grossPerBottle,
        },
        timestamp: Timestamp.now(),
    };

    // Call the new function to save to Firestore
    await saveProductPrice(productData);
    
    // Hide loading state
    calcBtn.disabled = false;
    buttonText.classList.remove('hidden');
    loadingIndicator.classList.add('hidden');
};

/**
 * Toggles the visibility of the drawer navigation and backdrop.
 */
function toggleDrawer() {
    if (drawerNav.classList.contains('open')) {
        closeDrawer();
    } else {
        openDrawer();
    }
}

/**
 * Opens the drawer navigation.
 */
function openDrawer() {
    drawerNav.classList.add('open');
    backdrop.classList.add('open');
    drawerNav.setAttribute('aria-hidden', 'false');
    hamburgerBtn.setAttribute('aria-expanded', 'true');
    const firstLink = drawerNav.querySelector('a');
    if (firstLink) firstLink.focus({ preventScroll: true });
    document.body.style.overflow = 'hidden';
}

/**
 * Closes the drawer navigation.
 */
function closeDrawer() {
    drawerNav.classList.remove('open');
    backdrop.classList.remove('open');
    drawerNav.setAttribute('aria-hidden', 'true');
    hamburgerBtn.setAttribute('aria-expanded', 'false');
    hamburgerBtn.focus({ preventScroll: true });
    document.body.style.overflow = '';
}


// Event listeners for drawer toggle
document.addEventListener('DOMContentLoaded', () => {
    // Check if the required elements exist before adding listeners
    if (hamburgerBtn && drawerNav && backdrop) {
        hamburgerBtn.addEventListener('click', toggleDrawer);
        backdrop.addEventListener('click', closeDrawer);
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && drawerNav.classList.contains('open')) {
                closeDrawer();
            }
        });
        drawerNav.addEventListener('click', (e) => {
            if (e.target.closest('a[href]')) {
                closeDrawer();
            }
        });
    } else {
        console.error('Drawer elements not found. Check your HTML IDs.');
    }
});


// When the DOM is loaded, wait for Firebase auth, then fetch materials
document.addEventListener('DOMContentLoaded', async () => {
    // First, let Firebase initialize completely
    await initializeFirebase();
    onAuthStateChanged(auth, user => {
        if (user) {
            console.log('User signed in, fetching materials...');
            fetchMaterials(user.uid);
        } else {
            console.log('User not signed in, redirecting to login...');
            window.location.href = 'login.html';
        }
    });
});
