# ✅ Firebase Setup Checklist

Use este checklist para configurar Firebase passo a passo.

---

## 📋 Pré-Setup

- [ ] Tenho uma conta Google
- [ ] Node.js está instalado
- [ ] Dependências instaladas (`npm install` executado)
- [ ] Li o `FIREBASE_QUICK_START.md`

---

## 🔥 Firebase Console

### Criar Projeto
- [ ] Acessei [Firebase Console](https://console.firebase.google.com)
- [ ] Cliquei em "Adicionar projeto"
- [ ] Nome do projeto: `pokextract` (ou outro)
- [ ] Desabilitei Google Analytics (opcional)
- [ ] Projeto criado com sucesso

### Configurar Firestore
- [ ] Cliquei em "Firestore Database"
- [ ] Cliquei em "Criar banco de dados"
- [ ] Escolhi "Modo de produção"
- [ ] Selecionei localização (ex: `southamerica-east1`)
- [ ] Firestore ativado

### Configurar Regras de Segurança
- [ ] Abri Firestore > Regras
- [ ] Copiei conteúdo de `firestore.rules`
- [ ] Colei no editor
- [ ] Cliquei em "Publicar"
- [ ] Regras publicadas com sucesso

### Configurar Authentication
- [ ] Cliquei em "Authentication"
- [ ] Cliquei em "Começar"
- [ ] Ativei provedor "Anônimo"
- [ ] (Opcional) Ativei "E-mail/senha"
- [ ] Salvei configurações

---

## 🖥️ Servidor (Firebase Admin SDK)

### Gerar Chave
- [ ] Abri Configurações do projeto (⚙️)
- [ ] Fui na aba "Contas de serviço"
- [ ] Cliquei em "Gerar nova chave privada"
- [ ] Baixei arquivo JSON

### Configurar no Projeto
- [ ] Renomeei arquivo para `firebase-service-account.json`
- [ ] Movi para pasta `server/`:
  ```bash
  mv ~/Downloads/pokextract-*.json server/firebase-service-account.json
  ```
- [ ] Verifiquei que está no `.gitignore`
- [ ] Arquivo está em `server/firebase-service-account.json`

---

## 💻 Cliente (Firebase Client SDK)

### Obter Credenciais
- [ ] Abri Configurações do projeto
- [ ] Rolei até "Seus aplicativos"
- [ ] Cliquei no ícone Web (`</>`)
- [ ] Apelido: `pokextract-web`
- [ ] NÃO marquei "Firebase Hosting"
- [ ] Cliquei em "Registrar app"
- [ ] Copiei objeto `firebaseConfig`

### Configurar no Projeto
- [ ] Copiei arquivo de exemplo:
  ```bash
  cp src/services/firebaseConfig.example.ts src/services/firebaseConfig.ts
  ```
- [ ] Editei `src/services/firebaseConfig.ts`
- [ ] Colei minhas credenciais
- [ ] Salvei arquivo
- [ ] Verifiquei que está no `.gitignore`

---

## ✅ Verificação

### Testar Servidor
- [ ] Executei `cd server && npm run dev`
- [ ] Vi log: `[Firebase] ✅ Inicializado com sucesso`
- [ ] Vi log: `✅ Firebase configurado`
- [ ] Servidor rodando sem erros

### Testar Cliente
- [ ] Executei `npm run dev` (raiz do projeto)
- [ ] Abri navegador em `http://localhost:5173`
- [ ] Abri Console (F12)
- [ ] Vi log: `[Firebase Client] ✅ Inicializado`
- [ ] Vi log: `[PlayerState] ✅ Firebase conectado`
- [ ] Cliente rodando sem erros

### Testar Fluxo Completo
- [ ] Iniciei expedição
- [ ] Coletei recursos
- [ ] Capturei criaturas
- [ ] Completei extração
- [ ] Vi log servidor: `[Firestore] ✅ Recompensas salvas`
- [ ] Abri Firebase Console > Firestore
- [ ] Vi coleção `users` com meu UID
- [ ] Vi coleção `expeditions` com histórico
- [ ] Dados foram salvos com sucesso! 🎉

---

## 🎯 Resultado Esperado

### Logs do Servidor
```
=== Inicializando Firebase ===
[Firebase] ✅ Inicializado com sucesso
[Firebase] ℹ️  Projeto: pokextract
✅ Firebase configurado - dados serão persistidos na nuvem

=== Servidor WebSocket ===
PokéExtract WebSocket server listening on ws://localhost:3003
```

### Logs do Cliente (Console)
```
[Firebase Client] ✅ Inicializado com sucesso
[Firebase Client] ✅ Login anônimo realizado
[Firebase Client] UID: abc123def456...
[PlayerState] ✅ Firebase conectado - sincronização ativa
```

### Firebase Console
```
Firestore Database
├─ users/
│  └─ abc123def456.../
│     ├─ profile (displayName, createdAt, etc)
│     ├─ inventory (items, teamSlots, etc)
│     ├─ creatures (criaturas capturadas)
│     └─ stats (expedições, recursos, etc)
└─ expeditions/
   └─ xyz789.../
      ├─ userId, mapId, startedAt
      ├─ rewards (resources, creatures)
      └─ stats (dano, recursos, etc)
```

---

## 🐛 Troubleshooting

### Problema: "Firebase não disponível"
- [ ] Verifiquei se `server/firebase-service-account.json` existe
- [ ] Verifiquei se o nome está correto (sem espaços)
- [ ] Reiniciei o servidor

### Problema: "Auth não inicializado"
- [ ] Verifiquei se `src/services/firebaseConfig.ts` existe
- [ ] Verifiquei se as credenciais estão corretas
- [ ] Verifiquei se Authentication está ativado no console
- [ ] Limpei cache do navegador (Ctrl+Shift+R)

### Problema: "Permission denied"
- [ ] Verifiquei regras em Firestore > Regras
- [ ] Copiei conteúdo de `firestore.rules`
- [ ] Publiquei as regras
- [ ] Aguardei 1 minuto para propagação

### Ainda com problemas?
- [ ] Li `FIREBASE_SETUP_GUIDE.md` (guia completo)
- [ ] Verifiquei logs do servidor e cliente
- [ ] Verifiquei Firebase Console > Uso (se há erros)

---

## 🎉 Sucesso!

Se todos os itens acima estão marcados, Firebase está configurado e funcionando!

### Próximos Passos
- [ ] Testar em outro dispositivo (multi-dispositivo)
- [ ] Explorar Firebase Console (ver dados salvos)
- [ ] Ler `FIREBASE_IMPLEMENTATION_SUMMARY.md` (detalhes técnicos)
- [ ] Continuar jogando e testando! 🎮

---

**Dica**: Salve este checklist e use sempre que configurar Firebase em um novo ambiente.

**Versão**: 1.0.0  
**Data**: 29/01/2026
