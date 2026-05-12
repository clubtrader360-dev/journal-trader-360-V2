// ========================================
// API ROUTE : RAPPORT HEBDOMADAIRE AUTOMATIQUE
// Route : /api/cron/weekly-report
// Cron : Tous les dimanches à 20h (heure Paris)
// ========================================

import { createClient } from '@supabase/supabase-js';

// ========================================
// CONFIGURATION
// ========================================
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://zgihbpgoorymomtsbxpz.supabase.co';
// Clé service (pas la clé publique). On accepte les deux noms : SUPABASE_SERVICE_ROLE_KEY
// est le nom canonique côté Supabase et celui documenté dans .env.example, mais l'historique
// du déploiement Vercel utilise SUPABASE_SERVICE_KEY — on garde le fallback pour ne rien casser.
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;

// ========================================
// HANDLER PRINCIPAL
// ========================================
export default async function handler(req, res) {
  console.log('[WEEKLY-REPORT] ========== START ==========');
  console.log('[WEEKLY-REPORT] Méthode:', req.method);
  console.log('[WEEKLY-REPORT] Headers:', req.headers);
  
  // Vérification CRON_SECRET — obligatoire (fail fermé si absent)
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error('[WEEKLY-REPORT] ❌ CRON_SECRET manquant en env');
    return res.status(500).json({ error: 'Missing CRON_SECRET' });
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    console.error('[WEEKLY-REPORT] ❌ Accès non autorisé');
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  // ✅ Vérifier les variables d'environnement
  if (!SUPABASE_SERVICE_KEY) {
    console.error('[WEEKLY-REPORT] ❌ SUPABASE_SERVICE_ROLE_KEY (ou SUPABASE_SERVICE_KEY) manquante');
    return res.status(500).json({ error: 'Missing SUPABASE_SERVICE_ROLE_KEY' });
  }
  
  if (!RESEND_API_KEY) {
    console.error('[WEEKLY-REPORT] ❌ RESEND_API_KEY manquante');
    return res.status(500).json({ error: 'Missing RESEND_API_KEY' });
  }
  
  try {
    // ✅ Initialiser Supabase avec la clé service (accès complet)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    console.log('[WEEKLY-REPORT] ✅ Supabase client initialisé');
    
    // ✅ Récupérer tous les utilisateurs avec email vérifié
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email, raw_user_meta_data')
      .not('email', 'is', null);
    
    if (usersError) {
      console.error('[WEEKLY-REPORT] ❌ Erreur récupération users:', usersError);
      return res.status(500).json({ error: usersError.message });
    }
    
    console.log(`[WEEKLY-REPORT] 📊 ${users.length} utilisateur(s) trouvé(s)`);
    
    // ✅ Calculer les dates de la semaine (lundi à dimanche)
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = dimanche, 1 = lundi, ..., 6 = samedi
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Nombre de jours depuis lundi
    
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - daysToMonday);
    startOfWeek.setHours(0, 0, 0, 0);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    
    const startDateStr = startOfWeek.toISOString().split('T')[0];
    const endDateStr = endOfWeek.toISOString().split('T')[0];
    
    console.log(`[WEEKLY-REPORT] 📅 Période : ${startDateStr} → ${endDateStr}`);
    
    // ✅ Pour chaque utilisateur, générer et envoyer le rapport
    const results = [];
    
    for (const user of users) {
      console.log(`[WEEKLY-REPORT] 📧 Traitement utilisateur : ${user.email}`);
      
      try {
        // 1️⃣ Récupérer les trades de la semaine
        const { data: trades, error: tradesError } = await supabase
          .from('trades')
          .select('*')
          .eq('user_id', user.id)
          .gte('date', startDateStr)
          .lte('date', endDateStr);
        
        if (tradesError) {
          console.error(`[WEEKLY-REPORT] ❌ Erreur trades pour ${user.email}:`, tradesError);
          continue;
        }
        
        // 2️⃣ Récupérer les notes de journal de la semaine
        const { data: journalEntries, error: journalError } = await supabase
          .from('journal_entries')
          .select('*')
          .eq('user_id', user.id)
          .gte('entry_date', startDateStr)
          .lte('entry_date', endDateStr);
        
        if (journalError) {
          console.error(`[WEEKLY-REPORT] ❌ Erreur journal pour ${user.email}:`, journalError);
          continue;
        }
        
        console.log(`[WEEKLY-REPORT] 📊 ${user.email}: ${trades?.length || 0} trades, ${journalEntries?.length || 0} notes`);
        
        // ✅ Si pas d'activité, skip
        if (!trades?.length && !journalEntries?.length) {
          console.log(`[WEEKLY-REPORT] ⏭️ ${user.email}: Aucune activité, skip`);
          results.push({ email: user.email, status: 'skipped', reason: 'no_activity' });
          continue;
        }
        
        // 3️⃣ Générer le rapport HTML
        const reportHTML = generateWeeklyReportHTML({
          user,
          trades,
          journalEntries,
          startDate: startDateStr,
          endDate: endDateStr
        });
        
        // 4️⃣ Envoyer l'email via Resend
        const emailResult = await sendEmail({
          to: user.email,
          subject: `📊 Ton rapport hebdomadaire - Semaine du ${formatDate(startDateStr)}`,
          html: reportHTML
        });
        
        if (emailResult.success) {
          console.log(`[WEEKLY-REPORT] ✅ Email envoyé à ${user.email}`);
          results.push({ email: user.email, status: 'sent', emailId: emailResult.id });
        } else {
          console.error(`[WEEKLY-REPORT] ❌ Échec envoi à ${user.email}:`, emailResult.error);
          results.push({ email: user.email, status: 'failed', error: emailResult.error });
        }
        
      } catch (userError) {
        console.error(`[WEEKLY-REPORT] ❌ Exception pour ${user.email}:`, userError);
        results.push({ email: user.email, status: 'error', error: userError.message });
      }
    }
    
    console.log('[WEEKLY-REPORT] ========== FIN ==========');
    console.log('[WEEKLY-REPORT] Résultats:', results);
    
    return res.status(200).json({
      success: true,
      period: { start: startDateStr, end: endDateStr },
      totalUsers: users.length,
      results
    });
    
  } catch (error) {
    console.error('[WEEKLY-REPORT] ❌ Erreur globale:', error);
    return res.status(500).json({ error: error.message });
  }
}

// ========================================
// FONCTION : Générer le HTML du rapport
// ========================================
function generateWeeklyReportHTML({ user, trades, journalEntries, startDate, endDate }) {
  console.log('[WEEKLY-REPORT] 🎨 Génération du rapport HTML...');
  
  // ✅ Calculer les métriques
  const totalTrades = trades.length;
  const totalPnl = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);
  const winningTrades = trades.filter(t => t.pnl > 0);
  const losingTrades = trades.filter(t => t.pnl < 0);
  const winRate = totalTrades > 0 ? (winningTrades.length / totalTrades * 100).toFixed(0) : 0;
  
  const grossProfit = winningTrades.reduce((sum, t) => sum + t.pnl, 0);
  const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0));
  const profitFactor = grossLoss > 0 ? (grossProfit / grossLoss).toFixed(2) : (grossProfit > 0 ? '∞' : '0');
  
  const bestTrade = trades.length > 0 ? Math.max(...trades.map(t => t.pnl)) : 0;
  const worstTrade = trades.length > 0 ? Math.min(...trades.map(t => t.pnl)) : 0;
  
  // ✅ Analyser les points positifs et erreurs
  const allPositives = [];
  const allErrors = [];
  
  journalEntries.forEach(entry => {
    if (entry.positive_points && Array.isArray(entry.positive_points)) {
      allPositives.push(...entry.positive_points);
    }
    if (entry.errors && Array.isArray(entry.errors)) {
      allErrors.push(...entry.errors);
    }
  });
  
  // Compter les occurrences
  const positivesCount = {};
  allPositives.forEach(p => {
    positivesCount[p] = (positivesCount[p] || 0) + 1;
  });
  
  const errorsCount = {};
  allErrors.forEach(e => {
    errorsCount[e] = (errorsCount[e] || 0) + 1;
  });
  
  // Top 3 de chaque
  const topPositives = Object.entries(positivesCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  
  const topErrors = Object.entries(errorsCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  
  // ✅ Générer le HTML
  const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Rapport Hebdomadaire - Journal Trader 360</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .container {
      background: white;
      border-radius: 12px;
      padding: 30px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .header {
      text-align: center;
      border-bottom: 3px solid #ac862b;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .logo {
      max-width: 200px;
      height: auto;
      margin-bottom: 20px;
    }
    .header h1 {
      color: #ac862b;
      margin: 0 0 10px 0;
      font-size: 28px;
    }
    .header p {
      color: #666;
      margin: 0;
      font-size: 14px;
    }
    .metric-card {
      background: #f9fafb;
      border-left: 4px solid #ac862b;
      padding: 15px;
      margin: 15px 0;
      border-radius: 6px;
    }
    .metric-card h3 {
      margin: 0 0 10px 0;
      color: #333;
      font-size: 16px;
    }
    .metric-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-top: 10px;
    }
    .metric {
      text-align: center;
    }
    .metric-value {
      font-size: 24px;
      font-weight: bold;
      color: #ac862b;
    }
    .metric-label {
      font-size: 12px;
      color: #666;
      text-transform: uppercase;
    }
    .positive {
      color: #10b981 !important;
    }
    .negative {
      color: #ef4444 !important;
    }
    .section {
      margin: 30px 0;
    }
    .section h2 {
      color: #333;
      font-size: 20px;
      margin-bottom: 15px;
      padding-bottom: 10px;
      border-bottom: 2px solid #e5e7eb;
    }
    .list-item {
      padding: 10px;
      margin: 8px 0;
      background: #f9fafb;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }
    .badge {
      background: #ac862b;
      color: white;
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: bold;
      flex-shrink: 0;
      margin-left: auto;
    }
    .footer {
      text-align: center;
      margin-top: 40px;
      padding-top: 20px;
      border-top: 2px solid #e5e7eb;
      color: #666;
      font-size: 12px;
    }
    .cta-button {
      display: inline-block;
      background: #ac862b;
      color: white;
      padding: 12px 30px;
      text-decoration: none;
      border-radius: 6px;
      font-weight: bold;
      margin: 20px 0;
    }
    .cta-button:hover {
      background: #8a6a22;
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <!-- Logo Trader 360 -->
      <img src="https://journal-trader-360.vercel.app/trader360-logo.png" alt="Trader 360" style="max-width: 200px; height: auto; margin-bottom: 20px;">
      <h1>📊 Ton Rapport Hebdomadaire</h1>
      <p>Semaine du ${formatDate(startDate)} au ${formatDate(endDate)}</p>
    </div>
    
    <!-- Performance Globale -->
    <div class="metric-card">
      <h3>📈 PERFORMANCE GLOBALE</h3>
      <div class="metric-grid">
        <div class="metric">
          <div class="metric-value ${totalPnl >= 0 ? 'positive' : 'negative'}">
            ${totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)}$
          </div>
          <div class="metric-label">P&L Net</div>
        </div>
        <div class="metric">
          <div class="metric-value">${totalTrades}</div>
          <div class="metric-label">Trades</div>
        </div>
        <div class="metric">
          <div class="metric-value ${winRate >= 50 ? 'positive' : 'negative'}">${winRate}%</div>
          <div class="metric-label">Win Rate</div>
        </div>
        <div class="metric">
          <div class="metric-value">${profitFactor}</div>
          <div class="metric-label">Profit Factor</div>
        </div>
      </div>
    </div>
    
    ${totalTrades > 0 ? `
    <div class="section">
      <h2>🎯 Trades Clés</h2>
      <div class="list-item">
        <span>⚡ Meilleur trade :</span>
        <strong class="positive">+${bestTrade.toFixed(2)}$</strong>
      </div>
      <div class="list-item">
        <span>🔻 Pire trade :</span>
        <strong class="negative">${worstTrade.toFixed(2)}$</strong>
      </div>
    </div>
    ` : ''}
    
    ${topPositives.length > 0 ? `
    <div class="section">
      <h2>✅ Points Positifs (${allPositives.length} au total)</h2>
      <p style="color: #666; font-size: 14px;">Tes forces cette semaine :</p>
      ${topPositives.map(([point, count]) => `
        <div class="list-item">
          <span style="flex: 1;">${point}</span>
          <span class="badge">${count}×</span>
        </div>
      `).join('')}
    </div>
    ` : ''}
    
    ${topErrors.length > 0 ? `
    <div class="section">
      <h2>❌ Erreurs Commises (${allErrors.length} au total)</h2>
      <p style="color: #666; font-size: 14px;">⚠️ Points à améliorer :</p>
      ${topErrors.map(([error, count]) => `
        <div class="list-item">
          <span style="flex: 1;">${error}</span>
          <span class="badge" style="background: #ef4444;">${count}×</span>
        </div>
      `).join('')}
      <p style="color: #ef4444; font-size: 14px; margin-top: 15px; font-weight: bold;">
        💡 Focus : Travaille à corriger "${topErrors[0][0]}" cette semaine !
      </p>
    </div>
    ` : ''}
    
    ${!totalTrades && !journalEntries.length ? `
    <div class="section" style="text-align: center; padding: 40px 0;">
      <p style="font-size: 18px; color: #666;">🤔 Aucune activité cette semaine</p>
      <p style="color: #999;">N'oublie pas de tenir ton journal à jour !</p>
    </div>
    ` : ''}
    
    <!-- CTA -->
    <div style="text-align: center;">
      <a href="https://journal-trader-360.vercel.app" class="cta-button">
        📖 Voir mon journal complet
      </a>
    </div>
    
    <!-- Citation -->
    <div style="background: linear-gradient(135deg, #f9fafb 0%, #e5e7eb 100%); border-left: 4px solid #ac862b; padding: 20px; margin: 30px 0; border-radius: 8px; text-align: center;">
      <p style="color: #666; font-style: italic; font-size: 15px; line-height: 1.6; margin: 0;">
        "Le succès est la somme de petits efforts répétés jour après jour."
      </p>
      <p style="color: #ac862b; font-weight: bold; font-size: 13px; margin: 10px 0 0 0;">
        — Robert Collier
      </p>
    </div>
    
    <!-- Footer -->
    <div class="footer">
      <p><strong>Journal Trader 360</strong> - Ton allié pour un trading régulier et rentable</p>
    </div>
  </div>
</body>
</html>
  `;
  
  return html;
}

// ========================================
// FONCTION : Envoyer l'email via Resend
// ========================================
async function sendEmail({ to, subject, html }) {
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Journal Trader 360 <reports@resend.dev>',
        to: [to],
        subject: subject,
        html: html
      })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      console.error('[WEEKLY-REPORT] ❌ Erreur Resend:', data);
      return { success: false, error: data.message || 'Unknown error' };
    }
    
    console.log('[WEEKLY-REPORT] ✅ Email envoyé via Resend, ID:', data.id);
    return { success: true, id: data.id };
    
  } catch (error) {
    console.error('[WEEKLY-REPORT] ❌ Exception sendEmail:', error);
    return { success: false, error: error.message };
  }
}

// ========================================
// FONCTION HELPER : Formatter une date
// ========================================
function formatDate(dateStr) {
  const date = new Date(dateStr);
  const day = date.getDate();
  const months = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}
