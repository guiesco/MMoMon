# 🔥 Implementação de Autenticação e Sincronização Firebase

**Data**: 29 de Janeiro de 2026  
**Status**: ✅ Implementado e Pronto para Teste

---

## 📋 Resumo

Implementação completa de:
1. ✅ **Autenticação com Email/Senha** no AuthScene
2. ✅ **Migração de Dados** do localStorage para Firebase
3. ✅ **Sincronização no Login** (carregar dados do Firebase)
4. ✅ **Sincronização no Início da Partida** (registrar início)
5. ✅ **Sincronização no Fim da Partida** (salvar recompensas e estatísticas)

---

## 🎯 Funcionalidades Implementadas

### 1. AuthScene - Autenticação com Email/Senha

**Arquivo**: `src/scenes/AuthScene.ts`

#### Modos de Autenticação
- **Visitante (Anônimo)**: Login rápido sem email/senha
- **Login**: Entrar com conta existente
- **Registro**: Criar nova conta

#### Interface do Usuário
- Toggle entre modos (clique no texto azul)
- Campos dinâmicos baseados no modo:
  - Visitante: apenas nome do treinador
  - Login/Registro: email + senha + nome
- Mensagens de erro contextuais
- Validação de senha (mínimo 6 caracteres)

#### Códigos de Erro Tratados
- `auth/email-already-in-use`: Email já em uso
- `auth/invalid-email`: Email inválido
- `auth/weak-password`: Senha muito fraca
- `auth/user-not-found`: Usuário não encontrado
- `auth/wrong-password`: Senha incorreta

---

### 2. PlayerState - Migração de Dados

**Arquivo**: `src/game/playerState.ts`

#### Fluxo de Migração
1. **Detecção**: Verifica se usuário tem dados no Firestore
2. **Análise**: Verifica se há dados significativos no localStorage:
   - Mais de 1 criatura (além do starter)
   - Mais de 2 itens (além dos iniciais)
   - Nome diferente de "Convidado"
3. **Preparação**: Atualiza UID local para o Firebase UID
4. **Sincronização**: Dados serão enviados ao servidor na próxima ação

#### Sincronização em Tempo Real
- Listener de mudanças no Firestore (`subscribeToUserData`)
- Atualização automática quando dados mudam no servidor
- Backup local no localStorage para modo offline

---

### 3. Serviço de Sincronização

**Arquivo**: `src/services/firebaseSync.ts`

#### Endpoints Criados
- `syncPlayerStateToServer()`: Sincroniza estado completo do jogador
- `syncExpeditionRewards()`: Sincroniza recompensas de expedição
- `syncExpeditionStart()`: Registra início de expedição
- `syncExpeditionEnd()`: Registra fim de expedição com estatísticas

#### Dados Sincronizados
- **Estado do Jogador**:
  - Perfil (nome, datas)
  - Inventário (itens, capacidades)
  - Criaturas (stats, XP, rank)
  - Time ativo
  - Estatísticas gerais

- **Expedição**:
  - Recursos coletados
  - Criaturas capturadas
  - Dano causado/recebido
  - Duração
  - Sucesso/Falha

---

### 4. Servidor HTTP

**Arquivo**: `server/src/httpServer.ts`

#### Servidor Express
- Porta: `3001`
- CORS habilitado
- JSON body parser

#### Endpoints REST

##### `GET /health`
Verifica status do servidor e Firebase
```json
{
  "status": "ok",
  "firebase": true,
  "timestamp": 1706543210000
}
```

##### `POST /api/sync-player`
Sincroniza estado completo do jogador
```json
{
  "userId": "abc123",
  "progress": { /* PlayerProgress */ }
}
```

##### `POST /api/sync-expedition-rewards`
Sincroniza recompensas de expedição
```json
{
  "userId": "abc123",
  "rewards": {
    "resourcesCollected": [{ "itemId": "...", "quantity": 5 }],
    "creaturesCaptures": [{ "definitionId": "...", "level": 10 }],
    "xpGained": { "creature-1": 100 }
  }
}
```

##### `POST /api/expedition-start`
Registra início de expedição
```json
{
  "userId": "abc123",
  "mapId": "forest-clearing",
  "timestamp": 1706543210000
}
```

##### `POST /api/expedition-end`
Registra fim de expedição
```json
{
  "userId": "abc123",
  "success": true,
  "stats": {
    "duration": 240,
    "resourcesCollected": 15,
    "creaturesCaptures": 3,
    "damageDealt": 500,
    "damageTaken": 120
  }
}
```

---

### 5. Operações Firestore

**Arquivo**: `server/src/firestoreOperations.ts`

#### Nova Função: `saveUserData()`
Salva/atualiza dados completos do usuário no Firestore
- Cria novo usuário se não existir
- Atualiza (merge) se já existir
- Usa Firebase Admin SDK (server-authoritative)

---

### 6. Integração na ExpeditionScene

**Arquivo**: `src/scenes/ExpeditionScene.ts`

#### Sincronização no Início
- Chamada em `create()` após inicialização
- Registra mapa selecionado
- Não bloqueia início da partida

#### Sincronização no Fim
- **Sucesso**: Ao completar extração (`handleExtractionState`)
- **Falha por Tempo**: Quando timer expira
- **Falha por Morte**: Quando jogador morre

#### Função Auxiliar: `syncExpeditionEndToFirebase()`
- Envia estatísticas completas
- Sincroniza estado do jogador
- Não bloqueia retorno à base

---

## 🔧 Configuração Necessária

### 1. Firebase Console
1. Criar projeto Firebase
2. Ativar Authentication:
   - Anônimo ✅
   - Email/Senha ✅
3. Ativar Firestore Database
4. Configurar regras de segurança (`firestore.rules`)

### 2. Credenciais do Servidor
1. Baixar `firebase-service-account.json`
2. Colocar em `server/firebase-service-account.json`
3. Verificar que está no `.gitignore`

### 3. Credenciais do Cliente
1. Obter configuração web do Firebase Console
2. Atualizar `src/services/firebaseConfig.ts`
3. Verificar que está no `.gitignore`

### 4. Instalar Dependências
```bash
# Servidor
cd server
npm install express cors @types/express @types/cors

# Cliente (já instalado)
npm install firebase
```

---

## 🚀 Como Testar

### 1. Iniciar Servidor
```bash
cd server
npm run dev
```

Deve mostrar:
```
[HTTP Server] 🌐 Servidor HTTP rodando na porta 3001
[HTTP Server] ℹ️  Firebase: Disponível
```

### 2. Iniciar Cliente
```bash
npm run dev
```

### 3. Testar Fluxo Completo

#### Teste 1: Registro de Nova Conta
1. Abrir jogo
2. Clicar em "Já tem conta? Clique para criar"
3. Preencher:
   - Email: `teste@example.com`
   - Senha: `senha123`
   - Nome: `Treinador Teste`
4. Clicar em "Criar Conta"
5. Verificar:
   - ✅ Login bem-sucedido
   - ✅ Redirecionado para BaseHubScene
   - ✅ Nome aparece na tela

#### Teste 2: Login com Conta Existente
1. Recarregar página
2. Clicar em "Já tem conta? Clique para entrar"
3. Preencher:
   - Email: `teste@example.com`
   - Senha: `senha123`
4. Clicar em "Entrar"
5. Verificar:
   - ✅ Login bem-sucedido
   - ✅ Dados carregados do Firebase

#### Teste 3: Sincronização de Expedição
1. Iniciar expedição
2. Coletar recursos
3. Capturar criaturas
4. Completar extração
5. Verificar logs do servidor:
   ```
   [HTTP] 📥 Registrando início de expedição: abc123 em forest-clearing
   [HTTP] 📥 Registrando fim de expedição: abc123 (sucesso)
   [HTTP] 📥 Sincronizando estado do jogador abc123
   ```
6. Verificar Firestore Console:
   - Coleção `users/{userId}` atualizada
   - Coleção `expeditions` com novo registro

#### Teste 4: Migração de Dados
1. Jogar em modo visitante (localStorage)
2. Acumular progresso (criaturas, itens)
3. Criar conta
4. Verificar:
   - ✅ Dados migrados para Firebase
   - ✅ Progresso preservado

---

## 📊 Logs de Debug

### Cliente
```
[AuthScene] Login com email bem-sucedido
[PlayerState] ✅ Usuário autenticado: abc123
[PlayerState] 📦 Primeira vez - migrando dados do localStorage
[PlayerState] 📤 Enviando dados para Firebase...
[PlayerState] ✅ Migração preparada
[ExpeditionScene] ✅ Fim de expedição sincronizado com Firebase
```

### Servidor
```
[HTTP] 📥 Sincronizando estado do jogador abc123
[Firestore] ✅ Dados atualizados para usuário abc123
[HTTP] ✅ Estado sincronizado para abc123
[HTTP] 📥 Registrando fim de expedição: abc123 (sucesso)
```

---

## 🔒 Segurança

### Cliente (Read-Only)
- Acesso SOMENTE LEITURA ao Firestore
- Não pode escrever diretamente
- Todas as escritas passam pelo servidor

### Servidor (Admin SDK)
- Acesso total ao Firestore
- Validação server-side
- Fonte de verdade para dados

### Regras Firestore
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      // Usuário pode ler seus próprios dados
      allow read: if request.auth != null && request.auth.uid == userId;
      // Apenas servidor pode escrever (via Admin SDK)
      allow write: if false;
    }
    
    match /expeditions/{expeditionId} {
      // Usuário pode ler suas próprias expedições
      allow read: if request.auth != null && 
                     resource.data.userId == request.auth.uid;
      // Apenas servidor pode escrever
      allow write: if false;
    }
  }
}
```

---

## 🐛 Troubleshooting

### Erro: "Firebase não disponível"
**Causa**: Credenciais não configuradas

**Solução**:
1. Verificar `server/firebase-service-account.json`
2. Verificar `src/services/firebaseConfig.ts`
3. Reiniciar servidor

### Erro: "Permission denied"
**Causa**: Regras de segurança incorretas

**Solução**:
1. Verificar regras no Firebase Console
2. Copiar de `firestore.rules`
3. Publicar regras

### Erro: "Email já em uso"
**Causa**: Tentando criar conta com email existente

**Solução**:
1. Usar modo "Login" ao invés de "Registro"
2. Ou usar email diferente

### Dados não sincronizam
**Causa**: Servidor HTTP não está rodando

**Solução**:
1. Verificar se servidor está na porta 3001
2. Verificar logs do console do navegador
3. Verificar logs do servidor

---

## 📈 Próximos Passos

### Implementado ✅
- [x] Autenticação com email/senha
- [x] Migração de dados do localStorage
- [x] Sincronização no login
- [x] Sincronização no início da partida
- [x] Sincronização no fim da partida

### Futuro 🚀
- [ ] Recuperação de senha (email)
- [ ] Verificação de email
- [ ] Login social (Google, Facebook)
- [ ] Leaderboards globais
- [ ] Trading entre jogadores
- [ ] Histórico de expedições na UI
- [ ] Achievements/Conquistas

---

## 📚 Referências

- [Firebase Authentication](https://firebase.google.com/docs/auth)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)
- [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup)
- [Express.js](https://expressjs.com/)

---

**Implementado por**: Cursor AI  
**Versão**: 1.0.0  
**Status**: ✅ Pronto para Teste
