/**
 * Configuração do Firebase Client SDK
 * 
 * Este arquivo lê as credenciais do Firebase de variáveis de ambiente.
 * 
 * Para desenvolvimento local:
 * - Crie um arquivo .env na raiz do projeto com:
 *   VITE_FIREBASE_API_KEY=...
 *   VITE_FIREBASE_AUTH_DOMAIN=...
 *   etc.
 * 
 * Para produção (GitHub Actions):
 * - Configure os secrets no GitHub (Settings > Secrets and variables > Actions)
 * - Os secrets serão automaticamente disponibilizados como variáveis de ambiente durante o build
 * 
 * Para obter as credenciais:
 * 1. Acesse Firebase Console (https://console.firebase.google.com)
 * 2. Selecione seu projeto
 * 3. Vá em Project Settings > General
 * 4. Role até "Your apps" e clique em "Web app"
 * 5. Copie os valores do objeto firebaseConfig
 */

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || ""
};
