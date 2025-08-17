import { db, userId, appId, initializeFirebase, collection, addDoc, Timestamp } from "./firebase-config.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";
import { doc, getDoc, updateDoc, query, where, getDocs, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Access DOM elements
const materialInput = document.getElementById('material');
const quantityInput = document.getElementById('quantity');
const quantityUnitSelect = document.getElementById('quantityUnit');
let lastUnit = quantityUnitSelect.value;
const pricePerUnitInput = document.getElementById('pricePerUnit');
const updatedCostPerUnitInput = document.getElementById('updatedCostPerUnit');
const priceInput = document.getElementById('price');
const priceLabel = document.getElementById('priceLabel');
const fileInput = document.getElementById('billPhoto');
const fileNameSpan = document.getElementById('file-name');
const filePreviewDiv = document.getElementById('file-preview');
const previewImage = document.getElementById('preview-image');
const materialForm = document.getElementById('materialForm');
const materialIdInput = document.getElementById('materialId');
const formTitle = document.querySelector('.main-heading');
const formButtonText = document.getElementById('buttonText');
const viewAllPurchasesBtn = document.querySelector('.btn-view-purchases');
const stockInput = document.getElementById('stock');
const stockGroup = document.getElementById('stockGroup');
const costPerUnitGroup = document.getElementById('costPerUnitGroup');
const minQuantityInput = document.getElementById('minQuantity');
const minQuantityUnitSelect = document.getElementById('minQuantityUnit');


let currentBillPhotoUrl = null; // To store the current bill photo URL in edit mode
let previousStock = 0; // Stores the stock from the most recent purchase
let previousCostPerUnit = 0; // Stores the cost per unit from the most recent purchase
let previousUnit = 'kg'; // Stores the unit of the fetched previous stock, default is 'kg'
let isNewMaterial = false; // Flag to determine if it's a new material entry


/**
 * Displays a message to the user.
 * @param {string} message The message to display.
 * @param {string} type The type of message ('success', 'error', 'info').
 */
function showMessage(message, type) {
    const msgDiv = document.getElementById('addMaterialMsg');
    msgDiv.textContent = message;
    msgDiv.className = `message-box message-${type}`;
    msgDiv.classList.remove('hidden');
    setTimeout(() => {
        msgDiv.classList.add('hidden');
    }, 5000);
}

/**
 * Updates the price label and placeholder based on the selected quantity unit.
 */
function updatePriceLabel() {
    const oldUnit = lastUnit;
    const currentUnit = quantityUnitSelect.value;
    lastUnit = currentUnit;

    if (currentUnit === 'kg') {
        priceLabel.textContent = "Price per kg (of this purchase)";
        pricePerUnitInput.placeholder = "Price per kg";
        // Convert price if unit changes
        if (oldUnit === 'gram' && pricePerUnitInput.value && !isNaN(parseFloat(pricePerUnitInput.value))) {
            pricePerUnitInput.value = (parseFloat(pricePerUnitInput.value) * 1000).toFixed(4); // Increased precision
        }
    } else {
        priceLabel.textContent = "Price per gram (of this purchase)";
        pricePerUnitInput.placeholder = "Price per gram";
        // Convert price if unit changes
        if (oldUnit === 'kg' && pricePerUnitInput.value && !isNaN(parseFloat(pricePerUnitInput.value))) {
            pricePerUnitInput.value = (parseFloat(pricePerUnitInput.value) / 1000).toFixed(6); // Increased precision
        }
    }
    // Re-calculate prices after unit change, but only if it's not a new material
    if (!isNewMaterial) {
        calculatePrices();
    }
}

/**
 * Calculates the total purchase price, updated stock, and new cost per unit.
 */
function calculatePrices() {
    // Check if the input value is a valid number, otherwise default to 0
    const purchaseQuantity = parseFloat(quantityInput.value) || 0;
    const purchasePricePerUnit = parseFloat(pricePerUnitInput.value) || 0;
    const purchaseUnit = quantityUnitSelect.value;

    let purchasePrice = 0;
    if (!isNaN(purchaseQuantity) && !isNaN(purchasePricePerUnit)) {
        purchasePrice = purchaseQuantity * purchasePricePerUnit;
    }
    priceInput.value = purchasePrice.toFixed(4);
    
    // Only perform calculations if it's not a new material.
    // New materials' stock is entered manually first, but cost is always calculated.
    if (!isNewMaterial) {
        // Normalize previous stock and previous cost to the current purchase unit for calculation
        let normalizedPreviousStock = previousStock;
        let normalizedPreviousCostPerUnit = previousCostPerUnit;

        if (purchaseUnit !== previousUnit) {
            if (purchaseUnit === 'kg' && previousUnit === 'gram') {
                normalizedPreviousStock = previousStock / 1000;
                normalizedPreviousCostPerUnit = previousCostPerUnit * 1000; // Correct conversion for cost
            } else if (purchaseUnit === 'gram' && previousUnit === 'kg') {
                normalizedPreviousStock = previousStock * 1000;
                normalizedPreviousCostPerUnit = previousCostPerUnit / 1000; // Correct conversion for cost
            }
        }

        // Calculate the new total stock
        const newTotalStock = normalizedPreviousStock + purchaseQuantity;
        stockInput.value = newTotalStock.toFixed(4);
        
        // Calculate the new weighted average cost per unit
        let newCostPerUnit = 0;
        if (newTotalStock > 0) {
            // Calculate total value of previous stock and new purchase
            const previousTotalValue = normalizedPreviousStock * normalizedPreviousCostPerUnit; // Use normalized cost
            const purchaseTotalValue = purchaseQuantity * purchasePricePerUnit;
            newCostPerUnit = (previousTotalValue + purchaseTotalValue) / newTotalStock;
        }
        updatedCostPerUnitInput.value = newCostPerUnit.toFixed(6);
    } else {
        // For new material, the cost per unit is simply the price per unit of the current purchase
        updatedCostPerUnitInput.value = purchasePricePerUnit.toFixed(6);
        stockInput.value = purchaseQuantity.toFixed(4);
    }
}

/**
 * Updates the file name and preview when a file is selected.
 */
function handleFileSelect() {
    const file = fileInput.files[0];
    if (file) {
        fileNameSpan.textContent = file.name;
        const reader = new FileReader();
        reader.onload = (e) => {
            previewImage.src = e.target.result;
            filePreviewDiv.style.display = 'block';
        };
        reader.readAsDataURL(file);
    } else if (currentBillPhotoUrl) {
        fileNameSpan.textContent = 'Existing bill photo';
        previewImage.src = currentBillPhotoUrl;
        filePreviewDiv.style.display = 'block';
    } else {
        fileNameSpan.textContent = 'Select an image...';
        filePreviewDiv.style.display = 'none';
        previewImage.src = '#';
    }
}

/**
 * Fetches the latest data for a given material name.
 * @param {string} materialName The name of the material.
 * @returns {Promise<object|null>} The latest material data or null if not found.
 */
async function fetchLatestMaterialData(materialName) {
    try {
        await initializeFirebase();
        if (!db || !userId) {
            console.error("User is not authenticated. Cannot fetch data.");
            return null;
        }

        const collectionPath = `/artifacts/${appId}/users/${userId}/materials`;
        
        // Query to get the latest record by timestamp
        const q = query(
            collection(db, collectionPath),
            where('material', '==', materialName),
            orderBy('timestamp', 'desc'),
            limit(1)
        );
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            const latestDoc = querySnapshot.docs[0];
            return latestDoc.data();
        } else {
            return null;
        }
    } catch (error) {
        console.error("Error fetching latest material data:", error);
        return null;
    }
}

/**
 * Fills the form with the latest data when the user leaves the material input field.
 */
async function handleMaterialInputBlur() {
    // Only run if we are not in edit mode
    if (materialIdInput.value) {
        return;
    }

    const materialName = materialInput.value.trim();
    if (materialName) {
        const latestData = await fetchLatestMaterialData(materialName);
        if (latestData) {
            isNewMaterial = false;
            // Fill the fields with the latest data
            document.getElementById('dealer').value = latestData.dealer || '';
            document.getElementById('gstNumber').value = latestData.gstNumber || '';
            document.getElementById('quantityUnit').value = latestData.quantityUnit || 'kg';
            minQuantityInput.value = latestData.minQuantity !== undefined ? latestData.minQuantity : 0;
            minQuantityUnitSelect.value = latestData.minQuantityUnit || 'kg';
            
            // Store previous stock and cost for calculation
            previousStock = parseFloat(latestData.stock) || 0;
            previousCostPerUnit = parseFloat(latestData.updatedCostPerUnit) || 0;
            previousUnit = latestData.quantityUnit || 'kg';

            // Make stock and cost per unit fields readonly for existing materials
            stockInput.setAttribute('readonly', 'true');
            updatedCostPerUnitInput.setAttribute('readonly', 'true');

            showMessage(`Loaded recent data for "${materialName}". You are adding to a stock of ${previousStock.toFixed(4)} ${latestData.quantityUnit} at a cost of ₹${previousCostPerUnit.toFixed(4)} per ${latestData.quantityUnit}.`, 'info');
            
            // Recalculate prices and stock based on any existing form data
            calculatePrices();
        } else {
            // If no data is found, reset the fields and previous values
            isNewMaterial = true;
            document.getElementById('dealer').value = '';
            document.getElementById('gstNumber').value = '';
            document.getElementById('quantityUnit').value = 'kg';
            minQuantityInput.value = 0;
            minQuantityUnitSelect.value = 'kg';
            previousStock = 0;
            previousCostPerUnit = 0;
            previousUnit = 'kg';

            // Allow manual input for stock, but cost per unit will be the current purchase price
            stockInput.removeAttribute('readonly');
            updatedCostPerUnitInput.setAttribute('readonly', 'true');
            stockInput.value = '';
            updatedCostPerUnitInput.value = '';
            showMessage('This is a new material. Please enter initial stock and cost per unit manually.', 'info');
        }
    }
}

// Event listeners
materialInput.addEventListener('blur', handleMaterialInputBlur);
quantityInput.addEventListener('input', calculatePrices);
pricePerUnitInput.addEventListener('input', calculatePrices);
quantityUnitSelect.addEventListener('change', updatePriceLabel);
fileInput.addEventListener('change', handleFileSelect);

// Handle form submission
materialForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const buttonText = document.getElementById('buttonText');
    const loadingIndicator = document.getElementById('loadingIndicator');

    buttonText.style.display = 'none';
    loadingIndicator.classList.remove('hidden');

    try {
        await initializeFirebase();
        if (!db || !userId) {
            showMessage("Error: User not authenticated. Please log in.", "error");
            return;
        }

        const materialName = materialInput.value.trim();
        const quantity = parseFloat(quantityInput.value) || 0;
        const purchasePricePerUnit = parseFloat(pricePerUnitInput.value) || 0;
        const totalPurchasePrice = parseFloat(priceInput.value) || 0;
        const quantityUnit = quantityUnitSelect.value;
        const dealer = document.getElementById('dealer').value.trim();
        const gstNumber = document.getElementById('gstNumber').value.trim();
        const updatedStock = parseFloat(stockInput.value) || 0;
        const updatedCostPerUnit = parseFloat(updatedCostPerUnitInput.value) || 0;
        const minQuantity = parseFloat(minQuantityInput.value) || 0;
        const minQuantityUnit = minQuantityUnitSelect.value;
        let billPhotoUrl = null;

        if (!materialName || !quantity || !purchasePricePerUnit) {
            showMessage("Please fill in all required fields (Material, Quantity, Price).", "error");
            return;
        }

        const newPurchaseDoc = {
            material: materialName,
            timestamp: Timestamp.now(),
            quantity: quantity,
            quantityUnit: quantityUnit,
            pricePerUnit: purchasePricePerUnit,
            totalPrice: totalPurchasePrice,
            dealer: dealer,
            gstNumber: gstNumber,
            // The following two fields are the *new* calculated values for the material
            stock: updatedStock,
            updatedCostPerUnit: updatedCostPerUnit,
            minQuantity: minQuantity,
            minQuantityUnit: minQuantityUnit
        };

        // Handle photo upload
        const file = fileInput.files[0];
        if (file) {
            const fileExtension = file.name.split('.').pop();
            const storageRef = ref(getStorage(), `bills/${materialName}-${Date.now()}.${fileExtension}`);
            await uploadBytes(storageRef, file);
            billPhotoUrl = await getDownloadURL(storageRef);
            newPurchaseDoc.billPhotoUrl = billPhotoUrl;
        } else if (currentBillPhotoUrl) {
            // Retain the existing photo URL if no new file is uploaded
            newPurchaseDoc.billPhotoUrl = currentBillPhotoUrl;
        }

        const collectionPath = `/artifacts/${appId}/users/${userId}/materials`;
        await addDoc(collection(db, collectionPath), newPurchaseDoc);

        showMessage("Purchase added successfully!", "success");
        materialForm.reset();
        isNewMaterial = true; // Reset the flag for the next entry
        handleFileSelect(); // Reset the file preview
        updatedCostPerUnitInput.value = '';
        stockInput.value = '';
        stockInput.removeAttribute('readonly');
        materialIdInput.value = '';
        formTitle.textContent = "Add Material";
        formButtonText.textContent = "+ Add Purchase";

    } catch (error) {
        console.error("Error adding purchase:", error);
        showMessage("An error occurred while adding the purchase. Please try again.", "error");
    } finally {
        buttonText.style.display = 'block';
        loadingIndicator.classList.add('hidden');
    }
});

// Logic for editing a material
const urlParams = new URLSearchParams(window.location.search);
const materialIdFromUrl = urlParams.get('materialId');

if (materialIdFromUrl) {
    // This is an edit operation
    formTitle.textContent = "Edit Material";
    formButtonText.textContent = "Update Material";
    stockInput.removeAttribute('readonly');
    updatedCostPerUnitInput.removeAttribute('readonly');
    viewAllPurchasesBtn.style.display = 'none';

    // Fetch and pre-fill data for editing
    async function fetchMaterialForEdit(docId) {
        try {
            await initializeFirebase();
            const docRef = doc(db, `/artifacts/${appId}/users/${userId}/materials`, docId);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data();
                materialIdInput.value = docId;
                materialInput.value = data.material || '';
                quantityInput.value = data.quantity || 0;
                quantityUnitSelect.value = data.quantityUnit || 'kg';
                pricePerUnitInput.value = data.pricePerUnit || 0;
                priceInput.value = data.totalPrice || 0;
                document.getElementById('dealer').value = data.dealer || '';
                document.getElementById('gstNumber').value = data.gstNumber || '';
                stockInput.value = data.stock || 0;
                updatedCostPerUnitInput.value = data.updatedCostPerUnit || 0;
                minQuantityInput.value = data.minQuantity !== undefined ? data.minQuantity : 0;
                minQuantityUnitSelect.value = data.minQuantityUnit || 'kg';
                currentBillPhotoUrl = data.billPhotoUrl || null;

                // Handle file preview
                handleFileSelect();
            } else {
                showMessage("No such material found for editing.", "error");
            }
        } catch (error) {
            console.error("Error fetching material for edit:", error);
            showMessage("Error fetching data for editing.", "error");
        }
    }

    fetchMaterialForEdit(materialIdFromUrl);

    // Update the form submission logic for editing
    materialForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const buttonText = document.getElementById('buttonText');
        const loadingIndicator = document.getElementById('loadingIndicator');

        buttonText.style.display = 'none';
        loadingIndicator.classList.remove('hidden');

        try {
            await initializeFirebase();
            if (!db || !userId) {
                showMessage("Error: User not authenticated. Please log in.", "error");
                return;
            }

            const docId = materialIdInput.value;
            if (!docId) {
                showMessage("Error: No document ID found for update.", "error");
                return;
            }

            const materialName = materialInput.value.trim();
            const quantity = parseFloat(quantityInput.value) || 0;
            const pricePerUnit = parseFloat(pricePerUnitInput.value) || 0;
            const totalPrice = parseFloat(priceInput.value) || 0;
            const quantityUnit = quantityUnitSelect.value;
            const dealer = document.getElementById('dealer').value.trim();
            const gstNumber = document.getElementById('gstNumber').value.trim();
            const stock = parseFloat(stockInput.value) || 0;
            const updatedCostPerUnit = parseFloat(updatedCostPerUnitInput.value) || 0;
            const minQuantity = parseFloat(minQuantityInput.value) || 0;
            const minQuantityUnit = minQuantityUnitSelect.value;
            
            const updatedData = {
                material: materialName,
                quantity: quantity,
                quantityUnit: quantityUnit,
                pricePerUnit: pricePerUnit,
                totalPrice: totalPrice,
                dealer: dealer,
                gstNumber: gstNumber,
                stock: stock,
                updatedCostPerUnit: updatedCostPerUnit,
                minQuantity: minQuantity,
                minQuantityUnit: minQuantityUnit
            };

            const file = fileInput.files[0];
            if (file) {
                const fileExtension = file.name.split('.').pop();
                const storageRef = ref(getStorage(), `bills/${materialName}-${Date.now()}.${fileExtension}`);
                await uploadBytes(storageRef, file);
                updatedData.billPhotoUrl = await getDownloadURL(storageRef);
            } else if (currentBillPhotoUrl) {
                updatedData.billPhotoUrl = currentBillPhotoUrl;
            }

            const docRef = doc(db, `/artifacts/${appId}/users/${userId}/materials`, docId);
            await updateDoc(docRef, updatedData);

            showMessage("Material updated successfully!", "success");

        } catch (error) {
            console.error("Error updating material:", error);
            showMessage("An error occurred while updating the material. Please try again.", "error");
        } finally {
            buttonText.style.display = 'block';
            loadingIndicator.classList.add('hidden');
        }
    });
}

// Navigation drawer logic
document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('hamburgerBtn');
    const drawer = document.getElementById('drawerNav');
    const backdrop = document.getElementById('backdrop');

    if (btn && drawer && backdrop) {
        function openDrawer() {
            drawer.classList.add('open');
            backdrop.classList.add('open');
            drawer.setAttribute('aria-hidden', 'false');
            btn.setAttribute('aria-expanded', 'true');
            const firstLink = drawer.querySelector('a');
            if (firstLink) firstLink.focus({ preventScroll: true });
            document.body.style.overflow = 'hidden';
        }

        function closeDrawer() {
            drawer.classList.remove('open');
            backdrop.classList.remove('open');
            drawer.setAttribute('aria-hidden', 'true');
            btn.setAttribute('aria-expanded', 'false');
            btn.focus({ preventScroll: true });
            document.body.style.overflow = '';
        }

        btn.addEventListener('click', () => {
            drawer.classList.contains('open') ? closeDrawer() : openDrawer();
        });

        backdrop.addEventListener('click', closeDrawer);

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && drawer.classList.contains('open')) closeDrawer();
        });

        drawer.addEventListener('click', (e) => {
            if (e.target.closest('a[href]')) closeDrawer();
        });
    } else {
        console.error('Drawer elements not found. Check your HTML IDs.');
    }
});
