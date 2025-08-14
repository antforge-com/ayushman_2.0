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

let currentBillPhotoUrl = null; // To store the current bill photo URL in edit mode

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
    const previousUnit = lastUnit;
    const currentUnit = quantityUnitSelect.value;
    lastUnit = currentUnit;

    if (currentUnit === 'kg') {
        priceLabel.textContent = "Price per kg";
        pricePerUnitInput.placeholder = "Price per kg";
        if (previousUnit === 'gram' && pricePerUnitInput.value && !isNaN(parseFloat(pricePerUnitInput.value))) {
            pricePerUnitInput.value = (parseFloat(pricePerUnitInput.value) * 1000).toFixed(2);
        }
    } else {
        priceLabel.textContent = "Price per gram";
        pricePerUnitInput.placeholder = "Price per gram";
        if (previousUnit === 'kg' && pricePerUnitInput.value && !isNaN(parseFloat(pricePerUnitInput.value))) {
            pricePerUnitInput.value = (parseFloat(pricePerUnitInput.value) / 1000).toFixed(4);
        }
    }
    calculateTotalPrice();
}

/**
 * Calculates the total price based on quantity and price per unit.
 */
function calculateTotalPrice() {
    const quantity = parseFloat(quantityInput.value);
    const quantityUnit = quantityUnitSelect.value;
    const pricePerUnit = parseFloat(pricePerUnitInput.value);

    if (!isNaN(quantity) && !isNaN(pricePerUnit)) {
        let totalprice = 0;
        if (quantityUnit === 'kg') {
            totalprice = quantity * pricePerUnit;
        } else if (quantityUnit === 'gram') {
            totalprice = quantity * pricePerUnit;
        }
        priceInput.value = totalprice.toFixed(2);
    } else {
        priceInput.value = '';
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
 * Populates the form with data for editing.
 * @param {string} materialId The ID of the material to edit.
 */
async function loadMaterialForEdit(materialId) {
    try {
        await initializeFirebase();
        if (!db || !userId) {
            throw new Error("User is not authenticated. Cannot load data.");
        }

        const collectionPath = `/artifacts/${appId}/users/${userId}/materials`;
        const materialDocRef = doc(db, collectionPath, materialId);
        const materialDoc = await getDoc(materialDocRef);

        if (materialDoc.exists()) {
            const data = materialDoc.data();
            materialIdInput.value = materialId;
            formTitle.textContent = "Edit Material Purchase";
            formButtonText.textContent = "Update Purchase";
            viewAllPurchasesBtn.style.display = 'none';

            document.getElementById('material').value = data.material || '';
            document.getElementById('dealer').value = data.dealer || '';
            document.getElementById('gstNumber').value = data.gstNumber || '';
            document.getElementById('description').value = data.description || '';
            document.getElementById('quantity').value = data.quantity || '';
            document.getElementById('stock').value = data.stock || '';
            document.getElementById('quantityUnit').value = data.quantityUnit || 'kg';
            document.getElementById('pricePerUnit').value = data.pricePerUnit || '';
            document.getElementById('updatedCostPerUnit').value = data.updatedCostPerUnit || '';
            document.getElementById('price').value = data.price || '';
            document.getElementById('gst').value = data.gst || 0;
            document.getElementById('hamali').value = data.hamali || 0;
            document.getElementById('transportation').value = data.transportation || 0;

            currentBillPhotoUrl = data.billPhotoUrl || null;
            handleFileSelect();
            updatePriceLabel();
        } else {
            showMessage("Material not found for editing.", 'error');
            materialIdInput.value = '';
            materialForm.reset();
        }
    } catch (error) {
        console.error("Error loading material for edit:", error);
        showMessage("Error loading material for editing. Please try again.", 'error');
        materialIdInput.value = '';
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
            // Fill the fields with the latest data
            document.getElementById('dealer').value = latestData.dealer || '';
            document.getElementById('gstNumber').value = latestData.gstNumber || '';
            document.getElementById('quantityUnit').value = latestData.quantityUnit || 'kg';
            document.getElementById('pricePerUnit').value = latestData.pricePerUnit || '';
            document.getElementById('updatedCostPerUnit').value = latestData.updatedCostPerUnit || '';
            document.getElementById('stock').value = latestData.stock || '';
            showMessage(`Loaded recent data for "${materialName}".`, 'info');
            
            // Recalculate total price
            calculateTotalPrice();
        } else {
            // If no data is found, reset the fields
            document.getElementById('dealer').value = '';
            document.getElementById('gstNumber').value = '';
            document.getElementById('stock').value = '';
            document.getElementById('pricePerUnit').value = '';
            document.getElementById('updatedCostPerUnit').value = '';
            document.getElementById('price').value = '';
            showMessage('This is a new material.', 'info');
        }
    }
}


// Event listeners
materialInput.addEventListener('change', handleMaterialInputBlur); // Use 'change' event to trigger on blur
quantityInput.addEventListener('input', calculateTotalPrice);
quantityUnitSelect.addEventListener('change', updatePriceLabel);
pricePerUnitInput.addEventListener('input', calculateTotalPrice);
fileInput.addEventListener('change', handleFileSelect);


materialForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const form = e.target;
    const button = form.querySelector('.btn');
    const buttonText = document.getElementById('buttonText');
    const loadingIndicator = document.getElementById('loadingIndicator');

    button.disabled = true;
    buttonText.classList.add('hidden');
    loadingIndicator.classList.remove('hidden');

    try {
        await initializeFirebase();
        
        // Get data from the form
        const existingMaterialId = materialIdInput.value;
        const collectionPath = `/artifacts/${appId}/users/${userId}/materials`;

        let dataToSave = {
            material: form.material.value.trim(),
            dealer: form.dealer.value || null,
            gstNumber: form.gstNumber.value || null,
            description: form.description.value || null,
            quantity: parseFloat(form.quantity.value),
            quantityUnit: form.quantityUnit.value,
            stock: parseFloat(form.stock.value),
            pricePerUnit: parseFloat(form.pricePerUnit.value),
            updatedCostPerUnit: parseFloat(form.updatedCostPerUnit.value),
            price: parseFloat(document.getElementById('price').value),
            gst: parseFloat(form.gst.value),
            hamali: parseFloat(form.hamali.value),
            transportation: parseFloat(form.transportation.value),
        };

        let billPhotoUrl = currentBillPhotoUrl;
        const file = fileInput.files[0];
        if (file) {
            const storage = getStorage();
            const storageRef = ref(storage, `user-uploads/${userId}/bills/${Timestamp.now().toMillis()}_${file.name}`);
            const uploadTask = await uploadBytes(storageRef, file);
            billPhotoUrl = await getDownloadURL(uploadTask.ref);
            showMessage('Bill photo uploaded successfully!', 'info');
            dataToSave.billPhotoUrl = billPhotoUrl;
        }

        if (!existingMaterialId) {
            // This is a new purchase, so always add a new document
            dataToSave.timestamp = Timestamp.now();
            await addDoc(collection(db, collectionPath), dataToSave);
            showMessage('New material added successfully!', 'success');
            form.reset();
            priceInput.value = '';
            handleFileSelect();
        } else {
            // This is edit mode (came from the URL), so update the existing document
            dataToSave.updatedAt = Timestamp.now();
            await updateDoc(doc(db, collectionPath, existingMaterialId), dataToSave);
            showMessage('Material updated successfully!', 'success');
            window.location.href = 'all-materials.html';
        }

    } catch (error) {
        console.error("Error submitting document: ", error);
        if (error.code === 'permission-denied') {
            showMessage('Permission denied. Please check your Firestore security rules.', 'error');
        } else {
            showMessage('Failed to submit material. Please check the form and try again.', 'error');
        }
    } finally {
        button.disabled = false;
        buttonText.classList.remove('hidden');
        loadingIndicator.classList.add('hidden');
    }
});


// Page load logic
window.addEventListener('load', async () => {
    try {
        await initializeFirebase();
        
        // Check for a materialId from the URL
        const urlParams = new URLSearchParams(window.location.search);
        const editId = urlParams.get('editId');
        
        if (editId) {
            loadMaterialForEdit(editId);
        } else {
            // New entry mode
            document.getElementById('materialId').value = '';
            formTitle.textContent = "Add New Material";
            formButtonText.textContent = "+ Add Purchase";
            viewAllPurchasesBtn.style.display = 'inline-flex';
        }

    } catch (err) {
        console.error("Initialization failed:", err);
        showMessage("Firebase initialization failed. Please check your connection.", "error");
    }
});

// Drawer toggle logic (reused from other pages)
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
