import { db, auth, appId, initializeFirebase, collection, onSnapshot, query, where, Timestamp } from './firebase-config.js';

const materialsListContainer = document.getElementById('materialsList');
const searchBtn = document.getElementById('searchBtn');
const searchModal = document.getElementById('searchModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const searchOptions = document.getElementById('searchOptions');
const searchByDealerBtn = document.getElementById('searchByDealerBtn');
const searchByDateBtn = document.getElementById('searchByDateBtn');
const dealerSearchForm = document.getElementById('dealerSearchForm');
const dateSearchForm = document.getElementById('dateSearchForm');

let unsubscribe = null; // Firestore listener के लिए unsubscribe function store करने के लिए variable.

/**
 * जांच करता है कि उपयोगकर्ता प्रमाणित (authenticated) है या नहीं और डेटा श्रोता (listener) को सेट करता है।
 */
const setupAuthCheck = async () => {
    try {
        await initializeFirebase();
    } catch (err) {
        console.error("Firebase initialization failed:", err);
        materialsListContainer.innerHTML = '<div class="message-box message-error">Error connecting to the database.</div>';
        return;
    }

    auth.onAuthStateChanged(user => {
        if (user) {
            setupMaterialListener(user.uid);
        } else {
            console.log("No user is signed in. Redirecting to login page.");
            window.location.href = 'login.html';
        }
    });
};

/**
 * वर्तमान उपयोगकर्ता के लिए materials collection पर एक real-time listener सेट करता है।
 * @param {string} currentUserId - वर्तमान में login हुए उपयोगकर्ता का ID.
 * @param {object} optionalQuery - एक वैकल्पिक Firestore query जो एक filter लागू करने के लिए है।
 */
const setupMaterialListener = (currentUserId, optionalQuery = []) => {
    if (unsubscribe) {
        unsubscribe(); // पिछले listener से unsubscribe करें
    }

    if (!db || !currentUserId) {
        console.error("Database or user ID not available.");
        materialsListContainer.innerHTML = '<div class="message-box message-error">Could not retrieve data. Please log in again.</div>';
        return;
    }

    const collectionPath = `/artifacts/${appId}/users/${currentUserId}/materials`;
    let baseQuery = collection(db, collectionPath);
    let finalQuery = query(baseQuery, ...optionalQuery);
    
    // NOTE: Sorting is now done client-side to avoid index issues with Firestore.
    // Firestore queries will not work with `orderBy` on multiple fields without a composite index.

    unsubscribe = onSnapshot(finalQuery, (snapshot) => {
        const materials = [];
        snapshot.forEach(doc => {
            materials.push({ id: doc.id, ...doc.data() });
        });

        // नए timestamp के अनुसार client-side पर सामग्री को sort करें।
        materials.sort((a, b) => {
            const timestampA = a.timestamp ? a.timestamp.toDate() : new Date(0);
            const timestampB = b.timestamp ? b.timestamp.toDate() : new Date(0);
            return timestampB - timestampA;
        });

        displayMaterials(materials);
    }, (error) => {
        console.error("Error listening to materials: ", error);
        materialsListContainer.innerHTML = '<div class="message-box message-error">Error loading data.</div>';
    });
};

/**
 * UI में सामग्रियों को गतिशील रूप से प्रदर्शित (dynamically display) करता है।
 * @param {Array} materials - प्रदर्शित होने वाली सामग्रियों की सूची।
 */
const displayMaterials = (materials) => {
    if (materials.length === 0) {
        materialsListContainer.innerHTML = '<div class="message-box">No materials have been added yet.</div>';
        return;
    }

    const materialCards = materials.map(item => {
        const date = item.timestamp ? item.timestamp.toDate().toLocaleDateString() : 'N/A';
        const time = item.timestamp ? item.timestamp.toDate().toLocaleTimeString() : 'N/A';
        
        const pricePerUnit = item.pricePerUnit !== undefined ? `₹${item.pricePerUnit}` : 'N/A';
        const quantity = item.quantity !== undefined ? `${item.quantity}` : 'N/A';
        const unit = item.quantityUnit || 'N/A';
        const price = item.price !== undefined ? `₹${item.price.toFixed(2)}` : 'N/A';
        const gst = item.gst !== undefined ? `₹${item.gst.toFixed(2)}` : 'N/A';
        const hamali = item.hamali !== undefined ? `₹${item.hamali.toFixed(2)}` : 'N/A';
        const total = (item.price !== undefined && item.gst !== undefined && item.hamali !== undefined) ? 
                      `₹${(item.price + item.gst + item.hamali).toFixed(2)}` : 'N/A';

        return `
            <article class="purchase-card">
                <header class="purchase-header flex justify-between items-center" data-id="${item.id}">
                    <h3>${item.material || 'Material Name'}</h3>
                    <i class="fa-solid fa-chevron-down toggle-icon"></i>
                </header>
                <div class="purchase-body hidden" id="details-${item.id}">
                    <div class="purchase-details flex flex-col gap-2">
                        <p><strong>Dealer:</strong> <span>${item.dealer || 'Dealer'}</span></p>
                        <p><strong>Quantity:</strong> <span>${quantity} ${unit}</span></p>
                        <p><strong>Price per unit:</strong> <span>${pricePerUnit}</span></p>
                        <p><strong>Total Price:</strong> <span>${price}</span></p>
                        <p><strong>GST Amount:</strong> <span>${gst}</span></p>
                        <p><strong>Hamali:</strong> <span>${hamali}</span></p>
                        <p><strong>Grand Total:</strong> <span>${total}</span></p>
                        <p><strong>Added on:</strong> <span>${date} at ${time}</span></p>
                    </div>
                </div>
            </article>
        `;
    }).join('');

    materialsListContainer.innerHTML = materialCards;

    // हर कार्ड के header पर event listener जोड़ें
    document.querySelectorAll('.purchase-header').forEach(header => {
        header.addEventListener('click', (event) => {
            const cardBody = document.getElementById(`details-${header.dataset.id}`);
            const isExpanded = cardBody.classList.contains('expanded');
            
            // Toggle the visibility of the details section
            cardBody.classList.toggle('expanded');
            header.classList.toggle('expanded');
            
            // Toggle the icon
            const icon = header.querySelector('.toggle-icon');
            if (icon) {
                icon.style.transform = isExpanded ? 'rotate(0deg)' : 'rotate(180deg)';
            }
        });
    });
};

// Modal and Search Logic
searchBtn.addEventListener('click', () => {
    searchModal.classList.remove('hidden');
});

closeModalBtn.addEventListener('click', () => {
    searchModal.classList.add('hidden');
    searchOptions.classList.remove('hidden');
    dealerSearchForm.classList.add('hidden');
    dateSearchForm.classList.add('hidden');
});

searchByDealerBtn.addEventListener('click', () => {
    searchOptions.classList.add('hidden');
    dealerSearchForm.classList.remove('hidden');
});

searchByDateBtn.addEventListener('click', () => {
    searchOptions.classList.add('hidden');
    dateSearchForm.classList.remove('hidden');
});

dealerSearchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const dealerName = document.getElementById('dealerName').value.trim();
    if (dealerName) {
        const user = auth.currentUser;
        const searchQueries = [where('dealer', '==', dealerName)];
        setupMaterialListener(user.uid, searchQueries);
        searchModal.classList.add('hidden');
        searchOptions.classList.remove('hidden');
        dealerSearchForm.classList.add('hidden');
    }
});

dateSearchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const purchaseDateStr = document.getElementById('purchaseDate').value;
    if (purchaseDateStr) {
        const startDate = new Date(purchaseDateStr);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(purchaseDateStr);
        endDate.setHours(23, 59, 59, 999);
        
        const user = auth.currentUser;
        const searchQueries = [
            where('timestamp', '>=', Timestamp.fromDate(startDate)),
            where('timestamp', '<=', Timestamp.fromDate(endDate))
        ];
        setupMaterialListener(user.uid, searchQueries);
        searchModal.classList.add('hidden');
        searchOptions.classList.remove('hidden');
        dateSearchForm.classList.add('hidden');
    }
});

// Drawer toggle logic (reused from index.html)
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

// Start the authentication check on page load
window.onload = setupAuthCheck;
