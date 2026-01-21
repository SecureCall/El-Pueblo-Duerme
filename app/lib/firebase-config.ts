

export const firebaseConfig = {
  "projectId": "studio-9015007721-ac536",
  "appId": "1:1064367864733:web:fcae731c7f8880f2b28d74",
  "apiKey": "AIzaSyCl3guWzQNlp7KasDyzIAAu6RPCG03Mw-U",
  "authDomain": "studio-9015007721-ac536.firebaseapp.com",
  "measurementId": "",
  "messagingSenderId": "1064367864733"
};

export function getAuthenticatedSdks() {
  const { initializeApp, getApps, getApp } = require("firebase/app");
  const { getAuth } = require("firebase/auth");
  const { getFirestore } = require("firebase/firestore");
  
  const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  const auth = getAuth(app);
  const firestore = getFirestore(app);
  return { auth, firestore, app };
}
