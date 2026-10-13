/**
 * LES QUIZ DE MODULE. ⛔ FICHIER ENGENDRE, NE PAS EDITER A LA MAIN.
 *
 * Produit par `node outils/formation-quiz-import.mjs --ecrire` depuis les
 * fichiers `_contenu-formation/quiz-module-*.md`, qui sont la source : une
 * question se corrige la-bas, puis on relance l outil.
 *
 * Forme : { '01': { titre, seuil, questions: [ { id, type, enonce, options,
 * bonne, renvoi: { lecon, de, a }, conseil } ] } }
 *   type     'choix' (quatre options) ou 'vraifaux' (deux)
 *   bonne    l index de la bonne option, AVANT melange : l ecran melange
 *   renvoi   la lecon a revoir et la fourchette de minutes
 *
 * ⚠️ Les bonnes reponses sont lisibles ici, et c est assume : voir l en-tete
 * de l outil.
 */
(function () {
  'use strict';
  const racine = typeof window !== 'undefined' ? window : globalThis;
  racine.FORMATION_QUIZ = {
 "01": {
  "titre": "Se préparer mentalement et comprendre les bases du trading",
  "seuil": 0.8,
  "questions": [
   {
    "id": "q01-1",
    "type": "choix",
    "enonce": "Dès l'introduction, Manu donne sa « phrase fétiche », celle qui doit servir de carburant à ta réussite. Laquelle ?",
    "options": [
     "Vis ta vie comme tu aimerais la raconter.",
     "Le trading, c'est le miroir de qui tu es.",
     "Ce sont les impatients qui payent les patients.",
     "Le marché récompense la constance, pas le génie."
    ],
    "bonne": 0,
    "renvoi": {
     "lecon": "m01-l0",
     "de": 3,
     "a": 6
    },
    "conseil": "Les trois autres phrases sont aussi dans le module, mais pas à cette place. Celle-ci est donnée dès l'introduction comme le carburant de ta réussite."
   },
   {
    "id": "q01-2",
    "type": "choix",
    "enonce": "Selon le chapitre 1.1, pourquoi 95 % des traders abandonnent-ils dans les douze premiers mois ?",
    "options": [
     "Parce que leur stratégie n'est pas assez rentable.",
     "Parce qu'ils manquent de capital de départ.",
     "Parce qu'ils sont mal préparés mentalement.",
     "Parce qu'ils ont choisi une mauvaise plateforme."
    ],
    "bonne": 2,
    "renvoi": {
     "lecon": "m01-l1",
     "de": 1,
     "a": 3
    },
    "conseil": "Ce n'est pas une question de stratégie, c'est une question de mental, de posture, de rapport à la perte et au doute."
   },
   {
    "id": "q01-3",
    "type": "choix",
    "enonce": "Le Trader 360 s'appuie sur cinq piliers mentaux. Lequel de ces quatre n'en fait pas partie ?",
    "options": [
     "La responsabilité totale.",
     "La maîtrise du levier.",
     "L'acceptation de l'incertitude.",
     "La patience active."
    ],
    "bonne": 1,
    "renvoi": {
     "lecon": "m01-l1",
     "de": 2,
     "a": 5
    },
    "conseil": "Les cinq piliers sont la responsabilité totale, le respect du processus, l'acceptation de l'incertitude, la patience active et la progression constante. Le levier est une question technique, pas un pilier mental."
   },
   {
    "id": "q01-4",
    "type": "vraifaux",
    "enonce": "Attendre représente 80 à 90 % de l'activité d'un trader.",
    "options": [
     "Vrai",
     "Faux"
    ],
    "bonne": 0,
    "renvoi": {
     "lecon": "m01-l1",
     "de": 3,
     "a": 5
    },
    "conseil": "C'est le pilier de la patience active : tu n'es pas payé à cliquer le plus souvent possible, tu es payé à attendre le bon moment."
   },
   {
    "id": "q01-5",
    "type": "vraifaux",
    "enonce": "Avec un bon rapport risque / rendement, on peut être gagnant en n'ayant raison que sur 20 % de ses positions.",
    "options": [
     "Vrai",
     "Faux"
    ],
    "bonne": 0,
    "renvoi": {
     "lecon": "m01-l1",
     "de": 4,
     "a": 6
    },
    "conseil": "C'est la première fausse croyance à désinstaller : « je dois avoir raison pour gagner ». Le risk reward fait que tu peux perdre souvent et rester gagnant."
   },
   {
    "id": "q01-6",
    "type": "choix",
    "enonce": "Le Trader 360 distingue trois niveaux d'objectifs. Lesquels ?",
    "options": [
     "Court terme, moyen terme, long terme.",
     "Objectif de vie, objectif de trading, objectif de progression.",
     "Capital, revenu, liberté.",
     "Technique, mental, financier."
    ],
    "bonne": 1,
    "renvoi": {
     "lecon": "m01-l2",
     "de": 1,
     "a": 5
    },
    "conseil": "L'objectif de vie dit pourquoi tu es là, l'objectif de trading fixe ton rythme et ton approche, l'objectif de progression te garde humble."
   },
   {
    "id": "q01-7",
    "type": "vraifaux",
    "enonce": "Le financement par une prop firm est un objectif de vie en soi.",
    "options": [
     "Vrai",
     "Faux"
    ],
    "bonne": 1,
    "renvoi": {
     "lecon": "m01-l2",
     "de": 7,
     "a": 10
    },
    "conseil": "C'est l'un des pièges classiques : confondre les moyens et les objectifs. Une prop firm, comme vivre du trading, est un moyen. L'objectif, c'est ce que tu en fais : du temps, des proches, des voyages."
   },
   {
    "id": "q01-8",
    "type": "choix",
    "enonce": "Quels sont les trois piliers de la discipline, version Trader 360 ?",
    "options": [
     "Plan, stop, objectif.",
     "Routine, journal, checklist.",
     "Clarté, engagement, environnement.",
     "Patience, humilité, courage."
    ],
    "bonne": 2,
    "renvoi": {
     "lecon": "m01-l3",
     "de": 2,
     "a": 6
    },
    "conseil": "La clarté élimine l'hésitation, l'engagement se décide avant la séance, et l'environnement, c'est le lieu, le bruit, et les gens qui t'entourent."
   },
   {
    "id": "q01-9",
    "type": "choix",
    "enonce": "Pour commencer, quelle durée maximale de séance Manu te fixe-t-il ?",
    "options": [
     "45 minutes.",
     "1 h 20.",
     "2 heures.",
     "4 heures."
    ],
    "bonne": 2,
    "renvoi": {
     "lecon": "m01-l3",
     "de": 7,
     "a": 9
    },
    "conseil": "Deux heures maximum pour commencer. Le 1 h 20, c'est le seuil personnel de Manu, celui où son attention baisse. À toi de trouver le tien, en te connaissant."
   },
   {
    "id": "q01-10",
    "type": "choix",
    "enonce": "Qu'est-ce que le « trade revanchard » ?",
    "options": [
     "Renforcer une position déjà gagnante.",
     "Reprendre un trade pour rattraper une perte qu'on n'a pas acceptée.",
     "Trader contre la tendance de fond.",
     "Sortir d'un trade avant son objectif."
    ],
    "bonne": 1,
    "renvoi": {
     "lecon": "m01-l3",
     "de": 8,
     "a": 11
    },
    "conseil": "Le trade revanchard ouvre la porte à l'over trading, au décalage des stops et aux renforcements sur des positions négatives. C'est la spirale à s'interdire."
   },
   {
    "id": "q01-11",
    "type": "choix",
    "enonce": "L'exercice de cohérence cardiaque recommandé avant la séance, c'est :",
    "options": [
     "Dix respirations profondes, les yeux fermés.",
     "Cinq secondes d'inspiration, cinq secondes d'expiration, pendant cinq minutes.",
     "Quatre secondes d'inspiration, sept de rétention, huit d'expiration.",
     "Deux minutes de respiration rapide pour s'activer."
    ],
    "bonne": 1,
    "renvoi": {
     "lecon": "m01-l4",
     "de": 3,
     "a": 5
    },
    "conseil": "Cinq, cinq, cinq. C'est gratuit, et des études montrent une baisse du cortisol, l'hormone du stress, d'environ 30 %."
   },
   {
    "id": "q01-12",
    "type": "choix",
    "enonce": "Le protocole d'urgence de la feuille anti-stress tient en trois mots. Lesquels ?",
    "options": [
     "Je ferme, je note, je dors.",
     "Je réduis, je double, je sors.",
     "Je respire, je coupe, je reviens.",
     "J'attends, j'analyse, je rentre."
    ],
    "bonne": 2,
    "renvoi": {
     "lecon": "m01-l4",
     "de": 13,
     "a": 15
    },
    "conseil": "La feuille d'urgence se prépare à l'avance et se garde à portée de main : trois phrases de recentrage, une photo ou un son qui apaise, et le protocole. Le jour où tu dérapes, tu ne réfléchis pas, tu appliques."
   },
   {
    "id": "q01-13",
    "type": "vraifaux",
    "enonce": "Pour être efficace, une routine mentale doit durer au moins trente minutes.",
    "options": [
     "Vrai",
     "Faux"
    ],
    "bonne": 1,
    "renvoi": {
     "lecon": "m01-l5",
     "de": 7,
     "a": 9
    },
    "conseil": "Croire qu'il faut une routine de deux heures est la première erreur citée. Manu préfère une routine de deux minutes à zéro routine ; la sienne dure dix minutes. Elle doit être simple, répétable, et faite tous les jours."
   },
   {
    "id": "q01-14",
    "type": "choix",
    "enonce": "Quelles sont les quatre conditions pour entrer dans la zone ?",
    "options": [
     "Un capital, un courtier, une stratégie, un mentor.",
     "Un plan clair, accepter l'incertitude, être reposé et lucide, avoir ritualisé son approche.",
     "Un objectif de gain, un stop, un take profit, un journal.",
     "La motivation, la confiance, l'expérience, la chance."
    ],
    "bonne": 1,
    "renvoi": {
     "lecon": "m01-l6",
     "de": 4,
     "a": 7
    },
    "conseil": "La zone ne vient pas par hasard, elle se crée. La routine du 1.5 en est le sas de sécurité."
   },
   {
    "id": "q01-15",
    "type": "choix",
    "enonce": "Lequel de ces signaux indique que tu es sorti de la zone ?",
    "options": [
     "Tu ne regardes pas les gains en cours.",
     "Tu ressens un alignement entre ton plan, ton action et ton émotion.",
     "Tu regardes ton equity toutes les dix secondes.",
     "Tu te sens calme et ancré."
    ],
    "bonne": 2,
    "renvoi": {
     "lecon": "m01-l6",
     "de": 7,
     "a": 9
    },
    "conseil": "L'obsession de l'equity, la validation externe, la vengeance du marché, les émotions excessives et l'impulsivité sont les cinq signaux de sortie de zone. Dans ce cas : stop, tu sors, tu respires, tu reviens plus tard."
   }
  ]
 },
 "02": {
  "titre": "Comprendre le trading",
  "seuil": 0.8,
  "questions": [
   {
    "id": "q02-1",
    "type": "choix",
    "enonce": "Dans la répartition des acteurs du marché donnée au chapitre 2.1, quelle part représentent les particuliers, le « retail » ?",
    "options": [
     "Moins de 20 %.",
     "Environ 45 %.",
     "La moitié.",
     "Moins de 2 %."
    ],
    "bonne": 0,
    "renvoi": {
     "lecon": "m02-l1",
     "de": 6,
     "a": 8
    },
    "conseil": "Les institutionnels pèsent environ 45 %, les banques centrales 25 %, les hedge funds 15 %, les algorithmes 10 %. Le particulier est minoritaire, et c'est pour ça qu'on suit les plus gros."
   },
   {
    "id": "q02-2",
    "type": "choix",
    "enonce": "Quel style de trading Trader 360 privilégie-t-il ?",
    "options": [
     "Le swing trading.",
     "Le scalping.",
     "Le position trading.",
     "Le day trading."
    ],
    "bonne": 1,
    "renvoi": {
     "lecon": "m02-l1",
     "de": 7,
     "a": 12
    },
    "conseil": "Des positions de quelques secondes à quelques minutes, jamais ouvertes après 22 h ou 23 h, et le compte connu à chaque fin de journée."
   },
   {
    "id": "q02-3",
    "type": "choix",
    "enonce": "Pourquoi le swing trading est-il compliqué en prop firm sur les futures ?",
    "options": [
     "Parce qu'il demande TradingView en version payante.",
     "Parce qu'on n'a pas le droit de garder une position la nuit.",
     "Parce que les indices ne sont pas assez volatils.",
     "Parce qu'il est interdit aux particuliers en Europe."
    ],
    "bonne": 1,
    "renvoi": {
     "lecon": "m02-l1",
     "de": 9,
     "a": 11
    },
    "conseil": "Le swing suppose de garder une position des jours ou des semaines. Les prop firms en futures imposent de fermer entre 22 h et 23 h, ce qui l'exclut."
   },
   {
    "id": "q02-4",
    "type": "choix",
    "enonce": "Compte financé de 100 000 $, partage à 90 %, tu génères 5 000 $ dans le mois. Combien touches-tu ?",
    "options": [
     "5 000 $.",
     "500 $.",
     "4 500 $.",
     "3 500 $."
    ],
    "bonne": 2,
    "renvoi": {
     "lecon": "m02-l2",
     "de": 1,
     "a": 3
    },
    "conseil": "90 % de 5 000 $, soit 4 500 $, pour zéro capital personnel engagé. Le partage varie de 70 à 100 % selon les prop firms."
   },
   {
    "id": "q02-5",
    "type": "choix",
    "enonce": "Le business plan d'une prop firm repose sur trois piliers. Lequel n'en fait pas partie ?",
    "options": [
     "Les challenges ratés, payés par ceux qui échouent.",
     "La part prélevée sur les gains des bons traders.",
     "Les abonnements à la plateforme de graphiques.",
     "La data des traders rentables, reproduite sur de plus gros comptes."
    ],
    "bonne": 2,
    "renvoi": {
     "lecon": "m02-l2",
     "de": 10,
     "a": 12
    },
    "conseil": "Les trois piliers sont les challenges ratés, les 10 à 30 % prélevés sur les gains, et la data. La plateforme de graphiques n'a rien à voir avec le modèle économique de la prop firm."
   },
   {
    "id": "q02-6",
    "type": "choix",
    "enonce": "Sur le calendrier économique d'Investing, que signifient les trois étoiles ?",
    "options": [
     "Les annonces européennes.",
     "Les annonces dont l'impact attendu est le plus fort.",
     "Les annonces déjà publiées.",
     "Les annonces favorables au marché."
    ],
    "bonne": 1,
    "renvoi": {
     "lecon": "m02-l3",
     "de": 3,
     "a": 5
    },
    "conseil": "Trois niveaux d'impact, faible, moyen, fort. Les trois étoiles sont celles qui font bouger le marché, surtout côté US."
   },
   {
    "id": "q02-7",
    "type": "choix",
    "enonce": "Quelle annonce tombe généralement le premier vendredi du mois, à 14 h 30 heure française ?",
    "options": [
     "La décision du FOMC.",
     "L'IPC, l'inflation.",
     "Les NFP, les emplois américains.",
     "Le PMI."
    ],
    "bonne": 2,
    "renvoi": {
     "lecon": "m02-l3",
     "de": 5,
     "a": 7
    },
    "conseil": "Les NFP sont parmi les annonces les plus volatiles. Le FOMC, lui, tombe le mercredi soir à 20 h, avec la conférence de la Fed à 20 h 30."
   },
   {
    "id": "q02-8",
    "type": "vraifaux",
    "enonce": "Si le setup est bon, on peut trader pendant une annonce à fort impact.",
    "options": [
     "Vrai",
     "Faux"
    ],
    "bonne": 1,
    "renvoi": {
     "lecon": "m02-l3",
     "de": 5,
     "a": 6
    },
    "conseil": "Jamais pendant. On observe la réaction, et on trade éventuellement une demi-heure ou une heure après. Certaines prop firms interdisent même les minutes qui précèdent et qui suivent."
   },
   {
    "id": "q02-9",
    "type": "choix",
    "enonce": "Pour qu'un support ou une résistance soit valide, combien de fois le prix doit-il l'avoir touché, au minimum ?",
    "options": [
     "Une fois.",
     "Deux fois.",
     "Trois fois.",
     "Cinq fois."
    ],
    "bonne": 1,
    "renvoi": {
     "lecon": "m02-l5",
     "de": 9,
     "a": 11
    },
    "conseil": "Deux touches minimum. Deux touches sur une résistance font un double top, deux sur un support un double bottom."
   },
   {
    "id": "q02-10",
    "type": "choix",
    "enonce": "Une résistance est dépassée, puis le prix revient se poser dessus. Que devient-elle ?",
    "options": [
     "Un support.",
     "Une zone neutre.",
     "Elle disparaît.",
     "Un range."
    ],
    "bonne": 0,
    "renvoi": {
     "lecon": "m02-l5",
     "de": 10,
     "a": 11
    },
    "conseil": "Une résistance franchie puis retestée devient un support. Et l'inverse vaut pour un support cassé."
   },
   {
    "id": "q02-11",
    "type": "choix",
    "enonce": "Un marteau avec une grande mèche en bas et un petit corps rouge, c'est :",
    "options": [
     "Une bougie vendeuse, puisqu'elle est rouge.",
     "Une bougie d'indécision.",
     "Une bougie acheteuse, quelle que soit sa couleur.",
     "Un marubozu."
    ],
    "bonne": 2,
    "renvoi": {
     "lecon": "m02-l6",
     "de": 3,
     "a": 6
    },
    "conseil": "C'est le piège classique des débutants. La grande mèche basse dit que les acheteurs ont rejeté la baisse dans l'unité de temps. Rouge ou verte, le marteau est acheteur ; le marteau inversé est vendeur."
   },
   {
    "id": "q02-12",
    "type": "choix",
    "enonce": "Dans la méthode Trader 360, quelle unité de temps sert à lire la tendance de fond ?",
    "options": [
     "1 minute.",
     "5 minutes.",
     "30 minutes.",
     "4 heures."
    ],
    "bonne": 3,
    "renvoi": {
     "lecon": "m02-l6",
     "de": 8,
     "a": 11
    },
    "conseil": "Le 4 heures donne la tendance de fond, le 30 minutes la structure court terme et les zones, le 5 minutes les zones intermédiaires, la minute le timing d'entrée. On n'interprète jamais une bougie M1 ou M5 sans avoir vu le 4 heures et le 30 minutes."
   },
   {
    "id": "q02-13",
    "type": "choix",
    "enonce": "Qu'appelle-t-on une confluence ?",
    "options": [
     "Deux bougies consécutives de la même couleur.",
     "Plusieurs niveaux ou indicateurs qui tombent sur la même zone.",
     "Le croisement de deux moyennes mobiles.",
     "Un support et une résistance au même prix."
    ],
    "bonne": 1,
    "renvoi": {
     "lecon": "m02-l8",
     "de": 5,
     "a": 7
    },
    "conseil": "Un creux en 4 heures, la clôture de la veille, un niveau psychologique et le POC au même endroit : plus il y a de niveaux, plus la probabilité de retournement est forte."
   },
   {
    "id": "q02-14",
    "type": "choix",
    "enonce": "Comment place-t-on la clôture de la veille du marché américain, en heure française ?",
    "options": [
     "La clôture de la bougie de 17 h 30.",
     "L'ouverture de la bougie de 15 h 30.",
     "La clôture de la bougie de 21 h 30, ou l'ouverture de celle de 22 h.",
     "La clôture de la bougie de 23 h."
    ],
    "bonne": 2,
    "renvoi": {
     "lecon": "m02-l9",
     "de": 1,
     "a": 3
    },
    "conseil": "Le marché US ferme à 22 h heure française. Attention aux semaines de décalage entre heure d'été et heure d'hiver, où la clôture peut tomber à 21 h ou 23 h."
   },
   {
    "id": "q02-15",
    "type": "choix",
    "enonce": "Quelle tranche horaire concentre l'explosion des volumes américains ?",
    "options": [
     "9 h à 11 h.",
     "15 h 30 à 17 h 30.",
     "20 h à 22 h.",
     "8 h à 9 h."
    ],
    "bonne": 1,
    "renvoi": {
     "lecon": "m02-l9",
     "de": 5,
     "a": 8
    },
    "conseil": "De 14 h à 15 h 30, c'est la préouverture US ; de 15 h 30 à 17 h 30, les gros acteurs entrent et la volatilité explose ; de 17 h 30 à 20 h, transition et consolidation."
   }
  ]
 },
 "03": {
  "titre": "Maîtriser tes indicateurs, et rien de plus",
  "seuil": 0.8,
  "questions": [
   {
    "id": "q03-1",
    "type": "choix",
    "enonce": "Combien d'indicateurs la méthode Trader 360 utilise-t-elle ?",
    "options": [
     "Autant que nécessaire, selon le marché.",
     "Quatre, cinq si on compte la clôture de la veille.",
     "Deux.",
     "Une dizaine."
    ],
    "bonne": 1,
    "renvoi": {
     "lecon": "m03-l0",
     "de": 1,
     "a": 3
    },
    "conseil": "Points pivots, bandes de Bollinger avec les moyennes mobiles 20 et 100, VWAP, POC et Market Profile. La clôture de la veille est un niveau plus qu'un indicateur. La puissance est dans la simplicité."
   },
   {
    "id": "q03-2",
    "type": "choix",
    "enonce": "Comment se calcule le point pivot journalier ?",
    "options": [
     "La moyenne des vingt dernières clôtures.",
     "L'ouverture plus la clôture de la veille, divisées par deux.",
     "Le plus haut, le plus bas et la clôture de la veille, additionnés et divisés par trois.",
     "Le prix moyen pondéré par les volumes."
    ],
    "bonne": 2,
    "renvoi": {
     "lecon": "m03-l1",
     "de": 1,
     "a": 3
    },
    "conseil": "Tu n'auras jamais à le calculer, l'indicateur le fait. Mais il faut savoir que tout part de la journée précédente : plus haut, plus bas, clôture."
   },
   {
    "id": "q03-3",
    "type": "choix",
    "enonce": "Que sont S2 et R2 ?",
    "options": [
     "La boussole centrale de la journée.",
     "Des zones de rebond testées dès le matin.",
     "Des zones d'extension, avec un retournement possible si le mouvement s'essouffle.",
     "Des zones extrêmes rarement atteintes."
    ],
    "bonne": 2,
    "renvoi": {
     "lecon": "m03-l1",
     "de": 2,
     "a": 4
    },
    "conseil": "Le point pivot est la boussole, S1 et R1 les zones de rebond fréquentes, S2 et R2 les extensions, S3 et R3 les extrêmes, rarement atteints et signe d'une puissance de marché inhabituelle."
   },
   {
    "id": "q03-4",
    "type": "vraifaux",
    "enonce": "Un point pivot touché est, à lui seul, un signal d'achat ou de vente.",
    "options": [
     "Vrai",
     "Faux"
    ],
    "bonne": 1,
    "renvoi": {
     "lecon": "m03-l1",
     "de": 4,
     "a": 6
    },
    "conseil": "Un point pivot est une zone de réaction potentielle, jamais une certitude. Sa puissance se révèle en confluence avec d'autres niveaux : un plus bas, la clôture de la veille, la VWAP, le POC."
   },
   {
    "id": "q03-5",
    "type": "choix",
    "enonce": "Qu'y a-t-il au milieu des bandes de Bollinger ?",
    "options": [
     "La VWAP.",
     "La moyenne mobile 100.",
     "La moyenne mobile 20.",
     "Le POC."
    ],
    "bonne": 2,
    "renvoi": {
     "lecon": "m03-l2",
     "de": 1,
     "a": 3
    },
    "conseil": "Les bandes de Bollinger sont construites autour de la moyenne mobile 20, quelle que soit l'unité de temps. La moyenne mobile 100 est une ligne à part."
   },
   {
    "id": "q03-6",
    "type": "choix",
    "enonce": "Les bandes de Bollinger se resserrent. Qu'est-ce que ça indique ?",
    "options": [
     "Une tendance forte est installée.",
     "Le marché est suracheté.",
     "Le marché est en contraction, souvent avant une grosse impulsion.",
     "Il faut vendre immédiatement."
    ],
    "bonne": 2,
    "renvoi": {
     "lecon": "m03-l2",
     "de": 4,
     "a": 5
    },
    "conseil": "Les bandes mesurent la volatilité. Resserrées, c'est le calme qui précède la tempête, et le marché n'aime pas rester sur le même niveau. Écartées, c'est l'élastique tendu, proche d'un retournement."
   },
   {
    "id": "q03-7",
    "type": "choix",
    "enonce": "La moyenne mobile 100 posée sur le graphique 1 minute correspond à :",
    "options": [
     "La moyenne mobile 20 du 4 heures.",
     "La moyenne mobile 20 du 5 minutes.",
     "La VWAP du 5 minutes.",
     "La moyenne mobile 100 du 30 minutes."
    ],
    "bonne": 1,
    "renvoi": {
     "lecon": "m03-l2",
     "de": 2,
     "a": 4
    },
    "conseil": "Cent bougies d'une minute, c'est vingt bougies de cinq minutes. C'est pour ça qu'on la garde dans la configuration en scalping."
   },
   {
    "id": "q03-8",
    "type": "choix",
    "enonce": "Comment sont calculées les bandes supérieure et inférieure ?",
    "options": [
     "Le plus haut et le plus bas des vingt dernières bougies.",
     "La moyenne mobile 20, plus ou moins deux écarts types.",
     "La moyenne mobile 20, plus ou moins 1 %.",
     "La moyenne mobile 100, plus ou moins un écart type."
    ],
    "bonne": 1,
    "renvoi": {
     "lecon": "m03-l2",
     "de": 3,
     "a": 5
    },
    "conseil": "L'écart type mesure la dispersion des prix autour de la moyenne. Plus la volatilité est grande, plus les bandes s'écartent."
   },
   {
    "id": "q03-9",
    "type": "vraifaux",
    "enonce": "Quand la VWAP est plate, elle reste un bon niveau de retournement.",
    "options": [
     "Vrai",
     "Faux"
    ],
    "bonne": 1,
    "renvoi": {
     "lecon": "m03-l3",
     "de": 3,
     "a": 5
    },
    "conseil": "Une VWAP plate n'est pas un signal assez fort, il faut même l'écarter. Elle s'utilise dans un flux avec une vraie tendance et de la volatilité, et jamais seule."
   },
   {
    "id": "q03-10",
    "type": "choix",
    "enonce": "Le POC, c'est :",
    "options": [
     "La clôture de la veille.",
     "Le plus haut de la veille.",
     "Le niveau de prix où le marché a passé le plus de temps et de volume la veille.",
     "Le point pivot journalier."
    ],
    "bonne": 2,
    "renvoi": {
     "lecon": "m03-l4",
     "de": 0,
     "a": 3
    },
    "conseil": "Le point de contrôle est le niveau le plus travaillé de la veille, un aimant vers lequel le prix tend à revenir. On retient toujours le POC volume, pas le POC de temps."
   },
   {
    "id": "q03-11",
    "type": "choix",
    "enonce": "Si le prix est au-dessus du POC, dans quelle zone est-on ?",
    "options": [
     "Zone discount.",
     "Zone neutre.",
     "Zone premium.",
     "Zone de range."
    ],
    "bonne": 2,
    "renvoi": {
     "lecon": "m03-l4",
     "de": 2,
     "a": 4
    },
    "conseil": "Au-dessus du POC, le prix est cher par rapport à la veille, c'est la zone premium ; en dessous, c'est la zone discount. Ça te dit si tu achètes trop cher ou vends trop bas."
   },
   {
    "id": "q03-12",
    "type": "choix",
    "enonce": "Sur Tradovate, quelle plage horaire règle-t-on pour le Market Profile ?",
    "options": [
     "9 h à 17 h 30.",
     "15 h 30 à 22 h, la session américaine en heure française.",
     "0 h à 24 h.",
     "14 h à 20 h."
    ],
    "bonne": 1,
    "renvoi": {
     "lecon": "m03-l4",
     "de": 4,
     "a": 6
    },
    "conseil": "Ouverture US à 15 h 30, fermeture à 22 h, heure française. Et attention aux jours fériés : le POC reste celui de la dernière séance réelle, pas de la veille calendaire."
   }
  ]
 },
 "04": {
  "titre": "Prendre en main ta plateforme de trading",
  "seuil": 0.8,
  "questions": [
   {
    "id": "q04-1",
    "type": "choix",
    "enonce": "Une plateforme de trading, c'est :",
    "options": [
     "L'entreprise qui détient ton compte et exécute tes ordres.",
     "L'outil qui te sert à analyser le marché et envoyer tes ordres, sans détenir tes fonds.",
     "La société qui finance ton compte.",
     "L'organisme qui régule les brokers."
    ],
    "bonne": 1,
    "renvoi": {
     "lecon": "m04-l1",
     "de": 0,
     "a": 2
    },
    "conseil": "La plateforme analyse et envoie, le broker détient et exécute. Les deux sont complémentaires, et c'est le broker qui prend les frais."
   },
   {
    "id": "q04-2",
    "type": "choix",
    "enonce": "Pourquoi Manu déconseille-t-il les brokers Market Maker ?",
    "options": [
     "Leurs commissions sont trop élevées.",
     "Ils ne proposent pas de CFD.",
     "Ils prennent la contrepartie de tes trades, donc ils gagnent quand tu perds.",
     "Ils n'acceptent pas les prop firms."
    ],
    "bonne": 2,
    "renvoi": {
     "lecon": "m04-l1",
     "de": 2,
     "a": 5
    },
    "conseil": "Le Market Maker ne transmet pas toujours au marché réel, d'où un conflit d'intérêt et une manipulation possible des prix. Le broker ECN / STP transmet au marché, sans conflit, mais coûte plus cher."
   },
   {
    "id": "q04-3",
    "type": "choix",
    "enonce": "Entre les CFD et les futures, lequel est le marché réel, avec un carnet d'ordres centralisé, le DOM ?",
    "options": [
     "Les CFD.",
     "Les deux.",
     "Les futures.",
     "Aucun des deux."
    ],
    "bonne": 2,
    "renvoi": {
     "lecon": "m04-l1",
     "de": 7,
     "a": 10
    },
    "conseil": "Les CFD reproduisent le prix d'un actif hors marché, avec des cotations qui varient selon les brokers. Les futures sont des contrats standardisés cotés sur un marché réglementé. C'est pour ça que tes prix en démo CFD diffèrent de ceux des lives."
   },
   {
    "id": "q04-4",
    "type": "vraifaux",
    "enonce": "Tradovate fournit un compte de démonstration illimité pour apprendre.",
    "options": [
     "Vrai",
     "Faux"
    ],
    "bonne": 1,
    "renvoi": {
     "lecon": "m04-l1",
     "de": 1,
     "a": 2
    },
    "conseil": "Tradovate n'offre qu'une démo de quatorze jours environ. C'est l'une des raisons pour lesquelles on apprend sur TradingView, gratuit et illimité."
   },
   {
    "id": "q04-5",
    "type": "choix",
    "enonce": "Quel symbole choisit-on sur TradingView pour s'entraîner ?",
    "options": [
     "ES1!, le future.",
     "SPY, l'ETF.",
     "SPX 500, chez FXCM.",
     "US500, chez n'importe quel fournisseur."
    ],
    "bonne": 2,
    "renvoi": {
     "lecon": "m04-l2",
     "de": 1,
     "a": 2
    },
    "conseil": "Dans la recherche, tape SPX 500 et prends la ligne FXCM, puis « Lancer graphique »."
   },
   {
    "id": "q04-6",
    "type": "choix",
    "enonce": "Combien d'indicateurs la version gratuite de TradingView autorise-t-elle ?",
    "options": [
     "Deux.",
     "Trois.",
     "Cinq.",
     "Autant qu'on veut."
    ],
    "bonne": 0,
    "renvoi": {
     "lecon": "m04-l2",
     "de": 10,
     "a": 12
    },
    "conseil": "Deux, et c'est suffisant : l'indicateur Trader 360, qui regroupe tout, plus la VWAP. Au troisième, TradingView propose le plan payant."
   },
   {
    "id": "q04-7",
    "type": "choix",
    "enonce": "Où trouve-t-on le code de l'indicateur Trader 360 à coller dans l'éditeur Pine ?",
    "options": [
     "Sur le site de TradingView, dans la bibliothèque publique.",
     "Dans le salon Discord « Code indicateur Club Trader 360 ».",
     "Dans les réglages de TradingView, il est préinstallé.",
     "Dans l'onglet Trade de TradingView."
    ],
    "bonne": 1,
    "renvoi": {
     "lecon": "m04-l2",
     "de": 7,
     "a": 9
    },
    "conseil": "Éditeur Pine, Créer, Nouveau, Indicateur, on supprime toutes les lignes, on colle le code entier, on enregistre, puis on ferme l'onglet pour ne plus y toucher."
   },
   {
    "id": "q04-8",
    "type": "choix",
    "enonce": "Que regroupe l'indicateur Trader 360, appelé Multi Pro ?",
    "options": [
     "La VWAP et le POC.",
     "La moyenne mobile 100 et le RSI.",
     "Les points pivots, la moyenne mobile 20 et les bandes de Bollinger.",
     "Le Market Profile et la clôture de la veille."
    ],
    "bonne": 2,
    "renvoi": {
     "lecon": "m04-l2",
     "de": 8,
     "a": 10
    },
    "conseil": "Sa VWAP intégrée n'est pas bonne, on la décoche. La vraie VWAP s'ajoute à part : « prix moyen pondéré par le volume », pas « VWAP auto-ancrée »."
   },
   {
    "id": "q04-9",
    "type": "choix",
    "enonce": "À combien règle-t-on le compte Paper Trading ?",
    "options": [
     "100 000 $, la valeur par défaut.",
     "50 000 $.",
     "10 000 $.",
     "25 000 $."
    ],
    "bonne": 1,
    "renvoi": {
     "lecon": "m04-l2",
     "de": 12,
     "a": 13
    },
    "conseil": "On crée un compte nommé par exemple « challenge1 » à 50 000 $, comme un compte de challenge, et pas les 100 000 $ par défaut."
   },
   {
    "id": "q04-10",
    "type": "vraifaux",
    "enonce": "Si tu prends un ordre sans placer ton stop et ton objectif dans le même ordre, le marché peut taper ton stop et laisser ton objectif actif, qui ouvrira alors une position inverse.",
    "options": [
     "Vrai",
     "Faux"
    ],
    "bonne": 0,
    "renvoi": {
     "lecon": "m04-l2",
     "de": 13,
     "a": 15
    },
    "conseil": "Quand SL et TP sont liés, le premier touché annule l'autre. Sinon, l'ordre restant devient un ordre de vente ou d'achat qui se déclenche tout seul. Oublier de fermer ses ordres peut coûter cher."
   },
   {
    "id": "q04-11",
    "type": "choix",
    "enonce": "À quelles heures ont lieu les lives trading sur le Discord ?",
    "options": [
     "8 h à 10 h, et 14 h à 16 h.",
     "7 h à 9 h, 9 h à 11 h, et 15 h à 17 h.",
     "9 h à 12 h seulement.",
     "15 h 30 à 22 h."
    ],
    "bonne": 1,
    "renvoi": {
     "lecon": "m04-l3",
     "de": 8,
     "a": 9
    },
    "conseil": "Trois créneaux, et le replay de chaque live est dans le salon dédié si tu l'as manqué."
   },
   {
    "id": "q04-12",
    "type": "choix",
    "enonce": "Quel stop maximal, en points, Nadir fixe-t-il sur le S&P 500 ?",
    "options": [
     "2 points.",
     "10 points.",
     "5,5 points, 6 grand maximum.",
     "20 points."
    ],
    "bonne": 2,
    "renvoi": {
     "lecon": "m04-l4",
     "de": 19,
     "a": 25
    },
    "conseil": "La plupart des trades tournent autour de 3,5 à 4 points. À 4,75 ou 5, le trade commence à être cher : pour garder le même risque en dollars, il faut moins de contrats."
   },
   {
    "id": "q04-13",
    "type": "choix",
    "enonce": "Pourquoi Nadir met-il 125 $ de risque par trade ?",
    "options": [
     "C'est le minimum imposé par TradingView.",
     "C'est 1 % du compte.",
     "C'est 0,25 % d'un compte de 50 000 $, soit deux cartouches par jour.",
     "C'est le prix d'un contrat ES."
    ],
    "bonne": 2,
    "renvoi": {
     "lecon": "m04-l4",
     "de": 26,
     "a": 29
    },
    "conseil": "0,25 % par trade, donc pas plus de 0,5 % de perte par jour. Avec plus de goût du risque, 1 % par jour revient à 250 $ par trade. Deux cartouches, et une fois la seconde passée, c'est terminé."
   },
   {
    "id": "q04-14",
    "type": "choix",
    "enonce": "Pour tracer la clôture de la veille sur la bougie de 21 h 30, on prend :",
    "options": [
     "La mèche basse.",
     "Le corps de la bougie, c'est-à-dire sa fermeture.",
     "Le plus haut de la bougie.",
     "La moyenne entre ouverture et fermeture."
    ],
    "bonne": 1,
    "renvoi": {
     "lecon": "m04-l4",
     "de": 33,
     "a": 37
    },
    "conseil": "Toujours le corps, jamais la mèche. Sur une bougie vendeuse, c'est le bas du corps ; sur une acheteuse, le haut. Toujours en 30 minutes, et on la trace en orange."
   },
   {
    "id": "q04-15",
    "type": "vraifaux",
    "enonce": "Le rectangle vert de l'outil position doit être au moins deux fois plus grand que le rouge.",
    "options": [
     "Vrai",
     "Faux"
    ],
    "bonne": 0,
    "renvoi": {
     "lecon": "m04-l4",
     "de": 21,
     "a": 24
    },
    "conseil": "C'est le ratio de 2 minimum, pour un objectif cohérent. Si tu agrandis le stop, le ratio baisse et il faut réajuster l'objectif."
   }
  ]
 },
 "05": {
  "titre": "Appliquer la méthode Trader 360",
  "seuil": 0.8,
  "questions": [
   {
    "id": "q05-1",
    "type": "choix",
    "enonce": "Quelles sont les trois règles inviolables de la séance ?",
    "options": [
     "Trader avant 9 h, après 15 h 30, et jamais le vendredi.",
     "Ne pas trader hors plan, ne jamais déplacer son stop loss, deux pertes maximum par jour.",
     "Un seul trade par jour, un seul actif, un seul écran.",
     "Respirer, visualiser, lire son plan."
    ],
    "bonne": 1,
    "renvoi": {
     "lecon": "m05-l1",
     "de": 11,
     "a": 14
    },
    "conseil": "Les trois règles de l'engagement, étape cinq de la routine. Si tu as du mal au départ, choisis-en une et respecte-la sans faille, les autres suivront."
   },
   {
    "id": "q05-2",
    "type": "choix",
    "enonce": "Que doit obligatoirement contenir un plan de trading Trader 360 ?",
    "options": [
     "Uniquement les points pivots du jour.",
     "Le gain visé en dollars et le nombre de trades prévus.",
     "Les annonces trois étoiles, la tendance en 4 heures et en 30 minutes, la clôture de la veille, les zones d'achat et de vente, et le sens des dernières bougies.",
     "Les signaux donnés par un indicateur."
    ],
    "bonne": 2,
    "renvoi": {
     "lecon": "m05-l2",
     "de": 2,
     "a": 5
    },
    "conseil": "Plus le POC, la VWAP, la MM20 et les bandes de Bollinger si tu veux. Mais la CV est le niveau le plus important, et les zones d'achat et de vente sont le cœur du plan."
   },
   {
    "id": "q05-3",
    "type": "vraifaux",
    "enonce": "Un mauvais plan vaut mieux que pas de plan du tout.",
    "options": [
     "Vrai",
     "Faux"
    ],
    "bonne": 0,
    "renvoi": {
     "lecon": "m05-l2",
     "de": 7,
     "a": 9
    },
    "conseil": "C'est la phrase de clôture du chapitre. Et les erreurs à éviter : faire un plan pour faire bien sans le suivre, rester vague, le modifier en cours de route, trader plus de 120 minutes."
   },
   {
    "id": "q05-4",
    "type": "choix",
    "enonce": "Un retournement parfait se dessine, mais en dehors de toute zone. Que fais-tu ?",
    "options": [
     "Je le prends, le signal est trop beau.",
     "Je le prends avec un stop plus serré.",
     "Je ne trade pas : pas de zone, pas de trade.",
     "Je le prends à moitié de taille."
    ],
    "bonne": 2,
    "renvoi": {
     "lecon": "m05-l3",
     "de": 3,
     "a": 5
    },
    "conseil": "Hors zone, ce n'est plus du trading, c'est du pari. Trois choix seulement : zone d'achat avec bon contexte, j'achète ; zone de vente avec bon contexte, je vends ; hors zone, je ne trade pas."
   },
   {
    "id": "q05-5",
    "type": "choix",
    "enonce": "Première chose à poser sur le graphique vierge pour identifier tes zones :",
    "options": [
     "Les bandes de Bollinger.",
     "La clôture de la veille.",
     "La VWAP.",
     "Les points pivots."
    ],
    "bonne": 1,
    "renvoi": {
     "lecon": "m05-l4",
     "de": 0,
     "a": 2
    },
    "conseil": "Nadir retire tous les indicateurs, même la MM20, et ne garde que la clôture de la veille, « un niveau indiscutable à placer ». Le reste vient après."
   },
   {
    "id": "q05-6",
    "type": "choix",
    "enonce": "Sur quelle unité de temps repère-t-on d'abord les sommets et les creux, avant d'affiner ?",
    "options": [
     "1 minute, puis 5 minutes.",
     "Daily, puis 1 heure.",
     "4 heures, puis 30 minutes.",
     "5 minutes, puis 1 minute."
    ],
    "bonne": 2,
    "renvoi": {
     "lecon": "m05-l4",
     "de": 1,
     "a": 3
    },
    "conseil": "Le 4 heures donne les grandes zones, le 30 minutes les affine, et le 5 minutes sert à vérifier qu'un niveau a aussi été travaillé à court terme. Le marché ne se trade pas entre deux zones."
   },
   {
    "id": "q05-7",
    "type": "vraifaux",
    "enonce": "Quand le trade est perdant, on peut écarter son stop loss pour lui laisser respirer.",
    "options": [
     "Vrai",
     "Faux"
    ],
    "bonne": 1,
    "renvoi": {
     "lecon": "m05-l5",
     "de": 2,
     "a": 4
    },
    "conseil": "Le stop se décide avant et ne bouge jamais, surtout pas quand il est perdant. Si tu t'es trompé de niveau, tu assumes la perte prévue, tu ne l'agrandis pas."
   },
   {
    "id": "q05-8",
    "type": "choix",
    "enonce": "Le break even, c'est :",
    "options": [
     "Sortir dès que le trade atteint un RR de 1.",
     "Prendre la moitié des gains.",
     "Remettre son stop loss sur le niveau d'entrée.",
     "Doubler la position quand elle est gagnante."
    ],
    "bonne": 2,
    "renvoi": {
     "lecon": "m05-l5",
     "de": 3,
     "a": 5
    },
    "conseil": "Un trade positif ne doit pas redevenir négatif. Le break even libère la pression : quoi qu'il arrive, la session ne perd plus sur ce trade."
   },
   {
    "id": "q05-9",
    "type": "choix",
    "enonce": "Dans la méthode, le stop loss doit rester entre :",
    "options": [
     "0,5 et 1 point.",
     "2 et 8 points.",
     "10 et 20 points.",
     "20 et 30 points."
    ],
    "bonne": 1,
    "renvoi": {
     "lecon": "m05-l5",
     "de": 13,
     "a": 15
    },
    "conseil": "Au-delà de 8 points, c'est rare le matin, et seulement en cas de forte volatilité l'après-midi. Si tu risques 8 points, tu vises 16 de TP ; si tu risques 2, tu vises 4."
   },
   {
    "id": "q05-10",
    "type": "choix",
    "enonce": "Avec des ratios de 2, à partir de quel taux de réussite est-on rentable ?",
    "options": [
     "Environ 60 %.",
     "Environ 50 %.",
     "Environ un tiers, 34 %.",
     "Environ 26 %."
    ],
    "bonne": 2,
    "renvoi": {
     "lecon": "m05-l5",
     "de": 15,
     "a": 17
    },
    "conseil": "À RR 1, il faut 51 % ; à RR 2, un tiers des trades ; à RR 3, un quart, 26 %. Le trading, c'est des mathématiques simples : si ton win rate baisse, il faut laisser courir tes trades plus loin."
   },
   {
    "id": "q05-11",
    "type": "choix",
    "enonce": "La règle d'or du money management, c'est :",
    "options": [
     "Ne jamais perdre plus de 1 % par jour.",
     "Ne jamais perdre plus de 5 % par semaine.",
     "Risquer 2 % par trade.",
     "Doubler la taille après une perte."
    ],
    "bonne": 0,
    "renvoi": {
     "lecon": "m05-l6",
     "de": 2,
     "a": 4
    },
    "conseil": "Sur un compte de 50 000 $, 1 % fait 500 $ : deux trades à 250 $ et la journée est terminée. Et en phase financée, Manu conseille plutôt 0,20 à 0,25 % par trade : il faut alors 16 à 20 pertes d'affilée pour perdre le compte, au lieu de quatre."
   },
   {
    "id": "q05-12",
    "type": "choix",
    "enonce": "Dans la méthode Trader 360, un trade n'a que quatre issues possibles. Lesquelles ?",
    "options": [
     "Petite perte, grosse perte, petit gain, gros gain.",
     "Petite perte, break even, petit gain, gros gain.",
     "Perte, gain, break even, stop suiveur.",
     "Stop loss, take profit, RR 1, RR 2."
    ],
    "bonne": 1,
    "renvoi": {
     "lecon": "m05-l6",
     "de": 5,
     "a": 7
    },
    "conseil": "La grosse perte est interdite. Tout ce qui sort de ces quatre cadres est de l'improvisation."
   },
   {
    "id": "q05-13",
    "type": "choix",
    "enonce": "Pour placer ton stop sous le plus bas d'un retournement, la règle est :",
    "options": [
     "Pile sur le plus bas.",
     "1,25 point minimum sous le plus bas, et jamais sur un compte rond.",
     "10 points sous le plus bas.",
     "Sur la moyenne mobile 20."
    ],
    "bonne": 1,
    "renvoi": {
     "lecon": "m05-l7",
     "de": 2,
     "a": 4
    },
    "conseil": "Si le plus bas tombe sur 6 000,00, tu vas chercher 5 999,75. Les comptes ronds sont des niveaux que tout le monde regarde."
   },
   {
    "id": "q05-14",
    "type": "choix",
    "enonce": "Dans l'exemple du 5.6, à quel moment place-t-on le break even ?",
    "options": [
     "Dès que le trade est à plus un point.",
     "Après cinq minutes en position.",
     "Quand une bougie clôture au-dessus de la moyenne mobile 20.",
     "Quand le RR de 2 est atteint."
    ],
    "bonne": 2,
    "renvoi": {
     "lecon": "m05-l7",
     "de": 3,
     "a": 5
    },
    "conseil": "On attend la clôture au-dessus de la MM20, puis on sécurise et on vise au moins le RR de 1, avec le stop suiveur sur les plus bas des dernières bougies ensuite."
   },
   {
    "id": "q05-15",
    "type": "choix",
    "enonce": "Sur combien de trades peut-on juger sa performance ?",
    "options": [
     "Sur une journée.",
     "Sur un seul trade bien exécuté.",
     "Sur une série : vingt à trente au moins, et vraiment sur une centaine.",
     "Sur une semaine de gains."
    ],
    "bonne": 2,
    "renvoi": {
     "lecon": "m05-l11",
     "de": 0,
     "a": 3
    },
    "conseil": "« J'ai fait 500 $ aujourd'hui, je suis un bon trader », c'est le trader amateur. Le seul indicateur valable, c'est le respect du process, mesuré sur une série."
   }
  ]
 },
 "06": {
  "titre": "Renforcer ta psychologie de trader",
  "seuil": 0.8,
  "questions": [
   {
    "id": "q06-1",
    "type": "choix",
    "enonce": "Quelle est la différence entre le trader amateur et le trader professionnel, selon le 6.1 ?",
    "options": [
     "L'amateur trade les actions, le pro trade les futures.",
     "L'amateur cherche à gagner, le pro cherche à bien exécuter son plan, son process et son money management.",
     "L'amateur trade le matin, le pro l'après-midi.",
     "L'amateur utilise des indicateurs, le pro n'en utilise pas."
    ],
    "bonne": 1,
    "renvoi": {
     "lecon": "m06-l1",
     "de": 0,
     "a": 2
    },
    "conseil": "Focus sur l'argent immédiat d'un côté, focus sur le processus long terme de l'autre. Gagner est une conséquence du travail, pas l'objectif."
   },
   {
    "id": "q06-2",
    "type": "choix",
    "enonce": "Quelle question introspective Manu demande-t-il de se poser ?",
    "options": [
     "« Combien ai-je gagné cette semaine ? »",
     "« Quel est mon meilleur trade du mois ? »",
     "« Si j'étais payé en fonction du respect de mes règles, est-ce que je serais riche ? »",
     "« Quel indicateur m'a le plus aidé ? »"
    ],
    "bonne": 2,
    "renvoi": {
     "lecon": "m06-l1",
     "de": 2,
     "a": 4
    },
    "conseil": "Si la réponse est non, tu te sabotes encore. Imagine un employeur qui te paie quand tu respectes les règles et te vire quand tu ne les respectes pas."
   },
   {
    "id": "q06-3",
    "type": "choix",
    "enonce": "Complète l'enchaînement du 6.1 : ton mindset détermine ton comportement, et ton comportement détermine…",
    "options": [
     "Ta stratégie.",
     "Tes résultats.",
     "Ton capital.",
     "Ton horaire de trading."
    ],
    "bonne": 1,
    "renvoi": {
     "lecon": "m06-l1",
     "de": 2,
     "a": 4
    },
    "conseil": "Et ton mindset est ton premier capital. C'est pour ça que les modules psycho se relisent, même quand on pense ne plus en avoir besoin."
   },
   {
    "id": "q06-4",
    "type": "choix",
    "enonce": "Quel est le trio des émotions toxiques nommé au 6.2 ?",
    "options": [
     "Colère, joie, ennui.",
     "Doute, impatience, orgueil.",
     "Stress, peur, cupidité.",
     "FOMO, ego, euphorie."
    ],
    "bonne": 2,
    "renvoi": {
     "lecon": "m06-l2",
     "de": 3,
     "a": 5
    },
    "conseil": "Le stress t'empêche de réfléchir, la peur t'empêche d'agir, la cupidité te fait surtrader et doubler les positions pour te refaire."
   },
   {
    "id": "q06-5",
    "type": "choix",
    "enonce": "Qu'est-ce que la règle du « stop loss mental » ?",
    "options": [
     "Un stop qu'on garde en tête sans le poser sur la plateforme.",
     "S'interdire de prendre un trade quand son état interne est agité, instable ou préoccupé.",
     "Arrêter la séance après deux pertes.",
     "Limiter sa perte à 1 % par jour."
    ],
    "bonne": 1,
    "renvoi": {
     "lecon": "m06-l2",
     "de": 5,
     "a": 7
    },
    "conseil": "Pas bien réveillé, préoccupé, pas lucide : tu ne trades pas. Ce n'est pas aux coachs de t'y obliger, c'est à toi d'en prendre conscience."
   },
   {
    "id": "q06-6",
    "type": "vraifaux",
    "enonce": "Après chaque trade, gagnant ou perdant, il faut prendre une ou deux minutes de pause.",
    "options": [
     "Vrai",
     "Faux"
    ],
    "bonne": 0,
    "renvoi": {
     "lecon": "m06-l2",
     "de": 6,
     "a": 8
    },
    "conseil": "Souffler, revenir présent, éviter le tilt. Les pauses devraient être obligatoires, et certains en ont pris d'une ou deux semaines."
   },
   {
    "id": "q06-7",
    "type": "choix",
    "enonce": "Selon le 6.2, ton identité de trader est :",
    "options": [
     "Le reflet de ta dernière semaine de résultats.",
     "Indépendante de tes performances, temporaires ou long terme.",
     "Définie par ton win rate.",
     "Liée à la taille de ton compte."
    ],
    "bonne": 1,
    "renvoi": {
     "lecon": "m06-l2",
     "de": 7,
     "a": 8
    },
    "conseil": "Une mauvaise journée ne fait pas de toi une mauvaise personne, un mauvais trade ne fait pas de toi un mauvais trader. Tu es un exécutant discipliné, le reste est une question de probabilités."
   },
   {
    "id": "q06-8",
    "type": "vraifaux",
    "enonce": "En trading, quand tu fais tout juste, tu gagnes le trade.",
    "options": [
     "Vrai",
     "Faux"
    ],
    "bonne": 1,
    "renvoi": {
     "lecon": "m06-l3",
     "de": 0,
     "a": 2
    },
    "conseil": "Tu peux tout faire juste et perdre, faire n'importe quoi et gagner. Le marché n'a aucune obligation envers toi : c'est un jeu de probabilités, pas de certitudes."
   },
   {
    "id": "q06-9",
    "type": "choix",
    "enonce": "Quels sont les trois révélateurs de ton niveau, plus puissants que « combien j'ai gagné cette semaine » ?",
    "options": [
     "Le win rate, le RR moyen, le gain mensuel.",
     "Le respect du plan, le nombre de trades, l'état émotionnel.",
     "Le nombre d'heures devant l'écran, le nombre d'indicateurs, le nombre de comptes.",
     "La taille du compte, le drawdown, le payout."
    ],
    "bonne": 1,
    "renvoi": {
     "lecon": "m06-l3",
     "de": 3,
     "a": 5
    },
    "conseil": "As-tu suivi tes conditions d'entrée ? Respecté le nombre de trades maximum ? Étais-tu calme, frustré, euphorique, et pourquoi ? C'est ça qui te fait passer un cap."
   },
   {
    "id": "q06-10",
    "type": "choix",
    "enonce": "Combien de temps consacrer au débrief mensuel ?",
    "options": [
     "Dix minutes.",
     "Une demi-heure.",
     "Au moins deux heures.",
     "Une journée entière."
    ],
    "bonne": 2,
    "renvoi": {
     "lecon": "m06-l3",
     "de": 5,
     "a": 7
    },
    "conseil": "En fin de mois, au moins deux heures pour savoir si tu as progressé ou si tu bloques, et le partager aux coachs."
   },
   {
    "id": "q06-11",
    "type": "choix",
    "enonce": "Parmi ces règles, laquelle ne fait pas partie des limites structurelles du 6.4 ?",
    "options": [
     "Un seul actif, une seule méthode.",
     "Deux trades maximum par séance.",
     "Trois heures de séance maximum.",
     "Stop loss et take profit définis à l'avance."
    ],
    "bonne": 2,
    "renvoi": {
     "lecon": "m06-l4",
     "de": 2,
     "a": 3
    },
    "conseil": "C'est deux heures de séance maximum pour commencer, pas trois. Avec 1 % maximum par session. Le trading est addictif, les limites sont là pour ça."
   },
   {
    "id": "q06-12",
    "type": "choix",
    "enonce": "L'échelle d'émotion proposée pour le journal va de :",
    "options": [
     "1 à 10.",
     "1 à 5, de « complètement impulsif » à « focus et aligné ».",
     "0 à 100.",
     "A à E."
    ],
    "bonne": 1,
    "renvoi": {
     "lecon": "m06-l4",
     "de": 3,
     "a": 5
    },
    "conseil": "Mets des mots sur tes sensations, identifie les déclencheurs, et corrèle ton état à tes décisions : les pires viennent presque toujours d'un état déséquilibré."
   },
   {
    "id": "q06-13",
    "type": "choix",
    "enonce": "Qu'est-ce que la règle des 30 jours ?",
    "options": [
     "Trente jours de démo avant de passer en challenge.",
     "Suivre sa routine pendant au moins 30 jours pour que la discipline devienne une habitude.",
     "Trente trades pour juger une stratégie.",
     "Trente jours sans perte pour changer de niveau."
    ],
    "bonne": 1,
    "renvoi": {
     "lecon": "m06-l4",
     "de": 6,
     "a": 8
    },
    "conseil": "Comme le sport : après 30 jours, ne pas faire sa séance devient un manque. La discipline doit devenir aussi instinctive que respirer."
   }
  ]
 },
 "07": {
  "titre": "Gérer l'après-challenge et construire sa rentabilité",
  "seuil": 0.8,
  "questions": [
   {
    "id": "q07-1",
    "type": "choix",
    "enonce": "Quel objectif de rentabilité la plupart des prop firms demandent-elles pour valider un challenge ?",
    "options": [
     "Entre 1 et 2 %.",
     "Entre 6 et 10 %, parfois 4 à 6 selon les comptes.",
     "Environ 20 %.",
     "Environ 50 %."
    ],
    "bonne": 1,
    "renvoi": {
     "lecon": "m07-l1",
     "de": 0,
     "a": 2
    },
    "conseil": "Tu prouves, ils financent. Et elles ne cherchent pas des traders à 300 % de rentabilité, elles cherchent des traders disciplinés et réguliers."
   },
   {
    "id": "q07-2",
    "type": "choix",
    "enonce": "Chez Topstep, combien de comptes peux-tu détenir au maximum, et jusqu'à quel capital total ?",
    "options": [
     "Trois comptes, jusqu'à 150 000 $.",
     "Dix comptes, jusqu'à 500 000 $.",
     "Cinq comptes, jusqu'à 750 000 $.",
     "Vingt comptes, jusqu'à 1 000 000 $."
    ],
    "bonne": 2,
    "renvoi": {
     "lecon": "m07-l2",
     "de": 1,
     "a": 3
    },
    "conseil": "Trois tailles de compte, 50 000, 100 000 et 150 000 $, cinq comptes maximum. Et Manu te préconise de commencer par le 50 000 $ pour te faire la main."
   },
   {
    "id": "q07-3",
    "type": "choix",
    "enonce": "Quelles sont les règles du challenge Topstep à 50 000 $, telles qu'énoncées dans la vidéo ?",
    "options": [
     "5 000 $ de profit en cinq jours, perte maximale 1 000 $.",
     "3 000 $ de profit en un seul jour, perte maximale 2 500 $.",
     "3 000 $ de profit en deux jours minimum, perte maximale 2 000 $, règle de consistance à 50 %.",
     "6 000 $ de profit en dix jours, perte maximale 4 000 $."
    ],
    "bonne": 2,
    "renvoi": {
     "lecon": "m07-l2",
     "de": 2,
     "a": 4
    },
    "conseil": "3 000 $ en deux jours, donc 1 500 et 1 500, puisque ton plus gros trade ne peut pas dépasser 50 % des profits. Les prix et règles évoluent : vérifie sur le Discord."
   },
   {
    "id": "q07-4",
    "type": "choix",
    "enonce": "Première règle Topstep pour demander un paiement :",
    "options": [
     "Dix journées à 50 $ minimum.",
     "Cinq journées à 150 $ minimum.",
     "Trente jours de trading.",
     "Un trade par semaine."
    ],
    "bonne": 1,
    "renvoi": {
     "lecon": "m07-l2",
     "de": 3,
     "a": 5
    },
    "conseil": "Cinq journées qui finissent chacune à 150 $ ou plus, pas cumulées, et tu peux demander 50 % de tes profits, avec 10 % retenus. Une autre option existe au bout de trois jours avec une consistance à 40 %."
   },
   {
    "id": "q07-5",
    "type": "choix",
    "enonce": "Quelle est la particularité du drawdown chez Apex ?",
    "options": [
     "Il est fixe, à 2 000 $.",
     "Il n'y en a pas.",
     "C'est un drawdown suiveur : le maximum de perte suit le plus haut atteint par tes trades, même non clôturés.",
     "Il se remet à zéro chaque mois."
    ],
    "bonne": 2,
    "renvoi": {
     "lecon": "m07-l2",
     "de": 6,
     "a": 8
    },
    "conseil": "Un trade monté à 2 800 $ non clôturé, puis le compte qui redescend à 50 300 $, et le compte est perdu. Tant que tu n'as pas clôturé, le drawdown suiveur se resserre."
   },
   {
    "id": "q07-6",
    "type": "choix",
    "enonce": "Sur un compte Apex financé à 50 000 $, quelle est la règle de consistance ?",
    "options": [
     "50 %, sur les journées positives seulement.",
     "20 %, sur les journées positives seulement.",
     "30 %, pour les journées positives comme pour les journées négatives.",
     "40 %, sur les trades individuels."
    ],
    "bonne": 2,
    "renvoi": {
     "lecon": "m07-l2",
     "de": 8,
     "a": 9
    },
    "conseil": "Ta plus grosse journée ne doit pas dépasser 30 % de tes profits, et la règle vaut aussi pour les pertes : interdiction de perdre plus de 750 $. Et même si dix contrats sont affichés, les utiliser te disqualifie."
   },
   {
    "id": "q07-7",
    "type": "choix",
    "enonce": "Chez Tradify, quelle est la fréquence minimale de trading à respecter ?",
    "options": [
     "Un trade par mois.",
     "Un trade par jour.",
     "Un trade par semaine.",
     "Aucune obligation."
    ],
    "bonne": 2,
    "renvoi": {
     "lecon": "m07-l2",
     "de": 12,
     "a": 13
    },
    "conseil": "Topstep et Apex demandent un trade par mois minimum ; Tradify, un par semaine. Un détail qui tue si on l'oublie."
   },
   {
    "id": "q07-8",
    "type": "vraifaux",
    "enonce": "Les prop firms recommandées par Trader 360 sont des prop firms en CFD.",
    "options": [
     "Vrai",
     "Faux"
    ],
    "bonne": 1,
    "renvoi": {
     "lecon": "m07-l2",
     "de": 12,
     "a": 14
    },
    "conseil": "Uniquement des prop firms en futures : moins de spread, un marché réel, pas reproduit par un broker. La seule CFD sérieuse citée est FTMO, pour le swing, mais beaucoup plus chère."
   },
   {
    "id": "q07-9",
    "type": "choix",
    "enonce": "Sur TopstepX, à quoi sert le réglage du risque journalier avec l'option « Liquider et bloquer » ?",
    "options": [
     "À doubler la taille des positions après une perte.",
     "À liquider la position en cours et bloquer le compte pour la journée quand la perte fixée est atteinte.",
     "À fermer automatiquement les positions à 22 h.",
     "À copier les trades d'un autre compte."
    ],
    "bonne": 1,
    "renvoi": {
     "lecon": "m07-l4",
     "de": 5,
     "a": 6
    },
    "conseil": "C'est une sécurité contre toi-même : impossible de retrader avant le lendemain. Tu peux aussi fixer un objectif de profit et un nombre maximal de trades par jour."
   },
   {
    "id": "q07-10",
    "type": "choix",
    "enonce": "Sur Tradovate, quand tu trades sans bracket, que dois-tu faire en fin de session ?",
    "options": [
     "Rien, les ordres expirent seuls.",
     "Faire « Quitter marché » pour retirer tous les ordres restants.",
     "Passer le compte en mode confidentialité.",
     "Désactiver les notifications sonores."
    ],
    "bonne": 1,
    "renvoi": {
     "lecon": "m07-l5",
     "de": 20,
     "a": 21
    },
    "conseil": "Sans bracket, si le marché tape ton stop, ton objectif reste actif et peut t'ouvrir une position inverse quand tu n'es plus devant l'écran. « Quitter marché » enlève tout."
   },
   {
    "id": "q07-11",
    "type": "choix",
    "enonce": "Quelle est la durée minimum d'entraînement en démo avant de tenter un challenge ?",
    "options": [
     "Cinq séances.",
     "Dix séances.",
     "Trente séances sérieuses, avec le journal rempli.",
     "Cent séances."
    ],
    "bonne": 2,
    "renvoi": {
     "lecon": "m07-l6",
     "de": 3,
     "a": 6
    },
    "conseil": "Pas plus de 1 % de perte par jour, deux trades maximum par séance, suivi du process et pas du PnL. Un trader gagnant en démo dans l'impro totale se ment à lui-même."
   },
   {
    "id": "q07-12",
    "type": "choix",
    "enonce": "En mode challenge, combien risque-t-on par trade sur un compte de 50 000 $, et quel RR vise-t-on ?",
    "options": [
     "0,25 %, pour un RR de 2.",
     "5 %, pour un RR de 1.",
     "Jusqu'à 2 %, soit 1 000 $, pour un RR d'au moins 1,5.",
     "1 %, pour un RR de 3."
    ],
    "bonne": 2,
    "renvoi": {
     "lecon": "m07-l7",
     "de": 6,
     "a": 8
    },
    "conseil": "Deux retournements à RR 1,5 deux jours d'affilée, et le challenge Topstep est validé. Le 1 % par jour, c'est la règle une fois financé ; en challenge, tu peux envoyer."
   },
   {
    "id": "q07-13",
    "type": "choix",
    "enonce": "En mode challenge, combien de trades par jour ?",
    "options": [
     "Deux, comme en financé.",
     "Un seul, par compte.",
     "Cinq.",
     "Autant que la volatilité le permet."
    ],
    "bonne": 1,
    "renvoi": {
     "lecon": "m07-l7",
     "de": 4,
     "a": 6
    },
    "conseil": "Un gros trade sélectif par jour, de préférence l'après-midi quand il y a de la volatilité, sur un setup validé à 100 %. Pas d'improvisation, même en challenge."
   },
   {
    "id": "q07-14",
    "type": "choix",
    "enonce": "Après un trade gagnant, que recommande Manu ?",
    "options": [
     "Le poster dans le Discord pour motiver les autres.",
     "Ressentir la même émotion qu'après une perte, et se récompenser éventuellement en fin de mois.",
     "Doubler la taille du trade suivant.",
     "Arrêter la semaine pour sécuriser le gain."
    ],
    "bonne": 1,
    "renvoi": {
     "lecon": "m07-l8",
     "de": 7,
     "a": 9
    },
    "conseil": "Célébrer un trade libère de la dopamine et installe l'euphorie. Un trade, c'est une étape. Le resto entre potes, c'est en fin de mois."
   },
   {
    "id": "q07-15",
    "type": "vraifaux",
    "enonce": "Selon Manu, gagner 1 % par semaine de manière constante vaut mieux que faire 6 % en une journée puis tout perdre.",
    "options": [
     "Vrai",
     "Faux"
    ],
    "bonne": 0,
    "renvoi": {
     "lecon": "m07-l8",
     "de": 4,
     "a": 6
    },
    "conseil": "Tu es payé pour être cohérent, pas pour être spectaculaire. Le trading pro est un marathon, et la seule personne à impressionner, c'est toi."
   }
  ]
 },
 "07bis": {
  "titre": "Structurer son activité de trader après le challenge",
  "seuil": 0.8,
  "questions": [
   {
    "id": "q07bis-1",
    "type": "choix",
    "enonce": "Chez Topstep, quel est le montant minimum d'un retrait, et le maximum ?",
    "options": [
     "Minimum 500 $, maximum 100 % du solde.",
     "Minimum 125 $, maximum 50 % du solde.",
     "Minimum 1 000 $, maximum 25 % du solde.",
     "Pas de minimum, maximum 5 000 $."
    ],
    "bonne": 1,
    "renvoi": {
     "lecon": "m07-l10",
     "de": 1,
     "a": 3
    },
    "conseil": "Si tu as fait 4 000 $, tu peux retirer 2 000 $. Plafond de 5 000 $ avec la règle des cinq journées à 150 $, 6 000 $ avec la consistance à 40 %."
   },
   {
    "id": "q07bis-2",
    "type": "choix",
    "enonce": "Qu'est-ce que le MLL figé ?",
    "options": [
     "Le drawdown qui se recalcule chaque mois.",
     "Après un retrait, le drawdown maximum reste au niveau initial de 50 000 $ au lieu de descendre.",
     "Un plafond de pertes par trade.",
     "Le nombre maximal de contrats autorisés."
    ],
    "bonne": 1,
    "renvoi": {
     "lecon": "m07-l10",
     "de": 2,
     "a": 4
    },
    "conseil": "Compte à 51 000 $, tu retires 1 000 $ : ton drawdown ne descend pas à 49 000, il reste figé à 50 000. Retirer trop tôt réduit ta marge d'erreur, d'où l'intérêt d'un matelas."
   },
   {
    "id": "q07bis-3",
    "type": "choix",
    "enonce": "Chez Apex, à partir de quel solde peut-on demander un retrait sur un compte de 50 000 $ ?",
    "options": [
     "50 500 $.",
     "52 600 $.",
     "55 000 $.",
     "60 000 $."
    ],
    "bonne": 1,
    "renvoi": {
     "lecon": "m07-l10",
     "de": 3,
     "a": 6
    },
    "conseil": "52 500 $ plus 100 $, après sept ou huit journées à 50 $ minimum. Et le trailing stop se fige à 50 000 $ dès que tu passes 50 500 $."
   },
   {
    "id": "q07bis-4",
    "type": "choix",
    "enonce": "Qu'est-ce qu'un scaling plan ?",
    "options": [
     "Augmenter la taille des lots à mesure que le compte grossit.",
     "Répliquer le même trade sur plusieurs comptes financés, avec le même risque par compte.",
     "Passer d'un compte de 50 000 $ à un compte de 150 000 $.",
     "Ouvrir un compte par prop firm."
    ],
    "bonne": 1,
    "renvoi": {
     "lecon": "m07-l11",
     "de": 0,
     "a": 2
    },
    "conseil": "Un compte maître, un copieur sur Tradovate, et le trade se réplique sur les autres. Les gains sont multipliés, mais les pertes aussi : 50 $ fois 20 font 1 000 $, dans les deux sens."
   },
   {
    "id": "q07bis-5",
    "type": "choix",
    "enonce": "Avant de scaler, quel matelas de sécurité Manu demande-t-il de constituer sur chaque compte ?",
    "options": [
     "500 $.",
     "1 000 $.",
     "2 600 $.",
     "10 000 $."
    ],
    "bonne": 2,
    "renvoi": {
     "lecon": "m07-l11",
     "de": 3,
     "a": 4
    },
    "conseil": "Démarrer avec un seul compte, construire le matelas à 2 600 $, puis dupliquer. Et ne jamais scaler sans s'être prouvé rentable sur un, deux, trois comptes uniques."
   },
   {
    "id": "q07bis-6",
    "type": "choix",
    "enonce": "Combien de comptes financés peut-on détenir, chez Apex d'une part, chez Topstep et Tradify d'autre part ?",
    "options": [
     "5 chez Apex, 20 chez Topstep et Tradify.",
     "20 chez Apex, 5 chez Topstep et Tradify.",
     "10 partout.",
     "Illimité chez Apex, 3 chez Topstep et Tradify."
    ],
    "bonne": 1,
    "renvoi": {
     "lecon": "m07-l11",
     "de": 0,
     "a": 2
    },
    "conseil": "D'où l'intérêt d'être multi prop firm. Les retraits et exécutions restent soumis aux mêmes règles strictes que sur un compte unique."
   },
   {
    "id": "q07bis-7",
    "type": "choix",
    "enonce": "Dans le calcul de Manu, pour monter douze comptes à 2 600 $ en un an, quel gain quotidien par compte suffit ?",
    "options": [
     "Environ 11 $.",
     "Environ 50 $.",
     "Environ 110 $.",
     "Environ 250 $."
    ],
    "bonne": 0,
    "renvoi": {
     "lecon": "m07-l11",
     "de": 7,
     "a": 10
    },
    "conseil": "2 600 $ divisés par 12 mois font environ 220 $ par mois, soit 11 $ par jour sur 20 jours de trading. Ridicule par compte, puissant une fois répliqué. La puissance des mathématiques et de la patience."
   },
   {
    "id": "q07bis-8",
    "type": "choix",
    "enonce": "Chez Topstep, que faut-il valider pour passer en live, sur des fonds réels ?",
    "options": [
     "Un seul retrait.",
     "Au moins cinq retraits validés sur le même compte.",
     "Six mois d'ancienneté.",
     "Un compte à 150 000 $."
    ],
    "bonne": 1,
    "renvoi": {
     "lecon": "m07-l12",
     "de": 2,
     "a": 4
    },
    "conseil": "Évaluation, puis démo financée avec des retraits réguliers, puis compte live. Le passage peut arriver plus tôt si la prop firm juge les résultats exceptionnels."
   },
   {
    "id": "q07bis-9",
    "type": "vraifaux",
    "enonce": "En passant en live chez Topstep, tu conserves les 750 000 $ de comptes financés.",
    "options": [
     "Vrai",
     "Faux"
    ],
    "bonne": 1,
    "renvoi": {
     "lecon": "m07-l12",
     "de": 2,
     "a": 4
    },
    "conseil": "En live, tu ne les as plus : tu restes sur les fonds que tu as engendrés sur tes comptes financés. C'est l'une des raisons pour lesquelles beaucoup évitent le live."
   },
   {
    "id": "q07bis-10",
    "type": "choix",
    "enonce": "Quelle est la vraie différence entre un compte financé en démo et un compte live ?",
    "options": [
     "Les frais de plateforme.",
     "Les horaires de trading.",
     "Tu gères des fonds réels : chaque tick a un impact financier direct, et la psychologie change radicalement.",
     "Le nombre de contrats autorisés."
    ],
    "bonne": 2,
    "renvoi": {
     "lecon": "m07-l12",
     "de": 0,
     "a": 2
    },
    "conseil": "Tu passes du sentiment d'abondance à la préservation stricte du capital confié. Plus de place pour l'improvisation, et la préparation mentale devient ton seul avantage."
   }
  ]
 },
 "08": {
  "titre": "Comprendre la fiscalité liée au trading",
  "seuil": 0.8,
  "questions": [
   {
    "id": "q08-1",
    "type": "choix",
    "enonce": "Quel taux de flat tax 2026 Manu cite-t-il pour les plus-values de l'investisseur classique ?",
    "options": [
     "12,8 %.",
     "30 %.",
     "31,4 %.",
     "45 %."
    ],
    "bonne": 2,
    "renvoi": {
     "lecon": "m08-l0",
     "de": 2,
     "a": 3
    },
    "conseil": "30 % en 2025, 31,4 % en 2026 selon la vidéo, avec l'option du barème selon ta TMI. Ça vaut pour tes propres fonds, CTO, crowdfunding. Chiffre à vérifier chaque année."
   },
   {
    "id": "q08-2",
    "type": "choix",
    "enonce": "Fiscalement, qu'est un payout de prop firm ?",
    "options": [
     "Une plus-value mobilière personnelle.",
     "Un salaire.",
     "La rémunération d'une prestation de service rendue à la prop firm.",
     "Un revenu non imposable."
    ],
    "bonne": 2,
    "renvoi": {
     "lecon": "m08-l0",
     "de": 3,
     "a": 5
    },
    "conseil": "Tu ne trades pas ton capital, tu agis sous contrat, tu respectes un règlement et tu perçois un payout. Tu quittes donc le régime des capitaux mobiliers. La qualification détermine tout le reste."
   },
   {
    "id": "q08-3",
    "type": "choix",
    "enonce": "Quelles sont les deux catégories fiscales qui s'offrent au trader prop firm ?",
    "options": [
     "Le PEA ou le CTO.",
     "Le régime BNC en individuel, ou une société soumise à l'IS, type SAS, SASU, EURL.",
     "La flat tax ou le barème progressif.",
     "Les BIC ou les revenus fonciers."
    ],
    "bonne": 1,
    "renvoi": {
     "lecon": "m08-l0",
     "de": 4,
     "a": 5
    },
    "conseil": "Deux voies, et le choix dépend de la propriété des fonds, du risque économique et du contrat signé. À valider avec un expert-comptable, Manu en recommande deux sur le Discord."
   },
   {
    "id": "q08-4",
    "type": "choix",
    "enonce": "Quels sont les trois critères qui font requalifier un gain exceptionnel en activité professionnelle ?",
    "options": [
     "Montant, devise, pays.",
     "Habitude, intention, organisation.",
     "Âge, statut, revenus.",
     "Fréquence, prop firm, plateforme."
    ],
    "bonne": 1,
    "renvoi": {
     "lecon": "m08-l1",
     "de": 0,
     "a": 2
    },
    "conseil": "Un premier payout isolé de 10 000 $ peut rester un revenu exceptionnel. Dès que ça se répète, que l'intention est durable et que les moyens sont en place, la structure devient nécessaire."
   },
   {
    "id": "q08-5",
    "type": "vraifaux",
    "enonce": "L'administration fiscale peut s'appuyer sur ce que tu publies sur les réseaux sociaux.",
    "options": [
     "Vrai",
     "Faux"
    ],
    "bonne": 0,
    "renvoi": {
     "lecon": "m08-l1",
     "de": 0,
     "a": 2
    },
    "conseil": "Dire tous les jours « je gagne tant » peut être un motif de contrôle. Une raison de plus de ne pas célébrer ses trades en public."
   },
   {
    "id": "q08-6",
    "type": "choix",
    "enonce": "Quel plafond de chiffre d'affaires Manu cite-t-il pour la microentreprise en 2026 ?",
    "options": [
     "37 500 €.",
     "77 700 €.",
     "188 700 €.",
     "Pas de plafond."
    ],
    "bonne": 1,
    "renvoi": {
     "lecon": "m08-l2",
     "de": 0,
     "a": 2
    },
    "conseil": "Simple, peu de gestion, pas de comptabilité à tenir, mais un plafond, et aucune charge déductible."
   },
   {
    "id": "q08-7",
    "type": "choix",
    "enonce": "Quel abattement forfaitaire s'applique en microentreprise, selon la vidéo ?",
    "options": [
     "10 %.",
     "34 %.",
     "50 %.",
     "71 %."
    ],
    "bonne": 1,
    "renvoi": {
     "lecon": "m08-l2",
     "de": 0,
     "a": 2
    },
    "conseil": "10 000 € déclarés, 3 400 € d'abattement, 6 600 € imposés selon ta TMI."
   },
   {
    "id": "q08-8",
    "type": "choix",
    "enonce": "Les achats de challenges sont-ils déductibles ?",
    "options": [
     "Oui, partout.",
     "Non, nulle part.",
     "Non en microentreprise, où l'abattement de 34 % les couvre forfaitairement ; oui au régime réel, comme une charge.",
     "Oui en microentreprise seulement."
    ],
    "bonne": 2,
    "renvoi": {
     "lecon": "m08-l2",
     "de": 3,
     "a": 5
    },
    "conseil": "10 000 € de payout et 10 000 € de comptes : au réel, résultat zéro ; en micro, tu es quand même imposé sur 6 600 €."
   },
   {
    "id": "q08-9",
    "type": "choix",
    "enonce": "Quel seuil de franchise de TVA Manu cite-t-il pour 2026 ?",
    "options": [
     "Environ 10 000 €.",
     "Environ 37 500 €.",
     "Environ 77 700 €.",
     "Environ 100 000 €."
    ],
    "bonne": 1,
    "renvoi": {
     "lecon": "m08-l2",
     "de": 2,
     "a": 3
    },
    "conseil": "Le statut BNC ne dicte pas le régime de TVA, ce sont deux mécanismes distincts. À faire valider par un expert-comptable."
   },
   {
    "id": "q08-10",
    "type": "choix",
    "enonce": "Pourquoi, en général, aucune TVA n'est facturée sur les prestations à Topstep ou Tradify ?",
    "options": [
     "Parce que le trading est exonéré par nature.",
     "Parce que ce sont des sociétés situées hors de France.",
     "Parce que les payouts sont en dollars.",
     "Parce que les prop firms la paient à ta place."
    ],
    "bonne": 1,
    "renvoi": {
     "lecon": "m08-l2",
     "de": 2,
     "a": 3
    },
    "conseil": "Prestation à l'étranger, pas de TVA facturée en général. Mais au-delà du seuil de franchise, tu peux être assujetti : chaque situation est unique."
   }
  ]
 },
 "09": {
  "titre": "Pour aller plus loin (bonus)",
  "seuil": 0.8,
  "questions": [
   {
    "id": "q09-1",
    "type": "choix",
    "enonce": "D'où vient la perte de confiance, selon Manu ?",
    "options": [
     "Du marché, qui devient illisible.",
     "Rarement du marché, presque toujours du manque de maîtrise : ne pas savoir pourquoi on entre, sort, gagne ou perd.",
     "D'une série de gains trop rapide.",
     "D'un mauvais choix de prop firm."
    ],
    "bonne": 1,
    "renvoi": {
     "lecon": "m09-l0",
     "de": 1,
     "a": 3
    },
    "conseil": "Le doute naît du flou. C'est pour ça qu'on note tout dans le journal : il te montre si tu as été régulier, et un journal régulier fait douter beaucoup moins."
   },
   {
    "id": "q09-2",
    "type": "vraifaux",
    "enonce": "Quand la confiance baisse, on augmente son risque pour se refaire plus vite.",
    "options": [
     "Vrai",
     "Faux"
    ],
    "bonne": 1,
    "renvoi": {
     "lecon": "m09-l0",
     "de": 2,
     "a": 3
    },
    "conseil": "Règles du professionnel quand la confiance baisse : ne pas forcer, ne pas augmenter le risque, ne pas changer de stratégie sur un coup d'émotion, réduire l'exposition et retourner en démo."
   },
   {
    "id": "q09-3",
    "type": "choix",
    "enonce": "Pour obtenir une vision externe, combien de membres Manu propose-t-il de solliciter, et à quelle condition ?",
    "options": [
     "Un seul, le plus expérimenté.",
     "Trois, à condition qu'ils ne rencontrent pas les mêmes difficultés que toi.",
     "Dix, pour avoir une moyenne.",
     "Les trois coachs uniquement."
    ],
    "bonne": 1,
    "renvoi": {
     "lecon": "m09-l0",
     "de": 3,
     "a": 5
    },
    "conseil": "Des personnes qui partagent tes blocages te réconforteraient dedans. Expose ton journal, tes règles, tes captures et tes décisions : une vision externe détecte ce que tu refuses de voir."
   },
   {
    "id": "q09-4",
    "type": "choix",
    "enonce": "Qu'est-ce qu'il ne faut jamais faire après quelques pertes ?",
    "options": [
     "Retourner en démo.",
     "Réduire ses séances.",
     "Changer complètement de méthode.",
     "Demander un avis extérieur."
    ],
    "bonne": 2,
    "renvoi": {
     "lecon": "m09-l0",
     "de": 7,
     "a": 9
    },
    "conseil": "Un journal qui ne perd jamais n'est pas sain. Augmenter la taille pour compenser, retrader pour se rassurer, se comparer aux autres : les pièges sont nommés. La confiance se soigne par la structure, pas par l'ego."
   },
   {
    "id": "q09-5",
    "type": "choix",
    "enonce": "Comment est rémunérée une recommandation ?",
    "options": [
     "10 % du prix de la formation.",
     "20 % du chiffre d'affaires hors taxe, sur chaque inscription validée et entièrement payée.",
     "50 % du premier mois.",
     "Un mois d'accompagnement offert."
    ],
    "bonne": 1,
    "renvoi": {
     "lecon": "m09-l1",
     "de": 1,
     "a": 3
    },
    "conseil": "Gagnant-gagnant : le membre recommandé, la communauté, et toi. Manu dit que les membres les plus qualitatifs sont ceux qui ont été recommandés."
   },
   {
    "id": "q09-6",
    "type": "choix",
    "enonce": "Pour qu'une recommandation soit prise en compte, que doit faire la personne que tu recommandes ?",
    "options": [
     "Regarder la vidéo de présentation, ça suffit.",
     "Remplir le questionnaire de positionnement et y indiquer ton nom complet.",
     "T'envoyer un message privé.",
     "Rejoindre directement le Discord."
    ],
    "bonne": 1,
    "renvoi": {
     "lecon": "m09-l1",
     "de": 2,
     "a": 4
    },
    "conseil": "La vidéo de présentation seule ne permet pas d'être recontacté. Le questionnaire est indispensable, puis deux rendez-vous avec un coach."
   },
   {
    "id": "q09-7",
    "type": "choix",
    "enonce": "Que faut-il pour recevoir la rémunération ?",
    "options": [
     "Rien, un virement est fait sur présentation d'un RIB.",
     "Une structure juridique pour facturer, micro ou société, ou à défaut un avoir sur les sommes que tu as engagées chez Trader 360.",
     "Être au niveau confirmé.",
     "Avoir recommandé au moins cinq personnes."
    ],
    "bonne": 1,
    "renvoi": {
     "lecon": "m09-l1",
     "de": 5,
     "a": 6
    },
    "conseil": "Cadre juridique oblige : sans facture, la relation pourrait être requalifiée en emploi. L'avoir est l'alternative pour une ou deux recommandations."
   },
   {
    "id": "q09-8",
    "type": "choix",
    "enonce": "Entre quoi et quoi se mesure une imbalance ?",
    "options": [
     "Entre l'ouverture et la clôture d'une même bougie.",
     "Entre les mèches des deux bougies qui encadrent la grande bougie, et elle n'est confirmée qu'une fois la troisième bougie terminée.",
     "Entre deux clôtures consécutives.",
     "Entre le plus haut et le plus bas de la journée."
    ],
    "bonne": 1,
    "renvoi": {
     "lecon": "m09-l2",
     "de": 1,
     "a": 5
    },
    "conseil": "Un déséquilibre, un endroit où le prix est passé si vite qu'il a laissé des contrats derrière lui. Un marché sain revient les chercher, pas forcément tout de suite."
   },
   {
    "id": "q09-9",
    "type": "choix",
    "enonce": "À quoi Nadir utilise-t-il surtout les imbalances ?",
    "options": [
     "À décider d'entrer en position.",
     "À choisir l'unité de temps.",
     "À la gestion du trade : placer son stop et sa sécurisation derrière la dernière imbalance plutôt qu'au break even.",
     "À remplacer les zones de la méthode."
    ],
    "bonne": 2,
    "renvoi": {
     "lecon": "m09-l2",
     "de": 8,
     "a": 14
    },
    "conseil": "Les entrées restent sur les zones. En gestion, laisser l'imbalance au marché coûte plus de trades négatifs et moins de break even, mais va chercher de plus gros RR. Plus on avance dans le trade, plus on colle le prix."
   },
   {
    "id": "q09-10",
    "type": "choix",
    "enonce": "Quel indicateur TradingView Nadir utilise-t-il pour afficher les imbalances ?",
    "options": [
     "Volume Profile.",
     "Imbalance Finder Dynamic.",
     "Fair Value Gap Pro.",
     "Order Block Detector."
    ],
    "bonne": 1,
    "renvoi": {
     "lecon": "m09-l2",
     "de": 21,
     "a": 22
    },
    "conseil": "Paramètres d'entrée inchangés, couleurs à ton goût. Et même avec l'indicateur, Nadir les trace à la main en live, pour analyser le marché au lieu de stresser sur son trade."
   }
  ]
 }
};
})();
