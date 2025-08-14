// firebase-config.js

// Firebase modules from the shared config file.
// साझा कॉन्फ़िगरेशन फ़ाइल से Firebase मॉड्यूल.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, onSnapshot, addDoc, getDocs, doc, setDoc, query, where, Timestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Firebase configuration for your web app.
// आपके वेब ऐप के लिए Firebase कॉन्फ़िगरेशन.
// आपको यह कॉन्फ़िगरेशन आपके FlutterFire फ़ाइल से प्राप्त हुआ है.
const firebaseConfig = {
    apiKey: 'AIzaSyDPdyMpNZjbc_ktg79U9IAZnmzafSbD8-Q',
    authDomain: 'ayushman-bhava-11a4f.firebaseapp.com',
    projectId: 'ayushman-bhava-11a4f',
    storageBucket: 'ayushman-bhava-11a4f.firebasestorage.app',
    messagingSenderId: '885564236048',
    appId: '1:885564236048:web:205070b576e56baebb8595'
};

const appId = firebaseConfig.appId;

let db;
let auth;
let userId;

/**
 * Initializes Firebase and authenticates the user.
 * Firebase को इनिशियलाइज़ करता है और उपयोगकर्ता को प्रमाणित करता है।
 * यह एक Promise लौटाता है ताकि हम सुनिश्चित कर सकें कि Firebase पूरी तरह से तैयार है।
 */
const initializeFirebase = async () => {
    return new Promise((resolve, reject) => {
        try {
            if (db && auth) {
                console.log("Firebase already initialized.");
                resolve();
                return;
            }

            const app = initializeApp(firebaseConfig);
            db = getFirestore(app);
            auth = getAuth(app);
            
            const unsubscribe = onAuthStateChanged(auth, (user) => {
                if (user) {
                    userId = user.uid;
                    console.log("Authenticated with user ID:", userId);
                } else {
                    userId = null;
                    console.log("No user is signed in.");
                }
                unsubscribe();
                resolve();
            });
            
        } catch (err) {
            console.error("Firebase initialization or authentication error:", err);
            reject(err);
        }
    });
};

export { db, auth, userId, appId, initializeFirebase, collection, onSnapshot, addDoc, getDocs, doc, setDoc, query, where, Timestamp };
