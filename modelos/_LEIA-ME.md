# Modelos do VidCut

Cada ficheiro `.tsx` desta pasta é um modelo programático (componente Remotion) que aparece na aba **Modelos** da app.
Ficheiros começados por `_` são ignorados. O índice (`index.ts`) é gerado sozinho — não o edites.

Vários modelos foram adaptados dos templates gratuitos de https://github.com/reactvideoeditor/remotion-templates
(licença MIT, © React Video Editor), reescritos com parâmetros editáveis, tamanhos relativos ao quadro e curvas IBM.

## Criar um modelo

```tsx
import { defineTemplate, useTemplate, fill } from '../shared/template-api';
import { FONT_FAMILY } from '../shared/fonts';

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
        <div style={{ opacity: a, transform: `translateY(${(1 - a) * 40 * k}px)`, color: p.cor, fontFamily: FONT_FAMILY.sans, fontSize: 120 * k, fontWeight: 700 }}>
          {p.titulo}
        </div>
      </div>
    );
  },
});
```

Tipos de campo: `text`, `textarea`, `color`, `number` (min/max), `select` (options), `boolean`, `image` (escolhe uma imagem do projeto).
