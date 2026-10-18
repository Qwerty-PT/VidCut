# Modelos do VidCut

Cada ficheiro `.tsx` desta pasta é um modelo programático (componente Remotion) que aparece na aba **Modelos** da app.
Ficheiros começados por `_` são ignorados. O índice (`index.ts`) é gerado sozinho — não o edites.

Vários modelos foram adaptados dos templates gratuitos de https://github.com/reactvideoeditor/remotion-templates
(licença MIT, © React Video Editor), reescritos com parâmetros editáveis, tamanhos relativos ao quadro e curvas IBM.

## Criar um modelo

```tsx
import { defineTemplate, useTemplate, fill, fontOf } from '../shared/template-api';

export default defineTemplate({
  id: 'o-meu-titulo',            // único
  name: 'O meu título',
  category: 'Títulos',
  durationSec: 4,
  opaque: false,                 // false = transparente (fica por cima do vídeo)
  fields: [
    { key: 'titulo', label: 'Título', type: 'text', default: 'Olá!' },
    { key: 'cor', label: 'Cor', type: 'color', default: '#ffffff' },
  ],
  component: ({ p }) => {
    const { k, prog, outro } = useTemplate();   // k = escala para 1080p; prog/outro = curvas IBM
    const a = prog(0, 12) * outro(8);
    return (
      <div style={{ ...fill, display: 'grid', placeItems: 'center' }}>
        <div style={{ opacity: a, transform: `translateY(${(1 - a) * 40 * k}px)`, color: p.cor, fontFamily: fontOf(p, 'sans'), fontSize: 120 * k, fontWeight: 700 }}>
          {p.titulo}
        </div>
      </div>
    );
  },
});
```

Tipos de campo: `text`, `textarea`, `color`, `number` (min/max), `select` (options), `boolean`, `image` (escolhe uma imagem do projeto).

Categorias: `Títulos`, `Oráculos`, `Redes sociais`, `Dispositivos`, `Logótipo`, `Contagens`, `Dados`, `Listas`, `Apresentação`, `Fundos`, `Final`.

## Temas

A galeria e o separador **Modelo** têm chips de tema (Escuro, Claro, Vivo, Elegante, Néon, Suave). Um tema troca as cores e a letra de todos os campos de cor, pelo **nome do campo**:

| Campo | Papel |
|---|---|
| `fundo` | fundo |
| `cor`, `texto` | texto |
| `destaque` | destaque |
| `barra`, `secundaria` | secundária |
| `c1`, `c2`, `c3` | gradiente |
| `cor1`, `cor2` | destaque + secundária |
| `caixa` | caixa |

- Para mapear de outra forma: `themeRoles: { cor: 'accent' }` no `defineTemplate`.
- Usa sempre `fontOf(p, 'sans' | 'serif')` em vez de `FONT_FAMILY` para o modelo seguir a letra do tema (Elegante = serifada, Néon = mono com brilho).
- Modelos transparentes sem campo `fundo` (oráculos, lembretes) ficam com texto claro em todos os temas, para se lerem por cima do vídeo.
- Ficheiros `_*.tsx` servem para partilhar código entre modelos (ex.: `_dispositivo.tsx` para Telemóvel, Portátil e Browser).
