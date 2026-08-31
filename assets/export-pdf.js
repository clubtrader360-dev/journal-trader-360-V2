/* ============================================================================
   Export PDF « analyse IA » — rendu TEXTE NATIF.

   ⚠️ CONTRAINTE ABSOLUE : le document doit contenir du texte SÉLECTIONNABLE,
   produit par jsPDF.text(). Aucun html2canvas, aucun rendu canvas, aucune
   capture d'écran — le PDF deviendrait une image et l'IA ne pourrait rien en
   lire, ce qui annulerait tout l'objet de cet export.

   Structure pensée pour la lecture MACHINE, pas pour l'impression : pas de
   grille à 22 colonnes (l'extraction de texte d'un tableau dense casse l'ordre
   des cellules), mais un bloc par trade avec chaque champ NOMMÉ.

   Ce fichier est volontairement autonome et sans dépendance au DOM, pour être
   exécutable tel quel en Node dans le test de non-régression.
   ============================================================================ */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.TraderPdfExport = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var M = { left: 14, right: 14, top: 16, bottom: 16 };
  var LINE = 5;          // interligne
  var FS_BODY = 9;
  var FS_H1 = 16;
  var FS_H2 = 11;

  function money(v) {
    var n = Number(v) || 0;
    return (n >= 0 ? '+' : '-') + Math.abs(n).toFixed(2);
  }

  // Champ omis s'il est vide : « un champ vide est omis plutôt que laissé pendant ».
  function pair(label, value) {
    if (value === null || value === undefined) return null;
    var s = String(value).trim();
    if (!s || s === 'NaN') return null;
    return label + ': ' + s;
  }
  function joinPairs(parts) {
    var kept = parts.filter(Boolean);
    return kept.length ? kept.join(' | ') : null;
  }

  // Lignes d'un bloc de trade. Retournées AVANT écriture, pour pouvoir mesurer
  // la hauteur du bloc et décider d'un saut de page sans jamais le couper en deux.
  function tradeLines(doc, r, usableWidth) {
    var lines = [];
    var title = 'Trade ' + r.id + ' — ' + (r.date || 'date inconnue') + (r.dayOfWeek ? ' (' + r.dayOfWeek.toLowerCase() + ')' : '');
    lines.push({ text: title, bold: true });

    var rows = [
      joinPairs([pair('Instrument', r.instrument), pair('Direction', r.direction), pair('Type', r.typeTrade)]),
      joinPairs([pair('Entrée', r.entryT), pair('Sortie', r.exitT),
                 pair('Durée', r.duration ? r.duration + ' min' : ''), pair('Session', r.session)]),
      joinPairs([pair('Quantité', r.quantity), pair('Prix entrée', r.entryPrice), pair('Prix sortie', r.exitPrice)]),
      joinPairs([pair('P&L', money(r.pnl)), pair('RR atteint', r.rrAtteint), pair('Résultat', r.winLoss)]),
      joinPairs([pair('Protections — Setup', r.protSetup), pair('Cible', r.protTarget), pair('Invalidation', r.protInval)]),
      joinPairs([pair('Comptes', r.accountsStr), pair('Méthode', r.methode)]),
    ];
    rows.filter(Boolean).forEach(function (t) { lines.push({ text: t, bold: false }); });

    // Notes longues : splitTextToSize gère le retour à la ligne, rien n'est tronqué.
    if (r.notes && String(r.notes).trim()) {
      var wrapped = doc.splitTextToSize('Notes: ' + String(r.notes).trim(), usableWidth);
      wrapped.forEach(function (t) { lines.push({ text: t, bold: false }); });
    }
    return lines;
  }

  function buildPdf(jsPDFCtor, meta, records) {
    var doc = new jsPDFCtor({ unit: 'mm', format: 'a4' });
    var pageW = doc.internal.pageSize.getWidth();
    var pageH = doc.internal.pageSize.getHeight();
    var usable = pageW - M.left - M.right;
    var maxY = pageH - M.bottom;
    var y = M.top;

    function write(text, opts) {
      opts = opts || {};
      // Garde ligne à ligne : un bloc PLUS HAUT QU'UNE PAGE (note très longue) ne peut
      // pas être gardé d'un seul tenant. Sans ce contrôle, jsPDF continuait d'écrire
      // sous le bas de page : le texte était dessiné hors cadre et PERDU à l'extraction.
      if (y > maxY) newPage();
      doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
      doc.setFontSize(opts.size || FS_BODY);
      doc.text(String(text), M.left, y);
      y += opts.gap || LINE;
    }
    function newPage() { doc.addPage(); y = M.top; }
    function ensure(height) { if (y + height > maxY) newPage(); }

    // ---- En-tête ----
    write('Export Trader 360 — analyse IA', { bold: true, size: FS_H1, gap: 8 });
    [
      pair('Trader', meta.trader),
      pair("Date d'export", meta.exportedAt),
      pair('Période couverte', meta.periode),
      pair('Comptes', meta.comptes),
    ].filter(Boolean).forEach(function (t) { write(t); });
    y += 3;

    // ---- Synthèse : une paire libellé/valeur par ligne ----
    var n = records.length;
    var pnlTotal = records.reduce(function (s, r) { return s + (Number(r.pnl) || 0); }, 0);
    var wins = records.filter(function (r) { return r.winLoss === 'Win'; }).length;
    var losses = records.filter(function (r) { return r.winLoss === 'Loss'; }).length;
    var be = records.filter(function (r) { return r.winLoss === 'Break-Even'; }).length;
    var decided = wins + losses;                     // break-even exclu du winrate
    var winrate = decided ? Math.round((wins / decided) * 100) : 0;
    var jours = Object.keys(records.reduce(function (a, r) { if (r.date) a[r.date] = 1; return a; }, {})).length;
    var meth = records.filter(function (r) { return r.methode === 'Méthode'; }).length;
    var hors = records.filter(function (r) { return r.methode === 'Hors méthode'; }).length;

    write('Synthèse', { bold: true, size: FS_H2, gap: 6 });
    [
      'Nombre de trades: ' + n,
      'Nombre de trades bruts (avant déduplication copy-trading): ' + meta.nbTradesBruts,
      'P&L total: ' + money(pnlTotal),
      'Winrate: ' + winrate + '% (break-even exclus du calcul)',
      'Jours tradés: ' + jours,
      'Répartition méthode: Méthode ' + meth + ' | Hors méthode ' + hors + ' | Non renseigné ' + (n - meth - hors),
      'Répartition résultat: Win ' + wins + ' | Loss ' + losses + ' | Break-Even ' + be,
    ].forEach(function (t) { write(t); });
    y += 4;

    // ---- Trades ----
    ensure(10);
    write('Trades', { bold: true, size: FS_H2, gap: 6 });

    records.forEach(function (r) {
      var lines = tradeLines(doc, r, usable);
      var blockH = lines.length * LINE + 3;
      // Un bloc n'est JAMAIS coupé entre deux pages : s'il ne tient pas, on
      // bascule avant de commencer à l'écrire.
      if (blockH <= (maxY - M.top)) ensure(blockH);
      lines.forEach(function (l) { write(l.text, { bold: l.bold }); });
      y += 3;
    });

    // ---- Pagination ----
    var total = doc.internal.getNumberOfPages();
    for (var p = 1; p <= total; p++) {
      doc.setPage(p);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text('Page ' + p + ' / ' + total, pageW - M.right, pageH - 8, { align: 'right' });
    }
    return doc;
  }

  return { buildPdf: buildPdf, tradeLines: tradeLines, money: money, pair: pair };
});
