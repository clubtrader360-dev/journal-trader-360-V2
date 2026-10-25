/**
 * BANC : le certificat de réussite (assets/formation-diplome.js), 25/10/2026.
 *   1. le PDF écrit à la main est lisible : chaque entrée de la table xref pointe
 *      exactement sur « n 0 obj », la longueur du flux est celle de l'image ;
 *   2. l'espace élève et le back-office numérotent le certificat de la MÊME façon
 *      (un écart ferait circuler deux certificats pour la même personne) ;
 *   3. il ne reste qu'une seule façon de noter un résultat de quiz.
 * Usage : node outils/certificat-banc.mjs
 */
import { readFileSync } from 'node:fs';
let ko = 0; const dire = (ok, m, v) => { console.log((ok ? 'ok  ' : '⛔  ') + m + (v !== undefined ? '  ' + JSON.stringify(v) : '')); if (!ok) ko++; };

globalThis.window = {}; globalThis.document = {};
new Function(readFileSync('assets/formation-diplome.js', 'utf8'))();
const FD = window.FormationDiplome;

// 1. Le PDF
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...Array(200).fill(7), 0xff, 0xd9]);
const octets = new Uint8Array(await FD.pdfDeJpeg(jpeg, 3508, 2480).arrayBuffer());
const texte = Buffer.from(octets).toString('latin1');
dire(texte.startsWith('%PDF-1.4') && texte.trimEnd().endsWith('%%EOF'), 'en-tête et fin de PDF');
const debutXref = Number(texte.match(/startxref\n(\d+)/)[1]);
dire(texte.slice(debutXref, debutXref + 4) === 'xref', 'startxref pointe sur la table', debutXref);
const entrees = [...texte.slice(debutXref).matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
dire(entrees.length === 6 && entrees.every((o, i) => texte.slice(o).startsWith(`${i + 1} 0 obj`)), '6 objets, chaque décalage tombe sur « n 0 obj »', entrees);
dire(texte.includes(`/Length ${jpeg.length} >>`) && texte.includes('/Width 3508 /Height 2480'), 'longueur du flux = taille du JPEG, dimensions 300 dpi');
// Témoin : un décalage faux doit être vu.
dire(!texte.slice(entrees[0] + 1).startsWith('1 0 obj'), 'témoin : un décalage décalé d’un octet ne passe pas');

// 2. Même numéro des deux côtés
const formule = (src) => (src.match(/T360-C-\$\{[^`]+`/) || [''])[0].replace(/\s+/g, '');
const eleve = formule(readFileSync('supabase-formation.js', 'utf8'));
const bo = formule(readFileSync('assets/back-office.js', 'utf8'));
const norm = (f) => f.replace(/_uid\|\|''/, 'ID').replace(/el\.user_id/, 'ID').replace(/q\.premiere|el\.certifie_le/, 'DATE').replace(/\ban\b/, 'newDate(DATE).getFullYear()');
dire(!!eleve && !!bo, 'les deux formules de numéro sont trouvées', { eleve, bo });
dire(norm(eleve).split('-').slice(3).join('-') === norm(bo).split('-').slice(3).join('-'), 'même suffixe : 6 premiers caractères de l’identifiant, en majuscules');

// 3. Une seule façon de noter un quiz
const sf = readFileSync('supabase-formation.js', 'utf8');
dire((sf.match(/noterQuiz\(/g) || []).length === 5, 'noterQuiz : 1 définition + 4 appels (chargement, quiz, examen, réécriture)', (sf.match(/noterQuiz\(/g) || []).length);
dire((sf.match(/_quiz\[[^\]]+\] = s;/g) || []).length === 1, 'une seule écriture « _quiz[...] = s », celle de noterQuiz', (sf.match(/_quiz\[[^\]]+\] = s;/g) || []).length);
dire(/data-certificat/.test(sf) && /celebrer\(\{ certificat: d \}\)/.test(sf), 'bouton de téléchargement et fusée branchés dans l’espace élève');
dire(readFileSync('index.html', 'utf8').includes('/assets/formation-diplome.js') && readFileSync('back-office.html', 'utf8').includes('/assets/formation-diplome.js'), 'le module est chargé par l’espace élève ET le back-office');

console.log(ko ? '\n⛔ défauts' : '\nbanc vert'); process.exitCode = ko ? 1 : 0;
