import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyC7nXy9q6HmUrzqhJ8cO2aCnrKJq4_dRac",
  authDomain: "latorre-gym.firebaseapp.com",
  projectId: "latorre-gym",
  storageBucket: "latorre-gym.firebasestorage.app",
  messagingSenderId: "397805094674",
  appId: "1:397805094674:web:ffb09f1e52a6ed8690d5cb"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
