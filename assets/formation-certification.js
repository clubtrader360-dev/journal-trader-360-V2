/**
 * LA CERTIFICATION TRADER 360. ⛔ FICHIER ENGENDRE, NE PAS EDITER A LA MAIN.
 *
 * Produit par `node outils/formation-certification-import.mjs --ecrire` depuis
 * `_contenu-formation/certification-t360.md` (questions) et
 * `_contenu-formation/certification-exercices.json` (exercices), qui sont la
 * source : une question ou un graphique se corrige la-bas, puis on relance.
 *
 * Forme : { titre, seuil, exercices_minimum, points_par_exercice,
 *           questions: [ comme FORMATION_QUIZ ], exercices: [ voir le json ] }
 */
(function () {
  'use strict';
  const racine = typeof window !== 'undefined' ? window : globalThis;
  racine.FORMATION_CERTIFICATION = {
 "titre": "Certification Trader 360",
 "seuil": 0.8,
 "exercices_minimum": 3,
 "points_par_exercice": 5,
 "questions": [
  {
   "id": "c10-1",
   "type": "choix",
   "enonce": "Il est 9 h 40. Un retournement acheteur parfait se dessine, bougie en marteau, mèche bien marquée, mais il se fait entre deux zones de ton plan, sans aucun niveau dessous. Que fais-tu ?",
   "options": [
    "Je n'entre pas : pas de zone, pas de trade, même si le retournement est beau.",
    "J'entre avec une taille réduite, le signal est trop propre pour le laisser.",
    "J'entre et je place mon stop à la louche, 2 points sous la mèche.",
    "J'attends la bougie suivante et j'entre si elle est verte."
   ],
   "bonne": 0,
   "renvoi": {
    "lecon": "m05-l3",
    "de": 3,
    "a": 5
   },
   "conseil": "« Pas de zone, pas de trade. Même si tu as un super bon retournement qui ne se fait pas sur ta zone, tu ne viens pas le trader. » Hors zone, le stop n'a aucun niveau pour s'appuyer et l'entrée devient un pari."
  },
  {
   "id": "c10-2",
   "type": "choix",
   "enonce": "Tu ouvres ton graphique vierge avant la séance. Dans quel ordre poses-tu tes niveaux ?",
   "options": [
    "La clôture de la veille d'abord, puis les sommets et creux en 4 heures, puis en 30 minutes.",
    "Les bandes de Bollinger et la VWAP d'abord, les zones ensuite.",
    "Les sommets et creux en 1 minute, puis en 5 minutes, puis en 30 minutes.",
    "Les points pivots d'abord, la clôture de la veille en dernier."
   ],
   "bonne": 0,
   "renvoi": {
    "lecon": "m05-l4",
    "de": 0,
    "a": 3
   },
   "conseil": "Pour poser les zones, Manu enlève tous ses indicateurs. Il ne garde que la clôture de la veille, « niveau indiscutable », puis cherche les retournements en 4 heures, et affine en 30 minutes."
  },
  {
   "id": "c10-3",
   "type": "choix",
   "enonce": "Entre deux de tes zones, il y a soixante points sans aucun sommet ni creux travaillé. Le marché remonte dans cet espace et fait une petite hésitation. Que vaut cet espace pour toi ?",
   "options": [
    "Rien : entre deux zones, on ne trade pas, on attend que le marché arrive sur un niveau clé.",
    "Une zone secondaire, bonne pour un trade à taille réduite.",
    "Une zone d'achat, puisque le marché y remonte.",
    "Une zone de vente, puisqu'il hésite."
   ],
   "bonne": 0,
   "renvoi": {
    "lecon": "m05-l4",
    "de": 10,
    "a": 13
   },
   "conseil": "« Entre deux, tu n'as pas grand-chose à prendre. Si le marché retourne dans cette zone-là, tu ne trades pas. » Les zones sont les niveaux les plus travaillés, pas l'espace entre eux."
  },
  {
   "id": "c10-4",
   "type": "choix",
   "enonce": "Tu hésites entre deux niveaux pour ta zone de vente. Le premier a été touché une fois en 4 heures. Le second a un sommet 4 heures, un double top en 30 minutes et il est à deux points de la clôture de la veille. Lequel gardes-tu ?",
   "options": [
    "Le second : plusieurs niveaux travaillés et une confluence avec la clôture de la veille.",
    "Le premier : plus il est haut, plus la vente est sûre.",
    "Les deux, on ne sait jamais.",
    "Aucun : on ne vend pas près de la clôture de la veille."
   ],
   "bonne": 0,
   "renvoi": {
    "lecon": "m05-l4",
    "de": 7,
    "a": 10
   },
   "conseil": "« Nous, ce qu'on veut, c'est plusieurs niveaux qui viennent rebuter. » Et quand il y a trop de zones, on garde les plus travaillées et on élimine le reste."
  },
  {
   "id": "c10-5",
   "type": "choix",
   "enonce": "Un marteau acheteur se forme sur ta zone, le corps clôture à 6 962,50. Où places-tu ton ordre d'entrée ?",
   "options": [
    "0,25 point au-dessus du corps, soit 6 962,75.",
    "Au marché, tout de suite, avant que ça parte.",
    "2 points au-dessus de la mèche haute, pour être sûr.",
    "Sur la clôture de la veille, quelle qu'elle soit."
   ],
   "bonne": 0,
   "renvoi": {
    "lecon": "m05-l7",
    "de": 1,
    "a": 2
   },
   "conseil": "« Je vais chercher juste mon point d'entrée, 0,25 au-dessus, soit du corps, soit de la mèche, mais éventuellement du corps. » L'entrée se fait sur confirmation, pas sur espoir."
  },
  {
   "id": "c10-6",
   "type": "choix",
   "enonce": "Le plus bas de ton retournement est à 6 000,00 tout rond. Où va ton stop ?",
   "options": [
    "1,25 point minimum sous le plus bas, et jamais sur un compte rond : 5 998,75 par exemple.",
    "Pile à 6 000,00, c'est le plus bas.",
    "À 5 999,75, juste sous le compte rond, c'est suffisant.",
    "10 points plus bas, pour laisser respirer."
   ],
   "bonne": 0,
   "renvoi": {
    "lecon": "m05-l7",
    "de": 2,
    "a": 3
   },
   "conseil": "« 1,25 minimum sous le plus bas, et jamais rester sur des comptes ronds. » À 5 999,75 tu es sous le rond mais à 0,25 du plus bas seulement, pas à 1,25."
  },
  {
   "id": "c10-7",
   "type": "choix",
   "enonce": "Beau retournement sur une belle zone, mais ton stop calculé tombe à 11,50 points. Que fais-tu ?",
   "options": [
    "Je ne prends pas : au-delà de 8 points, c'est trop cher, il n'y a pas de signal.",
    "Je prends, la zone est belle.",
    "Je prends avec un stop à 8 points, quitte à être sous le plus bas de moins de 1,25.",
    "Je prends sans stop et je gère à la main."
   ],
   "bonne": 0,
   "renvoi": {
    "lecon": "m05-l8",
    "de": 6,
    "a": 7
   },
   "conseil": "« Pas de signal. Il était sur une belle zone, par contre il était beaucoup trop cher, 11,50. » Le stop vit entre 2 et 8 points ; un stop plus large casse le ratio."
  },
  {
   "id": "c10-8",
   "type": "choix",
   "enonce": "Tu es en position à l'achat depuis trois bougies. Une bougie clôture au-dessus de la moyenne mobile 20. Que fais-tu ?",
   "options": [
    "Je passe mon stop à break even, sur mon niveau d'entrée, puis je suis le marché avec un stop suiveur.",
    "Je double ma position, la tendance est confirmée.",
    "Je coupe tout de suite, l'objectif est atteint.",
    "Rien, je touche à mon stop seulement s'il est menacé."
   ],
   "bonne": 0,
   "renvoi": {
    "lecon": "m05-l7",
    "de": 3,
    "a": 5
   },
   "conseil": "« On attend au moins la clôture de la bougie au-dessus de la moyenne mobile 20 pour bien venir placer son break even, et aller chercher au moins le RR de 1. » Ensuite, stop suiveur sous les derniers plus bas."
  },
  {
   "id": "c10-9",
   "type": "choix",
   "enonce": "Ton trade est perdant de 4 points et ton stop est à 1 point du prix. Tu es sûr que ça va se retourner. Que fais-tu ?",
   "options": [
    "Rien : le stop ne se déplace jamais, il se prend s'il doit se prendre.",
    "Je l'écarte de 3 points, le temps que ça respire.",
    "Je l'enlève, je le remettrai quand ça sera reparti.",
    "Je rajoute une position pour moyenner mon entrée."
   ],
   "bonne": 0,
   "renvoi": {
    "lecon": "m05-l5",
    "de": 2,
    "a": 4
   },
   "conseil": "« Ne jamais déplacer son stop loss » est l'une des trois règles inviolables de la séance. Un stop placé sous un niveau stratégique fait son travail ; écarté, il ne protège plus rien."
  },
  {
   "id": "c10-10",
   "type": "choix",
   "enonce": "Deux pertes ce matin, deux fois 5 points. Il est 10 h 20, un troisième retournement se forme, propre, sur ta meilleure zone. Que fais-tu ?",
   "options": [
    "Je ferme la plateforme : deux pertes, la séance est finie, même si le signal est bon.",
    "Je le prends, celui-là est le bon.",
    "Je le prends avec une taille double pour rattraper.",
    "Je le prends sans stop, c'est le dernier."
   ],
   "bonne": 0,
   "renvoi": {
    "lecon": "m05-l1",
    "de": 11,
    "a": 14
   },
   "conseil": "« Deux pertes maximum par jour. » Le troisième trade, c'est le trade revanchard du 1.3 : on reprend pour rattraper une perte qu'on n'a pas acceptée."
  },
  {
   "id": "c10-11",
   "type": "choix",
   "enonce": "Compte de 50 000 $, tu risques 125 $ par trade. Après deux pertes, combien as-tu perdu, et où en es-tu par rapport à la règle d'or ?",
   "options": [
    "250 $, soit 0,5 % : la journée s'arrête là, bien sous le 1 % maximum par jour.",
    "250 $, soit 0,5 % : il me reste 0,5 %, donc deux trades.",
    "500 $, soit 1 % : je suis au maximum.",
    "250 $, mais la règle d'or ne s'applique qu'aux comptes financés."
   ],
   "bonne": 0,
   "renvoi": {
    "lecon": "m05-l6",
    "de": 2,
    "a": 4
   },
   "conseil": "125 $, c'est 0,25 % de 50 000 $, « deux cartouches par jour ». Deux pertes font 0,5 %, et la règle des deux pertes arrête la séance avant même le plafond de 1 %."
  },
  {
   "id": "c10-12",
   "type": "choix",
   "enonce": "Sur tes trente derniers trades, tu n'as eu raison que 14 fois, avec des ratios de 2. Que dis-tu de ta méthode ?",
   "options": [
    "Elle est rentable : avec des ratios de 2, on gagne dès un tiers de réussite, et 14 sur 30 fait près de la moitié.",
    "Elle est mauvaise : moins de la moitié de réussite, il faut en changer.",
    "On ne peut rien dire, trente trades c'est trop peu.",
    "Elle est rentable seulement si je passe mes ratios à 3."
   ],
   "bonne": 0,
   "renvoi": {
    "lecon": "m05-l5",
    "de": 15,
    "a": 17
   },
   "conseil": "« Avec des ratios de 2, à partir d'environ un tiers, 34 %, on est rentable. » Et on juge sur une série, vingt à trente trades au moins (5.9). Changer de méthode après quelques pertes est l'erreur nommée au module 9."
  },
  {
   "id": "c10-13",
   "type": "choix",
   "enonce": "Il est 14 h 20, un vendredi. Ton plan dit « NFP à 14 h 30, trois étoiles ». Le marché arrive sur ta zone d'achat et un retournement se dessine à 14 h 27. Que fais-tu ?",
   "options": [
    "Je n'entre pas : on ne trade pas pendant une annonce à fort impact, même si le setup est bon.",
    "J'entre, le retournement est avant l'annonce.",
    "J'entre avec un stop plus large pour encaisser l'annonce.",
    "J'entre et je coupe à 14 h 29."
   ],
   "bonne": 0,
   "renvoi": {
    "lecon": "m02-l3",
    "de": 5,
    "a": 6
   },
   "conseil": "Les annonces trois étoiles sont dans le plan pour une raison : on ne trade pas dedans. Un setup parfait trois minutes avant un NFP n'est pas un setup, c'est une loterie."
  },
  {
   "id": "c10-14",
   "type": "choix",
   "enonce": "Ton plan de ce matin contient la clôture de la veille, les zones d'achat et de vente, et le sens des dernières bougies. Qu'est-ce qui manque pour qu'il soit complet ?",
   "options": [
    "Les annonces trois étoiles et la tendance en 4 heures et en 30 minutes.",
    "Le POC et la VWAP de la semaine dernière.",
    "Rien, il est complet.",
    "Le nombre de trades gagnants de la veille."
   ],
   "bonne": 0,
   "renvoi": {
    "lecon": "m05-l2",
    "de": 2,
    "a": 5
   },
   "conseil": "Le plan Trader 360 contient cinq choses : les annonces trois étoiles, la tendance 4 heures et 30 minutes, la clôture de la veille, les zones, le sens des dernières bougies. Et « un mauvais plan vaut mieux que pas de plan »."
  },
  {
   "id": "c10-15",
   "type": "choix",
   "enonce": "Une résistance 30 minutes vient d'être dépassée. Le prix revient se poser dessus et forme un marteau. Comment lis-tu ce niveau maintenant ?",
   "options": [
    "Comme un support : une résistance cassée puis retestée devient un support, et le marteau est une confirmation d'achat.",
    "Toujours comme une résistance : je vends le retest.",
    "Comme un niveau mort, puisqu'il a cédé.",
    "Comme un niveau à ignorer tant qu'il n'a pas été touché deux fois de plus."
   ],
   "bonne": 0,
   "renvoi": {
    "lecon": "m02-l5",
    "de": 10,
    "a": 11
   },
   "conseil": "« Résistance qui fait après office de support, support, résistance… » (5.3 bis). Le marché a une mémoire : il réagit là où il a déjà réagi."
  },
  {
   "id": "c10-16",
   "type": "choix",
   "enonce": "Sur ta zone d'achat, la bougie qui se forme a un petit corps rouge et une longue mèche en bas. Ton voisin dit « elle est rouge, c'est vendeur ». Qu'en penses-tu ?",
   "options": [
    "C'est un marteau, une bougie acheteuse quelle que soit sa couleur : la mèche montre le rejet des vendeurs.",
    "Il a raison, rouge égale vente.",
    "Il faut attendre qu'elle devienne verte pour qu'elle soit acheteuse.",
    "Une mèche en bas est toujours un signal de vente."
   ],
   "bonne": 0,
   "renvoi": {
    "lecon": "m02-l6",
    "de": 3,
    "a": 6
   },
   "conseil": "Un marteau avec une grande mèche en bas et un petit corps est une bougie acheteuse, rouge ou verte. C'est la mèche qui parle : les vendeurs ont poussé, les acheteurs ont tout repris."
  },
  {
   "id": "c10-17",
   "type": "choix",
   "enonce": "Les bandes de Bollinger se resserrent fortement en 1 minute, juste sous ta zone de vente. Que t'indique cette contraction ?",
   "options": [
    "Que le marché se comprime, souvent avant une impulsion : je me tiens prêt, mais j'attends toujours un retournement dans la zone.",
    "Que le marché va monter, à coup sûr.",
    "Qu'il faut vendre tout de suite, avant l'explosion.",
    "Que les bandes sont mal réglées."
   ],
   "bonne": 0,
   "renvoi": {
    "lecon": "m03-l2",
    "de": 4,
    "a": 5
   },
   "conseil": "Les bandes qui se resserrent annoncent une contraction, « souvent avant une grosse impulsion ». Elles ne disent pas le sens : le sens vient de la zone et du retournement."
  },
  {
   "id": "c10-18",
   "type": "choix",
   "enonce": "Tu viens d'encaisser une perte, tu sens la colère monter, ton plan est toujours valable et une nouvelle zone approche. Que fais-tu d'abord ?",
   "options": [
    "Je prends une ou deux minutes de pause, je respire, et je ne reprends un trade que si mon état interne est redevenu stable.",
    "Je reprends tout de suite, tant que le plan est valable.",
    "Je double la taille, pour effacer la perte en un trade.",
    "Je change de zone, celle-là m'a trahi."
   ],
   "bonne": 0,
   "renvoi": {
    "lecon": "m06-l2",
    "de": 5,
    "a": 8
   },
   "conseil": "« Stop loss mental » : s'interdire un trade quand l'état interne est agité. Et après chaque trade, gagnant ou perdant, une ou deux minutes de pause. Le protocole d'urgence du 1.4 tient en trois mots : je respire, je coupe, je reviens."
  },
  {
   "id": "c10-19",
   "type": "choix",
   "enonce": "Tu passes un challenge sur un compte de 50 000 $. Combien de trades par jour, et combien peux-tu risquer sur ce trade ?",
   "options": [
    "Un seul trade par jour et par compte, jusqu'à 2 % soit 1 000 $, pour un ratio d'au moins 1,5.",
    "Deux trades à 125 $, comme en séance normale.",
    "Autant de trades qu'il faut pour atteindre l'objectif du jour.",
    "Un seul trade, à 5 % du compte."
   ],
   "bonne": 0,
   "renvoi": {
    "lecon": "m07-l7",
    "de": 4,
    "a": 8
   },
   "conseil": "Le mode challenge a ses propres règles : un trade par jour et par compte, jusqu'à 2 % de risque, ratio 1,5 minimum. Ce n'est pas le money management de la séance normale."
  },
  {
   "id": "c10-20",
   "type": "choix",
   "enonce": "Fin de séance. Tu as pris un break even et une petite perte, en respectant ton plan. Que notes-tu dans le journal, et comment juges-tu ta journée ?",
   "options": [
    "Les deux trades, mon état émotionnel et le respect du plan : la journée est bonne, le process a été exécuté.",
    "Rien, il n'y a pas eu de gain à noter.",
    "Seulement la perte, pour me souvenir de ne plus la faire.",
    "Le montant perdu : la journée est mauvaise."
   ],
   "bonne": 0,
   "renvoi": {
    "lecon": "m05-l9",
    "de": 0,
    "a": 3
   },
   "conseil": "Le pro cherche à bien exécuter son plan, pas à gagner (6.1). Les trois révélateurs de ton niveau sont le respect du plan, le nombre de trades et l'état émotionnel (6.3), et c'est le journal qui les garde."
  }
 ],
 "exercices": [
  {
   "id": "A1",
   "type": "zone",
   "titre": "Poser la zone de vente",
   "consigne": "Graphique 30 minutes, clôture de la veille en pointillé. Glisse la bande sur la zone de vente la plus travaillée, celle que tu mettrais dans ton plan.",
   "ut": "30 min",
   "symbole": "ES · S&P 500",
   "heure_debut": "Lun. 02:00",
   "graine": 11,
   "n": 80,
   "cv": 6977.5,
   "chemin": [
    [
     6958,
     0
    ],
    [
     6975.5,
     10
    ],
    [
     6966,
     17
    ],
    [
     6975.75,
     25
    ],
    [
     6960,
     33
    ],
    [
     6990,
     42
    ],
    [
     6968,
     50
    ],
    [
     6975.25,
     57
    ],
    [
     6963,
     66
    ],
    [
     6970,
     72
    ],
    [
     6961,
     79
    ]
   ],
   "bougies": {
    "10": {
     "o": 6974.5,
     "h": 6975.5,
     "l": 6971.25,
     "c": 6972
    },
    "25": {
     "o": 6974.75,
     "h": 6975.75,
     "l": 6971.5,
     "c": 6972.25
    },
    "42": {
     "o": 6986,
     "h": 6990,
     "l": 6982.5,
     "c": 6983
    },
    "57": {
     "o": 6974.25,
     "h": 6975.5,
     "l": 6970.75,
     "c": 6971.5
    }
   },
   "bande": {
    "hauteur": 4,
    "depart": 6950
   },
   "attendu": {
    "centre": 6975.5,
    "marge": 1.5
   },
   "explication": "La zone des 6 975 : un sommet 4 heures repris deux fois en 30 minutes, trois rejets au même niveau, et la clôture de la veille à deux points. C'est la confluence que la méthode cherche.",
   "pieges": [
    {
     "prix": 6990,
     "texte": "Le sommet de 6 990 n'a été touché qu'une fois : le marché n'y est jamais revenu. Un niveau travaillé une fois n'est pas une zone."
    },
    {
     "prix": 6961,
     "texte": "Les creux entre 6 960 et 6 963 ne sont pas alignés : pas de double creux, pas de zone, et de toute façon ce serait une zone d'achat."
    }
   ]
  },
  {
   "id": "A2",
   "type": "zone",
   "titre": "Poser la zone d'achat",
   "consigne": "Graphique 30 minutes, clôture de la veille en pointillé. Glisse la bande sur la zone d'achat la plus travaillée.",
   "ut": "30 min",
   "symbole": "ES · S&P 500",
   "heure_debut": "Mar. 02:00",
   "graine": 23,
   "n": 80,
   "cv": 6943.75,
   "chemin": [
    [
     6955,
     0
    ],
    [
     6942,
     8
    ],
    [
     6951,
     15
    ],
    [
     6941.75,
     22
    ],
    [
     6953.5,
     29
    ],
    [
     6935,
     36
    ],
    [
     6947,
     42
    ],
    [
     6942.25,
     48
    ],
    [
     6958,
     58
    ],
    [
     6953,
     63
    ],
    [
     6962,
     70
    ],
    [
     6956,
     79
    ]
   ],
   "bougies": {
    "8": {
     "o": 6943,
     "h": 6945.5,
     "l": 6942,
     "c": 6945
    },
    "22": {
     "o": 6942.75,
     "h": 6945.25,
     "l": 6941.75,
     "c": 6944.75
    },
    "36": {
     "o": 6938.5,
     "h": 6941,
     "l": 6935,
     "c": 6940.5
    },
    "48": {
     "o": 6943.5,
     "h": 6946,
     "l": 6942.25,
     "c": 6945.5
    }
   },
   "bande": {
    "hauteur": 4,
    "depart": 6962
   },
   "attendu": {
    "centre": 6942.25,
    "marge": 1.5
   },
   "explication": "La zone des 6 942 : deux creux au même niveau, puis un pullback qui est revenu s'y poser avant de repartir, et la clôture de la veille à 6 943,75 en confluence. Trois fois travaillée, c'est la zone d'achat du plan.",
   "pieges": [
    {
     "prix": 6935,
     "texte": "Le plus bas absolu, 6 935, n'a été touché qu'une fois, sur une mèche. Le marché n'y est pas revenu : ce n'est pas une zone, c'est un extrême."
    },
    {
     "prix": 6952,
     "texte": "Les sommets de 6 951 et 6 953,50 ne sont pas alignés, et ce seraient des zones de vente. L'énoncé demande la zone d'achat."
    }
   ]
  },
  {
   "id": "B1",
   "type": "entrees",
   "titre": "Repérer l'entrée à l'achat",
   "consigne": "Graphique 1 minute, ta zone d'achat du plan en bande dorée, moyenne mobile 20 tracée. Cinq bougies sont marquées : coche celles que tu prendrais à l'achat. Chaque candidat se juge seul, comme si c'était le premier trade de la séance.",
   "ut": "1 min",
   "symbole": "ES · S&P 500",
   "heure_debut": "15:35",
   "graine": 37,
   "n": 70,
   "sens": "achat",
   "zone": {
    "bas": 6961,
    "haut": 6964
   },
   "chemin": [
    [
     6975,
     0
    ],
    [
     6962.5,
     14
    ],
    [
     6971,
     24
    ],
    [
     6975,
     30
    ],
    [
     6966,
     38
    ],
    [
     6963,
     44
    ],
    [
     6970,
     50
    ],
    [
     6962,
     57
    ],
    [
     6966,
     62
    ],
    [
     6962,
     66
    ],
    [
     6968,
     69
    ]
   ],
   "bougies": {
    "14": {
     "o": 6962.75,
     "h": 6963.75,
     "l": 6958.5,
     "c": 6963.25
    },
    "30": {
     "o": 6975.25,
     "h": 6976,
     "l": 6972.5,
     "c": 6975.75
    },
    "44": {
     "o": 6961.5,
     "h": 6964.75,
     "l": 6961.25,
     "c": 6964.5
    },
    "57": {
     "o": 6963,
     "h": 6964,
     "l": 6953.25,
     "c": 6963.5
    },
    "66": {
     "o": 6962.25,
     "h": 6963.25,
     "l": 6959.5,
     "c": 6962.75
    }
   },
   "candidats": [
    {
     "i": 14,
     "lettre": "A",
     "bon": true,
     "texte": "Marteau dans la zone : entrée 0,25 au-dessus du corps à 6 963,50, stop 1,25 sous le plus bas à 6 957,25, soit 6,25 points. Dans la fourchette 2 à 8."
    },
    {
     "i": 30,
     "lettre": "B",
     "bon": false,
     "texte": "Un marteau propre, mais douze points au-dessus de la zone. Pas de zone, pas de trade."
    },
    {
     "i": 44,
     "lettre": "C",
     "bon": false,
     "texte": "Une grande bougie verte sans mèche basse : c'est une continuation, pas un retournement. Rien n'a été rejeté."
    },
    {
     "i": 57,
     "lettre": "D",
     "bon": false,
     "texte": "Marteau dans la zone, mais sa mèche descend à 6 953,25 : stop à 6 952, soit 11,75 points sous l'entrée. Trop cher, pas de signal."
    },
    {
     "i": 66,
     "lettre": "E",
     "bon": true,
     "texte": "Second retournement sur la même zone, après un retest : entrée 6 963, stop 6 958,25, 4,75 points. Le genre d'entrée que Manu prend « facilement »."
    }
   ]
  },
  {
   "id": "B2",
   "type": "entrees",
   "titre": "Repérer l'entrée à la vente",
   "consigne": "Graphique 1 minute, ta zone de vente du plan en bande dorée, moyenne mobile 20 tracée, une annonce à 16 h 00. Cinq bougies sont marquées : coche celles que tu prendrais à la vente.",
   "ut": "1 min",
   "symbole": "ES · S&P 500",
   "heure_debut": "15:20",
   "graine": 41,
   "n": 70,
   "sens": "vente",
   "zone": {
    "bas": 7012,
    "haut": 7015
   },
   "annonce": {
    "i": 40,
    "texte": "Annonce 16 h 00"
   },
   "chemin": [
    [
     7000,
     0
    ],
    [
     7013.5,
     12
    ],
    [
     7005,
     20
    ],
    [
     7003,
     26
    ],
    [
     7010,
     34
    ],
    [
     7013,
     39
    ],
    [
     7006,
     41
    ],
    [
     7009,
     46
    ],
    [
     7014,
     52
    ],
    [
     7008,
     58
    ],
    [
     7013.5,
     64
    ],
    [
     7004,
     69
    ]
   ],
   "bougies": {
    "12": {
     "o": 7012.75,
     "h": 7017.5,
     "l": 7012,
     "c": 7012.25
    },
    "26": {
     "o": 7003.5,
     "h": 7006.5,
     "l": 7002.75,
     "c": 7003
    },
    "40": {
     "o": 7014,
     "h": 7014.25,
     "l": 7005.5,
     "c": 7006
    },
    "52": {
     "o": 7013,
     "h": 7024,
     "l": 7012.25,
     "c": 7012.5
    },
    "64": {
     "o": 7013.25,
     "h": 7016,
     "l": 7011.5,
     "c": 7013.25
    }
   },
   "candidats": [
    {
     "i": 12,
     "lettre": "A",
     "bon": true,
     "texte": "Étoile filante dans la zone : entrée 0,25 sous le corps à 7 012, stop 1,25 au-dessus du plus haut à 7 018,75, soit 6,75 points."
    },
    {
     "i": 26,
     "lettre": "B",
     "bon": false,
     "texte": "Une étoile filante, mais neuf points sous la zone, en plein « entre deux ». Pas de zone, pas de trade."
    },
    {
     "i": 40,
     "lettre": "C",
     "bon": false,
     "texte": "La bougie de l'annonce de 16 h : une impulsion, pas un retournement, et on ne trade pas pendant une annonce à fort impact."
    },
    {
     "i": 52,
     "lettre": "D",
     "bon": false,
     "texte": "Étoile filante dans la zone, mais la mèche monte à 7 024 : stop à 7 025,25, treize points au-dessus de l'entrée. Trop cher."
    },
    {
     "i": 64,
     "lettre": "E",
     "bon": true,
     "texte": "Un doji dans la zone, après un retest : « c'est plus un doji, mais on a osé le prendre parce qu'on était sur une bonne zone » (5.7, exemple 6). Entrée 7 013, stop 7 017,25, 4,25 points."
    }
   ]
  }
 ]
};
})();
