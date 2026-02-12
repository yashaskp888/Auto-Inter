// Import the functions you need from the SDKs you need
import { initializeApp,getApp,getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAoXeE1Cn1SR94M4DtRwDkk0J8Imf0niPU",
  authDomain: "auto-inter.firebaseapp.com",
  projectId: "auto-inter",
  storageBucket: "auto-inter.firebasestorage.app",
  messagingSenderId: "830870903379",
  appId: "1:830870903379:web:8a428da59acc967d0b84a6",
  measurementId: "G-HNJ3S7F3S0"
};

// Initialize Firebase
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);