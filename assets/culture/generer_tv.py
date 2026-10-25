"""
Les schémas de la rubrique « culture de marché », version graphique TradingView (25/10/2026).

    python3 assets/culture/generer_tv.py [dossier_sortie] [slug ...]

POURQUOI CETTE REFONTE. Les vingt schémas d'origine (generer.mjs) étaient des lignes
brisées sans bougies, sans échelle ni repère nommé : trop sommaires pour enseigner quoi
que ce soit (Nadir et Manu, 25/10). Ceux-ci reprennent l'aspect des exercices de la
formation, qui imitent TradingView : fond blanc, grille légère, bougies vertes et
rouges, échelle de prix à droite, indicateurs calculés SUR les bougies dessinées (une
moyenne mobile qui ne serait pas celle des bougies serait fausse à l'œil d'un trader),
et des étiquettes courtes qui nomment ce qu'il faut voir.

RÈGLES DE SÉRIE
  1. Toile 600 × 300, rendue au double (1200 × 600). Échelle de prix à droite, 62 px.
  2. Couleurs de TradingView (thème clair) : hausse #089981, baisse #f23645, grille
     #eef1f6, texte d'échelle #6a6d78. Accent or #ac862b pour les repères pédagogiques.
  3. Les bougies viennent d'un CHEMIN de points clés, avec un bruit à graine fixe :
     une même graine redonne exactement le même schéma.
  4. Une étiquette = deux à cinq mots. Le texte explicatif reste dans le brief.
  5. Rien ne touche le bord ; aucune étiquette ne recouvre une autre (contrôlé à l'œil
     sur la planche, notion par notion).

Pourquoi Python et cairo : le générateur d'origine rend par resvg, dont le binaire
n'existe ici que pour macOS. cairo dessine directement, sans SVG intermédiaire.
"""
import math, os, sys, random
import cairo

W, H = 600, 300
ECHELLE = 2
AXE = 62                      # largeur de l'échelle de prix, à droite
G, HAUT, BAS = 10, 30, 22     # marges gauche, haut (légende), bas
FOND = (1, 1, 1)
GRILLE = (0.933, 0.945, 0.965)
TEXTE_AXE = (0.416, 0.427, 0.471)
TEXTE = (0.118, 0.133, 0.176)
HAUSSE = (0.031, 0.6, 0.506)
BAISSE = (0.949, 0.212, 0.271)
OR = (0.675, 0.525, 0.169)
NOIR = (0.12, 0.12, 0.14)
ORANGE = (1.0, 0.596, 0.0)
BLEU = (0.161, 0.384, 1.0)
POLICE = 'Inter'


def hexa(c, a=1):
    return (*c, a)


# ── Les bougies ─────────────────────────────────────────────────────────────────
def bougies(chemin, n, graine=1, bruit=1.0, meche=1.0, tick=0.25):
    """`chemin` : liste de (indice, prix). Clôture interpolée + bruit, ouverture = clôture précédente."""
    rnd = random.Random(graine)
    def prix(i):
        for (i0, p0), (i1, p1) in zip(chemin, chemin[1:]):
            if i0 <= i <= i1:
                t = 0 if i1 == i0 else (i - i0) / (i1 - i0)
                return p0 + (p1 - p0) * t
        return chemin[-1][1]
    r = lambda v: round(v / tick) * tick
    out, prev = [], r(prix(0))
    for i in range(n):
        base = prix(i)
        c = r(base + (rnd.random() - 0.5) * 2.2 * bruit)
        o = prev if i else r(base + (rnd.random() - 0.5) * bruit)
        h = r(max(o, c) + rnd.random() * 1.8 * meche)
        l = r(min(o, c) - rnd.random() * 1.8 * meche)
        out.append({'o': o, 'h': h, 'l': l, 'c': c})
        prev = c
    return out


def poser(B, i, o, h, l, c):
    """Une bougie clé posée à la main ; la suivante ouvre sur sa clôture."""
    B[i] = {'o': o, 'h': max(h, o, c), 'l': min(l, o, c), 'c': c}
    if i + 1 < len(B):
        B[i + 1]['o'] = c
        B[i + 1]['h'] = max(B[i + 1]['h'], c); B[i + 1]['l'] = min(B[i + 1]['l'], c)


# ── Les indicateurs, calculés sur les bougies ─────────────────────────────────────
def mm(B, p):
    return [sum(b['c'] for b in B[max(0, i - p + 1):i + 1]) / len(B[max(0, i - p + 1):i + 1]) for i in range(len(B))]

def mme(v, p):
    k, out = 2 / (p + 1), []
    for i, x in enumerate(v):
        out.append(x if i == 0 else x * k + out[-1] * (1 - k))
    return out

def bollinger(B, p=20, k=2):
    m = mm(B, p); out = []
    for i in range(len(B)):
        d = [b['c'] for b in B[max(0, i - p + 1):i + 1]]
        e = math.sqrt(sum((x - m[i]) ** 2 for x in d) / len(d))
        out.append((m[i] + k * e, m[i], m[i] - k * e))
    return out

def rsi(B, p=14):
    out, g, l = [], 1.0, 1.0
    for i in range(len(B)):
        if i == 0:
            out.append(50); continue
        d = B[i]['c'] - B[i - 1]['c']
        g = (g * (p - 1) + max(d, 0)) / p; l = (l * (p - 1) + max(-d, 0)) / p
        out.append(100 if l == 0 else 100 - 100 / (1 + g / l))
    return out

def macd(B, r=12, l=26, s=9):
    c = [b['c'] for b in B]
    m = [a - b for a, b in zip(mme(c, r), mme(c, l))]
    sig = mme(m, s)
    return m, sig, [a - b for a, b in zip(m, sig)]

def vwap(B, graine=7):
    rnd = random.Random(graine); pv = vv = 0; out = []
    for b in B:
        t = (b['h'] + b['l'] + b['c']) / 3
        v = 60 + rnd.random() * 60 + abs(b['c'] - b['o']) * 30
        pv += t * v; vv += v; out.append(pv / vv)
    return out

def atr(B, p=14):
    out = []
    for i, b in enumerate(B):
        tr = b['h'] - b['l'] if i == 0 else max(b['h'] - b['l'], abs(b['h'] - B[i - 1]['c']), abs(b['l'] - B[i - 1]['c']))
        out.append(tr if i == 0 else (out[-1] * (p - 1) + tr) / p)
    return out


# ── Le dessin ───────────────────────────────────────────────────────────────────
class Graphe:
    def __init__(self, B, legende, bas=None, hauteur_bas=82, marge_prix=0.10, prix_min=None, prix_max=None):
        self.B, self.legende, self.bas = B, legende, bas
        self.surface = cairo.ImageSurface(cairo.FORMAT_RGB24, W * ECHELLE, H * ECHELLE)
        ctx = self.ctx = cairo.Context(self.surface)
        ctx.scale(ECHELLE, ECHELLE)
        ctx.set_source_rgb(*FOND); ctx.paint()
        self.x0, self.x1 = G, W - AXE
        self.y0 = HAUT
        self.y1 = H - BAS - ((hauteur_bas + 10) if bas else 0)
        hs = [b['h'] for b in B]; ls = [b['l'] for b in B]
        hautp, basp = max(hs), min(ls)
        if prix_max is not None: hautp = max(hautp, prix_max)
        if prix_min is not None: basp = min(basp, prix_min)
        m = (hautp - basp) * marge_prix
        self.ph, self.pb = hautp + m, basp - m
        self.pas = (self.x1 - self.x0) / len(B)
        if bas:
            self.by0, self.by1 = self.y1 + 10, H - BAS
        self.objets = []      # boîtes d'étiquettes, pour ne pas en superposer deux
        self.differe = []     # étiquettes dessinées en dernier, au-dessus des bougies
        self.graduations = [] # graduations de l'échelle, masquées sous une étiquette de prix
        self.tags = []

    # repères
    def x(self, i): return self.x0 + self.pas * (i + 0.5)
    def y(self, p): return self.y0 + (self.ph - p) / (self.ph - self.pb) * (self.y1 - self.y0)

    def police(self, taille, gras=False):
        self.ctx.select_font_face(POLICE, cairo.FONT_SLANT_NORMAL, cairo.FONT_WEIGHT_BOLD if gras else cairo.FONT_WEIGHT_NORMAL)
        self.ctx.set_font_size(taille)

    def texte(self, t, x, y, couleur=TEXTE, taille=9.5, gras=False, ancre='start'):
        self.police(taille, gras)
        e = self.ctx.text_extents(t)
        dx = {'start': 0, 'middle': -e.x_advance / 2, 'end': -e.x_advance}[ancre]
        self.ctx.set_source_rgb(*couleur); self.ctx.move_to(x + dx, y); self.ctx.show_text(t); self.ctx.new_path()
        return e.x_advance

    def cadre(self):
        ctx = self.ctx
        # grille et échelle de prix
        etendue = self.ph - self.pb
        pas = next(g for g in [1, 2, 2.5, 5, 10, 20, 25, 50, 100] if etendue / g <= 6)
        p = math.ceil(self.pb / pas) * pas
        while p <= self.ph:
            yy = self.y(p)
            ctx.set_source_rgb(*GRILLE); ctx.set_line_width(1); ctx.move_to(self.x0, yy); ctx.line_to(self.x1, yy); ctx.stroke()
            self.graduations.append((yy, f"{p:,.2f}".replace(',', ' ').replace('.', ',')))
            p += pas
        for k in range(1, 6):
            xx = self.x0 + (self.x1 - self.x0) * k / 6
            ctx.set_source_rgb(*GRILLE); ctx.move_to(xx, self.y0); ctx.line_to(xx, (self.by1 if self.bas else self.y1)); ctx.stroke()
        # séparation échelle
        ctx.set_source_rgb(0.86, 0.87, 0.9); ctx.set_line_width(1)
        ctx.move_to(self.x1 + 0.5, self.y0 - 6); ctx.line_to(self.x1 + 0.5, H - BAS + 4); ctx.stroke()
        if self.bas:
            ctx.move_to(self.x0, self.y1 + 5); ctx.line_to(W - 6, self.y1 + 5); ctx.stroke()
        # légende façon TradingView, en haut à gauche
        x = self.texte('ES1!', self.x0 + 2, 18, TEXTE, 10, True)
        self.texte(' · 15 · CME', self.x0 + 2 + x, 18, TEXTE_AXE, 10)
        if self.legende:
            lx = self.x0 + 2 + x + 72
            for t, c in self.legende:
                lx += self.texte(t, lx, 18, c, 9.5) + 12

    def bougies(self, jusqua=None):
        ctx = self.ctx; l = max(2.0, min(8.0, self.pas * 0.62))
        for i, b in enumerate(self.B[:jusqua]):
            c = HAUSSE if b['c'] >= b['o'] else BAISSE
            ctx.set_source_rgb(*c); ctx.set_line_width(1)
            ctx.move_to(self.x(i), self.y(b['h'])); ctx.line_to(self.x(i), self.y(b['l'])); ctx.stroke()
            yo, yc = self.y(b['o']), self.y(b['c'])
            ctx.rectangle(self.x(i) - l / 2, min(yo, yc), l, max(1.0, abs(yo - yc))); ctx.fill()

    def serie(self, v, couleur, largeur=1.6, tirets=None, depuis=0, y=None):
        ctx = self.ctx; y = y or self.y
        ctx.set_source_rgb(*couleur); ctx.set_line_width(largeur); ctx.set_line_join(cairo.LINE_JOIN_ROUND)
        ctx.set_dash(tirets or [])
        for i in range(depuis, len(v)):
            (ctx.move_to if i == depuis else ctx.line_to)(self.x(i), y(v[i]))
        ctx.stroke(); ctx.set_dash([])

    def niveau(self, p, couleur, etiquette=None, tirets=(5, 4), largeur=1.2, de=None, a=None, cote='droite', prix=True):
        ctx = self.ctx; yy = self.y(p)
        xa = self.x(de) - self.pas / 2 if de is not None else self.x0
        xb = self.x(a) + self.pas / 2 if a is not None else self.x1
        ctx.set_source_rgb(*couleur); ctx.set_line_width(largeur); ctx.set_dash(list(tirets) if tirets else [])
        ctx.move_to(xa, yy); ctx.line_to(xb, yy); ctx.stroke(); ctx.set_dash([])
        if prix:   # l'étiquette de prix sur l'échelle, comme une ligne horizontale TradingView
            self.police(8.5, True); t = f"{p:,.2f}".replace(',', ' ').replace('.', ',')
            self.tags.append((yy, t, couleur))
        if etiquette:
            self.puce(etiquette, (xa + 6) if cote == 'gauche' else (xb - 6), yy - 10, couleur, ancre='start' if cote == 'gauche' else 'end')

    def arrondi(self, x, y, l, h, r):
        ctx = self.ctx
        ctx.new_sub_path(); ctx.arc(x + l - r, y + r, r, -math.pi / 2, 0); ctx.arc(x + l - r, y + h - r, r, 0, math.pi / 2)
        ctx.arc(x + r, y + h - r, r, math.pi / 2, math.pi); ctx.arc(x + r, y + r, r, math.pi, 3 * math.pi / 2); ctx.close_path()

    def puce(self, *a, **k):
        self.differe.append((a, k))

    def _puce(self, t, x, y, couleur=OR, ancre='start', plein=False):
        """Une étiquette courte : fond blanc, bord et texte de la couleur du repère (ou pleine)."""
        self.police(9, True); e = self.ctx.text_extents(t)
        l, h = e.x_advance + 12, 16
        x0 = x if ancre == 'start' else x - l if ancre == 'end' else x - l / 2
        ctx = self.ctx
        self.arrondi(x0, y - h / 2, l, h, 4)
        if plein: ctx.set_source_rgb(*couleur); ctx.fill()
        else:
            ctx.set_source_rgb(1, 1, 1); ctx.fill_preserve(); ctx.set_source_rgb(*couleur); ctx.set_line_width(1); ctx.stroke()
        self.texte(t, x0 + 6, y + 3.3, (1, 1, 1) if plein else couleur, 9, True)
        self.objets.append((x0, y - h / 2, x0 + l, y + h / 2, t))

    def zone(self, i0, i1, p_haut, p_bas, couleur, alpha=0.14, etiquette=None, bord=True, ancre='start'):
        ctx = self.ctx
        xa = self.x(i0) - self.pas / 2; xb = self.x(i1) + self.pas / 2 if i1 is not None else self.x1
        ya, yb = self.y(p_haut), self.y(p_bas)
        ctx.set_source_rgba(*couleur, alpha); ctx.rectangle(xa, ya, xb - xa, yb - ya); ctx.fill()
        if bord:
            ctx.set_source_rgba(*couleur, 0.7); ctx.set_line_width(1); ctx.rectangle(xa, ya, xb - xa, yb - ya); ctx.stroke()
        if etiquette:
            self.puce(etiquette, (xa + 4) if ancre == 'start' else (xb - 4), ya - 10, couleur, ancre=ancre)

    def droite(self, i0, p0, i1, p1, couleur, largeur=1.6, tirets=None, prolonger=0):
        ctx = self.ctx; xa, ya, xb, yb = self.x(i0), self.y(p0), self.x(i1), self.y(p1)
        if prolonger:
            dx, dy = xb - xa, yb - ya; xb += dx * prolonger; yb += dy * prolonger
        ctx.set_source_rgb(*couleur); ctx.set_line_width(largeur); ctx.set_dash(tirets or [])
        ctx.move_to(xa, ya); ctx.line_to(xb, yb); ctx.stroke(); ctx.set_dash([])

    def point(self, i, p, couleur=OR, r=3.6, creux=False):
        ctx = self.ctx; ctx.new_path(); ctx.arc(self.x(i), self.y(p), r, 0, 2 * math.pi)
        if creux:
            ctx.set_source_rgb(1, 1, 1); ctx.fill_preserve(); ctx.set_source_rgb(*couleur); ctx.set_line_width(1.6); ctx.stroke()
        else:
            ctx.set_source_rgb(*couleur); ctx.fill()

    def fleche(self, i0, p0, i1, p1, couleur=OR, y=None):
        y = y or self.y; ctx = self.ctx
        xa, ya, xb, yb = self.x(i0), y(p0), self.x(i1), y(p1)
        ctx.set_source_rgb(*couleur); ctx.set_line_width(1.4); ctx.move_to(xa, ya); ctx.line_to(xb, yb); ctx.stroke()
        a = math.atan2(yb - ya, xb - xa)
        ctx.move_to(xb, yb); ctx.line_to(xb - 7 * math.cos(a - 0.45), yb - 7 * math.sin(a - 0.45))
        ctx.line_to(xb - 7 * math.cos(a + 0.45), yb - 7 * math.sin(a + 0.45)); ctx.close_path(); ctx.fill()

    # panneau du bas (indicateur)
    def panneau(self, vmin, vmax, graduations=(), nom=None):
        self.vmin, self.vmax = vmin, vmax
        for g in graduations:
            self.texte(str(g).replace('.', ','), self.x1 + 8, self.yb(g) + 3.5, TEXTE_AXE, 8.5)
        if nom: self.texte(nom, self.x0 + 4, self.by0 + 11, TEXTE_AXE, 9)
    def yb(self, v): return self.by0 + (self.vmax - v) / (self.vmax - self.vmin) * (self.by1 - self.by0)

    def enregistrer(self, chemin):
        ctx = self.ctx
        for yy, t in self.graduations:
            if all(abs(yy - ty) > 12 for ty, _, _ in self.tags):
                self.texte(t, self.x1 + 8, yy + 3.5, TEXTE_AXE, 8.5)
        for yy, t, c in self.tags:
            self.police(8.5, True); e = ctx.text_extents(t)
            ctx.set_source_rgb(*c); self.arrondi(self.x1 + 2, yy - 7, e.x_advance + 10, 14, 2); ctx.fill()
            self.texte(t, self.x1 + 7, yy + 3.2, (1, 1, 1), 8.5, True)
        for a, k in self.differe:
            self._puce(*a, **k)
        self.surface.write_to_png(chemin)


# ── Les vingt notions ───────────────────────────────────────────────────────────
def s_tendance():
    pts = [(0, 7600), (8, 7618), (13, 7608), (21, 7632), (26, 7622), (34, 7648), (39, 7638), (47, 7664), (52, 7655), (59, 7675)]
    B = bougies(pts, 60, 3, 1.4)
    g = Graphe(B, [('Tendance haussière', OR)]); g.cadre()
    g.droite(13, 7605, 52, 7651, OR, 1.6, prolonger=0.18)
    g.bougies()
    for i, p, t in [(8, 7621, 'Sommet'), (21, 7635, 'Sommet plus haut'), (34, 7651, 'Sommet plus haut')]:
        g.point(i, p, HAUSSE); g.puce(t, g.x(i), g.y(p) - 14, HAUSSE, 'middle')
    for i, p, t in [(13, 7605, 'Creux'), (26, 7619, 'Creux plus haut'), (39, 7635, 'Creux plus haut')]:
        g.point(i, p, OR); g.puce(t, g.x(i), g.y(p) + 16, OR, 'middle')
    g.puce('Ligne de tendance', g.x(52), g.y(7660) + 30, OR, 'end')
    return g

def s_range():
    pts = [(0, 7630), (5, 7652), (11, 7612), (17, 7651), (23, 7613), (29, 7650), (35, 7614), (41, 7651), (47, 7615), (53, 7648), (59, 7632)]
    B = bougies(pts, 60, 5, 1.2, 0.8)
    g = Graphe(B, [('Range : le prix rebondit entre deux bornes', OR)]); g.cadre()
    g.zone(0, None, 7655, 7650, BAISSE, 0.10, bord=False)
    g.zone(0, None, 7615, 7610, HAUSSE, 0.10, bord=False)
    g.niveau(7652.5, BAISSE, 'Résistance (borne haute)', cote='gauche')
    g.niveau(7612.5, HAUSSE, 'Support (borne basse)', cote='gauche')
    g.bougies()
    return g

def s_support_resistance():
    pts = [(0, 7660), (6, 7622), (11, 7645), (17, 7621), (23, 7650), (28, 7622), (34, 7655), (40, 7672), (46, 7662), (51, 7674), (59, 7690)]
    B = bougies(pts, 60, 8, 1.2)
    g = Graphe(B, [('Support et résistance', OR)]); g.cadre()
    g.niveau(7620, HAUSSE, 'Support : 3 rebonds', cote='gauche')
    g.niveau(7658, BAISSE, 'Résistance cassée, devenue support', cote='gauche')
    g.bougies()
    for i in (6, 17, 28): g.point(i, 7620, HAUSSE, creux=True)
    g.point(46, 7658, OR)
    return g

def s_double_sommet():
    pts = [(0, 7610), (12, 7662), (19, 7636), (28, 7663), (36, 7636), (40, 7628), (52, 7600), (59, 7598)]
    B = bougies(pts, 60, 11, 1.1)
    g = Graphe(B, [('Double sommet', OR)]); g.cadre()
    g.zone(9, 31, 7667, 7660, BAISSE, 0.10, bord=False)
    g.niveau(7635, OR, 'Ligne de cou', de=10, a=50, cote='droite', prix=False)
    g.bougies()
    g.puce('Sommet 1', g.x(12), g.y(7666) - 12, BAISSE, 'middle')
    g.puce('Sommet 2', g.x(28), g.y(7666) - 12, BAISSE, 'middle')
    g.point(37, 7635, OR, creux=True); g.puce('Cassure', g.x(37) + 8, g.y(7635) + 16, OR)
    g.fleche(44, 7622, 50, 7606, BAISSE)
    return g

def s_triangle():
    pts = [(0, 7602), (5, 7650), (10, 7612), (15, 7650), (20, 7622), (25, 7650), (30, 7631), (34, 7650), (38, 7638), (41, 7650), (44, 7663), (52, 7672), (59, 7684)]
    B = bougies(pts, 60, 13, 1.0, 0.8)
    g = Graphe(B, [('Triangle ascendant', OR)]); g.cadre()
    g.droite(0, 7652, 43, 7652, BAISSE, 1.6)
    g.droite(10, 7609, 38, 7636, HAUSSE, 1.6, prolonger=0.12)
    g.bougies()
    g.puce('Résistance plate', g.x(2), g.y(7652) - 12, BAISSE)
    g.puce('Creux de plus en plus hauts', g.x(14), g.y(7606) + 16, HAUSSE)
    g.puce('Compression', g.x(30), g.y(7643), OR, 'middle')
    g.point(43, 7655, OR, creux=True); g.puce('Sortie', g.x(43) - 6, g.y(7662) - 12, OR, 'end')
    return g

def s_pullback():
    pts = [(0, 7600), (10, 7622), (16, 7612), (24, 7640), (30, 7628), (36, 7656), (42, 7642), (47, 7641), (52, 7660), (59, 7676)]
    B = bougies(pts, 60, 17, 1.1)
    g = Graphe(B, [('Pullback', OR)]); g.cadre()
    g.niveau(7642, OR, 'Ancienne résistance', de=20, a=59, cote='gauche', prix=False)
    g.bougies()
    g.fleche(31, 7630, 35, 7652, HAUSSE)
    g.puce('Cassure', g.x(33), g.y(7660) - 12, HAUSSE, 'middle')
    g.point(44, 7641, OR, creux=True); g.puce('Pullback : retour tester le niveau', g.x(44), g.y(7641) + 18, OR, 'middle')
    g.puce('Reprise de la tendance', g.x(56), g.y(7680) - 8, HAUSSE, 'end')
    return g

def s_break_of_structure():
    pts = [(0, 7600), (8, 7624), (14, 7612), (22, 7636), (28, 7624), (35, 7634), (40, 7629), (46, 7650), (52, 7645), (59, 7660)]
    B = bougies(pts, 60, 19, 1.0)
    g = Graphe(B, [('Break of structure', OR)]); g.cadre()
    g.niveau(7638, OR, None, de=22, a=46, prix=False)
    g.bougies()
    g.point(22, 7638, OR); g.puce('Dernier sommet', g.x(22), g.y(7638) - 14, OR, 'middle')
    g.point(44, 7638, HAUSSE, creux=True); g.puce('BOS : sommet cassé', g.x(44) + 6, g.y(7638) + 16, HAUSSE)
    g.puce('Creux plus haut', g.x(28), g.y(7620) + 16, TEXTE_AXE, 'middle')
    return g

def s_order_block():
    pts = [(0, 7640), (10, 7628), (16, 7620), (17, 7618), (24, 7652), (30, 7662), (36, 7648), (40, 7630), (44, 7626), (50, 7650), (59, 7668)]
    B = bougies(pts, 60, 23, 1.0)
    poser(B, 17, 7625, 7627, 7616.5, 7618)          # dernière bougie baissière
    poser(B, 18, 7618, 7631, 7617.5, 7630.5)        # départ impulsif
    poser(B, 19, 7630.5, 7642, 7629.5, 7641.5)
    g = Graphe(B, [('Order block', OR)]); g.cadre()
    g.zone(17, None, 7627, 7616.5, OR, 0.13, 'Order block')
    g.bougies()
    g.puce('Dernière bougie baissière avant le départ', g.x(1), g.y(7652), BAISSE)
    g.point(44, 7626, OR, creux=True); g.puce('Retour dans la zone', g.x(44), g.y(7622) + 18, OR, 'middle')
    return g

def s_liquidite():
    pts = [(0, 7620), (8, 7650), (14, 7636), (22, 7650.5), (28, 7638), (36, 7650), (42, 7640), (45, 7657), (47, 7646), (53, 7628), (59, 7620)]
    B = bougies(pts, 60, 29, 0.9, 0.7)
    poser(B, 45, 7648, 7659.5, 7647, 7649)          # mèche qui balaie les sommets
    g = Graphe(B, [('Liquidité', OR)]); g.cadre()
    g.zone(6, 44, 7653, 7650, BAISSE, 0.10, bord=False)
    g.niveau(7651.5, BAISSE, None, de=6, a=44, tirets=(3, 3), prix=False)
    g.bougies()
    g.puce('Sommets égaux : stops au-dessus', g.x(16), g.y(7651.5) - 14, BAISSE, 'middle')
    g.point(45, 7659.5, OR, creux=True); g.puce('Chasse des stops', g.x(45) + 6, g.y(7660) - 12, OR)
    g.fleche(47, 7642, 52, 7630, BAISSE)
    return g

def s_gap():
    pts = [(0, 7600), (12, 7622), (19, 7630), (20, 7650), (30, 7660), (38, 7652), (46, 7636), (50, 7630), (59, 7640)]
    B = bougies(pts, 60, 31, 1.0)
    poser(B, 19, 7628, 7631.5, 7627, 7630)
    poser(B, 20, 7646, 7652, 7645, 7651)            # ouverture décalée
    g = Graphe(B, [('Gap', OR)]); g.cadre()
    g.zone(20, 49, 7645, 7630, OR, 0.13)
    g.puce('Gap : ouverture au-dessus de la clôture', g.x(21), g.y(7630) + 14, OR)
    g.bougies()
    g.puce('Clôture', g.x(19) - 6, g.y(7630) + 14, TEXTE, 'end')
    g.puce('Ouverture', g.x(20) - 6, g.y(7646) - 10, TEXTE, 'end')
    g.point(49, 7630.5, HAUSSE, creux=True); g.puce('Gap comblé', g.x(50), g.y(7628) + 16, HAUSSE)
    return g

def s_fibonacci():
    pts = [(0, 7640), (6, 7600), (26, 7680), (34, 7655), (40, 7636), (44, 7631), (52, 7656), (59, 7676)]
    B = bougies(pts, 60, 37, 1.0)
    g = Graphe(B, [('Retracement de Fibonacci', OR)]); g.cadre()
    bas_, haut_ = 7600, 7680
    for niv, coul in [(0, TEXTE_AXE), (0.382, OR), (0.5, OR), (0.618, HAUSSE), (1, TEXTE_AXE)]:
        p = haut_ - (haut_ - bas_) * niv
        g.niveau(p, coul, None, de=6, a=59, tirets=None if niv in (0, 1) else (4, 3), largeur=1, prix=False)
        g.puce(f"{niv*100:.1f} %".replace('.', ',').replace(',0 %', ' %'), g.x1 - 4, g.y(p) - 10, coul, 'end')
    g.bougies()
    g.droite(6, bas_, 26, haut_, TEXTE_AXE, 1, (3, 3))
    g.point(44, 7630.56, HAUSSE, creux=True); g.puce('Rebond sur 61,8 %', g.x(44), g.y(7630.56) + 18, HAUSSE, 'middle')
    return g

def s_chandelier_japonais():
    B = bougies([(0, 7630), (59, 7632)], 14, 41, 0.6, 0.4)
    poser(B, 5, 7620, 7646, 7612, 7638)     # haussière
    poser(B, 9, 7640, 7647, 7614, 7622)     # baissière
    for i in (6, 10):
        c = B[i]['c']; B[i].update(o=c + 0.5, h=c + 1, l=c - 0.5)
    g = Graphe(B, [('Anatomie d’une bougie', OR)], marge_prix=0.08, prix_min=7600); g.cadre()
    g.bougies()
    for i, b, sens in [(5, B[5], 'h'), (9, B[9], 'b')]:
        x = g.x(i)
        g.ctx.set_source_rgb(*TEXTE_AXE); g.ctx.set_line_width(0.8)
    g.puce('Mèche haute : le plus haut', g.x(5) - 18, g.y(7646), TEXTE, 'end')
    g.puce('Clôture', g.x(5) - 18, g.y(7638), HAUSSE, 'end')
    g.puce('Corps', g.x(5) - 18, g.y(7629), HAUSSE, 'end')
    g.puce('Ouverture', g.x(5) - 18, g.y(7620), HAUSSE, 'end')
    g.puce('Mèche basse : le plus bas', g.x(5) - 18, g.y(7612), TEXTE, 'end')
    g.puce('Ouverture', g.x(9) + 18, g.y(7640), BAISSE)
    g.puce('Clôture', g.x(9) + 18, g.y(7622), BAISSE)
    g.puce('Bougie haussière', g.x(5), g.y(7604), HAUSSE, 'middle')
    g.puce('Bougie baissière', g.x(9), g.y(7604), BAISSE, 'middle')
    for i, ps in [(5, (7646, 7638, 7629, 7620, 7612)), (9, (7640, 7622))]:
        for p in ps:
            g.ctx.set_source_rgba(*TEXTE_AXE, 0.7); g.ctx.set_line_width(0.8); g.ctx.set_dash([2, 2])
            xa = g.x(i) - 16 if i == 5 else g.x(i) + 16
            g.ctx.move_to(xa, g.y(p)); g.ctx.line_to(g.x(i) + (-5 if i == 5 else 5), g.y(p)); g.ctx.stroke(); g.ctx.set_dash([])
    return g

def s_moyenne_mobile():
    pts = [(0, 7660), (14, 7630), (22, 7622), (30, 7632), (40, 7652), (50, 7660), (59, 7676)]
    B = bougies(pts, 60, 43, 1.3)
    m = mm(B, 20)
    g = Graphe(B, [('MM 20', NOIR)]); g.cadre()
    g.bougies(); g.serie(m, NOIR, 1.6, depuis=3)
    k = next(i for i in range(25, 59) if B[i]['c'] > m[i] and B[i - 1]['c'] <= m[i - 1])
    g.point(k, m[k], OR, creux=True); g.puce('Le prix repasse au-dessus', g.x(k), g.y(m[k]) + 18, OR, 'middle')
    g.puce('Sous la moyenne : pression vendeuse', g.x(1), g.y(m[1]) - 30, BAISSE)
    g.puce('Au-dessus : pression acheteuse', g.x(59), g.y(7624), HAUSSE, 'end')
    return g

def s_bollinger():
    pts = [(0, 7630), (10, 7640), (18, 7634), (26, 7637), (34, 7635), (40, 7636), (44, 7650), (52, 7672), (59, 7668)]
    B = bougies(pts, 60, 47, 1.0)
    for i in range(24, 41):
        b = B[i]; mid = (b['o'] + b['c']) / 2
    bb = bollinger(B)
    g = Graphe(B, [('Bandes de Bollinger 20, 2', BLEU)], prix_max=max(x[0] for x in bb[5:]), prix_min=min(x[2] for x in bb[5:])); g.cadre()
    g.serie([x[0] for x in bb], HAUSSE, 1.2, depuis=5); g.serie([x[2] for x in bb], BAISSE, 1.2, depuis=5)
    g.serie([x[1] for x in bb], BLEU, 1.2, (4, 3), depuis=5)
    g.bougies()
    g.puce('Resserrement : volatilité faible', g.x(33), g.y(bb[33][0]) - 14, OR, 'middle')
    g.puce('Expansion', g.x(51), g.y(bb[51][2]) + 14, OR, 'middle')
    g.puce('Bande haute', g.x(8), g.y(bb[8][0]) - 12, HAUSSE)
    g.puce('Bande basse', g.x(8), g.y(bb[8][2]) + 14, BAISSE)
    return g

def s_vwap():
    pts = [(0, 7620), (10, 7650), (18, 7640), (24, 7633), (30, 7646), (38, 7654), (44, 7640), (48, 7637), (54, 7652), (59, 7660)]
    B = bougies(pts, 60, 53, 1.1)
    v = vwap(B)
    g = Graphe(B, [('VWAP séance', ORANGE)]); g.cadre()
    g.bougies(); g.serie(v, ORANGE, 2)
    g.texte('09:30', g.x(0), H - 8, TEXTE_AXE, 8.5); g.texte('16:00', g.x(59), H - 8, TEXTE_AXE, 8.5, ancre='end')
    for i in (24, 48):
        g.point(i, v[i], OR, creux=True)
    g.puce('Retours sur le VWAP', g.x(36), g.y(v[36]) + 22, OR, 'middle')
    g.puce('Prix moyen pondéré par les volumes', g.x(1), g.y(7660), ORANGE)
    return g

def s_rsi():
    pts = [(0, 7620), (14, 7662), (20, 7666), (30, 7640), (40, 7612), (46, 7608), (59, 7632)]
    B = bougies(pts, 60, 59, 2.4)
    r = rsi(B)
    g = Graphe(B, [('RSI 14', (0.494, 0.341, 0.761))], bas=True); g.cadre(); g.bougies()
    g.panneau(0, 100, (30, 70), 'RSI 14')
    ctx = g.ctx
    for v, c in ((70, BAISSE), (30, HAUSSE)):
        ctx.set_source_rgb(*c); ctx.set_line_width(1); ctx.set_dash([4, 3]); ctx.move_to(g.x0, g.yb(v)); ctx.line_to(g.x1, g.yb(v)); ctx.stroke(); ctx.set_dash([])
    ctx.set_source_rgba(0.494, 0.341, 0.761, 0.08); ctx.rectangle(g.x0, g.yb(70), g.x1 - g.x0, g.yb(30) - g.yb(70)); ctx.fill()
    g.serie(r, (0.494, 0.341, 0.761), 1.6, depuis=2, y=g.yb)
    hi = max(range(5, 30), key=lambda i: r[i]); lo = min(range(30, 55), key=lambda i: r[i])
    g.puce('Surachat > 70', g.x(hi) + 10, g.yb(r[hi]) + 2, BAISSE)
    g.puce('Survente < 30', g.x(lo) + 10, g.yb(r[lo]) - 2, HAUSSE)
    return g

def s_macd():
    pts = [(0, 7660), (16, 7626), (24, 7622), (36, 7648), (46, 7662), (59, 7640)]
    B = bougies(pts, 60, 61, 1.0)
    m, s, h = macd(B)
    g = Graphe(B, [('MACD 12, 26, 9', BLEU)], bas=True); g.cadre(); g.bougies()
    a = max(max(abs(x) for x in m[8:]), max(abs(x) for x in h[8:])) * 1.15
    g.panneau(-a, a, (), 'MACD 12, 26, 9')
    ctx = g.ctx; ctx.set_source_rgb(*GRILLE); ctx.move_to(g.x0, g.yb(0)); ctx.line_to(g.x1, g.yb(0)); ctx.stroke()
    g.texte('0', g.x1 + 8, g.yb(0) + 3.5, TEXTE_AXE, 8.5)
    for i in range(8, len(B)):
        ctx.set_source_rgba(*(HAUSSE if h[i] >= 0 else BAISSE), 0.55)
        ctx.rectangle(g.x(i) - g.pas * 0.3, min(g.yb(0), g.yb(h[i])), g.pas * 0.6, abs(g.yb(h[i]) - g.yb(0))); ctx.fill()
    g.serie(m, BLEU, 1.5, depuis=8, y=g.yb); g.serie(s, ORANGE, 1.3, depuis=8, y=g.yb)
    k = next(i for i in range(15, 50) if m[i] > s[i] and m[i - 1] <= s[i - 1])
    g.point(k, m[k], HAUSSE, creux=True, r=3.2)
    g.ctx.arc(g.x(k), g.yb(m[k]), 3.4, 0, 2 * math.pi); g.ctx.set_source_rgb(*HAUSSE); g.ctx.fill()
    g.puce('Croisement haussier', g.x(k) + 6, g.yb(m[k]) - 10, HAUSSE)
    g.puce('MACD', g.x(56), g.by0 + 12, BLEU, 'end'); g.puce('Signal', g.x(48), g.by0 + 12, ORANGE, 'end')
    return g

def s_divergence():
    pts = [(0, 7620), (12, 7652), (20, 7636), (32, 7660), (40, 7640), (50, 7626), (59, 7620)]
    B = bougies(pts, 60, 67, 2.0)
    poser(B, 12, 7648, 7655, 7647, 7653)
    poser(B, 32, 7656, 7661, 7655, 7659.5)
    r = rsi(B)
    g = Graphe(B, [('Divergence baissière', OR)], bas=True); g.cadre(); g.bougies()
    g.panneau(0, 100, (30, 70), 'RSI 14')
    ctx = g.ctx
    for v, c in ((70, BAISSE), (30, HAUSSE)):
        ctx.set_source_rgb(*c); ctx.set_line_width(1); ctx.set_dash([4, 3]); ctx.move_to(g.x0, g.yb(v)); ctx.line_to(g.x1, g.yb(v)); ctx.stroke(); ctx.set_dash([])
    g.serie(r, (0.494, 0.341, 0.761), 1.6, depuis=2, y=g.yb)
    i1 = max(range(8, 16), key=lambda i: r[i]); i2 = max(range(28, 36), key=lambda i: r[i])
    g.droite(12, 7655, 32, 7661, BAISSE, 1.6)
    ctx = g.ctx; ctx.set_source_rgb(*BAISSE); ctx.set_line_width(1.6); ctx.move_to(g.x(i1), g.yb(r[i1])); ctx.line_to(g.x(i2), g.yb(r[i2])); ctx.stroke()
    g.puce('Prix : sommet plus haut', g.x(22), g.y(7664) - 6, BAISSE, 'middle')
    g.puce('RSI : sommet plus bas', g.x(22), g.yb(max(r[i1], r[i2])) - 8, BAISSE, 'middle')
    g.fleche(36, 7652, 44, 7634, BAISSE)
    return g

def s_volume():
    pts = [(0, 7630), (8, 7640), (16, 7632), (24, 7639), (32, 7633), (38, 7640), (40, 7656), (50, 7670), (59, 7676)]
    B = bougies(pts, 60, 71, 0.9, 0.8)
    rnd = random.Random(5); vol = [40 + rnd.random() * 30 + abs(b['c'] - b['o']) * 6 for b in B]
    for i in (39, 40, 41): vol[i] = 150 + i % 2 * 25
    g = Graphe(B, [('Volume', TEXTE_AXE)], bas=True); g.cadre()
    g.niveau(7641, OR, 'Résistance', de=0, a=40, cote='gauche', prix=False)
    g.bougies()
    g.panneau(0, max(vol) * 1.15, (), 'Volume')
    ctx = g.ctx
    for i, v in enumerate(vol):
        ctx.set_source_rgba(*(HAUSSE if B[i]['c'] >= B[i]['o'] else BAISSE), 0.5)
        ctx.rectangle(g.x(i) - g.pas * 0.32, g.yb(v), g.pas * 0.64, g.yb(0) - g.yb(v)); ctx.fill()
    g.puce('Volume en forte hausse à la cassure', g.x(40) + 10, g.yb(vol[40]) + 2, OR)
    g.puce('Cassure', g.x(40) - 6, g.y(7652) - 8, HAUSSE, 'end')
    return g

def s_atr():
    pts = [(0, 7640), (24, 7646), (30, 7636), (36, 7660), (42, 7626), (48, 7658), (54, 7622), (59, 7640)]
    B = bougies(pts, 60, 73, 0.5, 0.4)
    for i in range(30, 60):
        b = B[i]; e = (i - 28) * 0.22
        b['h'] += e; b['l'] -= e
    a = atr(B)
    g = Graphe(B, [('ATR 14', (0.765, 0.11, 0.388))], bas=True); g.cadre(); g.bougies()
    g.panneau(0, max(a) * 1.2, (), 'ATR 14')
    g.serie(a, (0.765, 0.11, 0.388), 1.6, depuis=2, y=g.yb)
    g.puce('Séance calme : amplitude faible', g.x(4), g.y(7656), TEXTE_AXE)
    g.puce('La volatilité augmente', g.x(46), g.yb(a[46]) - 10, (0.765, 0.11, 0.388), 'middle')
    return g


SCHEMAS = {
    'tendance': s_tendance, 'range': s_range, 'support-resistance': s_support_resistance,
    'double-sommet': s_double_sommet, 'triangle': s_triangle, 'pullback': s_pullback,
    'break-of-structure': s_break_of_structure, 'order-block': s_order_block, 'liquidite': s_liquidite,
    'gap': s_gap, 'fibonacci': s_fibonacci, 'chandelier-japonais': s_chandelier_japonais,
    'moyenne-mobile': s_moyenne_mobile, 'bandes-de-bollinger': s_bollinger, 'vwap': s_vwap,
    'rsi': s_rsi, 'macd': s_macd, 'divergence': s_divergence, 'volume': s_volume, 'atr': s_atr,
}

if __name__ == '__main__':
    sortie = sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(os.path.abspath(__file__))
    noms = sys.argv[2:] or list(SCHEMAS)
    os.makedirs(sortie, exist_ok=True)
    for n in noms:
        g = SCHEMAS[n]()
        g.enregistrer(os.path.join(sortie, f'{n}.png'))
        print('✓', n)
