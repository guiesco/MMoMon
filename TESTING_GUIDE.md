# Guia de Teste - Modo Multiplayer

## ✅ Pré-requisitos

1. **Projeto compilado**:
   ```bash
   npm run build
   ```
   Status: ✅ Compilado com sucesso

2. **Servidor WebSocket**:
   ```bash
   cd server
   npm run dev
   # Aguarde: Server listening on port 3003
   ```

3. **Cliente rodando**:
   ```bash
   npm run dev
   # Aguarde: http://localhost:5173
   ```

## 🧪 Teste 1: Modo Single-Player Funciona

### Procedimento
1. Abra `http://localhost:5173` (SEM `?mp=1`)
2. Faça login com um nome de treinador
3. Comece uma expedição

### Esperado
- ✅ Criaturas selvagens aparecem (spawn local)
- ✅ Recursos aparecem (spawn local)
- ✅ Movimento, combate e captura funcionam
- ✅ Sem dependência de servidor

### Resultado
```
[ ] Passou
[ ] Falhou - Descrever erro
```

---

## 🧪 Teste 2: Modo Multiplayer - Conexão

### Procedimento
1. Abra `http://localhost:5173/?mp=1` (com `?mp=1`)
2. Abra console (F12)
3. Aguarde 2-3 segundos

### Esperado
Logs no console:
```
[MP] Conectado com ID: ...
[MultiplayerClient] WebSocket connected
```

### Resultado
```
[ ] Passou - Vejo os logs
[ ] Falhou - Descrever erro
```

---

## 🧪 Teste 3: Criaturas Remotas Aparecem

### Procedimento
1. Servidor enviando criaturas (implementar/verificar)
2. Abra `http://localhost:5173/?mp=1`
3. Observe o mapa

### Esperado
- ✅ Criaturas aparecem (não do spawn local)
- ✅ Têm barras de HP coloridas
- ✅ Posição corresponde ao servidor

### Log esperado
```
[MP] Criaturas atualizadas: N criaturas no servidor
```

### Resultado
```
[ ] Passou - Vejo criaturas com posição suave
[ ] Falhou - Descrever erro
```

---

## 🧪 Teste 4: Recursos Remotos Aparecem

### Procedimento
1. Servidor enviando recursos
2. Abra `http://localhost:5173/?mp=1`
3. Observe cores dos recursos

### Esperado
- ✅ Recursos aparecem em cores distintas
- ✅ Cristal: Ciano
- ✅ Ferro: Cinza
- ✅ Energia: Roxo
- ✅ Padrão: Amarelo

### Log esperado
```
[MP] Recursos atualizados: N recursos no servidor
```

### Resultado
```
[ ] Passou - Vejo recursos coloridos
[ ] Falhou - Descrever erro
```

---

## 🧪 Teste 5: Interpolação Suave

### Procedimento
1. Criatura se move no servidor
2. Observe o movimento no cliente

### Esperado
- ✅ Movimento é **suave** (não "teleporta")
- ✅ Velocidade ~8px/s
- ✅ Recursos se movem mais lentamente (~4px/s)

### Resultado
```
[ ] Passou - Movimento é suave
[ ] Falhou - Movimento é entrecortado
```

---

## 🧪 Teste 6: Remoção Automática

### Procedimento
1. Criatura morre no servidor (remova da lista de entidades)
2. Próximo update do servidor
3. Observe cliente

### Esperado
- ✅ Sprite desaparece **imediatamente** (sem delay)
- ✅ Sem animação de morte
- ✅ Sem lag

### Resultado
```
[ ] Passou - Removida automaticamente
[ ] Falhou - Descrever comportamento
```

---

## 🧪 Teste 7: Multiple Clients

### Procedimento
1. Abra `http://localhost:5173/?mp=1` em **aba 1**
2. Abra `http://localhost:5173/?mp=1` em **aba 2**
3. Mova-se em uma aba
4. Observe a outra aba

### Esperado
- ✅ Ambos os clientes veem uns aos outros
- ✅ Movimento do outro é suave (interpolação)
- ✅ Nomes aparecem

### Resultado
```
[ ] Passou - Ambos os clientes se veem
[ ] Falhou - Descrever erro
```

---

## 🧪 Teste 8: HP Bars Dinâmicas

### Procedimento
1. Servidor reduz HP de criatura
2. Observe barra de HP

### Esperado
- ✅ HP > 50%: Verde
- ✅ HP 25-50%: Amarelo
- ✅ HP < 25%: Vermelho

### Resultado
```
[ ] Passou - Cores mudam conforme HP
[ ] Falhou - Descrever problema
```

---

## 🔍 Debug - Acessar Dados Internos

Abra console (F12) e execute:

```javascript
// Ver criaturas remotas no cliente
scene.serverCreatures

// Ver recursos remotos
scene.serverResources

// Ver jogadores remotos
scene.remotePlayers

// Ver client ID
scene.clientId

// Ver se está em modo multiplayer
scene.isMultiplayer

// Ver MultiplayerClient
scene.mpClient
```

---

## 📋 Checklist de Testes

- [ ] Teste 1: Single-player funciona
- [ ] Teste 2: Multiplayer conecta
- [ ] Teste 3: Criaturas aparecem
- [ ] Teste 4: Recursos aparecem
- [ ] Teste 5: Interpolação suave
- [ ] Teste 6: Remoção automática
- [ ] Teste 7: Múltiplos clientes
- [ ] Teste 8: HP bars dinâmicas

## 📊 Resultados

| Teste | Status | Notas |
|-------|--------|-------|
| 1 - Single-play | ⚪ | |
| 2 - Conexão | ⚪ | |
| 3 - Criaturas | ⚪ | |
| 4 - Recursos | ⚪ | |
| 5 - Interpolação | ⚪ | |
| 6 - Remoção | ⚪ | |
| 7 - Multi-client | ⚪ | |
| 8 - HP Bars | ⚪ | |

---

## 🐛 Se Encontrar Bugs

1. Abra console (F12)
2. Copie erros/logs
3. Verifique logs do servidor
4. Descreva os passos para reproduzir

---

## 💡 Dicas

- **Modo Debug**: Procure por `[MP]` nos logs para rastrear eventos multiplayer
- **Verify Compilation**: `npm run build` deve completar sem erros
- **Check Server**: `curl localhost:3003` deve conectar (WebSocket)
- **Network Tab**: Use DevTools → Network para ver mensagens WebSocket

---

Boa sorte com os testes! 🚀
