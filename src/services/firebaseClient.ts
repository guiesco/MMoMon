/**
 * Firebase Client SDK
 * 
 * Este módulo gerencia autenticação e sincronização em tempo real com Firebase.
 * O cliente tem acesso SOMENTE LEITURA aos seus próprios dados (via regras de segurança).
 * Todas as escritas são feitas pelo servidor via Admin SDK.
 */

import { initializeApp, FirebaseApp } from 'firebase/app';
import { 
  getAuth, 
  Auth,
  signInAnonymously,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { 
  getFirestore, 
  Firestore,
  doc,
  onSnapshot,
  Unsubscribe
} from 'firebase/firestore';

// Importar configuração
import { firebaseConfig } from './firebaseConfig';

// ============================================================================
// INICIALIZAÇÃO
// ============================================================================

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let currentUser: User | null = null;
let unsubscribeAuth: (() => void) | null = null;
let unsubscribeUserData: Unsubscribe | null = null;

/**
 * Inicializa Firebase Client SDK
 */
export function initializeFirebaseClient(): boolean {
  try {
    if (!firebaseConfig || !firebaseConfig.apiKey) {
      console.warn('[Firebase Client] ⚠️  Firebase não configurado');
      console.warn('[Firebase Client] ⚠️  apiKey está vazio. Verifique se as variáveis de ambiente estão configuradas.');
      console.warn('[Firebase Client] ⚠️  Variáveis esperadas: VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, etc.');
      if (import.meta.env.DEV) {
        console.warn('[Firebase Client] ⚠️  Em desenvolvimento, crie um arquivo .env na raiz do projeto');
      } else {
        console.warn('[Firebase Client] ⚠️  Em produção, verifique se os secrets estão configurados no GitHub Actions');
      }
      return false;
    }

    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);

    console.log('[Firebase Client] ✅ Inicializado com sucesso');
    return true;
  } catch (error) {
    console.error('[Firebase Client] ❌ Erro ao inicializar:', error);
    return false;
  }
}

/**
 * Verifica se Firebase está disponível
 */
export function isFirebaseClientAvailable(): boolean {
  return app !== null && auth !== null && db !== null;
}

// ============================================================================
// AUTENTICAÇÃO
// ============================================================================

/**
 * Faz login anônimo (para MVP - sem necessidade de email/senha)
 */
export async function signInAnonymous(): Promise<User | null> {
  if (!auth) {
    console.warn('[Firebase Client] Auth não inicializado');
    return null;
  }

  try {
    const userCredential = await signInAnonymously(auth);
    currentUser = userCredential.user;
    
    console.log('[Firebase Client] ✅ Login anônimo realizado');
    console.log(`[Firebase Client] UID: ${currentUser.uid}`);
    
    return currentUser;
  } catch (error) {
    console.error('[Firebase Client] ❌ Erro ao fazer login anônimo:', error);
    return null;
  }
}

/**
 * Faz login com email e senha
 */
export async function signInWithEmail(email: string, password: string): Promise<User | null> {
  if (!auth) {
    console.warn('[Firebase Client] Auth não inicializado');
    return null;
  }

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    currentUser = userCredential.user;
    
    console.log('[Firebase Client] ✅ Login realizado');
    console.log(`[Firebase Client] Email: ${currentUser.email}`);
    
    return currentUser;
  } catch (error) {
    console.error('[Firebase Client] ❌ Erro ao fazer login:', error);
    return null;
  }
}

/**
 * Cria nova conta com email e senha
 */
export async function createAccount(email: string, password: string): Promise<User | null> {
  if (!auth) {
    console.warn('[Firebase Client] Auth não inicializado');
    return null;
  }

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    currentUser = userCredential.user;
    
    console.log('[Firebase Client] ✅ Conta criada');
    console.log(`[Firebase Client] UID: ${currentUser.uid}`);
    
    return currentUser;
  } catch (error) {
    console.error('[Firebase Client] ❌ Erro ao criar conta:', error);
    return null;
  }
}

/**
 * Retorna usuário atualmente autenticado
 */
export function getCurrentUser(): User | null {
  return currentUser;
}

/**
 * Retorna UID do usuário autenticado
 */
export function getUserId(): string | null {
  return currentUser?.uid || null;
}

/**
 * Escuta mudanças no estado de autenticação
 */
export function onAuthChange(callback: (user: User | null) => void): void {
  if (!auth) {
    console.warn('[Firebase Client] Auth não inicializado');
    return;
  }

  unsubscribeAuth = onAuthStateChanged(auth, (user) => {
    currentUser = user;
    callback(user);
  });
}

// ============================================================================
// SINCRONIZAÇÃO DE DADOS
// ============================================================================

export interface UserData {
  profile: {
    displayName: string;
    createdAt: Date;
    lastLogin: Date;
    totalPlayTime: number;
  };
  inventory: {
    items: Record<string, number>;
    teamSlots: number;
    movementSpeedBonus: number;
    captureChanceBonus: number;
    inventoryCapacity: number;
  };
  creatures: Record<string, any>;
  activeTeam: {
    creatureIds: string[];
    selectedMapId: string;
  };
  stats: {
    expeditionsCompleted: number;
    expeditionsFailed: number;
    totalResourcesCollected: number;
    totalCreaturesCaptured: number;
    totalDamageDealt: number;
    totalDamageTaken: number;
  };
}

/**
 * Escuta mudanças nos dados do usuário em tempo real
 */
export function subscribeToUserData(
  userId: string,
  callback: (data: UserData | null) => void
): Unsubscribe | null {
  if (!db) {
    console.warn('[Firebase Client] Firestore não inicializado');
    return null;
  }

  const userRef = doc(db, 'users', userId);

  unsubscribeUserData = onSnapshot(
    userRef,
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as UserData;
        const creaturesCount = Object.keys(data.creatures || {}).length;
        console.log('[Firebase Client] 📥 Dados sincronizados do servidor');
        console.log(`[Firebase Client] 📥 Criaturas no snapshot: ${creaturesCount}`);
        console.log(`[Firebase Client] 📥 IDs das criaturas:`, Object.keys(data.creatures || {}));
        callback(data);
      } else {
        console.warn('[Firebase Client] ⚠️  Usuário não encontrado no Firestore');
        callback(null);
      }
    },
    (error) => {
      console.error('[Firebase Client] ❌ Erro ao escutar dados do usuário:', error);
      callback(null);
    }
  );

  return unsubscribeUserData;
}

/**
 * Para de escutar mudanças nos dados do usuário
 */
export function unsubscribeFromUserData(): void {
  if (unsubscribeUserData) {
    unsubscribeUserData();
    unsubscribeUserData = null;
    console.log('[Firebase Client] 🔌 Desconectado da sincronização');
  }
}

// ============================================================================
// CLEANUP
// ============================================================================

/**
 * Limpa todas as conexões e listeners
 */
export function cleanupFirebaseClient(): void {
  if (unsubscribeAuth) {
    unsubscribeAuth();
    unsubscribeAuth = null;
  }

  unsubscribeFromUserData();

  currentUser = null;
  console.log('[Firebase Client] 🧹 Cleanup completo');
}
