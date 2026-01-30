# 🔥 Guia de Setup Firebase

Este guia explica como configurar o Firebase para persistir dados do jogo na nuvem.

---

## 📋 Pré-requisitos

- Conta Google (para acessar Firebase Console)
- Node.js instalado (já configurado no projeto)
- Dependências instaladas (`npm install` já executado)

---

## 🚀 Passo a Passo

### 1. Criar Projeto no Firebase Console

1. Acesse [Firebase Console](https://console.firebase.google.com)
2. Clique em **"Adicionar projeto"**
3. Nome do projeto: `pokextract` (ou outro nome de sua preferência)
4. Desabilite Google Analytics (opcional para MVP)
5. Clique em **"Criar projeto"**

### 2. Configurar Firestore Database

1. No menu lateral, clique em **"Firestore Database"**
2. Clique em **"Criar banco de dados"**
3. Escolha **"Iniciar no modo de produção"** (vamos configurar regras depois)
4. Escolha a localização mais próxima (ex: `southamerica-east1` para Brasil)
5. Clique em **"Ativar"**

### 3. Configurar Regras de Segurança

1. No Firestore, vá em **"Regras"**
2. Copie o conteúdo do arquivo `firestore.rules` do projeto
3. Cole no editor de regras do Firebase Console
4. Clique em **"Publicar"**

### 4. Configurar Authentication

1. No menu lateral, clique em **"Authentication"**
2. Clique em **"Começar"**
3. Ative o provedor **"Anônimo"** (para MVP)
4. (Opcional) Ative **"E-mail/senha"** para contas permanentes
5. Clique em **"Salvar"**

### 5. Configurar Servidor (Firebase Admin SDK)

#### 5.1. Gerar Chave de Conta de Serviço

1. No Firebase Console, clique no ícone de engrenagem ⚙️ > **"Configurações do projeto"**
2. Vá na aba **"Contas de serviço"**
3. Clique em **"Gerar nova chave privada"**
4. Confirme e baixe o arquivo JSON

#### 5.2. Configurar no Projeto

1. Renomeie o arquivo baixado para `firebase-service-account.json`
2. Mova para a pasta `server/` do projeto:
   ```bash
   mv ~/Downloads/pokextract-*.json server/firebase-service-account.json
   ```
3. **IMPORTANTE**: Verifique que o arquivo está no `.gitignore` (já configurado)

### 6. Configurar Cliente (Firebase Client SDK)

#### 6.1. Obter Credenciais do App Web

1. No Firebase Console, vá em **"Configurações do projeto"**
2. Role até **"Seus aplicativos"**
3. Clique no ícone **"Web"** (`</>`)
4. Apelido do app: `pokextract-web`
5. **NÃO** marque "Configurar Firebase Hosting"
6. Clique em **"Registrar app"**
7. Copie o objeto `firebaseConfig` que aparece

#### 6.2. Configurar no Projeto

1. Copie o arquivo de exemplo:
   ```bash
   cp src/services/firebaseConfig.example.ts src/services/firebaseConfig.ts
   ```

2. Edite `src/services/firebaseConfig.ts` e cole suas credenciais:
   ```typescript
   export const firebaseConfig = {
     apiKey: "AIza...",
     authDomain: "pokextract.firebaseapp.com",
     projectId: "pokextract",
     storageBucket: "pokextract.appspot.com",
     messagingSenderId: "123456789",
     appId: "1:123456789:web:abc123"
   };
   ```

3. **IMPORTANTE**: Verifique que o arquivo está no `.gitignore` (já configurado)

---

## ✅ Verificar Instalação

### Testar Servidor

1. Inicie o servidor:
   ```bash
   cd server
   npm run dev
   ```

2. Verifique os logs:
   ```
   === Inicializando Firebase ===
   [Firebase] ✅ Inicializado com sucesso
   [Firebase] ℹ️  Projeto: pokextract
   ✅ Firebase configurado - dados serão persistidos na nuvem
   ```

### Testar Cliente

1. Inicie o cliente:
   ```bash
   npm run dev
   ```

2. Abra o console do navegador (F12)
3. Verifique os logs:
   ```
   [Firebase Client] ✅ Inicializado com sucesso
   [Firebase Client] ✅ Login anônimo realizado
   [Firebase Client] UID: abc123...
   [PlayerState] ✅ Firebase conectado - sincronização ativa
   ```

---

## 🧪 Testar Persistência

### Teste 1: Completar Expedição

1. Inicie uma expedição
2. Colete recursos e capture criaturas
3. Complete a extração
4. Verifique os logs do servidor:
   ```
   [Firestore] ✅ Recompensas salvas para usuário abc123
   [Firestore] ℹ️  Recursos: 5, Criaturas: 2
   ```

### Teste 2: Verificar no Firebase Console

1. Acesse Firebase Console > Firestore Database
2. Você deve ver:
   - Coleção `users` com seu UID
   - Coleção `expeditions` com histórico

### Teste 3: Multi-Dispositivo (Opcional)

1. Abra o jogo em outro navegador/dispositivo
2. Use o mesmo UID (ou implemente login com email)
3. Verifique que o progresso está sincronizado

---

## 🔧 Troubleshooting

### Erro: "Firebase não disponível"

**Causa**: Arquivo `firebase-service-account.json` não encontrado

**Solução**:
1. Verifique se o arquivo está em `server/firebase-service-account.json`
2. Verifique se o nome está correto (sem espaços ou caracteres especiais)

### Erro: "Permission denied"

**Causa**: Regras de segurança não configuradas corretamente

**Solução**:
1. Vá em Firestore > Regras
2. Copie o conteúdo de `firestore.rules`
3. Publique as regras

### Erro: "Auth não inicializado"

**Causa**: Arquivo `firebaseConfig.ts` não encontrado ou inválido

**Solução**:
1. Verifique se `src/services/firebaseConfig.ts` existe
2. Verifique se as credenciais estão corretas
3. Verifique se Authentication está ativado no Firebase Console

### Dados não sincronizam

**Causa**: Cliente não está autenticado

**Solução**:
1. Verifique logs do console: deve mostrar "Login anônimo realizado"
2. Verifique se Authentication > Anônimo está ativado
3. Limpe cache do navegador e recarregue

---

## 📊 Monitoramento

### Ver Dados no Firestore

1. Firebase Console > Firestore Database
2. Navegue pelas coleções:
   - `users/{userId}`: Dados do jogador
   - `expeditions/{expeditionId}`: Histórico de expedições

### Ver Usuários Autenticados

1. Firebase Console > Authentication
2. Aba "Usuários": lista de todos os usuários (anônimos e com email)

### Ver Uso e Custos

1. Firebase Console > Uso e faturamento
2. Monitore:
   - Leituras do Firestore
   - Escritas do Firestore
   - Autenticações

**Plano Gratuito (Spark)**:
- 50k leituras/dia
- 20k escritas/dia
- 1GB armazenamento
- Suficiente para MVP e testes

---

## 🎯 Próximos Passos

### Implementado ✅

- [x] Setup Firebase Admin SDK no servidor
- [x] Setup Firebase Client SDK no cliente
- [x] Autenticação anônima
- [x] Salvamento de recompensas de expedição
- [x] Sincronização em tempo real
- [x] Fallback para localStorage

### Futuro 🚀

- [ ] Autenticação com email/senha
- [ ] Migração de dados do localStorage para Firebase
- [ ] Leaderboards globais
- [ ] Histórico de expedições na UI
- [ ] Trading entre jogadores
- [ ] Achievements/Conquistas

---

## 📚 Referências

- [Firebase Documentation](https://firebase.google.com/docs)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)
- [Firebase Authentication](https://firebase.google.com/docs/auth)
- [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup)

---

## ⚠️ Segurança

### ✅ O que está protegido

- Servidor usa Admin SDK (acesso total, bypass de regras)
- Cliente usa SDK normal (acesso restrito por regras)
- Regras impedem que cliente escreva diretamente
- Todas as escritas passam pelo servidor
- Validação server-side de todas as ações

### ❌ O que NÃO fazer

- **NUNCA** commite `firebase-service-account.json`
- **NUNCA** commite `firebaseConfig.ts`
- **NUNCA** exponha credenciais em código público
- **NUNCA** desabilite regras de segurança

---

## 💡 Dicas

1. **Desenvolvimento Local**: Firebase funciona offline com emuladores (opcional)
2. **Testes**: Use projeto separado para testes (não misture com produção)
3. **Backup**: Firestore tem backup automático (configure no console)
4. **Índices**: Firestore cria índices automaticamente quando necessário
5. **Performance**: Use batch writes para operações múltiplas (já implementado)

---

**Implementado em**: 29 de Janeiro de 2026  
**Versão**: 1.0.0  
**Status**: ✅ Pronto para uso
