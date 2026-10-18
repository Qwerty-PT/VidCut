#!/usr/bin/env python3
"""Gera o pack de animações Lottie incluído no VidCut (pasta lotties/).

Animações originais (sem licenças de terceiros), com as curvas IBM:
  expressive entrance (0,0,.3,1) · expressive standard (.4,.14,.3,1) · expressive exit (.4,.14,1,1)
Uso: python3 scripts/gen-lotties.py
"""
import json, math, os, random

OUT = os.path.join(os.path.dirname(__file__), '..', 'lotties')
FR = 30

ENT = (0, 0, 0.3, 1)
STD = (0.4, 0.14, 0.3, 1)
EXIT = (0.4, 0.14, 1, 1)
LIN = (0, 0, 1, 1)


def hexc(h, a=1):
    h = h.lstrip('#')
    return [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)] + [a]


AMBER, WHITE, GREEN, RED, BLUE, PINK, YELLOW, PURPLE, TEAL, GREY = (
    '#F2B33D', '#FFFFFF', '#24A148', '#DA1E28', '#4589FF', '#FA4D56', '#F1C21B', '#A56EFF', '#08BDBA', '#525866')


# ---------- propriedades ----------
def K(v):
    return {'a': 0, 'k': v}


def A(*kfs):
    """kfs: (t, valor, curva) — a curva é a do segmento que começa nesse keyframe; o último pode omitir."""
    out = []
    for i, kf in enumerate(kfs):
        t, v = kf[0], kf[1]
        v = v if isinstance(v, list) else [v]
        k = {'t': t, 's': v}
        if i < len(kfs) - 1:
            e = kf[2] if len(kf) > 2 else STD
            n = len(v)
            k['o'] = {'x': [e[0]] * n, 'y': [e[1]] * n}
            k['i'] = {'x': [e[2]] * n, 'y': [e[3]] * n}
        out.append(k)
    return {'a': 1, 'k': out}


def tr(p=(0, 0), a=(0, 0), s=(100, 100), r=0, o=100):
    w = lambda x: x if isinstance(x, dict) else K(list(x) if isinstance(x, (tuple, list)) else x)
    return {'ty': 'tr', 'p': w(p), 'a': w(a), 's': w(s), 'r': w(r), 'o': w(o), 'sk': K(0), 'sa': K(0), 'nm': 'Transformar'}


# ---------- formas ----------
def path(v, closed=False, i=None, o=None):
    n = len(v)
    return {'ty': 'sh', 'ks': K({'v': [list(p) for p in v], 'i': [list(p) for p in (i or [(0, 0)] * n)],
                                  'o': [list(p) for p in (o or [(0, 0)] * n)], 'c': closed}), 'nm': 'Caminho'}


def ellipse(size, pos=(0, 0)):
    return {'ty': 'el', 'p': K(list(pos)), 's': size if isinstance(size, dict) else K(list(size)), 'nm': 'Elipse'}


def rect(size, pos=(0, 0), r=0):
    return {'ty': 'rc', 'p': K(list(pos)), 's': size if isinstance(size, dict) else K(list(size)), 'r': K(r), 'nm': 'Retângulo'}


def star(pts, outer, inner, pos=(0, 0), round_=0):
    return {'ty': 'sr', 'sy': 1, 'd': 1, 'pt': K(pts), 'p': K(list(pos)), 'r': K(0), 'ir': K(inner), 'is': K(round_),
            'or': K(outer), 'os': K(round_), 'nm': 'Estrela'}


def stroke(color, width, opacity=100, cap=2):
    return {'ty': 'st', 'c': K(hexc(color)), 'o': K(opacity) if not isinstance(opacity, dict) else opacity,
            'w': K(width) if not isinstance(width, dict) else width, 'lc': cap, 'lj': 2, 'ml': 4, 'nm': 'Traço'}


def fill(color, opacity=100):
    return {'ty': 'fl', 'c': K(hexc(color)), 'o': K(opacity) if not isinstance(opacity, dict) else opacity, 'r': 1, 'nm': 'Preenchimento'}


def trim(s=0, e=100, o=0):
    w = lambda x: x if isinstance(x, dict) else K(x)
    return {'ty': 'tm', 's': w(s), 'e': w(e), 'o': w(o), 'm': 1, 'nm': 'Aparar'}


def group(items, t=None, nm='Grupo'):
    return {'ty': 'gr', 'it': items + [t or tr()], 'nm': nm}


def layer(nm, shapes, op, p=(256, 256), s=(100, 100), r=0, o=100, a=(0, 0), ind=1):
    w = lambda x, z=None: x if isinstance(x, dict) else K(list(x) + ([z] if z is not None else []) if isinstance(x, (tuple, list)) else x)
    return {'ddd': 0, 'ind': ind, 'ty': 4, 'nm': nm, 'sr': 1,
            'ks': {'o': w(o), 'r': w(r), 'p': w(p, 0), 'a': w(a, 0), 's': w(s, 100)},
            'ao': 0, 'shapes': shapes, 'ip': 0, 'op': op, 'st': 0, 'bm': 0}


def anim(name, op, layers, w=512, h=512):
    for i, l in enumerate(layers):
        l['ind'] = i + 1
    return {'v': '5.7.4', 'fr': FR, 'ip': 0, 'op': op, 'w': w, 'h': h, 'nm': name, 'ddd': 0, 'assets': [], 'layers': layers}


def pop(t0, dur=14, to=100):
    """Escala 0 → 100 com a curva de entrada expressiva (sem ressalto — regra IBM)"""
    return A((t0, [0, 0], ENT), (t0 + dur, [to, to]))


# ---------- animações ----------
def visto():
    op = 60
    ring = group([ellipse((220, 220)), stroke(GREEN, 6, A((8, 80, EXIT), (30, 0)))],
                 tr(s=A((8, [90, 90], ENT), (30, [150, 150]))), 'Onda')
    disc = group([ellipse((200, 200)), fill(GREEN)], tr(s=pop(0, 14)), 'Disco')
    check = group([path([(-48, 4), (-14, 38), (52, -32)]), trim(0, A((12, 0, ENT), (28, 100))), stroke(WHITE, 22)], nm='Visto')
    return anim('Visto', op, [layer('Visto', [check], op), layer('Disco', [disc], op), layer('Onda', [ring], op)])


def erro():
    op = 60
    ring = group([ellipse((220, 220)), stroke(RED, 6, A((8, 80, EXIT), (30, 0)))],
                 tr(s=A((8, [90, 90], ENT), (30, [150, 150]))), 'Onda')
    disc = group([ellipse((200, 200)), fill(RED)], tr(s=pop(0, 14)), 'Disco')
    l1 = group([path([(-38, -38), (38, 38)]), trim(0, A((12, 0, ENT), (22, 100))), stroke(WHITE, 22)], nm='Traço 1')
    l2 = group([path([(38, -38), (-38, 38)]), trim(0, A((18, 0, ENT), (28, 100))), stroke(WHITE, 22)], nm='Traço 2')
    return anim('Erro', op, [layer('X', [l1, l2], op), layer('Disco', [disc], op), layer('Onda', [ring], op)])


HEART_V = [(0, 70), (-110, -40), (-40, -100), (0, -70), (40, -100), (110, -40)]
HEART_I = [(60, -40), (0, 40), (-30, 0), (-5, -20), (-20, 0), (0, -40)]
HEART_O = [(-60, -40), (0, -40), (20, 0), (5, -20), (30, 0), (0, 40)]


def coracao():
    op = 60
    heart = group([path(HEART_V, True, HEART_I, HEART_O), fill(PINK)],
                  tr(p=(0, 10), s=A((0, [0, 0], ENT), (14, [100, 100], STD), (32, [100, 100], STD), (40, [110, 110], STD), (50, [100, 100]))), 'Coração')
    parts = []
    for k in range(8):
        ang = math.radians(k * 45 + 22.5)
        x, y = math.cos(ang) * 150, math.sin(ang) * 150
        parts.append(group([ellipse((16, 16)), fill(PINK if k % 2 else AMBER)],
                           tr(p=A((6, [0, 0], ENT), (26, [x, y])), o=A((6, 100, EXIT), (28, 0)),
                              s=A((6, [60, 60], ENT), (26, [100, 100]))), f'Partícula {k}'))
    return anim('Coração', op, [layer('Coração', [heart], op), layer('Partículas', parts, op)])


def estrela():
    op = 60
    st = group([star(5, 120, 52, round_=8), fill(AMBER)],
               tr(p=(0, 8), s=pop(0, 16), r=A((0, -40, ENT), (16, 0))), 'Estrela')
    sp = []
    for k, (x, y, t) in enumerate([(150, -120, 14), (-160, -60, 18), (130, 120, 22), (-120, 140, 26)]):
        sp.append(group([star(4, 22, 6), fill(WHITE)],
                        tr(p=(x, y), s=A((t, [0, 0], ENT), (t + 8, [100, 100], EXIT), (t + 20, [0, 0])),
                           r=A((t, 0, LIN), (t + 20, 90))), f'Brilho {k}'))
    return anim('Estrela', op, [layer('Estrela', [st], op), layer('Brilhos', sp, op)])


def seta(rot, name):
    op = 60
    ar = group([path([(0, -80), (0, 60)]), path([(-48, 12), (0, 60), (48, 12)]), stroke(WHITE, 24)], nm='Seta')
    dx, dy = (0, 26) if rot == 0 else (26, 0)
    lay = layer(name, [ar], op, r=rot,
                p=A((0, [256 - dx, 256 - dy, 0], STD), (30, [256 + dx, 256 + dy, 0], STD), (60, [256 - dx, 256 - dy, 0])))
    return anim(name, op, [lay])


def seta_baixo():
    return seta(0, 'Seta para baixo')


def seta_direita():
    return seta(-90, 'Seta para a direita')


def confetes():
    op = 75
    rnd = random.Random(7)
    cols = [AMBER, PINK, BLUE, GREEN, PURPLE, TEAL, WHITE]
    items = []
    for k in range(36):
        ang = math.radians(rnd.uniform(-160, -20))
        dist = rnd.uniform(120, 230)
        x, y = math.cos(ang) * dist, math.sin(ang) * dist
        fall = rnd.uniform(220, 340)
        drift = rnd.uniform(-40, 40)
        w_, h_ = rnd.choice([(18, 10), (14, 14), (22, 8)])
        t0 = rnd.randint(0, 4)
        spin = rnd.choice([-1, 1]) * rnd.uniform(360, 900)
        items.append(group([rect((w_, h_), r=2), fill(rnd.choice(cols))],
                           tr(p=A((t0, [0, 60], ENT), (t0 + 16, [x, y + 60], EXIT), (op, [x + drift, y + 60 + fall])),
                              r=A((t0, 0, LIN), (op, spin)), o=A((t0, 0, LIN), (t0 + 2, 100, LIN), (op - 14, 100, EXIT), (op, 0))),
                           f'Confete {k}'))
    return anim('Confetes', op, [layer('Confetes', items, op, p=(256, 300))])


def fogo():
    op = 90
    bursts = [((-90, -60), 0, AMBER), ((110, -110), 16, PINK), ((20, 60), 32, BLUE)]
    layers = []
    for b, ((cx, cy), t, col) in enumerate(bursts):
        rays = []
        for k in range(12):
            ang = math.radians(k * 30)
            x1, y1, x2, y2 = math.cos(ang) * 18, math.sin(ang) * 18, math.cos(ang) * 120, math.sin(ang) * 120
            rays.append(group([path([(x1, y1), (x2, y2)]), trim(A((t + 8, 0, EXIT), (t + 24, 100)), A((t, 0, ENT), (t + 14, 100))),
                               stroke(col, 8)], nm=f'Raio {k}'))
        flash = group([ellipse((60, 60)), fill(WHITE)], tr(s=A((t, [0, 0], ENT), (t + 6, [100, 100], EXIT), (t + 14, [0, 0]))), 'Clarão')
        layers.append(layer(f'Explosão {b + 1}', rays + [flash], op, p=(256 + cx, 256 + cy)))
    return anim('Fogo de artifício', op, layers)


BELL_V = [(-85, 50), (-60, -25), (0, -85), (60, -25), (85, 50)]
BELL_I = [(0, 0), (0, 40), (-35, 0), (0, -35), (-15, -15)]
BELL_O = [(15, -15), (0, -35), (35, 0), (0, 40), (0, 0)]


def sino():
    op = 60
    swing = A((0, 0, STD), (8, -16, STD), (16, 12, STD), (24, -7, STD), (32, 4, STD), (40, 0))
    bell = group([path(BELL_V, True, BELL_I, BELL_O), fill(AMBER)], nm='Corpo')
    knob = group([ellipse((26, 26), (0, -96)), fill(AMBER)], nm='Argola')
    clap = group([ellipse((42, 42), (0, 70)), fill(AMBER)], nm='Badalo')
    body = group([bell, knob, clap], tr(p=(0, -96), a=(0, -96), r=swing), 'Sino')
    badge = group([ellipse((54, 54)), fill(RED)], tr(p=(70, -70), s=pop(18, 10)), 'Aviso')
    return anim('Sino', op, [layer('Aviso', [badge], op, p=(256, 270)), layer('Sino', [body], op, p=(256, 270))])


def partilhar():
    op = 60
    nodes = [(-80, 0), (80, -80), (80, 80)]
    circ = [group([ellipse((70, 70)), fill(BLUE)], tr(p=n, s=pop(t, 12)), f'Nó {k}') for k, (n, t) in enumerate(zip(nodes, [0, 8, 14]))]
    lines = [group([path([nodes[0], nodes[i]]), trim(0, A((10 + 4 * i, 0, ENT), (24 + 4 * i, 100))), stroke(BLUE, 14)], nm=f'Ligação {i}')
             for i in (1, 2)]
    return anim('Partilhar', op, [layer('Nós', circ, op), layer('Ligações', lines, op)])


def sublinhado():
    op = 45
    v = [(-260, 10), (-120, -4), (20, 8), (160, -6), (260, 4)]
    i = [(0, 0), (-50, 6), (-50, -6), (-50, 6), (-40, -4)]
    o = [(50, -6), (50, -6), (50, 6), (50, -6), (0, 0)]
    g = group([path(v, False, i, o), trim(0, A((0, 0, STD), (20, 100))), stroke(AMBER, 16)], nm='Sublinhado')
    return anim('Sublinhado', op, [layer('Sublinhado', [g], op, p=(300, 80))], 600, 160)


def circulo_mao():
    op = 45
    rx, ry = 240, 120
    pts = [(-rx, 0), (0, -ry), (rx, 0), (0, ry), (-rx + 6, -10), (-rx * 0.6, -ry * 0.82)]
    k = 0.55
    i = [(0, ry * k), (-rx * k, 0), (0, -ry * k), (rx * k, 0), (0, ry * k * 0.9), (-rx * 0.3, ry * 0.3)]
    o = [(0, -ry * k), (rx * k, 0), (0, ry * k), (-rx * k, 0), (0, -ry * k * 0.5), (0, 0)]
    g = group([path(pts, False, i, o), trim(0, A((0, 0, STD), (26, 100))), stroke(AMBER, 12)], tr(r=-4), 'Círculo')
    return anim('Círculo à mão', op, [layer('Círculo', [g], op, p=(300, 170))], 600, 340)


def seta_desenhada():
    op = 50
    shaft = group([path([(-180, 120), (140, -90)], False, [(0, 0), (-60, 120)], [(150, -20), (0, 0)]),
                   trim(0, A((0, 0, STD), (22, 100))), stroke(WHITE, 14)], nm='Haste')
    head = group([path([(70, -100), (140, -90), (128, -20)]), trim(0, A((20, 0, ENT), (32, 100))), stroke(WHITE, 14)], nm='Ponta')
    return anim('Seta desenhada', op, [layer('Seta', [shaft, head], op)])


def marcador():
    op = 40
    g = group([path([(-260, 0), (260, 0)]), trim(0, A((0, 0, STD), (16, 100))), stroke(YELLOW, 64, 55, cap=1)], tr(r=-1.5), 'Marcador')
    return anim('Marcador', op, [layer('Marcador', [g], op, p=(300, 60))], 600, 120)


def carregamento():
    op = 60
    track = group([ellipse((180, 180)), stroke(GREY, 16)], nm='Fundo')
    arc = group([ellipse((180, 180)), trim(0, A((0, 12, STD), (30, 70, STD), (60, 12))), stroke(AMBER, 16)],
                tr(r=A((0, 0, LIN), (60, 360))), 'Arco')
    return anim('Carregamento', op, [layer('Arco', [arc], op), layer('Fundo', [track], op)])


def pontos():
    op = 60
    dots = []
    for k in range(3):
        t = k * 8
        dots.append(group([ellipse((44, 44)), fill(WHITE)],
                          tr(p=((k - 1) * 80, 0), s=A((0, [60, 60], LIN), (t, [60, 60], STD), (t + 12, [100, 100], STD), (t + 24, [60, 60], LIN), (op, [60, 60])),
                             o=A((0, 40, LIN), (t, 40, STD), (t + 12, 100, STD), (t + 24, 40, LIN), (op, 40))), f'Ponto {k}'))
    return anim('Pontos', op, [layer('Pontos', dots, op)])


def progresso():
    op = 60
    track = group([rect((420, 28), r=14), fill(GREY)], nm='Fundo')
    bar = group([rect((420, 28), (210, 0), r=14), fill(AMBER)], tr(p=(-210, 0), a=(0, 0), s=A((4, [0, 100], STD), (50, [100, 100]))), 'Barra')
    return anim('Barra de progresso', op, [layer('Barra', [bar], op, p=(256, 60)), layer('Fundo', [track], op, p=(256, 60))], 512, 120)


def clique():
    op = 60
    cur = group([path([(0, 0), (0, 64), (16, 50), (27, 74), (38, 69), (28, 46), (48, 46)], True), fill(WHITE), stroke('#111111', 4)],
                tr(p=A((0, [90, 90], STD), (16, [0, 0], STD)), s=A((18, [100, 100], STD), (22, [88, 88], STD), (27, [100, 100]))), 'Cursor')
    rings = [group([ellipse((140, 140)), stroke(AMBER, 6, A((20 + d, 100, EXIT), (44 + d, 0)))],
                   tr(s=A((20 + d, [10, 10], ENT), (44 + d, [100, 100]))), f'Onda {d}') for d in (0, 8)]
    return anim('Clique', op, [layer('Cursor', [cur], op, p=(250, 250)), layer('Ondas', rings, op, p=(250, 250))])


PACK = [
    ('visto', 'Visto', 'Ícones', visto), ('erro', 'Erro', 'Ícones', erro), ('coracao', 'Coração', 'Ícones', coracao),
    ('estrela', 'Estrela', 'Ícones', estrela), ('seta-baixo', 'Seta para baixo', 'Ícones', seta_baixo),
    ('seta-direita', 'Seta para a direita', 'Ícones', seta_direita),
    ('confetes', 'Confetes', 'Celebração', confetes), ('fogo-artificio', 'Fogo de artifício', 'Celebração', fogo),
    ('sino', 'Sino de aviso', 'Social', sino), ('partilhar', 'Partilhar', 'Social', partilhar),
    ('sublinhado', 'Sublinhado', 'Desenhado à mão', sublinhado), ('circulo-mao', 'Círculo à mão', 'Desenhado à mão', circulo_mao),
    ('seta-desenhada', 'Seta desenhada', 'Desenhado à mão', seta_desenhada), ('marcador', 'Marcador', 'Desenhado à mão', marcador),
    ('carregamento', 'Carregamento', 'Interface', carregamento), ('pontos', 'Três pontos', 'Interface', pontos),
    ('progresso', 'Barra de progresso', 'Interface', progresso), ('clique', 'Clique', 'Interface', clique),
]

# fotograma da miniatura (fração da duração) quando o fim da animação fica vazio
THUMB = {'fogo-artificio': 0.42, 'confetes': 0.3, 'clique': 0.4, 'pontos': 0.25}

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    index = []
    for pid, name, cat, fn in PACK:
        data = fn()
        with open(os.path.join(OUT, f'{pid}.json'), 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, separators=(',', ':'))
        item = {'id': pid, 'name': name, 'category': cat, 'file': f'{pid}.json'}
        if pid in THUMB:
            item['thumb'] = THUMB[pid]
        index.append(item)
    with open(os.path.join(OUT, 'index.json'), 'w', encoding='utf-8') as f:
        json.dump(index, f, ensure_ascii=False, indent=1)
    print(f'{len(index)} animações em lotties/')
