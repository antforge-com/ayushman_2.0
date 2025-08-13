import { db, userId, appId, initializeFirebase, collection, addDoc, Timestamp } from "./firebase-config.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";
import { getDoc, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// DOM elements ko access karein
const quantityInput = document.getElementById('quantity');
const quantityUnitSelect = document.getElementById('quantityUnit');
let lastUnit = quantityUnitSelect.value;
const pricePerUnitInput = document.getElementById('pricePerUnit');
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

let currentBillPhotoUrl = null; // Edit mode mein current bill photo URL ko store karne ke liye

/**
 * User ko message dikhata hai.
 * @param {string} message Dikhane wala message.
 * @param {string} type Message ka prakar ('success', 'error', 'info').
 */
function showMessage(message, type) {
    const msgDiv = document.getElementById('addMaterialMsg');
    msgDiv.textContent = message;
    // Template literal ka sahi upyog kar rahe hain
    msgDiv.className = `message-box message-${type}`;
    msgDiv.classList.remove('hidden');
    setTimeout(() => {
        msgDiv.classList.add('hidden');
    }, 5000);
}
        
/**
 * Quantity Unit ke aadhar par price label aur placeholder update karta hai.
 */
function updatePriceLabel() {
    // Detect unit change
    const previousUnit = lastUnit;
    const currentUnit = quantityUnitSelect.value;
    lastUnit = currentUnit;

    if (currentUnit === 'kg') {
        priceLabel.textContent = "Price per kg";
        pricePerUnitInput.placeholder = "Price per kg";
        // If previous unit was gram, convert pricePerUnit to per kg
        if (previousUnit === 'gram' && pricePerUnitInput.value && !isNaN(parseFloat(pricePerUnitInput.value))) {
            pricePerUnitInput.value = (parseFloat(pricePerUnitInput.value) * 1000).toFixed(2);
        }
    } else {
        priceLabel.textContent = "Price per gram";
        pricePerUnitInput.placeholder = "Price per gram";
        // If previous unit was kg, convert pricePerUnit to per gram
        if (previousUnit === 'kg' && pricePerUnitInput.value && !isNaN(parseFloat(pricePerUnitInput.value))) {
            pricePerUnitInput.value = (parseFloat(pricePerUnitInput.value) / 1000).toFixed(4);
        }
    }
    calculateTotalPrice();
}

/**
 * Quantity aur price per unit ke aadhar par total price calculate karta hai.
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
 * File input mein change hone par file ka naam aur preview update karta hai.
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
 * Edit mode ke liye form ko data se populate karta hai.
 * @param {string} materialId - Edit karne ke liye material ka ID.
 */
async function loadMaterialForEdit(materialId) {
    try {
        await initializeFirebase();
        if (!db || !userId) {
            throw new Error("User is not authenticated. Cannot load data.");
        }
        
        // Template literal ko sahi karein
        const collectionPath = `/artifacts/${appId}/users/${userId}/materials`;

        // Document ID ke aadhar par ek specific document fetch karne ke liye
        // `getDoc` aur `doc` ka sahi upyog kar rahe hain
        const materialDocRef = doc(db, collectionPath, materialId);
        const materialDoc = await getDoc(materialDocRef);
        
        if (materialDoc.exists()) {
            const data = materialDoc.data();
            materialIdInput.value = materialId;
            formTitle.textContent = "Edit Material Purchase";
            formButtonText.textContent = "Update Purchase";
            viewAllPurchasesBtn.style.display = 'none'; // "View All Purchases" button ko hide karein
            
            // Form fields ko data se populate karein
            document.getElementById('material').value = data.material || '';
            document.getElementById('dealer').value = data.dealer || '';
            document.getElementById('gstNumber').value = data.gstNumber || '';
            document.getElementById('description').value = data.description || '';
            document.getElementById('quantity').value = data.quantity || '';
            document.getElementById('quantityUnit').value = data.quantityUnit || 'kg';
            document.getElementById('pricePerUnit').value = data.pricePerUnit || '';
            document.getElementById('price').value = data.price || '';
            document.getElementById('gst').value = data.gst || 0;
            document.getElementById('hamali').value = data.hamali || 0;
            document.getElementById('transportation').value = data.transportation || 0;
            
            currentBillPhotoUrl = data.billPhotoUrl || null;
            handleFileSelect(); // File preview update karein
            updatePriceLabel(); // Calculation ko trigger karein
        } else {
            showMessage("Material not found for editing.", 'error');
            // Form ko reset karein agar material nahi mila
            materialIdInput.value = '';
            materialForm.reset();
        }
    } catch (error) {
        console.error("Error loading material for edit:", error);
        showMessage("Error loading material for editing. Please try again.", 'error');
        materialIdInput.value = '';
    }
}


// Event listeners
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
        
        const materialId = materialIdInput.value;
        const isEditMode = !!materialId;

        const material = form.material.value;
        const dealer = form.dealer.value || null;
        const gstNumber = form.gstNumber.value || null;
        const description = form.description.value || null;
        const quantity = parseFloat(form.quantity.value);
        const quantityUnit = form.quantityUnit.value;
        const pricePerUnit = parseFloat(form.pricePerUnit.value);
        const price = parseFloat(document.getElementById('price').value);
        const gst = parseFloat(form.gst.value);
        const hamali = parseFloat(form.hamali.value);
        const transportation = parseFloat(form.transportation.value);
        
        if (!db || !userId) {
            throw new Error("User is not authenticated. Please log in and try again.");
        }

        let billPhotoUrl = currentBillPhotoUrl;
        const file = fileInput.files[0];
        if (file) {
            const storage = getStorage();
            // Template literal ko sahi karein
            const storageRef = ref(storage, `user-uploads/${userId}/bills/${Timestamp.now().toMillis()}_${file.name}`);
            const uploadTask = await uploadBytes(storageRef, file);
            billPhotoUrl = await getDownloadURL(uploadTask.ref);
            showMessage('Bill photo uploaded successfully!', 'info');
        }
        
        const dataToSave = {
            material,
            dealer,
            gstNumber,
            description,
            quantity,
            quantityUnit,
            pricePerUnit,
            price,
            gst,
            hamali,
            transportation,
            billPhotoUrl,
        };

        // Template literal ko sahi karein
        const collectionPath = `/artifacts/${appId}/users/${userId}/materials`;
        if (isEditMode) {
            dataToSave.updatedAt = Timestamp.now();
            await updateDoc(doc(db, collectionPath, materialId), dataToSave);
            showMessage('Material updated successfully!', 'success');
            // Go back to all materials page after update
            window.location.href = 'all-materials.html';
        } else {
            dataToSave.timestamp = Timestamp.now();
            await addDoc(collection(db, collectionPath), dataToSave);
            showMessage('Material added successfully!', 'success');
            form.reset();
            priceInput.value = '';
            handleFileSelect();
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
        
        // URL se materialId ko check karein
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
