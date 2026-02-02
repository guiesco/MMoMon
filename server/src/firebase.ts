/**
 * Firebase Admin SDK Configuration
 * 
 * Este módulo inicializa o Firebase Admin SDK para operações server-side.
 * O servidor tem acesso total ao Firestore via Admin SDK, ignorando regras de segurança.
 * 
 * Setup:
 * 
 * Desenvolvimento Local:
 * 1. Criar projeto no Firebase Console
 * 2. Gerar chave de conta de serviço (firebase-service-account.json)
 * 3. Colocar o arquivo na raiz do diretório server/
 * 4. Adicionar ao .gitignore
 * 
 * Produção (Fly.io):
 * 1. Converter firebase-service-account.json para base64:
 *    cat firebase-service-account.json | base64 | pbcopy
 * 2. Configurar secret no Fly.io:
 *    flyctl secrets set FIREBASE_SERVICE_ACCOUNT="<cole o base64 aqui>"
 */

import { initializeApp, cert, getApps, App } from 'firebase-admin/app';
import { getFirestore, Firestore, FieldValue } from 'firebase-admin/firestore';
import * as path from 'path';
import * as fs from 'fs';

let firebaseApp: App | null = null;
let firestoreDb: Firestore | null = null;

/**
 * Carrega as credenciais do Firebase de um secret do Fly.io ou arquivo local
 */
function loadServiceAccount(): any | null {
  // Prioridade 1: Tentar ler do secret do Fly.io (produção)
  const flySecret = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (flySecret) {
    try {
      console.log('[Firebase] 🔐 Carregando credenciais do secret do Fly.io...');
      // Decodificar base64
      const decoded = Buffer.from(flySecret, 'base64').toString('utf8');
      const serviceAccount = JSON.parse(decoded);
      console.log('[Firebase] ✅ Credenciais carregadas do secret do Fly.io');
      return serviceAccount;
    } catch (error) {
      console.error('[Firebase] ❌ Erro ao decodificar secret do Fly.io:', error);
      console.warn('[Firebase] ⚠️  Tentando arquivo local como fallback...');
    }
  }

  // Prioridade 2: Tentar ler do arquivo local (desenvolvimento)
  const serviceAccountPath = path.join(__dirname, '..', 'firebase-service-account.json');
  if (fs.existsSync(serviceAccountPath)) {
    try {
      console.log('[Firebase] 📁 Carregando credenciais do arquivo local...');
      const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
      console.log('[Firebase] ✅ Credenciais carregadas do arquivo local');
      return serviceAccount;
    } catch (error) {
      console.error('[Firebase] ❌ Erro ao ler arquivo local:', error);
    }
  }

  return null;
}

/**
 * Inicializa Firebase Admin SDK
 * Pode ser chamado múltiplas vezes (é idempotente)
 */
export function initializeFirebase(): void {
  // Se já foi inicializado, não faz nada
  if (getApps().length > 0) {
    console.log('[Firebase] Já inicializado');
    return;
  }

  try {
    // Carregar credenciais (secret do Fly.io ou arquivo local)
    const serviceAccount = loadServiceAccount();

    if (!serviceAccount) {
      console.warn('[Firebase] ⚠️  Credenciais do Firebase não encontradas');
      console.warn('[Firebase] ⚠️  Firebase desabilitado - dados não serão persistidos na nuvem');
      console.warn('[Firebase] ℹ️  Para habilitar:');
      console.warn('[Firebase] ℹ️  Desenvolvimento: Colocar firebase-service-account.json em server/');
      console.warn('[Firebase] ℹ️  Produção: Configurar secret FIREBASE_SERVICE_ACCOUNT no Fly.io');
      return;
    }

    // Inicializar Firebase Admin
    firebaseApp = initializeApp({
      credential: cert(serviceAccount)
    });

    firestoreDb = getFirestore(firebaseApp);

    console.log('[Firebase] ✅ Inicializado com sucesso');
    console.log(`[Firebase] ℹ️  Projeto: ${serviceAccount.project_id}`);
  } catch (error) {
    console.error('[Firebase] ❌ Erro ao inicializar:', error);
    console.warn('[Firebase] ⚠️  Firebase desabilitado - dados não serão persistidos');
  }
}

/**
 * Retorna instância do Firestore
 * @throws Error se Firebase não foi inicializado
 */
export function getDb(): Firestore {
  if (!firestoreDb) {
    throw new Error('[Firebase] Firestore não inicializado. Chame initializeFirebase() primeiro.');
  }
  return firestoreDb;
}

/**
 * Verifica se Firebase está disponível
 */
export function isFirebaseAvailable(): boolean {
  return firestoreDb !== null;
}

/**
 * Exporta FieldValue para operações atômicas
 * Exemplos:
 * - FieldValue.increment(1)
 * - FieldValue.serverTimestamp()
 * - FieldValue.arrayUnion(item)
 */
export { FieldValue };

/**
 * Exporta tipos do Firestore
 */
export type { Firestore, DocumentReference, DocumentSnapshot, QuerySnapshot } from 'firebase-admin/firestore';
