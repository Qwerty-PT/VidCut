# VidCut

Editor de vídeo e áudio para uso pessoal, ao estilo CapCut, feito com **Electron + React + Remotion**. Corre em Windows, macOS e Linux.

Estado: **fase 1 concluída** (base do editor). Ver o plano no fim.

## O que já faz

- Importar vídeo (MP4, MOV, WebM, MKV), áudio (MP3, WAV, M4A, AAC, OGG, FLAC) e imagens (PNG, JPG, WebP, GIF), pelo botão ou a arrastar ficheiros do sistema
- Timeline multi-pista (vídeo e áudio), pistas de vídeo de cima ficam por cima da imagem
- Mover clips (também entre pistas do mesmo tipo), aparar pelas pontas, dividir, apagar
- Três tipos de divisão, como no CapCut: dividir (`S`), dividir e eliminar à esquerda (`Q`) e dividir e eliminar à direita (`W`). Nos dois últimos, o espaço que fica é fechado (os clips seguintes da mesma pista encostam)
- Íman: encaixa nas pontas de outros clips e na cabeça de leitura
- Magnet ao largar media: o clip cola-se ao fim do clip anterior nessa pista (ou ao início, se a pista estiver vazia). Com o íman desligado, fica onde o largaste
- Zoom da timeline até ao frame (cerca de 0,3 s visíveis; a régua passa a mostrar frames): arrastar as pontas da barra de navegação (por baixo das pistas), pinça no trackpad, `Ctrl`/`Cmd` + roda, slider, `+` / `-` / `0`
- Barra de navegação: arrastar o meio para andar na timeline, clicar fora para saltar
- **Separar áudio** de um clip de vídeo (botão direito no clip, ou no painel da direita): o som passa para uma pista de áudio, alinhado ao frame, e pode ser movido, cortado e ter volume e fades próprios. "Voltar a juntar o áudio" desfaz a separação
- Fade in / fade out por clip: no vídeo afeta imagem e som, no áudio afeta o volume
- Volume por clip (0–200 %), silenciar e esconder pistas
- Desfazer / refazer (arrastar um clip ou um slider conta como um só passo)
- Projeto: resolução (16:9, 4K, 9:16, 1:1, 4:5, 720p), fps (24, 25, 30, 50, 60 — nunca abaixo de 24, regra IBM), cor de fundo
- Guardar e abrir projetos `.vidcut` (JSON), gravação automática contínua
- Exportar MP4 (H.264 + AAC) com barra de progresso e cancelar

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

Notas:
- No macOS a app não vai assinada: na primeira vez, abrir com botão direito → Abrir
- Na app instalada, o Chrome do Remotion fica na pasta de dados do utilizador (não na pasta da app)
- O empacotamento ainda não foi testado nos três sistemas; o export foi testado em Linux (ver Testes)

## Atalhos

| Tecla | Ação |
|---|---|
| `Espaço` | Reproduzir / pausa |
| `S` | Dividir na cabeça de leitura (clips selecionados, ou todos os que estão por baixo) |
| `Q` | Dividir e eliminar à esquerda da cabeça de leitura |
| `W` | Dividir e eliminar à direita da cabeça de leitura |
| `Delete` / `Backspace` | Apagar seleção |
| `←` / `→` | Frame anterior / seguinte (`Shift`: 1 segundo) |
| `Home` / `End` | Início / fim |
| `+` / `-` / `0` | Zoom da timeline / ajustar ao projeto |
| `Ctrl+Z` / `Ctrl+Shift+Z` (ou `Ctrl+Y`) | Desfazer / refazer |
| `Ctrl+S` / `Ctrl+Shift+S` | Guardar / guardar como |
| `Ctrl+O` / `Ctrl+N` | Abrir / novo projeto |
| `Ctrl+I` / `Ctrl+E` | Importar media / exportar vídeo |
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
  components/        MediaBin, Preview, Inspector, Timeline, ExportModal, Icon
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

Para repetir o teste de export: `sh scripts/make-test-media.sh && node scripts/test-render.cjs`

## Limitações conhecidas

- A pré-visualização usa o leitor de vídeo do Chromium: H.264, VP8/VP9 e AV1 funcionam; HEVC/H.265 e alguns MKV podem não pré-visualizar (o export usa ffmpeg e lida com mais formatos)
- Sem forma de onda real nos clips de áudio (é um padrão gráfico)
- Seleção múltipla só serve para apagar/dividir; mover arrasta um clip de cada vez
- Depois de separar, vídeo e áudio ficam independentes (mover um não move o outro). Se dividires o vídeo depois de separar, só a metade da esquerda volta a juntar o áudio automaticamente
- A app só funciona dentro do Electron (no browser mostra um aviso)

## Licença do Remotion

Grátis para uso individual e empresas até 3 pessoas. Uso pessoal está coberto. Se um dia for usado por uma equipa de 4 ou mais pessoas, é preciso a Company License (remotion.pro).

## Plano

1. ~~Base: importar, timeline multi-pista, mover/aparar/dividir, íman, zoom, desfazer, exportar~~ (feito, com fades e volume adiantados)
2. **Transições** entre clips (`@remotion/transitions`: fade, slide, wipe…) e pegas de fade arrastáveis no próprio clip
3. **Texto e animações**: pista de texto/formas, presets IBM (productive/expressive) já definidos em `shared/motion.ts`, keyframes, stagger automático
4. **Efeitos**: velocidade, cor/brilho, blur, crop/zoom, presets guardáveis
