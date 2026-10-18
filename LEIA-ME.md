# VidCut

Editor de vídeo e áudio para uso pessoal, ao estilo CapCut, feito com **Electron + React + Remotion**. Corre em Windows, macOS e Linux.

Estado: **fase 1 concluída** (base do editor). Ver o plano no fim.

## O que já faz

- Importar vídeo (MP4, MOV, WebM, MKV), áudio (MP3, WAV, M4A, AAC, OGG, FLAC) e imagens (PNG, JPG, WebP, GIF), pelo botão ou a arrastar ficheiros do sistema
- Timeline multi-pista (vídeo e áudio), pistas de vídeo de cima ficam por cima da imagem
- Mover clips (também entre pistas do mesmo tipo), aparar pelas pontas, dividir, apagar
- Três tipos de divisão, como no CapCut: dividir (`S`), dividir e eliminar à esquerda (`Q`) e dividir e eliminar à direita (`W`). Nos dois últimos, o espaço que fica é fechado (os clips seguintes da mesma pista encostam)
- Cabeça de leitura arrastável: pela pega no topo (na régua) ou agarrando a própria linha em qualquer ponto (o cursor muda ao passar por cima)
- **Seleção múltipla**: arrastar numa zona vazia da timeline desenha um retângulo que seleciona os clips que toca (`Shift`/`Cmd` para juntar à seleção); `Cmd+A` seleciona tudo. Arrastar um dos clips selecionados move o grupo todo (cada um na sua pista, sem saltar por cima de outros)
- **Copiar / cortar / colar / duplicar**: `Cmd+C`, `Cmd+X`, `Cmd+V` (cola na cabeça de leitura, mantendo as posições relativas; se não houver espaço cria pistas novas), `Cmd+D` (duplica logo a seguir). Num campo de texto, estes atalhos funcionam no texto
- **Apagar e fechar espaço** (ripple): `Shift+Delete` ou botão direito → "Apagar e fechar espaço"; os clips seguintes da mesma pista encostam
- **Forma de onda real** nos clips de áudio e numa faixa por baixo dos vídeos com som (calculada com o ffmpeg, guardada em cache)
- Íman: encaixa nas pontas de outros clips e na cabeça de leitura
- Magnet ao largar media: o clip cola-se ao fim do clip anterior nessa pista (ou ao início, se a pista estiver vazia). Com o íman desligado, fica onde o largaste
- Zoom da timeline até ao frame (cerca de 0,3 s visíveis; a régua passa a mostrar frames): arrastar as pontas da barra de navegação (por baixo das pistas), pinça no trackpad, `Ctrl`/`Cmd` + roda, slider, `+` / `-` / `0`
- Barra de navegação: arrastar o meio para andar na timeline, clicar fora para saltar
- **Separar áudio** de um clip de vídeo (botão direito no clip, ou no painel da direita): o som passa para uma pista de áudio, alinhado ao frame, e pode ser movido, cortado e ter volume e fades próprios. "Voltar a juntar o áudio" desfaz a separação
- Fade in / fade out por clip: no vídeo afeta imagem e som, no áudio afeta o volume. Ajusta-se no painel ou a arrastar as bolinhas no canto superior de cada clip (esquerda: fade in, direita: fade out)
- **Transições** entre clips encostados na mesma pista de vídeo: passa o rato na junção e carrega no **+**. Tipos: Dissolver, Fundido a preto, Deslizar, Empurrar, Cortina, Zoom. Duração com presets IBM (Rápida 240 ms, Média 400 ms, Lenta 700 ms, 1 s) e curva IBM expressiva. A transição fica centrada no corte; se um clip não tiver imagem extra para lá do corte, o primeiro/último frame fica parado durante a transição. Seleciona o bloco da transição para mudar ou apagar (`Delete`)
- Volume por clip (0–200 %), silenciar e esconder pistas
- **Enquadramento** de vídeos e imagens: posição, escala, rotação (com ±90°), espelhar, ajuste (caber inteiro / preencher), opacidade e recorte. Na pré-visualização, o clip selecionado mostra uma caixa: arrastar para mover (encaixa no centro e nos terços), cantos para redimensionar, pega de cima para rodar (`Shift`: de 15 em 15°). Disposições rápidas: inteiro, preencher, metades (esquerda/direita/cima/baixo, para ecrã dividido) e picture-in-picture nos 4 cantos
- **Velocidade** de vídeos e áudio (0,25× a 4×, slider ou 0,5× / 1× / 1,5× / 2× / 3×): mantém o mesmo excerto, o clip encolhe/estica e os clips seguintes da pista acompanham. Na timeline aparece "2×"
- **Cor e efeitos** (vídeo e imagem): brilho, contraste, saturação, temperatura (frio ↔ quente), desfocar, vinheta e sépia, com filtros prontos (Vívido, Quente, Frio, P&B, Sépia, Desbotado, Cinema, Vintage)
- Painel dos clips de vídeo/imagem organizado em separadores: Básico, Enquadrar, Cor, Animação
- **Keyframes** (vídeo, imagem e texto): animar posição, escala, rotação e opacidade ao longo do tempo. No separador Enquadrar (ou na posição do texto): "Adicionar keyframe" guarda os valores no frame atual; depois, ao mudar a posição/escala/rotação/opacidade noutro frame (no painel ou a arrastar na pré-visualização), o keyframe é criado sozinho. Curva por keyframe: Produtiva, Expressiva (IBM), Linear ou Parar. Setas para saltar entre keyframes; na timeline os keyframes aparecem como losangos (clicar salta, arrastar move). Os keyframes acompanham o conteúdo ao aparar, dividir e mudar a velocidade
- **Modelos programáticos (Remotion)**: aba **Modelos** no painel da esquerda, com pré-visualização ao passar o rato. Arrastar para a timeline ou duplo clique (entra numa pista de vídeo livre, ou numa nova no topo). Ao selecionar, o separador **Modelo** mostra os campos do modelo (gerados automaticamente); os modelos também aceitam enquadramento, cor, animação e keyframes. Incluídos (15): Título cinema, Título em duas linhas, Citação, Capítulo, Oráculo (nome), Lembrete subscrever, Revelação de logótipo, Contagem decrescente, Contador de número, Gráfico de barras, Lista de pontos, Fundo gradiente, Confetes e brilhos, Cartão final, Créditos finais. Vários são adaptados dos templates MIT de [reactvideoeditor/remotion-templates](https://github.com/reactvideoeditor/remotion-templates), reescritos com parâmetros, tamanhos relativos ao quadro e curvas IBM
- **Criar modelos próprios**: junta um ficheiro `.tsx` à pasta `modelos/` (guia e exemplo em `modelos/_LEIA-ME.md`). Em `npm run dev` aparece logo na app; o índice `modelos/index.ts` é gerado sozinho. Na app instalada é preciso voltar a gerar o instalador
- **Texto**: botão "Texto" na barra da timeline (ou tecla `T`) cria um texto de 3 s na cabeça de leitura, numa pista de texto por cima de tudo. Edita-se no painel da direita: texto (várias linhas), fonte IBM Plex (Sans, Serif, Mono, embutidas), peso, tamanho, cor, alinhamento, posição (grelha de 9 posições, sliders ou **arrastar na pré-visualização** com encaixe no centro e nos terços), largura máxima, caixa de fundo (cor e opacidade) e sombra
- **Animações de entrada e saída** (texto, imagens e vídeos): Aparecer, Subir, Descer, Da direita, Da esquerda, Escala, Revelar e, só no texto, Máquina de escrever, Palavra a palavra e Linha a linha (com desfasamento entre partes). Curva IBM Produtiva ou Expressiva e duração com presets IBM. Por defeito o texto entra a subir (Expressiva, 400 ms) e sai a desaparecer (Produtiva, 240 ms)
- Desfazer / refazer (arrastar um clip ou um slider conta como um só passo)
- Projeto: resolução (16:9, 4K, 9:16, 1:1, 4:5, 720p), fps (24, 25, 30, 50, 60 — nunca abaixo de 24, regra IBM), cor de fundo
- Guardar e abrir projetos `.vidcut` (JSON), gravação automática contínua
- Exportar (`Ctrl+E`) com diálogo de opções, barra de progresso e cancelar:
  - Formato: MP4 (H.264), HEVC (H.265, ~40% mais leve, abre no QuickTime), WebM (VP9), ProRes 422 HQ (.mov, para outro editor), GIF, MP3, WAV
  - Resolução: projeto, 4K, 2K, 1080p, 720p, 480p (lado menor; serve para vertical e horizontal)
  - Qualidade Alta/Média/Leve (CRF e bitrate de áudio; no GIF escolhe os fps)
  - Fotogramas: os do projeto ou 24/25/30/50/60
  - O que exportar: tudo, os clips selecionados, ou um intervalo de/até
  - Incluir áudio sim/não; resumo com dimensões, duração e tamanho estimado
  - As últimas opções ficam lembradas

## Requisitos

- Node.js 20 ou superior
- Ligação à internet **só no primeiro export**: o Remotion descarrega um Chrome headless (~100 MB) que usa para renderizar

## Arrancar em desenvolvimento

```
npm install
npm run dev
```

`npm run dev` gera o bundle do Remotion, arranca o Vite e abre a janela do Electron com as ferramentas de programador.

## Criar o instalador

Cada sistema tem de ser empacotado **no próprio sistema** (o Remotion usa binários nativos diferentes por SO):

| Sistema | Comando | Resultado em `release/` |
|---|---|---|
| Windows | `npm run dist:win` | instalador `.exe` (NSIS) |
| macOS | `npm run dist:mac` | `.dmg` |
| Linux | `npm run dist:linux` | `.AppImage` e `.deb` |

### macOS (.dmg)

```
cd ~/Downloads/vidcut
npm run dist:mac
```

- Demora 2–4 minutos; a primeira vez descarrega o Electron para empacotar (~100 MB)
- Resultado: `release/VidCut-<versão>-arm64.dmg` (ou `-x64` num Mac Intel)
- Abrir o .dmg → arrastar o VidCut para Aplicações
- Assinatura ad-hoc (sem certificado Apple): num .dmg feito no próprio Mac abre logo. Se for copiado para outro Mac, a primeira vez abre-se com botão direito → Abrir (ou `xattr -cr /Applications/VidCut.app`)

### Windows (.exe)

```
npm run dist:win
```

- Resultado: `release/VidCut-<versão>-Setup.exe` (instalador em português, escolhe a pasta, cria atalhos no ambiente de trabalho e no menu Iniciar)
- Pode ser gerado num PC Windows ou a partir de Linux com Wine (`wine` + `wine32`); o script instala o compositor do Remotion para Windows
- O ícone e a versão do .exe são aplicados por `scripts/after-pack.cjs` (resedit, sem Wine)
- Sem certificado de assinatura: na primeira vez o Windows mostra "O Windows protegeu o computador" → **Mais informações** → **Executar mesmo assim**
- Dados da app (autosave, Chrome do Remotion, formas de onda): `%APPDATA%\VidCut`

### Linux (.AppImage e .deb)

```
npm run dist:linux
```

- `VidCut-<versão>-x86_64.AppImage`: não instala, corre em qualquer distribuição. `chmod +x VidCut-*.AppImage` e abrir. Se não arrancar (Ubuntu 24+), correr com `--no-sandbox`; se faltar FUSE: `sudo apt install libfuse2t64`
- `VidCut-<versão>-amd64.deb`: Ubuntu/Debian/Mint. `sudo apt install ./VidCut-*-amd64.deb`; fica no menu de aplicações, em `/opt/VidCut`
- Dados da app: `~/.config/VidCut`
- Testado: .deb instalado (importar, exportar GIF e MP3) e AppImage a arrancar

Notas:
- Na app instalada, o Chrome do Remotion fica em `~/Library/Application Support/VidCut/node_modules/.remotion` (descarregado no primeiro export); o autosave e as formas de onda ficam na mesma pasta
- Empacotamento testado em Linux (pasta desempacotada): importar, exportar GIF e MP3 a partir da app instalada

## Atalhos

| Tecla | Ação |
|---|---|
| `Espaço` | Reproduzir / pausa |
| `S` | Dividir na cabeça de leitura (clips selecionados, ou todos os que estão por baixo) |
| `T` | Adicionar texto na cabeça de leitura |
| `Q` | Dividir e eliminar à esquerda da cabeça de leitura |
| `W` | Dividir e eliminar à direita da cabeça de leitura |
| `Delete` / `Backspace` | Apagar seleção |
| `Shift+Delete` | Apagar e fechar o espaço |
| `Cmd+C` / `Cmd+X` / `Cmd+V` | Copiar / cortar / colar clips |
| `Cmd+D` | Duplicar |
| `Cmd+A` | Selecionar tudo |
| `←` / `→` | Frame anterior / seguinte (`Shift`: 1 segundo) |
| `Home` / `End` | Início / fim |
| `+` / `-` / `0` | Zoom da timeline / ajustar ao projeto |
| `Ctrl+Z` / `Ctrl+Shift+Z` (ou `Ctrl+Y`) | Desfazer / refazer |
| `Ctrl+S` / `Ctrl+Shift+S` | Guardar / guardar como |
| `Ctrl+O` / `Ctrl+N` | Abrir / novo projeto |
| `Ctrl+I` / `Ctrl+E` | Importar media / exportar (vídeo, GIF ou áudio) |
| `Shift` ou `Ctrl` + clique | Seleção múltipla |
| Duplo clique na media | Adiciona na cabeça de leitura |
| Botão direito num clip | Dividir (3 tipos), separar/juntar áudio, apagar |
| Pinça no trackpad | Zoom da timeline |

## Estrutura

```
electron/
  main.cjs           janela, menus, diálogos, IPC, gravação automática
  preload.cjs        ponte segura window.vidcut
  media-server.cjs   servidor HTTP local (127.0.0.1) que serve só os ficheiros importados
  render.cjs         export com @remotion/renderer (corre também fora do Electron)
shared/
  types.ts           modelo de dados do projeto
  motion.ts          tokens de animação IBM/Carbon (curvas, durações) + fades
  VidCutComposition.tsx  composição Remotion: a MESMA para pré-visualização e export
  remotion-root.tsx  entrada do bundle de export
src/                 interface React
  App.tsx            estado global, atalhos, ficheiros, export
  state.ts           reducer com histórico (desfazer/refazer)
  ops.ts             operações de edição puras (adicionar, mover, aparar, dividir…)
  playhead.ts        cabeça de leitura (fora do React para não re-renderizar tudo)
  media.ts           leitura de duração/dimensões e miniaturas
  components/        MediaBin, Preview, Inspector, Timeline, ExportOptions, ExportModal, Icon
scripts/
  bundle-remotion.mjs   gera remotion-bundle/ (pré-compilado, usado no export)
  make-test-media.sh    cria ficheiros de teste em test-media/ (precisa de ffmpeg)
  test-render.cjs       export de teste sem Electron
```

## Modelo de dados

O projeto é um único JSON. Todos os tempos estão em **frames** à taxa do projeto (mudar o fps converte tudo).

- `media[]`: ficheiros importados (caminho absoluto, tipo, duração em segundos). Os ficheiros **não são copiados**: se mudares um ficheiro de sítio, o clip aparece como "Ficheiro em falta"
- `tracks[]`: a pista 0 é a de cima. Cada clip tem `start`, `duration`, `trimStart` (corte no início da fonte), `volume`, `fadeIn`, `fadeOut`
- Regra: clips na mesma pista nunca se sobrepõem

## Testes feitos

- `tsc` sem erros e build completo (Vite + bundle Remotion)
- Operações de edição: adicionar, sobreposição, aparar com limites, dividir, mover, apagar, mudar fps, separar e voltar a juntar áudio
- Export com áudio separado: o vídeo fica mudo e o som separado toca na nova posição
- Export real (Node): corte inicial exato ao frame, fades de imagem e áudio, imagem sobreposta, volume a 50 %
- App Electron real (Linux, ecrã virtual): importar 4 ficheiros, adicionar à timeline, exportar MP4 1080p, separar áudio pelo menu de contexto, zoom pela barra de navegação

Para repetir o teste de export: `sh scripts/make-test-media.sh && node scripts/test-render.cjs` (opcional: `'{"codec":"gif","scale":0.5,"everyNthFrame":2}' saida.gif`)
- Export dos 7 formatos verificado com ffprobe (codec, dimensões, fps, duração, etiqueta hvc1 no HEVC)

## Limitações conhecidas

- A pré-visualização usa o leitor de vídeo do Chromium: H.264, VP8/VP9 e AV1 funcionam; HEVC/H.265 e alguns MKV podem não pré-visualizar (o export usa ffmpeg e lida com mais formatos)
- Depois de separar, vídeo e áudio ficam independentes (mover um não move o outro). Se dividires o vídeo depois de separar, só a metade da esquerda volta a juntar o áudio automaticamente
- A app só funciona dentro do Electron (no browser mostra um aviso)

## Licença do Remotion

Grátis para uso individual e empresas até 3 pessoas. Uso pessoal está coberto. Se um dia for usado por uma equipa de 4 ou mais pessoas, é preciso a Company License (remotion.pro).

## Plano

5. ~~Modelos Remotion (aba Modelos, painel automático, pasta modelos/)~~ (feito)
6. ~~Edição rápida: seleção múltipla, copiar/colar/duplicar, ripple, forma de onda~~ (feito)
7. ~~Opções de export: formatos, resolução, qualidade, fps, intervalo~~ (feito)
8. ~~Instaladores: .dmg (macOS), .exe instalador e portátil (Windows), AppImage e .deb (Linux)~~ (feito)

### Backlog

- **Proxies (edição em baixa resolução):** cópias leves (ex. 540p/720p, H.264 com GOP curto) geradas em segundo plano ao importar ou a pedido; a pré-visualização usa o proxy, o export usa sempre o original. Interruptor "Usar proxies" na barra, indicador por ficheiro (a gerar / pronto), cache em userData/proxies e opção para apagar. Útil em computadores lentos e com vídeo 4K/HEVC (que o Chromium nem sempre pré-visualiza)
- **Projetos portáteis (mudar de computador):**
  - Caminhos relativos ao ficheiro do projeto (pasta do projeto + `media/`) — funciona com pen, iCloud, Drive, Dropbox e entre Mac/Windows/Linux
  - Reencontrar ficheiros em falta ao abrir: escolher pasta, procura por nome + tamanho, um encontrado reencontra os restantes
  - "Empacotar projeto": copia projeto + ficheiros usados para uma pasta ou `.vidcutpack` (abre com duplo clique); opção "só proxies" para editar num portátil e exportar onde estão os originais
- **Legendas automáticas (local):** Whisper via whisper.cpp (`@remotion/install-whisper-cpp` + `@remotion/captions`), offline e grátis, modelo descarregado uma vez (base / small (sugerido) / medium). Áudio extraído com o ffmpeg incluído → pista de legendas com tempo por palavra, editável na timeline (juntar/partir, ajustar tempos). Estilos: clássico em baixo e palavra a palavra (TikTok/Reels) com curvas IBM. Importar/exportar .srt; no export queimadas no vídeo ou .srt à parte
- Mais transições: direções, formas, desfocar, flash, glitch
- Formas: retângulos, círculos, linhas e setas, animáveis com keyframes
- **Lottie (animações vetoriais):**
  - Biblioteca na barra lateral (separador "Animações", ao lado de Media e Modelos), por categorias, com pré-visualização ao passar o rato e duplo clique / arrastar para a timeline
  - Pack inicial incluído (~15–20): ícones (✓, ✗, ❤️, estrela, setas), confetes e fogo de artifício, "subscrever"/"gosto"/"partilhar", sublinhados e círculos desenhados à mão, carregamento — criados por nós (sem problemas de licença) com curvas IBM; cores editáveis quando a animação o permitir
  - Importar mais: botão "Adicionar" + arrastar ficheiros `.json` (Lottie JSON) e `.lottie` (dotLottie, comprimido); ficam guardados numa biblioteca do utilizador (pasta de dados da app) e disponíveis em todos os projetos
  - "Obter mais": atalhos que abrem no browser LottieFiles, Lordicon, IconScout, useAnimations (com aviso para confirmar a licença de cada animação)
  - Na timeline comportam-se como clips de vídeo com transparência: posição, tamanho, velocidade, loop, keyframes; render com `@remotion/lottie` (pré-visualização = export)
- Vídeos em lote: um modelo + uma lista → um vídeo por linha
- **Ecrã verde (chroma key):** remover fundo verde/azul de um clip — conta-gotas para a cor, tolerância, suavidade das arestas e remoção do reflexo verde (spill); funciona na pré-visualização e no export
- **Aceleração por hardware no export (Mac):** VideoToolbox para H.264, HEVC e ProRes (opção "Rápido (hardware)" no diálogo de export; usa bitrate em vez de CRF); noutros sistemas fica desligada
- **Marcadores na timeline:** tecla M adiciona um marcador com nome e cor na régua; saltar entre marcadores; o íman encosta clips aos marcadores
- **Pré-visualização em ecrã inteiro:** botão e tecla F para ver o vídeo a tocar em ecrã inteiro, sem a interface (Esc para sair)

### Backlog — mais tarde (não fazer em conjunto com o anterior)

- **Legendas pela nuvem:** opção alternativa à transcrição local (API OpenAI Whisper ou ElevenLabs) — mais rápida/precisa, paga ao minuto, o áudio sai do computador; chave de API nas definições
- **Tradução de legendas:** gerar a versão noutra língua (ex. API do Claude)


1. ~~Base: importar, timeline multi-pista, mover/aparar/dividir, íman, zoom, desfazer, exportar~~ (feito, com fades e volume adiantados)
2. ~~Transições entre clips e pegas de fade arrastáveis~~ (feito)
3. ~~Texto, animações de entrada/saída e keyframes~~ (feito). Falta: formas
4. ~~Efeitos: enquadramento, velocidade, cor, desfocar, vinheta~~ (feito)
