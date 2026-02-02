# Configuração do Firebase para Deploy

Este guia explica como configurar o Firebase para funcionar com o jogo deployado no GitHub Pages.

## 🔧 Configurações Necessárias

### 1. Adicionar Domínio Autorizado (Authorized Domains)

O Firebase bloqueia requisições de domínios não autorizados por padrão. Você precisa adicionar o domínio do GitHub Pages.

#### Passo a passo:

1. Acesse o [Firebase Console](https://console.firebase.google.com)
2. Selecione seu projeto
3. Vá em **Authentication** (Autenticação) no menu lateral
4. Clique na aba **Settings** (Configurações)
5. Role até a seção **Authorized domains** (Domínios autorizados)
6. Clique em **Add domain** (Adicionar domínio)
7. Adicione o domínio do GitHub Pages:

```
YOUR_USERNAME.github.io
```

**Exemplo:**
- Se seu usuário é `guilhermelopes`, adicione:
  - `guilhermelopes.github.io`

⚠️ **Nota**: O Firebase aceita apenas domínios base (sem caminhos). O domínio `github.io` já está autorizado por padrão, mas você precisa adicionar seu domínio específico `YOUR_USERNAME.github.io`.

8. Clique em **Add** (Adicionar) para cada domínio

⚠️ **Importante**: O Firebase já inclui `localhost` por padrão para desenvolvimento.

### 2. Habilitar Autenticação Anônima

O jogo usa autenticação anônima. Você precisa habilitá-la:

1. No Firebase Console, vá em **Authentication**
2. Clique na aba **Sign-in method** (Método de login)
3. Procure por **Anonymous** (Anônimo)
4. Clique em **Anonymous**
5. Ative o toggle **Enable**
6. Clique em **Save** (Salvar)

### 3. Verificar Regras do Firestore

As regras do Firestore já estão configuradas corretamente no arquivo `firestore.rules`. Você precisa publicá-las:

#### Opção A: Via Firebase Console (Recomendado)

1. No Firebase Console, vá em **Firestore Database**
2. Clique na aba **Rules** (Regras)
3. Cole o conteúdo do arquivo `firestore.rules`:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // ========================================================================
    // USERS COLLECTION
    // ========================================================================
    // Usuários podem ler apenas seus próprios dados
    // Escritas são controladas exclusivamente pelo servidor via Admin SDK
    match /users/{userId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if false; // Apenas servidor pode escrever
    }
    
    // ========================================================================
    // EXPEDITIONS COLLECTION (Histórico)
    // ========================================================================
    // Usuários podem ler apenas suas próprias expedições
    // Escritas são controladas exclusivamente pelo servidor
    match /expeditions/{expeditionId} {
      allow read: if request.auth != null && 
                     resource.data.userId == request.auth.uid;
      allow write: if false; // Apenas servidor pode escrever
    }
    
    // ========================================================================
    // LEADERBOARDS COLLECTION (Futuro)
    // ========================================================================
    // Leaderboards são públicos para leitura
    // Escritas são controladas pelo servidor
    match /leaderboards/{leaderboardId} {
      allow read: if true; // Público
      allow write: if false; // Apenas servidor
    }
    
    // ========================================================================
    // DEFAULT: Negar tudo que não foi explicitamente permitido
    // ========================================================================
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

4. Clique em **Publish** (Publicar)

#### Opção B: Via Firebase CLI

```bash
# Instalar Firebase CLI (se ainda não tiver)
npm install -g firebase-tools

# Fazer login
firebase login

# Publicar regras
firebase deploy --only firestore:rules
```

### 4. Verificar Configurações de API

1. No Firebase Console, vá em **Project Settings** (Configurações do projeto)
2. Vá na aba **General**
3. Role até **Your apps** e verifique se o app web está configurado
4. Se não estiver, clique no ícone **Web** (`</>`) e registre um novo app

### 5. Verificar Quotas e Limites

Para garantir que o app funcione corretamente:

1. No Firebase Console, vá em **Usage and billing** (Uso e faturamento)
2. Verifique se você está no plano **Spark** (gratuito) ou **Blaze** (pago)
3. O plano Spark tem limites, mas é suficiente para desenvolvimento/testes

## 🧪 Testar Configuração

### 1. Testar Autenticação

Abra o console do navegador no jogo deployado e verifique:

```javascript
// Deve aparecer no console:
[Firebase Client] ✅ Inicializado com sucesso
[Firebase Client] ✅ Login anônimo realizado
[Firebase Client] UID: abc123...
```

### 2. Testar Firestore

Após fazer login, verifique se consegue ler dados:

1. No Firebase Console, vá em **Firestore Database**
2. Crie uma coleção `users` com um documento de teste
3. O documento deve ter o `userId` igual ao UID do usuário autenticado
4. O jogo deve conseguir ler esse documento

### 3. Verificar Erros no Console

Se houver erros, verifique:

- **Erro de CORS**: Domínio não autorizado → Adicione em Authorized domains
- **Erro de autenticação**: Autenticação anônima não habilitada → Habilite em Sign-in method
- **Erro de permissão**: Regras do Firestore → Verifique e publique as regras

## 🔍 Troubleshooting

### Erro: "auth/unauthorized-domain"

**Causa**: Domínio não está na lista de domínios autorizados.

**Solução**: 
1. Vá em Authentication > Settings > Authorized domains
2. Adicione o domínio do GitHub Pages

### Erro: "auth/operation-not-allowed"

**Causa**: Método de autenticação não está habilitado.

**Solução**:
1. Vá em Authentication > Sign-in method
2. Habilite "Anonymous"

### Erro: "permission-denied" no Firestore

**Causa**: Regras do Firestore bloqueando acesso.

**Solução**:
1. Verifique se as regras estão publicadas
2. Verifique se o usuário está autenticado (`request.auth != null`)
3. Verifique se o `userId` corresponde ao `request.auth.uid`

### Erro: "Missing or insufficient permissions"

**Causa**: Regras do Firestore muito restritivas ou usuário não autenticado.

**Solução**:
1. Verifique se o usuário está autenticado
2. Verifique se as regras permitem leitura para o usuário autenticado
3. Teste temporariamente com regras mais permissivas para debug:

```javascript
// ⚠️ APENAS PARA TESTE - NÃO USE EM PRODUÇÃO
match /users/{userId} {
  allow read, write: if request.auth != null;
}
```

## ✅ Checklist de Configuração

- [ ] Domínio do GitHub Pages adicionado em Authorized domains
- [ ] Autenticação anônima habilitada
- [ ] Regras do Firestore publicadas
- [ ] App web registrado no Firebase Console
- [ ] Credenciais do Firebase configuradas como secrets no GitHub
- [ ] Teste de autenticação funcionando
- [ ] Teste de leitura do Firestore funcionando

## 📝 Notas Importantes

1. **Domínios autorizados**: O Firebase aceita apenas domínios base (sem caminhos). Adicione `YOUR_USERNAME.github.io` (o domínio `github.io` já está autorizado por padrão, mas não é suficiente).

2. **HTTPS obrigatório**: O GitHub Pages usa HTTPS por padrão, o que é necessário para o Firebase funcionar corretamente.

3. **Regras de segurança**: As regras atuais são restritivas por design - apenas o servidor pode escrever, e usuários só podem ler seus próprios dados. Isso é uma boa prática de segurança.

4. **Autenticação anônima**: É temporária e pode ser convertida para autenticação permanente no futuro. Para produção, considere implementar autenticação com email/senha ou OAuth.
