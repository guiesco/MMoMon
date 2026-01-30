# Correção: ID do Ponto de Extração

**Data:** 29 de Janeiro de 2026  
**Problema:** Cliente enviava ID hardcoded (`extract-1`) enquanto servidor gerava IDs incrementais (`extract-0`, `extract-1`, etc.)

---

## 🐛 Problema

### Sintoma
```
[Extraction] Recebido pedido de start para ponto extract-1 do jogador 17697220...
[Extraction] Ponto de extração extract-1 não encontrado
[Extraction] Pedido processado: FALHOU
```

No cliente, a extração aparecia como sucesso, mas no servidor falhava.

### Causa Raiz

**Cliente (hardcoded):**
```typescript
// ❌ ANTES: ID hardcoded
this.mpClient.sendExtractionRequest("extract-1", "start");
```

**Servidor (gerado dinamicamente):**
```typescript
// IDs gerados com contador incremental
function generateId(prefix: string): string {
  return `${prefix}-${entityIdCounter++}`;
}

// Primeiro ponto de extração = "extract-0"
// Segundo ponto de extração = "extract-1"
// etc.
```

O problema é que:
1. Servidor reseta o contador ao criar uma nova sala (`entityIdCounter = 0`)
2. Primeiro ponto de extração criado recebe ID `extract-0`
3. Cliente tentava usar `extract-1` (não existia)
4. Servidor retornava "Ponto de extração não encontrado"

---

## ✅ Solução

### 1. Armazenar ID do Servidor

Adicionado campo para armazenar o ID correto recebido do servidor:

```typescript
// ExpeditionScene.ts
private serverExtractionPointId: string | null = null;
```

### 2. Processar Pontos de Extração do Servidor

```typescript
// Quando recebe worldState do servidor
if (world.extractionPoints && world.extractionPoints.length > 0) {
  console.log(`[MP] Recebendo ${world.extractionPoints.length} pontos de extração do servidor`);
  
  // ✅ Armazenar ID do primeiro ponto de extração
  if (world.extractionPoints[0]) {
    this.serverExtractionPointId = world.extractionPoints[0].id;
    console.log(`[MP] Ponto de extração registrado: ${this.serverExtractionPointId}`);
  }
}
```

### 3. Usar ID Correto nas Requisições

```typescript
// ✅ DEPOIS: Usar ID do servidor
const pointId = this.serverExtractionPointId ?? "extract-0"; // Fallback para extract-0
console.log(`[Extraction] Enviando pedido de extração ao servidor (ponto: ${pointId})...`);
this.mpClient.sendExtractionRequest(pointId, "start");
```

---

## 📊 Fluxo Corrigido

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. INICIALIZAÇÃO DO SERVIDOR                                    │
└─────────────────────────────────────────────────────────────────┘
Servidor
   │
   ├─> Cria sala
   ├─> Reseta contador: entityIdCounter = 0
   ├─> initializeWorldSpawns()
   │   ├─> Spawna criaturas (wild-0, wild-1, ...)
   │   ├─> Spawna recursos (res-0, res-1, ...)
   │   └─> Spawna ponto de extração (extract-0) ✅
   │

┌─────────────────────────────────────────────────────────────────┐
│ 2. CONEXÃO DO CLIENTE                                           │
└─────────────────────────────────────────────────────────────────┘
Cliente                          Servidor
   │                                │
   ├──── join ────────────────────>│
   │<──── joined ────────────────────┤
   │<──── state (worldState) ────────┤
   │   {                            │
   │     extractionPoints: [        │
   │       { id: "extract-0", ... } │ ✅
   │     ]                          │
   │   }                            │
   │                                │
   ├─> Armazena: serverExtractionPointId = "extract-0" ✅
   │

┌─────────────────────────────────────────────────────────────────┐
│ 3. EXTRAÇÃO                                                     │
└─────────────────────────────────────────────────────────────────┘
Cliente                          Servidor
   │                                │
   ├──── extraction_request ───────>│
   │   pointId: "extract-0" ✅      │
   │   action: "start"              │
   │                                ├─> Busca ponto "extract-0"
   │                                ├─> ✅ ENCONTRADO!
   │                                ├─> Inicia extração
   │<──── extraction_state ──────────┤
   │   status: "in_progress"        │
   │   progress: 0                  │
```

---

## 🧪 Como Testar

### Teste 1: Verificar ID do Ponto
1. Iniciar servidor
2. Conectar cliente em modo multiplayer (`?mp=1`)
3. Verificar logs do cliente:
   ```
   [MP] Recebendo 1 pontos de extração do servidor
   [MP] Ponto de extração registrado: extract-0
   ```

### Teste 2: Extração Funcional
1. Navegar até zona de extração
2. Pressionar E para extrair
3. Verificar logs do cliente:
   ```
   [Extraction] Enviando pedido de extração ao servidor (ponto: extract-0)...
   ```
4. Verificar logs do servidor:
   ```
   [Extraction] Recebido pedido de start para ponto extract-0 do jogador ...
   [Extraction] Pedido processado: SUCESSO ✅
   ```
5. Aguardar conclusão da extração
6. Verificar que recompensas são recebidas

---

## 📝 Arquivos Modificados

### Cliente
- `src/scenes/ExpeditionScene.ts`
  - ✅ Campo `serverExtractionPointId` para armazenar ID correto
  - ✅ Processamento de `world.extractionPoints` do servidor
  - ✅ Uso de ID dinâmico nas requisições de extração

---

## 🔍 Logs de Debug

### Antes (Erro)
```
Cliente:
[Extraction] Enviando pedido de extração ao servidor...

Servidor:
[Extraction] Recebido pedido de start para ponto extract-1 do jogador 17697220...
[Extraction] Ponto de extração extract-1 não encontrado ❌
[Extraction] Pedido processado: FALHOU
```

### Depois (Sucesso)
```
Cliente:
[MP] Recebendo 1 pontos de extração do servidor
[MP] Ponto de extração registrado: extract-0
[Extraction] Enviando pedido de extração ao servidor (ponto: extract-0)...

Servidor:
[Extraction] Recebido pedido de start para ponto extract-0 do jogador 17697220...
[Extraction] Pedido processado: SUCESSO ✅
[Extraction] Jogador 17697220... completou extração: 2 criaturas, 3 tipos de recursos
```

---

## 💡 Melhorias Futuras

### Opção 1: IDs Determinísticos
Usar IDs baseados em posição ou configuração do mapa:

```typescript
// Servidor
const extractionPoint = {
  id: `extract-${mapConfig.id}-0`, // ex: "extract-floresta-celestial-0"
  x, y, radius
};
```

### Opção 2: Sincronização Explícita
Enviar lista de pontos de extração em mensagem separada:

```typescript
// Servidor → Cliente
{
  type: "extraction_points_init",
  points: [
    { id: "extract-0", x: 1200, y: 144, radius: 96 }
  ]
}
```

### Opção 3: Validação no Cliente
Adicionar validação antes de enviar requisição:

```typescript
if (!this.serverExtractionPointId) {
  console.error("[Extraction] ID do ponto de extração não foi recebido do servidor!");
  return;
}
```

---

## ✅ Resultado

- ✅ Cliente usa ID correto do servidor
- ✅ Servidor encontra ponto de extração
- ✅ Extração funciona corretamente
- ✅ Recompensas são calculadas e enviadas
- ✅ Logs claros para debug
