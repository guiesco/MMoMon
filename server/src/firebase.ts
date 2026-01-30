/**
 * Firebase Admin SDK Configuration
 * 
 * Este módulo inicializa o Firebase Admin SDK para operações server-side.
 * O servidor tem acesso total ao Firestore via Admin SDK, ignorando regras de segurança.
 * 
 * Setup:
 * 1. Criar projeto no Firebase Console
 * 2. Gerar chave de conta de serviço (firebase-service-account.json)
 * 3. Colocar o arquivo na raiz do diretório server/
 * 4. Adicionar ao .gitignore
 */

import { initializeApp, cert, getApps, App } from 'firebase-admin/app';
import { getFirestore, Firestore, FieldValue } from 'firebase-admin/firestore';
import * as path from 'path';
import * as fs from 'fs';

let firebaseApp: App | null = null;
let firestoreDb: Firestore | null = null;

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
    // Caminho para o arquivo de credenciais
    const serviceAccountPath = path.join(__dirname, '..', 'firebase-service-account.json');

    // Verificar se o arquivo existe
    if (!fs.existsSync(serviceAccountPath)) {
      console.warn('[Firebase] ⚠️  Arquivo firebase-service-account.json não encontrado');
      console.warn('[Firebase] ⚠️  Firebase desabilitado - dados não serão persistidos na nuvem');
      console.warn('[Firebase] ℹ️  Para habilitar:');
      console.warn('[Firebase] ℹ️  1. Criar projeto no Firebase Console');
      console.warn('[Firebase] ℹ️  2. Baixar chave de conta de serviço');
      console.warn('[Firebase] ℹ️  3. Salvar como server/firebase-service-account.json');
      return;
    }

    // Carregar credenciais
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

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
