# Testes de Integração Multiplayer - Fase 4A

## Setup de Teste

### 1. Iniciar Servidor
```bash
cd server
npm run start
```
✅ Servidor deve iniciar em `ws://localhost:3003`
✅ Ver mensagem: "PokéExtract WebSocket server listening on ws://localhost:3003"

### 2. Iniciar Cliente
```bash
npm run dev
```
✅ Cliente deve iniciar em `http://localhost:5173`

### 3. Abrir Modo Multiplayer
Abrir no navegador: `http://localhost:5173/?mp=1`
✅ Query param `?mp=1` ativa o modo multiplayer

## Testes de Integração

### ✅ Teste 1: Conexão Básica
**Passos:**
1. Abrir `http://localhost:5173/?mp=1`
2. Fazer login (tela de auth)
3. Iniciar expedição da base

**Resultado Esperado:**
- [ ] Console mostra: `[MP] Conectado com ID: [algum-id]`
- [ ] Console mostra: `[MP] Recebendo X criaturas do servidor`
- [ ] Console mostra: `[MP] Recebendo Y recursos do servidor`
- [ ] Criaturas aparecem no mapa
- [ ] Recursos aparecem no mapa

**Status:** ⏳ PENDENTE

---

### ✅ Teste 2: Sincronização de Criaturas
**Passos:**
1. Conectar em modo MP
2. Observar criaturas no mapa
3. Aguardar 2-3 segundos

**Resultado Esperado:**
- [ ] Criaturas são renderizadas com cores corretas por tipo
- [ ] Barras de HP aparecem sobre criaturas próximas
- [ ] Criaturas se movem suavemente (interpolação)

**Status:** ⏳ PENDENTE

---

### ✅ Teste 3: Sincronização de Recursos
**Passos:**
1. Conectar em modo MP
2. Observar recursos no mapa (losangos coloridos)
3. Identificar recursos por cor

**Resultado Esperado:**
- [ ] Recursos aparecem nas posições corretas
- [ ] Cores correspondem ao tipo de recurso
- [ ] Não há duplicação de recursos

**Status:** ⏳ PENDENTE

---

### ✅ Teste 4: Combate com Criaturas
**Passos:**
1. Conectar em modo MP
2. Aproximar de uma criatura
3. Atacar com ESPAÇO ou clique

**Resultado Esperado:**
- [ ] Projétil é disparado
- [ ] Intent de ataque é enviado ao servidor
- [ ] Criatura toma dano (HP diminui)
- [ ] Barra de HP é atualizada
- [ ] Criatura morre quando HP chega a 0
- [ ] Sprite da criatura é removida do mapa

**Status:** ⏳ PENDENTE

---

### ✅ Teste 5: Captura de Criaturas
**Passos:**
1. Conectar em modo MP
2. Enfraquecer uma criatura (deixar com HP baixo)
3. Aproximar e pressionar Q para capturar

**Resultado Esperado:**
- [ ] Intent de captura é enviado ao servidor
- [ ] Servidor responde com resultado (sucesso/falha)
- [ ] Se sucesso: criatura desaparece do mapa
- [ ] Se sucesso: contador de criaturas capturadas aumenta
- [ ] Se falha: criatura permanece no mapa

**Status:** ⏳ PENDENTE

---

### ✅ Teste 6: Coleta de Recursos
**Passos:**
1. Conectar em modo MP
2. Mover jogador sobre um recurso

**Resultado Esperado:**
- [ ] Intent de coleta é enviado ao servidor (ou detecção por colisão)
- [ ] Recurso desaparece do mapa
- [ ] Contador de recursos aumenta
- [ ] Texto flutuante mostra recurso coletado

**Status:** ⏳ PENDENTE

---

### ✅ Teste 7: Extração Completa
**Passos:**
1. Conectar em modo MP
2. Coletar alguns recursos
3. Ir até zona de extração (área azul no topo)
4. Segurar E por 5 segundos

**Resultado Esperado:**
- [ ] Intent de extração é enviado ao servidor
- [ ] Barra de progresso aumenta
- [ ] Após 5s, extração completa
- [ ] Servidor envia recompensas
- [ ] Jogador retorna à base após 3s
- [ ] Recompensas são persistidas (criaturas + recursos)

**Status:** ⏳ PENDENTE

---

### ✅ Teste 8: Timer de Partida Sincronizado
**Passos:**
1. Conectar em modo MP
2. Observar timer no HUD (canto superior esquerdo)
3. Aguardar 10-20 segundos

**Resultado Esperado:**
- [ ] Timer conta de 4:00 para 0:00
- [ ] Barra de tempo muda de cor (verde → amarelo → vermelho)
- [ ] Quando chega a 0, partida termina
- [ ] Jogador é forçado a retornar à base

**Status:** ⏳ PENDENTE

---

### ✅ Teste 9: Múltiplos Jogadores
**Passos:**
1. Abrir 2 abas/janelas do navegador
2. Em ambas, acessar `http://localhost:5173/?mp=1`
3. Fazer login com nomes diferentes
4. Iniciar expedição em ambas

**Resultado Esperado:**
- [ ] Ambos jogadores aparecem no servidor
- [ ] Cada jogador vê o outro renderizado no mapa
- [ ] Movimentos são sincronizados
- [ ] Ambos veem as mesmas criaturas e recursos
- [ ] Ataques de um jogador afetam criaturas vistas por outro
- [ ] Captura de criatura por um jogador remove do mapa do outro

**Status:** ⏳ PENDENTE

---

### ✅ Teste 10: Modo Single-Player NÃO Quebrou
**Passos:**
1. Abrir `http://localhost:5173/` (SEM `?mp=1`)
2. Fazer login
3. Iniciar expedição

**Resultado Esperado:**
- [ ] Jogo funciona normalmente
- [ ] Criaturas aparecem (spawn local)
- [ ] Recursos aparecem (spawn local)
- [ ] Combate funciona
- [ ] Captura funciona
- [ ] Extração funciona
- [ ] Sem erros no console relacionados a multiplayer

**Status:** ⏳ PENDENTE

---

### ✅ Teste 11: Servidor Indisponível
**Passos:**
1. PARAR o servidor (Ctrl+C no terminal do servidor)
2. Abrir `http://localhost:5173/?mp=1`
3. Tentar iniciar expedição

**Resultado Esperado:**
- [ ] Cliente tenta conectar ao servidor
- [ ] Após timeout, deve haver fallback para single-player OU
- [ ] Mensagem de erro clara: "Servidor multiplayer não disponível"
- [ ] Jogo não trava ou quebra

**Status:** ⏳ PENDENTE

---

### ✅ Teste 12: Desconexão Durante Partida
**Passos:**
1. Conectar em modo MP
2. Durante a expedição, parar o servidor (Ctrl+C)
3. Continuar jogando

**Resultado Esperado:**
- [ ] Cliente detecta desconexão
- [ ] Tenta reconectar (até 5 tentativas)
- [ ] Se falhar, mensagem de erro ou fallback
- [ ] Jogo não trava

**Status:** ⏳ PENDENTE

---

## Logs do Servidor Esperados

### Durante Conexão:
```
[Server] Cliente conectado: [id]
[Server] Criando sala "floresta-celestial"...
[Server] ✓ Sala "floresta-celestial" criada e populada com spawns
[Room:floresta-celestial] Game loop iniciado
```

### Durante Ataque:
```
[Room:floresta-celestial] Dano aplicado: 20 em criatura wild-1 (HP: 40/60)
```

### Durante Captura:
```
[Room:floresta-celestial] ✓ Captura bem-sucedida! Jogador [id] capturou pyrognat (chance: 45.2%)
```
OU
```
[Room:floresta-celestial] ✗ Captura falhou! Jogador [id] não capturou wild-2 (chance: 32.1%, roll: 54.3%)
```

### Durante Extração:
```
[Room:floresta-celestial] Jogador [id] completou extração: 2 criaturas, 3 tipos de recursos
```

## Bugs Conhecidos a Serem Corrigidos

- [ ] Verificar se criaturas mortas não são duplicadas
- [ ] Verificar se recursos coletados desaparecem para todos
- [ ] Verificar se timer sincronizado não causa drift
- [ ] Verificar se extração funciona com múltiplos jogadores simultaneamente
- [ ] Verificar se reconexão restaura estado corretamente

## Notas de Performance

- [ ] Verificar FPS com 12 jogadores simultâneos
- [ ] Verificar latência de rede (ping < 100ms ideal)
- [ ] Verificar uso de memória (sem memory leaks)
- [ ] Verificar taxa de mensagens WebSocket (não sobrecarregar)

## Checklist Final

- [ ] Todos os testes passaram
- [ ] Sem erros no console do navegador
- [ ] Sem erros no console do servidor
- [ ] Sem crashes ou freezes
- [ ] Performance aceitável (60 FPS)
- [ ] Single-player continua funcionando
- [ ] Documentação atualizada
