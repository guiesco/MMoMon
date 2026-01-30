# 🚀 Firebase Quick Start

Guia rápido para começar a usar Firebase no PokéExtract.

---

## ⚡ TL;DR

```bash
# 1. Criar projeto no Firebase Console
# 2. Baixar credenciais
# 3. Configurar arquivos:

# Servidor
mv ~/Downloads/pokextract-*.json server/firebase-service-account.json

# Cliente
cp src/services/firebaseConfig.example.ts src/services/firebaseConfig.ts
# Editar firebaseConfig.ts com suas credenciais

# 4. Reiniciar
cd server && npm run dev  # Terminal 1
npm run dev               # Terminal 2
```

---

## 📚 Documentação Completa

- **Setup detalhado**: [`FIREBASE_SETUP_GUIDE.md`](FIREBASE_SETUP_GUIDE.md)
- **Resumo técnico**: [`FIREBASE_IMPLEMENTATION_SUMMARY.md`](FIREBASE_IMPLEMENTATION_SUMMARY.md)
- **Plano original**: [`FIREBASE_INTEGRATION_PLAN.md`](FIREBASE_INTEGRATION_PLAN.md)

---

## ✅ O Que Está Implementado

### Servidor
- ✅ Firebase Admin SDK
- ✅ Salvamento automático de recompensas
- ✅ Estrutura de dados completa (users, expeditions)
- ✅ Operações atômicas (batch writes)

### Cliente
- ✅ Firebase Client SDK
- ✅ Autenticação anônima automática
- ✅ Sincronização em tempo real
- ✅ Fallback para localStorage

### Segurança
- ✅ Server-authoritative (anti-cheat)
- ✅ Regras de segurança (read-only para cliente)
- ✅ Credenciais no .gitignore

---

## 🎮 Como Funciona

### Sem Firebase (Padrão)
```
Jogador → localStorage → Dados locais
```

### Com Firebase (Após Setup)
```
Jogador → Servidor → Firebase → Sincronização em tempo real
                                        ↓
                                   Todos os dispositivos
```

---

## 🔍 Como Saber Se Está Funcionando

### Logs do Servidor
```
=== Inicializando Firebase ===
[Firebase] ✅ Inicializado com sucesso
[Firebase] ℹ️  Projeto: pokextract
✅ Firebase configurado - dados serão persistidos na nuvem
```

### Logs do Cliente (Console do Navegador)
```
[Firebase Client] ✅ Inicializado com sucesso
[Firebase Client] ✅ Login anônimo realizado
[Firebase Client] UID: abc123...
[PlayerState] ✅ Firebase conectado - sincronização ativa
```

### Ao Completar Expedição
```
[Firestore] ✅ Recompensas salvas para usuário abc123
[Firestore] ℹ️  Recursos: 5, Criaturas: 2
```

---

## ❓ FAQ

### Preciso configurar Firebase para jogar?
**Não!** O jogo funciona normalmente com localStorage. Firebase é opcional.

### O que acontece se não configurar Firebase?
O jogo usa localStorage (dados locais no navegador). Funciona perfeitamente, mas sem multi-dispositivo ou backup na nuvem.

### Posso migrar dados do localStorage para Firebase?
Sim! Quando você configurar Firebase, os dados locais serão mantidos como backup. A migração automática será implementada em versão futura.

### Firebase é gratuito?
Sim! O plano gratuito (Spark) suporta:
- 50k leituras/dia
- 20k escritas/dia
- 1GB armazenamento
- Suficiente para MVP e testes

### Meus dados estão seguros?
Sim! Todas as escritas passam pelo servidor (server-authoritative). O cliente só pode ler seus próprios dados.

---

## 🆘 Problemas Comuns

### "Firebase não disponível"
- Verifique se `firebase-service-account.json` está em `server/`
- Verifique se o arquivo não tem espaços no nome

### "Auth não inicializado"
- Verifique se `src/services/firebaseConfig.ts` existe
- Copie de `firebaseConfig.example.ts` se não existir
- Preencha com suas credenciais do Firebase Console

### "Permission denied"
- Vá em Firebase Console > Firestore > Regras
- Copie o conteúdo de `firestore.rules`
- Publique as regras

---

## 📞 Suporte

- **Guia completo**: `FIREBASE_SETUP_GUIDE.md`
- **Documentação técnica**: `FIREBASE_IMPLEMENTATION_SUMMARY.md`
- **Firebase Docs**: https://firebase.google.com/docs

---

**Versão**: 1.0.0  
**Data**: 29/01/2026  
**Status**: ✅ Pronto para uso
