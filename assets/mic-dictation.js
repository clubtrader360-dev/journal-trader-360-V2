// ========================================
// MIC DICTATION (#13) — dictée vocale dans les textareas du journal élève.
// Web Speech API native (SpeechRecognition / webkitSpeechRecognition), zéro coût, zéro backend.
// Chrome/Edge/Safari : supporté. Firefox : non supporté → tooltip explicite au clic (bouton non caché).
// Reconnaissance FR (lang='fr-FR'), résultats temps réel (interim) injectés en direct dans la textarea.
// ========================================
(function () {
  'use strict';

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const NOT_SUPPORTED_MSG = 'Dictée vocale — utilise Chrome, Edge ou Safari (non supporté sur Firefox).';

  function notify(msg, type) {
    if (window.showNotification) window.showNotification(msg, type || 'info');
  }

  // Sépare proprement le texte existant du nouveau segment dicté.
  function joinSeparator(base) {
    if (!base) return '';
    return /\s$/.test(base) ? '' : (/[.!?…:]$/.test(base.trim()) ? ' ' : ' ');
  }

  // Capitalise la 1re lettre d'un segment finalisé (petit polish FR).
  function tidy(seg) {
    if (!seg) return seg;
    seg = seg.replace(/\s+/g, ' ').trim();
    return seg.charAt(0).toUpperCase() + seg.slice(1);
  }

  const MicDictation = {
    isSupported() { return !!SR; },

    attach(textarea, options) {
      options = options || {};
      if (!textarea || textarea.dataset.micAttached === '1') return;
      // Edge : ne pas attacher sur une textarea en lecture seule / désactivée (ex : coach-view).
      if (textarea.readOnly || textarea.disabled) return;
      textarea.dataset.micAttached = '1';

      const silenceTimeout = options.silenceTimeout || 3000;

      // ── Wrapper positionné (pour ancrer le bouton en haut-droit sans dépendre du parent). ──
      const wrap = document.createElement('span');
      wrap.className = 'mic-dictation-wrap';
      textarea.parentNode.insertBefore(wrap, textarea);
      wrap.appendChild(textarea);

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'mic-btn';
      btn.setAttribute('aria-label', 'Dictée vocale');
      btn.innerHTML = '<i class="fas fa-microphone"></i>';

      const indicator = document.createElement('div');
      indicator.className = 'mic-indicator';
      indicator.style.display = 'none';
      indicator.innerHTML = '<span class="mic-dot"></span> En écoute…';

      wrap.appendChild(btn);
      wrap.appendChild(indicator);

      // Non supporté (Firefox…) : bouton visible mais clic = tooltip explicatif.
      if (!SR) {
        btn.classList.add('unsupported');
        btn.title = NOT_SUPPORTED_MSG;
        btn.addEventListener('click', function (e) { e.preventDefault(); notify(NOT_SUPPORTED_MSG, 'error'); });
        return;
      }
      btn.title = 'Dictée vocale (cliquer pour parler)';

      let recognition = null;
      let listening = false;
      let baseText = '';       // contenu figé avant la session de dictée en cours
      let finalText = '';      // segments finalisés cumulés dans la session
      let silenceTimer = null;

      function setState(state) {
        btn.classList.remove('listening', 'error');
        const icon = btn.querySelector('i');
        if (state === 'listening') {
          btn.classList.add('listening');
          icon.className = 'fas fa-microphone';
          indicator.style.display = 'flex';
          btn.title = 'En écoute — cliquer pour arrêter';
        } else if (state === 'error') {
          btn.classList.add('error');
          icon.className = 'fas fa-microphone-slash';
          indicator.style.display = 'none';
        } else {
          icon.className = 'fas fa-microphone';
          indicator.style.display = 'none';
          btn.title = 'Dictée vocale (cliquer pour parler)';
        }
      }

      function clearSilence() { if (silenceTimer) { clearTimeout(silenceTimer); silenceTimer = null; } }
      function armSilence() {
        clearSilence();
        silenceTimer = setTimeout(function () { stop(); }, silenceTimeout);
      }

      function render(interim) {
        const sep = joinSeparator(baseText);
        textarea.value = baseText + sep + finalText + (interim ? (finalText ? ' ' : '') + interim : '');
        // notifie les listeners (auto-save, compteurs de caractères, etc.)
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
      }

      function start() {
        try {
          recognition = new SR();
          recognition.lang = options.lang || 'fr-FR';
          recognition.interimResults = true;
          recognition.continuous = true;

          baseText = textarea.value || '';
          finalText = '';

          recognition.onresult = function (event) {
            armSilence();
            let interim = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
              const res = event.results[i];
              const txt = res[0].transcript;
              if (res.isFinal) {
                finalText += (finalText ? ' ' : '') + tidy(txt);
                if (typeof options.onTranscription === 'function') {
                  try { options.onTranscription(tidy(txt)); } catch (_) {}
                }
              } else {
                interim += txt;
              }
            }
            render(interim.trim());
          };

          recognition.onerror = function (event) {
            clearSilence();
            listening = false;
            if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
              setState('error');
              btn.title = 'Micro refusé — autorise l\'accès au micro dans le navigateur';
              notify('Accès micro refusé. Autorise le micro pour dicter.', 'error');
            } else if (event.error === 'no-speech') {
              setState('idle');
            } else if (event.error === 'aborted') {
              setState('idle');
            } else {
              setState('error');
              notify('Erreur dictée vocale : ' + event.error, 'error');
            }
          };

          recognition.onend = function () {
            clearSilence();
            listening = false;
            // fige l'interim résiduel dans le texte final
            render('');
            if (!btn.classList.contains('error')) setState('idle');
          };

          recognition.start();
          listening = true;
          setState('listening');
          armSilence();
        } catch (err) {
          listening = false;
          setState('error');
          notify('Impossible de démarrer la dictée : ' + (err.message || err), 'error');
        }
      }

      function stop() {
        clearSilence();
        if (recognition && listening) {
          try { recognition.stop(); } catch (_) {}
        }
        listening = false;
      }

      btn.addEventListener('click', function (e) {
        e.preventDefault();
        if (listening) stop(); else start();
      });
    },

    // (Re)scanne le DOM et attache le micro à toutes les textareas marquées.
    scan(root) {
      if (window.CoachView && window.CoachView.isActive()) return; // lecture seule → pas de dictée
      (root || document).querySelectorAll('textarea[data-mic-dictation]').forEach(function (el) {
        MicDictation.attach(el);
      });
    }
  };

  window.MicDictation = MicDictation;

  document.addEventListener('DOMContentLoaded', function () { MicDictation.scan(); });
})();
