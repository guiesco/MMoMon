# PokéExtract: Wild Expedition – MVP (Single Player Prototype)

Este projeto é um protótipo inicial jogável em browser usando **Phaser + TypeScript**, focado em testar o **core loop de expedição** em modo single-player:

- Entrar na expedição a partir da base
- Explorar o mapa top-down
- Coletar recursos
- Encontrar criaturas e tentar capturá-las
- Correr até a zona de extração e segurar **E** para extrair

## Comandos (MVP)

- **Setas**: movimento (WASD pode ser mapeado depois, por enquanto setas para simplicidade).
- **E**: iniciar/segurar extração quando estiver dentro da zona de extração (retângulo azul no topo do mapa).
- **ESPAÇO ou clique esquerdo do mouse**: ataque básico em direção ao cursor.
- **Q**: tentar capturar uma criatura próxima (usa automaticamente a melhor Pokébola disponível).
- **F**: ativar a habilidade especial da criatura ativa (quando fora de recarga).

## Estrutura

- `index.html` – container básico para o jogo.
- `src/main.ts` – inicialização do Phaser.
- `src/scenes/ExpeditionScene.ts` – cena principal da expedição single-player.

## Arquitetura de Código (MVP)

O projeto está organizado em diretórios por responsabilidade:

### `src/game/`
Contém os modelos de domínio e configurações do jogo:
- **`types.ts`**: Definições de tipos TypeScript para criaturas, itens, progresso do jogador e receitas de crafting.
- **`creatures.ts`**: Definições de criaturas (stats, tipos, ataques básicos e habilidades especiais) e matriz de vantagens de tipo.
- **`items.ts`**: Definições de itens (pokébolas, recursos, consumíveis) e receitas de crafting.
- **`playerState.ts`**: Gerenciador singleton do estado persistente do jogador (criaturas, inventário, equipe ativa), usando localStorage no MVP.
- **`constants.ts`**: Constantes de configuração centralizadas (duração de expedição, valores de dano, configurações de captura, etc.) para facilitar balanceamento.

### `src/scenes/`
Cenas Phaser que compõem o fluxo do jogo:
- **`BootScene.ts`**: Cena de inicialização do Phaser.
- **`AuthScene.ts`**: Tela de login/nome do jogador.
- **`BaseHubScene.ts`**: Hub principal onde o jogador gerencia base, equipe e acessa outras áreas.
- **`CraftingScene.ts`**: Interface de crafting de itens (pokébolas principalmente).
- **`ExpeditionScene.ts`**: Cena principal da expedição, contendo toda a lógica de exploração, combate, captura e extração.

### `src/services/`
Serviços de integração externa:
- **`firebaseClient.ts`**: Cliente Firebase para autenticação e persistência na nuvem (✅ implementado).
- **`firebaseConfig.ts`**: Configuração de credenciais do Firebase (criar a partir do `.example.ts`).
- **`multiplayerClient.ts`**: Cliente WebSocket para sincronização multiplayer (presença e posição de jogadores).

### `server/src/`
Servidor WebSocket simples para multiplayer:
- **`index.ts`**: Servidor WebSocket que gerencia salas de partida, sincronização de posição de jogadores e timer de partida. Por enquanto apenas presença/movimento é sincronizado; regras de jogo (combate, captura, extração) ainda são client-side.
- `src/scenes/BaseHubScene.ts` – base do jogador, onde é possível ver equipe, inventário e iniciar a expedição ou abrir o crafting.
- `src/scenes/CraftingScene.ts` – tela de laboratório para transformar recursos em itens (ex: Pokébolas).

## Como é a tela da expedição

- **Mapa (bioma atual)**:
  - Fundo escuro com blocos em tons de verde representando a **Floresta Celestial** (bioma padrão).
  - O **jogador** é um círculo verde com um anel sutil ao redor (que realça o personagem quando está em perigo).
  - **Recursos** são losangos amarelos com borda marrom, bem distintos do fundo.
  - **Criaturas selvagens** são círculos vermelhos com contorno, transmitindo ameaça (com variações visuais por tier de ameaça).
- **Zona de Extração**:
  - Retângulo azul destacado, cuja posição varia conforme o mapa/bioma, com a label “ZONA DE EXTRAÇÃO”.
  - Ao entrar nela e segurar **E**, uma barra central na parte inferior mostra o progresso de extração.
- **HUD**:
  - Painel no canto superior esquerdo com:
    - Estado atual (Explorando, Em combate, Tentando captura, Extraindo, etc.).
    - Tempo restante de expedição.
    - Recursos e criaturas capturadas na expedição.
    - HP da equipe e quantidade de Pokébolas.
    - Um pequeno bloco de ajuda com os comandos principais.
  - Uma barra fina no topo da tela mostra o tempo de partida:
    - Verde no início, ficando amarela e depois vermelha, piscando quando o tempo está quase acabando.

### HUD de HP

O sistema de barras de HP foi projetado para fornecer leitura rápida e clara do estado de combate, usando cores associadas a cada tipo de criatura.

#### Barra de HP do Jogador/Criatura Ativa
- **Posição**: Logo abaixo do painel de texto principal, no canto superior esquerdo.
- **Aparência**: Barra larga (200px) com borda escura e preenchimento na cor do tipo elemental da criatura ativa.
- **Cores por tipo**:
  | Tipo | Cor Principal | Cor de Brilho |
  |------|---------------|---------------|
  | Fogo | Laranja (`#f97316`) | Laranja claro (`#ff6b35`) |
  | Água | Azul (`#3b82f6`) | Azul claro (`#60a5fa`) |
  | Planta | Verde (`#22c55e`) | Verde claro (`#4ade80`) |
  | Elétrico | Amarelo (`#facc15`) | Amarelo claro (`#fef08a`) |
  
- **Estados visuais**:
  - **HP > 60%**: Cor do tipo elemental (saudável).
  - **HP 30-60%**: Amarelo (`#facc15`) — atenção.
  - **HP < 30%**: Vermelho (`#ef4444`) com efeito de brilho pulsante — crítico.
  
- **Efeitos de dano**: Quando o jogador toma dano, a barra pisca em branco brevemente para indicar o impacto.

#### Barras de HP da Equipe (Aliados)
- **Posição**: Abaixo da barra principal, mostrando até 3 criaturas da equipe.
- **Aparência**: Barras menores (140px) para cada criatura, com nome da criatura acima.
- **Destaque**: A criatura ativa tem borda brilhante na cor do seu tipo; inativas ficam mais translúcidas.
- **Utilidade**: Permite monitorar o HP de toda a equipe sem precisar trocar de criatura.

#### Barras de HP dos Inimigos
- **Aparência**: Barras pequenas (40px) flutuantes que aparecem acima das criaturas selvagens.
- **Visibilidade**:
  - Aparecem automaticamente para inimigos **próximos** (até 250px de distância).
  - Sempre visíveis para inimigos quando o jogador está **em combate**.
  - Desaparecem quando o inimigo está muito longe ou morto.
- **Estados de cor**:
  - Verde: HP > 60%
  - Amarelo: HP 30-60%
  - Vermelho: HP < 30%
- **Otimização**: As barras são reutilizadas via pool de objetos para manter a performance, mesmo com muitos inimigos.

#### Leitura Rápida do Estado de Combate
Para avaliar rapidamente a situação:
1. **Barra principal vermelha pulsando** → HP crítico, fuja ou cure.
2. **Barras de aliados amarelas/vermelhas** → Considere trocar de criatura (teclas 1-3).
3. **Várias barras de inimigos aparecendo** → Está cercado, mova-se para área mais segura.
4. **Barras de inimigos vermelhas** → Bom momento para tentar captura (Q).

## Como é a tela da base

- Fundo escuro com um cabeçalho “Ilha do Treinador – Base”.
- À esquerda:
  - Nome do treinador e tamanho da equipe ativa.
  - Lista de criaturas ativas com nível e HP atual.
  - Resumo do inventário (itens e quantidades).
- Na parte inferior:
  - Um painel central indicado como “Escolha o próximo passo”, com um pequeno menu:
    - **Iniciar Expedição Solo**.
    - **Abrir Crafting**.
    - (Placeholder de sair).
  - A opção selecionada fica em verde para reforçar foco/seleção no teclado.

## 🔥 Persistência na Nuvem (Firebase)

O jogo agora suporta **persistência de dados na nuvem** usando Firebase! Seus dados são salvos automaticamente e sincronizados em tempo real.

### Benefícios
- ✅ **Dados na nuvem**: Nunca perca seu progresso
- ✅ **Multi-dispositivo**: Jogue no PC, depois no celular
- ✅ **Anti-cheat**: Servidor valida todas as recompensas
- ✅ **Sincronização em tempo real**: Dados atualizados automaticamente
- ✅ **Histórico completo**: Todas as expedições são registradas
- ✅ **Fallback**: Funciona offline com localStorage

### Como Configurar

**Siga o guia completo**: [`FIREBASE_SETUP_GUIDE.md`](FIREBASE_SETUP_GUIDE.md)

**Resumo rápido**:
1. Criar projeto no [Firebase Console](https://console.firebase.google.com)
2. Baixar `firebase-service-account.json` (servidor)
3. Criar `src/services/firebaseConfig.ts` (cliente)
4. Reiniciar servidor e cliente

**Sem Firebase**: O jogo funciona normalmente com localStorage (modo offline).

---

## Modo Multiplayer (Beta)

O jogo agora suporta modo multiplayer cooperativo experimental! Jogadores podem explorar o mesmo mapa, ver uns aos outros, e compartilhar criaturas e recursos spawna dos pelo servidor.

### Como Ativar

1. **Iniciar o Servidor:**
   ```bash
   cd server
   npm run start
   ```
   O servidor iniciará em `ws://localhost:3003`

2. **Conectar ao Servidor:**
   Abra o jogo com o parâmetro `?mp=1`:
   ```
   http://localhost:5173/?mp=1
   ```

3. **Convidar Amigos:**
   Compartilhe a URL com outros jogadores. Até **12 jogadores** podem estar na mesma sala simultaneamente.

### O Que Funciona em Multiplayer

✅ **Sincronização de Entidades:**
- Criaturas selvagens são geradas pelo servidor e sincronizadas entre todos os jogadores
- Recursos são compartilhados e todos veem os mesmos spawns
- Jogadores remotos aparecem na tela com nome e barra de HP

✅ **Timer Sincronizado:**
- O timer de 4 minutos é controlado pelo servidor
- Todos os jogadores veem o mesmo tempo restante
- Partida termina para todos simultaneamente

✅ **Combate Server-Side:**
- Dano a criaturas é calculado e validado pelo servidor
- Criaturas mortas desaparecem para todos os jogadores
- Barras de HP são sincronizadas em tempo real

✅ **Sistema de Captura:**
- Tentativas de captura são validadas pelo servidor
- Captura bem-sucedida remove criatura do mapa para todos
- Chances de captura calculadas server-side

✅ **Sistema de Extração:**
- Extração completa é validada pelo servidor
- Recompensas são calculadas e enviadas ao final
- Múltiplos jogadores podem extrair simultaneamente

✅ **Tratamento de Erros:**
- Reconexão automática em caso de desconexão (até 5 tentativas)
- Fallback gracioso se servidor não estiver disponível
- Mensagens de erro claras (sala cheia, partida terminada, etc)

### Limitações Conhecidas

⚠️ **Em Desenvolvimento:**
- Ataques de jogadores não são visíveis para outros (sem projéteis remotos)
- IA de inimigos ainda é client-side (pode ter diferenças leves)
- Sem persistência de progresso entre sessões multiplayer
- Sem sistema de chat ou comunicação in-game
- Performance não testada com 12 jogadores simultaneamente

⚠️ **Servidor Local Apenas:**
- O servidor roda apenas localmente (`localhost:3003`)
- Não há servidor dedicado público ainda
- Para jogar com amigos remotos, é necessário configurar port forwarding ou VPN

### Single-Player Continua Funcionando

O modo single-player **não foi afetado** pela implementação multiplayer:
- Abra o jogo normalmente **sem** `?mp=1` para jogar offline
- Todas as mecânicas funcionam exatamente como antes
- Spawns são gerados localmente
- Sem dependência de servidor

### Modo de Debug

Para visualizar informações de debug multiplayer:
```
http://localhost:5173/?mp=1&debug=1
```
Pressione **F1** para ativar o painel de debug in-game.

### Logs do Servidor

O servidor exibe logs úteis para debug:
```
[Server] Cliente conectado: [id]
[Room:floresta-celestial] Game loop iniciado
[Room:floresta-celestial] Dano aplicado: 20 em criatura wild-1 (HP: 40/60)
[Room:floresta-celestial] ✓ Captura bem-sucedida! Jogador [id] capturou pyrognat
[Room:floresta-celestial] Jogador [id] completou extração: 2 criaturas, 3 tipos de recursos
```

### Arquivos de Documentação Multiplayer

Para entender melhor a implementação:
- `multiplayer-plan.md` - Plano de arquitetura multiplayer
- `MULTIPLAYER_MODE_GUIDE.md` - Guia técnico completo
- `MULTIPLAYER_INTEGRATION_TESTS.md` - Suite de testes de integração
- `server/COMBAT_SYSTEM_DOCS.md` - Documentação do sistema de combate

## Próximos Passos (ideias)

- ~~Evoluir para multiplayer (servidor WebSocket)~~ ✅ **Implementado (Beta)**
- Refinar sincronização de projéteis e ataques visuais
- Adicionar sistema de chat in-game
- Implementar servidor dedicado público
- Persistência de progresso multiplayer
- Sistema de clãs/guildas

## Mapas & Biomas

O sistema de mapas é configurado em `src/game/maps.ts` e hoje suporta múltiplos biomas de expedição. Cada bioma define:

- Duração de expedição.
- Densidade de criaturas e recursos.
- Posição e “aperto” da zona de extração.
- Paleta de cores de fundo e do cenário.

### Floresta Celestial

- **Perfil**: risco **Médio**, recompensas **Balanceadas**.
- **Layout**: áreas relativamente abertas com blocos de vegetação luminescente em tons de verde.
- **Densidade**:
  - Criaturas: ~6 por mapa, mix de tiers Comum/Perigosa/Elite.
  - Recursos: ~12 nós espalhados em torno do centro e laterais.
- **Extração**:
  - 1 ponto de extração centralizado na parte superior do mapa.
  - Tempo de extração: ~5 segundos parado na zona azul.
- **Estilo de gameplay**:
  - Mapa ideal para runs iniciais, com boa leitura de ameaças e rotas claras até a extração.

### Cavernas Cristalinas

- **Perfil**: risco **Médio**, recompensas **Estáveis** (muitos recursos).
- **Layout**: sensação de corredores e galerias cristalinas — fundo mais azulado, elementos em tons de azul e ciano.
- **Densidade**:
  - Criaturas: um pouco menos que a floresta, focando mais em posicionamento do que em pressão constante.
  - Recursos: alta densidade de cristais, incentivando o jogador a “farmar” antes de extrair.
- **Extração**:
  - 1 ponto de extração deslocado para a lateral direita superior do mapa.
  - Jogador precisa cruzar parte das galerias para chegar ao ponto seguro.
- **Estilo de gameplay**:
  - Focado em coleta: runs mais “gananciosas”, com muitos recursos se o jogador conhecer bem as rotas.

### Ruínas Antigas

- **Perfil**: risco **Alto**, recompensas **Explosivas**.
- **Layout**: plataformas de pedra quebradas, pilares e blocos em cinza/laranja, sugerindo ruínas em colapso.
- **Densidade**:
  - Criaturas: maior número e com HP base mais alto, trazendo encontros mais perigosos.
  - Recursos: moderados, mas geralmente próximos de áreas com inimigos mais fortes.
- **Extração**:
  - 1 ponto de extração mais central, forçando o jogador a atravessar zonas perigosas no fim da partida.
  - Tempo de extração levemente mais longo em relação à floresta.
- **Estilo de gameplay**:
  - Runs de alto risco: ideal quando o jogador já está confiante com o loop e quer apostar em recompensas grandes.

### Como selecionar mapas

- Na **Base** (`BaseHubScene`):
  - No canto superior direito é exibido o **Mapa atual** com uma breve descrição de risco/recompensa.
  - Pressione **M** para alternar entre os mapas disponíveis antes de iniciar a expedição.
- Via URL (para testes/dev):
  - Adicione `?map=floresta-celestial`, `?map=cavernas-cristalinas` ou `?map=ruinas-antigas` à URL do jogo para forçar o bioma da próxima expedição.

## Exploração e Navegação

O sistema de exploração foi projetado para criar tensão e sensação de aventura real. A câmera aproximada e os mapas grandes fazem com que o jogador precise de tempo para explorar e encontrar pontos de interesse.

### Tamanho do Mapa

Os mapas de expedição são significativamente maiores que a viewport visível:

| Mapa | Dimensões | Descrição |
|------|-----------|-----------|
| **Floresta Celestial** | 2400×1800 px | Mapa de entrada, tamanho médio para aprender o loop |
| **Cavernas Cristalinas** | 2800×2000 px | Mapa maior com mais recursos para explorar |
| **Ruínas Antigas** | 3200×2400 px | Maior mapa, máximo risco e recompensa |

O jogador sempre começa na parte inferior do mapa e a zona de extração fica na região superior/distante, forçando uma travessia completa.

### Câmera

A câmera segue o jogador com um **zoom aumentado** (1.8x a 2.0x dependendo do mapa), o que:

- **Reduz o campo de visão**: O jogador não consegue ver todo o mapa de uma vez, aumentando a tensão.
- **Cria atmosfera de exploração**: Cada novo tile/área que o jogador descobre é uma surpresa.
- **Aumenta o risco**: Criaturas e recursos podem estar fora do campo de visão; o jogador precisa se mover para descobrir.
- **Suavização**: A câmera usa interpolação (lerp 0.08) para seguir o jogador suavemente, evitando motion sickness.

### Minimapa

Um minimapa no **canto inferior direito** da tela ajuda na navegação:

- **Fundo escuro semi-transparente**: Para não atrapalhar a jogabilidade.
- **Ponto verde (jogador)**: Mostra sua posição atual no mapa em tempo real.
- **Área azul pulsante (extração)**: Indica a direção aproximada da zona de extração.
  - A pulsação ajuda a chamar atenção sem revelar detalhes demais.
  - A label "EXT" aparece acima do marcador para reforçar o objetivo.

#### Como ler o minimapa para encontrar extração:

1. Observe o ponto verde (você) e o ponto azul (extração).
2. Mova-se na direção do ponto azul.
3. A distância real é proporcional à distância no minimapa.
4. Quando você estiver perto da zona azul no minimapa, estará perto da extração no mapa real.

**Dica**: O minimapa não mostra criaturas ou recursos – apenas sua posição e o objetivo final. Isso mantém a exploração interessante enquanto dá uma referência de navegação.

## Conteúdo Inicial de Criaturas e Itens

### Criaturas Iniciais

| ID        | Nome      | Tipo(s)               | Papel / Estilo de Jogo                   |
|----------|-----------|-----------------------|------------------------------------------|
| pyrognat | Pyrognat  | Fogo / Voador        | Mago de fogo móvel, foco em dano em área|
| aquaryl  | Aquaryl   | Água                  | Lutador equilibrado com cura pontual     |
| verdant  | Verdant   | Planta                | Tank/control, mais defesa e enraizamento |
| voltiger | Voltiger  | Elétrico / Lutador   | Glass cannon rápido, burst elétrico      |

### Habilidades Especiais por Criatura

| Criatura | Habilidade             | Efeito                                                                 | Cooldown aproximado |
|----------|------------------------|-------------------------------------------------------------------------|---------------------|
| Pyrognat | Nevoeiro Incendiário  | Cria uma área de fogo no ponto do cursor que causa dano periódico em criaturas selvagens dentro da zona. | 12s                 |
| Aquaryl  | Maré Curativa         | Onda de água ao redor do jogador que restaura parte do HP da criatura ativa.                             | 14s                 |
| Voltiger | Surto Elétrico        | Explosão elétrica ao redor do jogador que causa dano moderado e empurra criaturas próximas para longe.   | 11s                 |

### Identidade Visual das Criaturas

Cada criatura possui uma identidade visual distinta que reforça seu tipo elemental. A cor do jogador, projéteis, efeitos de habilidade e partículas de impacto mudam de acordo com a criatura ativa.

| Criatura | Tipo(s) | Cor Principal | Cor de Ataque | Tipo de Ataque | Particularidades Visuais |
|----------|---------|---------------|---------------|----------------|--------------------------|
| **Pyrognat** | Fogo/Voador | Laranja vibrante (`#f97316`) | Laranja-fogo (`#ff6b35`) | Projétil | Projéteis ardentes com partículas amarelas. Habilidade especial cria um nevoeiro de fogo translúcido. |
| **Aquaryl** | Água | Azul água (`#38bdf8`) | Ciano (`#22d3ee`) | Projétil | Projéteis líquidos com brilho ciano. Habilidade de cura gera partículas de água subindo. |
| **Verdant** | Planta | Verde vibrante (`#22c55e`) | Verde claro (`#4ade80`) | Melee (arco) | Ataque melee mostra um arco de balanço na direção do cursor. Hitbox visível durante o ataque. |
| **Voltiger** | Elétrico/Lutador | Amarelo elétrico (`#facc15`) | Amarelo claro (`#fef08a`) | Projétil | Projéteis de raio com faíscas. Habilidade especial dispara raios em zigzag ao redor do jogador. |

#### Feedback Visual de Combate

- **Flash de Hit**: Quando um ataque acerta um inimigo, ele brilha na cor do tipo de ataque por um breve momento.
- **Knockback**: Inimigos são empurrados levemente na direção do impacto.
- **Partículas de Impacto**: Pequenas partículas na cor do ataque se espalham no ponto de contato.
- **Efeito de Morte**: Quando uma criatura é derrotada, uma explosão de partículas coloridas e um anel em expansão indicam a eliminação.
- **Arco de Melee**: Ataques corpo a corpo (como o Verdant) mostram visualmente a área de efeito do golpe.

A configuração de temas visuais está centralizada em `src/game/creatureThemes.ts`, facilitando ajustes de paleta e adição de novas criaturas.

### Pokébolas de Captura

| ID               | Nome           | Tier      | Efeito de Captura                                                  |
|------------------|----------------|-----------|---------------------------------------------------------------------|
| poke-ball-basic  | Pokébola Básica| Básico    | Chance padrão (base) de captura.                                   |
| poke-ball-precisa| Bola Precisa   | Avançado  | Melhor desempenho com criaturas já com pouco HP.                   |
| poke-ball-ultra  | Ultra Bola     | Épico     | Maior multiplicador geral de chance, mesmo com HP um pouco maior.  |

No protótipo, ao pressionar **Q** o jogo usa automaticamente a **melhor pokébola disponível** no inventário, seguindo a prioridade: Ultra → Precisa → Básica.

## Sistema de Identidade Visual de Itens

O jogo utiliza um sistema de cores e símbolos para que o jogador identifique rapidamente:
- **Categoria do item**: função principal (captura, recurso, consumível, upgrade)
- **Raridade/tier**: valor relativo do item (Básico → Lendário)

Este sistema ajuda o jogador a tomar decisões rápidas de risco x recompensa durante expedições.

### Categorias de Itens

| Símbolo | Categoria | Cor Principal | Descrição | Quando Usar |
|---------|-----------|---------------|-----------|-------------|
| ◉ | **Captura** | Vermelho (#ef4444) | Pokébolas e ferramentas de captura | Vale arriscar para ter mais opções de captura |
| ◆ | **Recurso** | Âmbar (#f59e0b) | Materiais brutos para crafting | Acumular para crafting na base |
| ♥ | **Consumível** | Verde (#22c55e) | Itens de uso imediato (poções) | Usar durante expedições para sobreviver |
| ★ | **Upgrade** | Azul (#3b82f6) | Melhorias permanentes de base | Investimento de longo prazo |

### Tiers de Raridade

| Tier | Cor de Borda | Brilho | Tamanho Visual | Identificação |
|------|--------------|--------|----------------|---------------|
| **Básico** | Cinza (#6b7280) | Nenhum | Normal | Itens comuns, fáceis de obter |
| **Avançado** | Azul (#3b82f6) | Leve | Normal | Itens úteis, requerem algum esforço |
| **Épico** | Roxo (#a855f7) | Moderado | Maior | Itens raros, grande impacto |
| **Lendário** | Dourado (#fbbf24) | Intenso | Maior | Itens extremamente raros, game-changing |

### Onde as Cores Aparecem

- **No mapa de expedição**: Pickups de recursos usam cores da categoria + borda do tier. Recursos raros são ligeiramente maiores.
- **No inventário**: Fundo colorido por tier, símbolo da categoria à esquerda do nome, texto com cor do tier.
- **No crafting**: Receitas mostram tier do resultado, ingredientes com cores de suas respectivas categorias.
- **Feedback de coleta**: Partículas e texto flutuante usam a cor do item coletado.

### Recursos por Cor no Mapa

| Recurso | Cor | Borda | Onde Encontrar |
|---------|-----|-------|----------------|
| Ferro Cristalino | Dourado (#fbbf24) | Marrom | Todos os biomas (comum) |
| Mola de Precisão | Azul (#60a5fa) | Azul escuro | Ruínas Antigas |
| Seiva Eterna | Verde (#4ade80) | Verde escuro | Floresta Celestial (raro) |
| Cristal de Caverna | Ciano (#22d3ee) | Azul petróleo | Cavernas Cristalinas (raro) |
| Energia Pura | Roxo (#a855f7) | Roxo escuro | Cavernas/Ruínas (raro) |
| Essência Sombria | Violeta (#8b5cf6) | Roxo profundo | Pântano Sombrio (raro) |

### Dica para Jogadores

> **Olhar rápido, decisão rápida**: Durante uma expedição, priorize:
> - 🔴 **Vermelho** = mais opções de captura
> - 🟡 **Dourado/Âmbar** = recursos para crafting
> - 🟣 **Roxo** = itens épicos, vale arriscar mais tempo
> - 🟢 **Verde** = cura imediata quando HP estiver baixo

## Economia & Crafting Inicial

### Recursos por bioma / mapa

Os recursos são modelados para reforçar a fantasia de biomas diferentes, mesmo no MVP single-player. Cada mapa tem recursos **comuns** (sempre presentes) e **raros** (aparecem menos, usados em receitas mais fortes).

**Floresta Celestial (`floresta-celestial`)**

- **Comuns**
  - `resource-ferro-cristalino` – **Ferro Cristalino**: base genérica usada na maior parte das receitas de pokébolas e itens iniciais.
- **Raros**
  - `resource-seiva-eterna` – **Seiva Eterna**: recurso raro da floresta, usado em poções e upgrades de base.

**Cavernas Cristalinas (`cavernas-cristalinas`)**

- **Comuns**
  - `resource-ferro-cristalino` – **Ferro Cristalino**.
- **Raros**
  - `resource-cristal-caverna` – **Cristal de Caverna**: cristal refinado encontrado em cavernas, base para equipamentos resistentes.
  - `resource-energia-pura` – **Energia Pura**: componente raro usado em bolas de captura de tier alto.

**Ruínas Antigas (`ruinas-antigas`)**

- **Comuns**
  - `resource-ferro-cristalino` – **Ferro Cristalino**.
  - `resource-mola-precisao` – **Mola de Precisão**: requisito para bolas mais precisas/avançadas.
- **Raros**
  - `resource-energia-pura` – **Energia Pura**.

*(Planejado para o futuro)* **Pântano Sombrio (`pantano-sombrio`)**

- **Comuns**
  - `resource-ferro-cristalino` – **Ferro Cristalino**.
- **Raros**
  - `resource-essencia-sombria` – **Essência Sombria**: essência concentrada de biomas pantanosos, usada em receitas épicas.

### Recursos & Itens de Crafting

| ID                         | Nome                        | Uso Principal                                                   |
|----------------------------|-----------------------------|----------------------------------------------------------------|
| `resource-ferro-cristalino` | Ferro Cristalino           | Base para craft da Pokébola Básica e outras bolas.            |
| `resource-mola-precisao`  | Mola de Precisão            | Requisito para bolas mais precisas/avançadas.                 |
| `resource-energia-pura`   | Energia Pura                | Componente raro para a Ultra Bola.                            |
| `resource-seiva-eterna`   | Seiva Eterna                | Usada em poções e em upgrades de base de baixo impacto.       |
| `resource-cristal-caverna`| Cristal de Caverna          | Planejado para equipamentos mais resistentes em cavernas.     |
| `resource-essencia-sombria`| Essência Sombria           | Ingrediente épico para upgrades e itens de risco alto.        |
| `potion-basic`            | Poção                       | Consumível que restaura uma pequena quantidade de HP.         |
| `upgrade-slot-equipe`     | Plano de Expansão de Equipe | Blueprint que concede +1 slot de criatura na equipe da base. |

### Receitas de crafting disponíveis (MVP)

- **Pokébola Básica** (`recipe-poke-ball-basic`)
  - **Resultado**: `poke-ball-basic` (Pokébola Básica)
  - **Custo**: 2x `resource-ferro-cristalino`
  - **Uso**: Ferramenta de captura padrão, ideal para volume.

- **Bola Precisa** (`recipe-precise-ball`)
  - **Resultado**: `poke-ball-precisa` (Bola Precisa)
  - **Custo**: 2x `resource-ferro-cristalino`, 2x `resource-mola-precisao`
  - **Uso**: Melhor desempenho com criaturas já bem enfraquecidas (sinergia com HP baixo).

- **Ultra Bola** (`recipe-ultra-ball`)
  - **Resultado**: `poke-ball-ultra` (Ultra Bola)
  - **Custo**: 2x `resource-ferro-cristalino`, 1x `resource-mola-precisao`, 1x `resource-energia-pura`
  - **Uso**: Maior chance geral de captura, mesmo com HP médio; recurso caro e raro.

- **Poção Básica** (`recipe-potion-basic`)
  - **Resultado**: `potion-basic` (Poção)
  - **Custo**: 1x `resource-ferro-cristalino`, 1x `resource-seiva-eterna`
  - **Uso**: Consumível projetado para expedições mais longas; permite recuperar parte do HP da criatura ativa.

- **Plano de Expansão de Equipe** (`recipe-upgrade-team-slot`)
  - **Resultado**: `upgrade-slot-equipe` (efeito aplicado diretamente)
  - **Custo**: 2x `resource-seiva-eterna`, 1x `resource-essencia-sombria`
  - **Efeito**: Ao craftar, o jogador ganha **+1 slot de criatura na equipe** (até um limite suave definido em `playerState`), facilitando levar mais criaturas para futuras expedições.

## Progressão de Criaturas

O sistema de progressão permite que criaturas ganhem XP e evoluam através de dois mecanismos complementares: **nível por XP** e **rank por fusão de cópias**.

### Sistema de Níveis (XP)

Cada criatura ganha XP ao participar de expedições. O XP é distribuído ao final de cada expedição, independente de sucesso ou falha na extração.

#### Como Ganhar XP

| Fonte | XP por Unidade | Descrição |
|-------|----------------|-----------|
| Participação na equipe | 30 XP | Todas as criaturas na equipe ativa ganham este bônus |
| Extração bem-sucedida | +50 XP | Bônus adicional se o jogador extrair com sucesso |
| Tempo ativo em campo | 15 XP/minuto | Proporcional ao tempo que a criatura foi usada como ativa |
| Criaturas derrotadas | 10 XP | Dividido entre a equipe |
| Recursos coletados | 3 XP | Dividido entre a equipe |

#### Curva de Progressão

- **Nível máximo**: 50
- **XP base para primeiro level up**: 100 XP
- **Escala**: Cada nível subsequente requer 15% mais XP que o anterior

#### Bônus por Nível

Cada nível aumenta os stats base da criatura:

| Stat | Bônus por Nível |
|------|-----------------|
| HP | +2% |
| Dano de Ataque | +1.5% |
| Defesa | +1% |
| Velocidade | +0.5% |

### Sistema de Ranks (Fusão de Cópias)

Criaturas podem ser promovidas para ranks superiores sacrificando cópias da mesma espécie. Cada rank aumenta significativamente os stats através de um multiplicador.

#### Ranks Disponíveis

| Rank | Símbolo | Cópias Totais | Multiplicador | Cor |
|------|---------|---------------|---------------|-----|
| Comum | ★ | 0 | x1.00 | Cinza |
| Incomum | ★★ | 2 | x1.10 | Verde |
| Raro | ★★★ | 5 | x1.20 | Azul |
| Épico | ★★★★ | 10 | x1.35 | Roxo |
| Lendário | ★★★★★ | 20 | x1.50 | Dourado |

**Nota**: O número de cópias é cumulativo. Para ir de Comum para Incomum, são necessárias 2 cópias. Para ir de Incomum para Raro, são necessárias mais 3 cópias (5 no total).

#### Como Fundir Cópias

1. Acesse a **Base** após uma expedição
2. Selecione **Evoluir Criaturas** no menu (ou pressione **U**)
3. Escolha a criatura que deseja evoluir com as setas (↑/↓)
4. Se tiver cópias suficientes, pressione **ENTER** para fundir

As cópias usadas na fusão são permanentemente removidas do inventário.

### Visualização de Progresso

#### Na Base (BaseHubScene)

A tela da base agora exibe informações detalhadas de progressão para cada criatura da equipe:

- **Rank**: Representado por estrelas (★) com cor indicando a raridade
- **Nível**: Exibido ao lado do nome
- **Barra de XP**: Mostra progresso para o próximo nível
- **Stats efetivos**: HP, ATK e DEF calculados com bônus de nível e rank

#### Na Tela de Evolução (CreatureUpgradeScene)

A tela dedicada de evolução mostra:

- Lista de todas as criaturas possuídas
- Detalhes completos da criatura selecionada:
  - Rank atual e nome
  - Nível e barra de XP
  - Todos os stats efetivos
  - Bônus de stats obtidos pela progressão
  - Progresso de fusão para o próximo rank
  - Número de cópias disponíveis
  - Botão de fusão (quando disponível)

### Persistência

Todo o progresso de criaturas é salvo automaticamente no localStorage:

- Nível e XP atual
- Rank e cópias fundidas
- Total de XP ganho em expedições (para tracking)
- HP atual (restaurado ao máximo na base)

### Impacto na Gameplay

O sistema de progressão cria incentivos claros para o jogador:

1. **Voltar para expedições**: Mesmo sem capturar novas criaturas, ganhar XP já é motivador
2. **Capturar cópias**: Criaturas "repetidas" agora têm valor como material de fusão
3. **Especialização**: Focar em evoluir uma criatura específica vs ter várias criaturas básicas
4. **Risco x Recompensa**: Extração bem-sucedida dá bônus significativo de XP

Uma criatura Lv.50 com rank Lendário terá aproximadamente **2.5x os stats** de uma criatura Lv.1 Comum (98% de bônus de nível × 1.5 multiplicador de rank).

### Comandos Relacionados

| Tecla | Ação |
|-------|------|
| **U** | Abre a tela de evolução de criaturas (na base) |
| **↑/↓** | Navega entre criaturas na tela de evolução |
| **ENTER** | Confirma fusão de cópias |
| **ESC** | Volta para a base |

## Balanceamento e Telemetria

### Parâmetros de Balanceamento Atuais

O jogo foi balanceado para proporcionar uma experiência de **3-5 minutos** com tensão crescente. Os valores abaixo foram ajustados para criar um equilíbrio entre risco e recompensa. Os números são centralizados em `game/constants.ts` para facilitar ajustes futuros.

| Parâmetro | Valor | Racional |
|-----------|-------|----------|
| **Duração da Expedição** | 240s (4 minutos) | Mantém partidas ainda dentro da faixa de 3–5 minutos, mas com espaço extra para explorar biomas diferentes antes de decidir extrair. |
| **Tempo de Extração** | 5 segundos | Tempo suficiente para gerar vulnerabilidade forte na zona azul, reforçando o momento de risco máximo da run. |
| **Dano por Projétil do Jogador** | 20 | Permite derrotar inimigos comuns em poucos disparos, mantendo ritmo ágil. |
| **Número de Recursos** | ~10 por mapa | Recursos suficientes para testar crafting sem inundar o inventário em uma única run. |
| **Número de Criaturas Selvagens** | ~6 por mapa | Garante encontros frequentes espalhados pelo mapa, sem superlotar a área jogável. |

### Tiers de Inimigos (Escala de Ameaça)

As criaturas selvagens da **Floresta Celestial** agora são categorizadas em tiers de ameaça, usados tanto para spawn quanto para feedback visual:

| Tier       | HP Aproximado | Dano de Contato (por segundo) | Comportamento / Fantasia | Aparição no Mapa |
|-----------|---------------|-------------------------------|--------------------------|-------------------|
| **Comum** | ~60 HP        | ~6 DPS                        | Encontros básicos, punem apenas distração total. | Maioria dos spawns próximos ao centro do mapa. |
| **Perigosa** | ~90 HP     | ~12 DPS                       | Forçam reposicionamento; ficar colado nelas derrete o HP da equipe. | Espalhadas mais para as bordas e rotas alternativas. |
| **Elite** | ~130 HP       | ~20 DPS                       | Mini-“mini-bosses” da run: ignorá-las pode significar morte rápida. | Spawns mais raros em áreas laterais/mais profundas do mapa. |

Visualmente:
- **Comuns**: círculos menores vermelho-escuro com contorno vermelho-claro.
- **Perigosas**: maior contraste laranja, destacando maior ameaça.
- **Elites**: maiores, com cores quentes e contorno mais brilhante, para comunicar risco alto à distância.

### Modificadores de Pokébola

| Pokébola | Multiplicador | Bônus Fixo | Efeito |
|----------|---------------|------------|--------|
| Básica | 1.0x | +0% | Chance base sem modificações |
| Precisa | 1.2x | +5% | Melhor com criaturas com pouco HP (bonus de HP baixo) |
| Ultra | 1.6x | +10% | Maior chance geral, mesmo com HP médio |

A chance final de captura é calculada como: `(baseChance + bonusHP) * multiplicador + bônusFixo`, limitada a 95% máximo.

### Sistema de Telemetria

O jogo registra automaticamente métricas durante a expedição para análise de balanceamento:

**Métricas Coletadas:**
- Tempo total de expedição (e duração em minutos)
- Recursos coletados (total e por minuto)
- Criaturas encontradas vs capturadas
- Tentativas de captura (sucessos e falhas)
- Taxa de sucesso de captura
- Chance média de captura
- Encontros de combate
- Dano causado
- Dano recebido pelo jogador (incluindo mortes em combate)
- Projéteis disparados

**Visualização:**
- Ao final da expedição (sucesso ou falha), os dados são exibidos em formato de tabela no console usando `console.table()`.
- Um painel de debug em tempo real pode ser ativado pressionando **F1** ou adicionando `?debug=1` na URL.
- O painel mostra todas as métricas atualizadas em tempo real durante a jogada.

### Objetivo de Balanceamento

O objetivo é criar uma experiência onde:
1. **Primeiros 2 minutos**: Exploração e coleta relativamente segura
2. **2-3 minutos**: Tensão aumenta, jogador precisa decidir entre continuar coletando ou ir para extração
3. **3-4 minutos**: Alta tensão, risco de perder tudo se não extrair a tempo
4. **Recompensas**: Balanceadas para recompensar jogadores que arriscam mais tempo, mas com risco crescente

Os valores podem ser ajustados conforme feedback de playtesting e análise dos dados de telemetria coletados.

## Comportamento Básico de Inimigos

As criaturas selvagens agora possuem um sistema de IA que as torna ameaças ativas no mapa, perseguindo e atacando o jogador de forma legível e previsível.

### Tipos de Comportamento

Cada inimigo possui um de dois perfis de comportamento:

| Tipo | Descrição | Cor Visual | Comportamento |
|------|-----------|------------|---------------|
| **Melee** | Combatente corpo a corpo agressivo | Tons vermelhos/laranjas | Persegue e ataca quando próximo |
| **Ranged** | Atirador à distância que mantém recuo | Tons roxos | Mantém distância e dispara projéteis |

### Estados da IA

Cada inimigo opera em um dos seguintes estados:

| Estado | Comportamento |
|--------|---------------|
| **Idle** | Patrulhando levemente ao redor do ponto de spawn |
| **Chasing** | Perseguindo o jogador após detecção |
| **Attacking** | Preparando e executando ataque (com "tell" visual) |
| **Retreating** | Recuando do jogador (apenas ranged quando muito perto) |
| **Stunned** | Atordoado brevemente após receber dano |

### Feedback Visual

Para garantir que o jogador possa ler e reagir aos inimigos:

- **Indicador de Aggro**: Anel colorido ao redor do inimigo quando está perseguindo ou atacando
- **Tell de Ataque**: Flash branco piscante antes de cada ataque, dando tempo para reagir
- **Cores por Tipo**: Melee usa tons vermelhos/laranjas, Ranged usa tons roxos

### Configuração por Tier

Os valores de IA escalam com o tier de ameaça do inimigo:

| Parâmetro | Comum | Perigosa | Elite |
|-----------|-------|----------|-------|
| **Velocidade (melee)** | 100 px/s | 130 px/s | 160 px/s |
| **Velocidade (ranged)** | 70 px/s | 90 px/s | 110 px/s |
| **Alcance de Detecção** | 180-220 px | 220-260 px | 280-320 px |
| **Dano por Ataque (melee)** | 8 | 14 | 22 |
| **Dano por Ataque (ranged)** | 6 | 10 | 16 |
| **Tempo de Windup** | 0.4-0.5s | 0.35-0.45s | 0.3-0.4s |

### Comportamento Melee Detalhado

1. **Detecção**: Quando o jogador entra no alcance de detecção, inicia perseguição
2. **Perseguição**: Move-se em linha reta em direção ao jogador
3. **Preparação**: Ao entrar no alcance de ataque, inicia "windup" (tell visual)
4. **Ataque**: Após o windup, executa ataque em área curta à frente
5. **Cooldown**: Aguarda antes de poder atacar novamente
6. **Patrulha**: Quando o jogador está fora do alcance, patrulha suavemente ao redor do ponto de spawn

### Comportamento Ranged Detalhado

1. **Detecção**: Quando o jogador entra no alcance de detecção, entra em modo de combate
2. **Posicionamento**: Tenta manter uma distância preferida do jogador (120-180px dependendo do tier)
3. **Kiting**: Se o jogador chega muito perto, recua enquanto tenta atirar
4. **Preparação**: Ao atirar, mostra tell visual antes de disparar
5. **Projétil**: Dispara projétil vermelho em direção ao jogador
6. **Strafing**: Quando em alcance ideal, circula lateralmente para dificultar acertos do jogador

### Spawn de Inimigos

- ~35% dos inimigos são ranged, ~65% são melee
- A proporção de tiers é configurada em `WILD_CREATURE_CONFIG.tierWeights`
- Os tipos são visualmente distintos pela cor para fácil identificação

### Dicas para o Jogador

- **Observe os tells**: O flash branco antes do ataque dá tempo para esquivar
- **Priorize ranged**: Inimigos roxos atiram à distância, mate-os primeiro ou aproxime-se para dificultar o kiting
- **Use habilidades AoE**: Nevoeiro Incendiário e Surto Elétrico são eficazes contra grupos
- **Cuidado com elites**: Têm mais HP, velocidade e dano - evite se não estiver preparado

## Mecânicas Avançadas de Gameplay

O jogo possui mecânicas complementares que aumentam a profundidade do gameplay, reforçando o risco x recompensa e criando sinergias entre criaturas e recursos.

### Carga Valiosa (Greed Risk)

Esta mecânica reforça a fantasia de extração arriscada: **quanto mais recursos você carrega, maior o risco mas também ganha bônus**.

#### Como Funciona

| Recursos Coletados | Tier | Bônus de Velocidade | Efeito de Risco |
|--------------------|------|---------------------|-----------------|
| 0-3 | Normal | Nenhum | Nenhum |
| 4-7 | **Carga Valiosa** (Tier 1) | +5% velocidade | Inimigos detectam você de 20% mais longe |
| 8+ | **Muito Carregado** (Tier 2) | +10% velocidade | Inimigos detectam você de 50% mais longe |

#### Feedback Visual

- Ao atingir **Tier 1**, um **anel amarelo** pulsante aparece ao redor do jogador.
- Ao atingir **Tier 2**, o anel fica **laranja** e mais intenso, comunicando perigo aumentado.
- Mensagens flutuantes informam quando você muda de tier.

#### Estratégia

> **Dica**: A Carga Valiosa cria uma tensão interessante:
> - Coletou muitos recursos? Use o bônus de velocidade para correr até a extração!
> - Mas cuidado: inimigos que antes não te viam agora podem perseguir você.
> - Considere extrair mais cedo com menos recursos se a situação estiver perigosa.

### Sinergia Elemental

Criaturas podem ganhar **buffs temporários** ao coletar recursos compatíveis com seu tipo elemental. Isso incentiva escolher a criatura certa para o bioma e planejar rotas de coleta.

#### Sinergias Disponíveis

| Tipo da Criatura | Recurso Sinérgico | Buff | Duração |
|------------------|-------------------|------|---------|
| **Fogo** (Pyrognat) | Energia Pura | +20% dano de ataque | 30s |
| **Água** (Aquaryl) | Seiva Eterna | Regeneração de 2 HP/segundo | 20s |
| **Planta** (Verdant) | Ferro Cristalino | -15% dano recebido | 25s |
| **Elétrico** (Voltiger) | Cristal de Caverna | +10% velocidade de movimento | 20s |
| **Elétrico** (Voltiger) | Essência Sombria | +15% velocidade de movimento | 25s |

#### Feedback Visual

- Ao ativar uma sinergia, uma **explosão de partículas coloridas** aparece ao redor do jogador.
- Uma mensagem flutuante indica o buff ativado (ex: "Chamas Intensificadas! +20% Dano").
- Os buffs são **renováveis**: coletar o mesmo recurso novamente reseta a duração.

#### Estratégia

> **Dica de Sinergia por Bioma**:
> - **Floresta Celestial**: Aquaryl brilha aqui, podendo regenerar HP com Seiva Eterna.
> - **Cavernas Cristalinas**: Voltiger fica ainda mais rápido com Cristais de Caverna.
> - **Ruínas Antigas**: Pyrognat pode maximizar dano com Energia Pura encontrada aqui.
> - **Qualquer Bioma**: Verdant sempre ganha defesa com Ferro Cristalino, presente em todos os mapas.

### Configuração das Mecânicas

Todos os parâmetros das mecânicas avançadas estão centralizados em `game/constants.ts`:

```typescript
// Carga Valiosa (Greed Risk)
GREED_RISK_CONFIG = {
  tier1Threshold: 4,      // Recursos para ativar tier 1
  tier2Threshold: 8,      // Recursos para ativar tier 2
  tier1SpeedBonus: 1.05,  // +5% velocidade
  tier2SpeedBonus: 1.1,   // +10% velocidade
  tier1DetectionMultiplier: 1.2,  // Inimigos detectam 20% mais longe
  tier2DetectionMultiplier: 1.5   // Inimigos detectam 50% mais longe
}

// Sinergias Elementais
ELEMENTAL_SYNERGIES = {
  Fogo: { "resource-energia-pura": { type: "damage", value: 0.2, ... } },
  Água: { "resource-seiva-eterna": { type: "heal", value: 2, ... } },
  // ... etc
}
```

Isso permite ajustar facilmente os valores de balanceamento sem modificar a lógica do jogo.

