/* ============================================
   Italiano B1 — unit-renderer.js
   App.UnitRenderer: 15-step pedagogical unit renderer
   ============================================ */

var App = window.App || {};

App.UnitRenderer = (function() {
  'use strict';

  /* --- Private State --- */
  var _state = {
    unitId: null,
    data: null,
    currentStep: 0,
    totalSteps: 15,
    isTransitioning: false
  };

  /* --- Step Phase Mapping --- */
  var STEP_PHASES = {
    1:  { name: 'Observación',  color: '#3b82f6', cssClass: 'phase-blue',   badge: '🔍 Observación' },
    2:  { name: 'Observación',  color: '#3b82f6', cssClass: 'phase-blue',   badge: '🔍 Observación' },
    3:  { name: 'Observación',  color: '#3b82f6', cssClass: 'phase-blue',   badge: '🔍 Observación' },
    4:  { name: 'Gramática',    color: '#10b981', cssClass: 'phase-green',  badge: '📚 Gramática' },
    5:  { name: 'Gramática',    color: '#10b981', cssClass: 'phase-green',  badge: '📚 Gramática' },
    6:  { name: 'Gramática',    color: '#10b981', cssClass: 'phase-green',  badge: '📚 Gramática' },
    7:  { name: 'Gramática',    color: '#10b981', cssClass: 'phase-green',  badge: '📚 Gramática' },
    8:  { name: 'Práctica',     color: '#f59e0b', cssClass: 'phase-orange', badge: '✏️ Práctica' },
    9:  { name: 'Práctica',     color: '#f59e0b', cssClass: 'phase-orange', badge: '✏️ Práctica' },
    10: { name: 'Producción',   color: '#8b5cf6', cssClass: 'phase-purple', badge: '🎤 Producción' },
    11: { name: 'Producción',   color: '#8b5cf6', cssClass: 'phase-purple', badge: '🎤 Producción' },
    12: { name: 'Producción',   color: '#8b5cf6', cssClass: 'phase-purple', badge: '🎤 Producción' },
    13: { name: 'Producción',   color: '#8b5cf6', cssClass: 'phase-purple', badge: '🎤 Producción' },
    14: { name: 'Cierre',       color: '#94a3b8', cssClass: 'phase-gray',   badge: '🎯 Cierre' },
    15: { name: 'Cierre',       color: '#94a3b8', cssClass: 'phase-gray',   badge: '🔄 Cierre' }
  };

  /* --- Step Renderer Registry --- */
  var STEP_RENDERERS = {
    'situacion-comunicativa': renderStep1,
    'descubrimiento':         renderStep2,
    'comprension':            renderComprehension,
    'gramatica-del-dia':      renderGrammar,
    'construccion':           renderComingSoon,
    'regla':                  renderRule,
    'tabla-referencia':       renderReference,
    'ejercicios-escalonados': renderComingSoon,
    'vocabulario':            renderComingSoon,
    'pronunciacion':          renderComingSoon,
    'cultura':                renderCulture,
    'conversacion-guiada':    renderComingSoon,
    'conversacion-libre':     renderComingSoon,
    'resumen-visual':         renderSummary,
    'repaso-inteligente':     renderComingSoon,
    'coming-soon':            renderComingSoon
  };

  /* ==========================================
     DATA LOADING
     ========================================== */

  /**
   * Load unit data by unitId.
   * Tries inline JSON script tag first, falls back to fetch.
   * @param {number} unitId
   * @returns {object|null|Promise} Unit object, null, or Promise for async path
   */
  function loadUnitData(unitId) {
    var data = null;
    var el = document.getElementById('data-units-a1a2');
    if (el) {
      try {
        data = JSON.parse(el.textContent);
      } catch (e) {
        console.warn('[UnitRenderer] Failed to parse inline data:', e);
      }
    }

    if (data && data.length > 0) {
      return findUnit(data, unitId);
    }

    // Fallback: fetch from file
    return fetch('data/units-a1-a2.json')
      .then(function(res) {
        if (!res.ok) throw new Error('Failed to load units data');
        return res.json();
      })
      .then(function(json) {
        return findUnit(json, unitId);
      })
      .catch(function(err) {
        console.error('[UnitRenderer] Error loading unit data:', err);
        return null;
      });
  }

  /**
   * Find a unit by its numeric ID in the data array.
   * @param {Array} data
   * @param {number} unitId
   * @returns {object|null}
   */
  function findUnit(data, unitId) {
    if (!data || !Array.isArray(data)) return null;
    unitId = parseInt(unitId, 10);
    for (var i = 0; i < data.length; i++) {
      if (parseInt(data[i].id, 10) === unitId) return data[i];
    }
    return null;
  }

  /* ==========================================
     MAIN ENTRY POINT
     ========================================== */

  /**
   * Render a unit by its ID. Entry point for the public API.
   * @param {number} unitId
   */
  function renderUnit(unitId) {
    var result = loadUnitData(unitId);

    if (result && typeof result === 'object' && typeof result.then === 'function') {
      // Async path (fetch)
      result.then(function(unit) {
        if (!unit) {
          renderError('No se pudo cargar la unidad ' + unitId + '.');
          return;
        }
        initUnit(unitId, unit);
      });
    } else if (result) {
      // Sync path (inline script tag)
      initUnit(unitId, result);
    } else {
      renderError('No se pudo cargar la unidad ' + unitId + '. Verifica el archivo de datos.');
    }
  }

  /**
   * Initialize the unit renderer state and show the welcome screen.
   * @param {number} unitId
   * @param {object} unit
   */
  function initUnit(unitId, unit) {
    _state.unitId = unitId;
    _state.data = unit;
    _state.currentStep = 0;
    _state.totalSteps = 15;

    // Check for saved progress
    var learner = App.state && App.state.currentLearner;
    var savedStep = null;
    if (learner) {
      var profile = App.Progress.get(learner);
      if (profile && profile.unitProgress && profile.unitProgress[unitId]) {
        var st = profile.unitProgress[unitId].currentStep;
        if (st !== undefined && st !== null && st < _state.totalSteps) {
          savedStep = st;
        }
      }
    }

    // Update nav breadcrumb
    var navName = document.getElementById('nav-unit-name');
    if (navName) {
      navName.textContent = unit.title || 'Unidad ' + (unitId + 1);
    }

    // Show welcome screen (always — entry gate to the unit)
    renderWelcome(unit, savedStep);
  }

  /**
   * Show an error message in the step container.
   * @param {string} message
   */
  function renderError(message) {
    var container = document.getElementById('step-container');
    if (!container) return;
    container.innerHTML = '<div class="error-card" style="text-align:center;padding:48px 24px">' +
      '<p style="font-size:1.1rem;color:var(--text)">' + escapeHtml(message) + '</p></div>';
  }

  /* ==========================================
     WELCOME SCREEN
     ========================================== */

  /**
   * Render the unit welcome screen (step 0, pre-step entry gate).
   * Shows objectives as achievements, unit info, and start/resume buttons.
   * Hides step indicator + nav until the user clicks start.
   * @param {object} unit - Full unit data object
   * @param {number|null} savedStep - Saved progress step index, or null
   */
  function renderWelcome(unit, savedStep) {
    var objectivesHtml = '';
    if (unit.objectives && unit.objectives.length) {
      objectivesHtml = '<ul class="welcome-objectives-list">' +
        unit.objectives.map(function(obj) {
          return '<li class="welcome-objective-item"><span class="welcome-objective-check">&#10003;</span> ' +
            escapeHtml(obj) + '</li>';
        }).join('') +
        '</ul>';
    }

    var resumeBtnHtml = '';
    if (savedStep !== null && savedStep >= 0) {
      resumeBtnHtml = '<button class="primary-btn welcome-btn welcome-btn-secondary" id="welcome-resume">' +
        '&#9654; Continuar desde paso ' + (savedStep + 1) + '</button>';
    }

    var html =
      '<div class="welcome-screen">' +
        '<div class="welcome-card">' +
          '<div class="welcome-header">' +
            '<span class="welcome-level-badge">Nivel ' + escapeHtml(unit.level) + '</span>' +
            '<h1 class="welcome-title">' + escapeHtml(unit.title) + '</h1>' +
            '<p class="welcome-meta">15 pasos · ~45 minutos</p>' +
          '</div>' +
          '<div class="welcome-objectives">' +
            '<h2 class="welcome-section-title">&#127919; Al completar esta unidad podr&aacute;s...</h2>' +
            objectivesHtml +
          '</div>' +
          '<div class="welcome-actions">' +
            resumeBtnHtml +
            '<button class="primary-btn welcome-btn welcome-btn-primary" id="welcome-start">' +
              '&#9654; Empezar' +
            '</button>' +
          '</div>' +
          '<p class="welcome-footer-text">Tu progreso se guarda autom&aacute;ticamente al avanzar.</p>' +
        '</div>' +
      '</div>';

    var container = document.getElementById('step-container');
    if (!container) return;
    container.innerHTML = html;

    // Hide step indicator, progress bar, and nav during welcome
    var indicator = document.querySelector('.step-indicator');
    var progress = document.querySelector('.step-progress');
    var stepNav = document.querySelector('.step-nav');
    var unitHeader = document.querySelector('.unit-header');
    if (indicator) indicator.style.display = 'none';
    if (progress) progress.style.display = 'none';
    if (stepNav) stepNav.style.display = 'none';
    if (unitHeader) unitHeader.style.display = 'none';

    // Show indicators again when user starts
    function showIndicators() {
      if (indicator) indicator.style.display = '';
      if (progress) progress.style.display = '';
      if (stepNav) stepNav.style.display = '';
      if (unitHeader) unitHeader.style.display = '';
    }

    // Wire "Empezar" button — first-visit start
    var startBtn = document.getElementById('welcome-start');
    if (startBtn) {
      startBtn.addEventListener('click', function() {
        showIndicators();
        goToStep(0);
      });
    }

    // Wire "Continuar" button — resume from saved step
    var resumeBtn = document.getElementById('welcome-resume');
    if (resumeBtn) {
      resumeBtn.addEventListener('click', function() {
        showIndicators();
        goToStep(savedStep);
      });
    }
  }

  /* ==========================================
     STEP RENDERING DISPATCH
     ========================================== */

  /**
   * Render the current step — builds the full step view HTML and wires interactions.
   */
  function renderCurrentStep() {
    var idx = _state.currentStep;
    var steps = _state.data.steps || [];

    // Get step data or fall back to coming-soon stub
    var stepData = steps[idx];
    if (!stepData) {
      console.warn('[UnitRenderer] step ' + (idx + 1) + ' data missing, rendering stub');
      stepData = { type: 'coming-soon', title: 'Paso ' + (idx + 1), message: 'Paso no disponible.' };
    }

    // Build a 15-items display array (pad missing steps with coming-soon)
    var displaySteps = [];
    for (var i = 0; i < 15; i++) {
      displaySteps[i] = steps[i] || { type: 'coming-soon', step: i + 1 };
    }

    console.log('[UnitRenderer] Rendering step ' + (idx + 1) + ': ' + (stepData.type || 'unknown'));

    // Get phase info
    var phase = STEP_PHASES[idx + 1] || {};
    var stepTitle = stepData.title || 'Paso ' + (idx + 1);

    // --- BUILD HTML ---
    var html = '';

    // 1. Step header with phase badge
    html += '<div class="step-header">';
    if (phase.badge) {
      html += '<span class="step-phase-badge" style="background:' + phase.color + '20;color:' + phase.color + '">' +
        phase.badge + '</span>';
    }
    html += '<h2 class="step-title">' + escapeHtml(stepTitle) + '</h2>';
    html += '</div>';

    // 2. Progress bar
    var pct = Math.round(((idx + 1) / 15) * 100);
    html += '<div class="step-progress">' +
      '<div class="step-progress-bar">' +
        '<div class="step-progress-fill" style="width:' + pct + '%"></div>' +
      '</div>' +
      '<div class="step-progress-label">Paso ' + (idx + 1) + ' de 15 · ' + pct + '%</div>' +
    '</div>';

    // 3. Step content (delegate to type-specific renderer)
    var renderFn = STEP_RENDERERS[stepData.type] || renderComingSoon;
    html += '<div class="step-content">' + renderFn(stepData) + '</div>';

    // 4. Step indicator dots (15 color-coded dots)
    html += buildIndicatorHtml(displaySteps, idx);

    // 5. Navigation buttons
    var isFirst = idx === 0;
    var isLast = idx === 14;
    var nextLabel = isLast ? '▶ ¡Empezar ejercicios!' : 'Siguiente →';
    html += '<div class="step-nav">' +
      '<button class="secondary-btn step-prev"' + (isFirst ? ' disabled' : '') + '>← Anterior</button>' +
      '<span class="step-nav-spacer"></span>' +
      '<button class="primary-btn step-next">' + nextLabel + '</button>' +
    '</div>';

    // --- RENDER TO DOM ---
    var container = document.getElementById('step-container');
    if (!container) return;
    container.innerHTML = html;

    // Set progress bar color to match phase
    var fillEl = container.querySelector('.step-progress-fill');
    if (fillEl && phase.color) {
      fillEl.style.background = phase.color;
    }

    // Wire up interaction handlers
    wireNavButtons();
    wireDotClicks();
    wireTtsButtons(container);

    // Persist current step to profile
    saveProgress();
  }

  /* ==========================================
     STEP INDICATOR
     ========================================== */

  /**
   * Build the step indicator dots HTML.
   * @param {Array} steps - 15-step display array
   * @param {number} currentIdx - 0-based current step index
   * @returns {string} HTML string
   */
  function buildIndicatorHtml(steps, currentIdx) {
    var html = '<div class="step-indicator">';

    for (var i = 0; i < steps.length; i++) {
      var stepNum = i + 1;
      var phase = STEP_PHASES[stepNum] || {};

      var isCompleted = i < currentIdx;
      var isActive = i === currentIdx;
      var isComingSoon = steps[i] && steps[i].type === 'coming-soon';

      // CSS classes
      var cls = 'step-dot';
      if (isActive) cls += ' active';
      else if (isCompleted) cls += ' completed';
      if (isComingSoon) cls += ' coming-soon';
      if (phase.cssClass) cls += ' ' + phase.cssClass;

      // Inline style for phase color
      var bgColor = '';
      var borderColor = '';
      if (isCompleted) {
        bgColor = phase.color || '#94a3b8';
      }
      if (isActive) {
        borderColor = phase.color || '#3b82f6';
      }

      var style = '';
      if (bgColor) style += 'background:' + bgColor + ';';
      if (borderColor) style += 'border-color:' + borderColor + ';box-shadow:0 0 0 3px ' + borderColor + '33;';

      var label = phase.name || 'Paso ' + stepNum;

      html += '<span class="' + cls + '" style="' + style + '" ' +
        'title="Paso ' + stepNum + ': ' + label + '" ' +
        'data-step-index="' + i + '"></span>';
    }

    html += '</div>';
    return html;
  }

  /* ==========================================
     NAVIGATION
     ========================================== */

  /**
   * Wire prev/next button click handlers.
   */
  function wireNavButtons() {
    var prevBtn = document.querySelector('.step-prev');
    var nextBtn = document.querySelector('.step-next');
    var isLast = _state.currentStep === 14;

    if (prevBtn && !prevBtn.disabled) {
      prevBtn.addEventListener('click', function() {
        prevStep();
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', function() {
        if (isLast) {
          completeUnit();
        } else {
          nextStep();
        }
      });
    }
  }

  /**
   * Wire step dot click handlers for direct navigation.
   */
  function wireDotClicks() {
    var dots = document.querySelectorAll('.step-dot[data-step-index]');
    for (var i = 0; i < dots.length; i++) {
      dots[i].addEventListener('click', handleDotClick);
    }
  }

  /**
   * Handle a click on a step indicator dot.
   * @param {Event} e
   */
  function handleDotClick(e) {
    var dot = e.currentTarget;
    var step = parseInt(dot.getAttribute('data-step-index'), 10);
    if (!isNaN(step) && step >= 0 && step < _state.totalSteps && step !== _state.currentStep) {
      goToStep(step);
    }
  }

  /**
   * Complete the unit — mark as done and navigate home.
   */
  function completeUnit() {
    var learner = App.state && App.state.currentLearner;
    if (learner) {
      var profile = App.Progress.get(learner);
      if (profile) {
        if (!profile.unitProgress) profile.unitProgress = {};
        if (!profile.unitProgress[_state.unitId]) {
          profile.unitProgress[_state.unitId] = {};
        }
        profile.unitProgress[_state.unitId].completed = true;
        App.Progress.save(learner, profile);
      }
    }

    App.nav.show('home');
  }

  /**
   * Save the current step index to the learner profile.
   */
  function saveProgress() {
    var learner = App.state && App.state.currentLearner;
    if (!learner) return;
    var profile = App.Progress.get(learner);
    if (!profile) return;
    if (!profile.unitProgress) profile.unitProgress = {};
    if (!profile.unitProgress[_state.unitId]) {
      profile.unitProgress[_state.unitId] = {};
    }
    profile.unitProgress[_state.unitId].currentStep = _state.currentStep;
    App.Progress.save(learner, profile);
  }

  /* ==========================================
     TTS WIRING
     ========================================== */

  /**
   * Wire TTS play buttons and play-all buttons in the container.
   * Also wires dialogue extras (translation toggle, hint icons) and comprehension quiz.
   * @param {HTMLElement} container
   */
  function wireTtsButtons(container) {
    if (!container) return;

    // Individual TTS buttons
    var ttsBtns = container.querySelectorAll('.dialogue-tts-btn');
    for (var i = 0; i < ttsBtns.length; i++) {
      ttsBtns[i].addEventListener('click', handleTtsClick);
    }

    // Play-all button
    var playAll = container.querySelector('.dialogue-play-all-btn');
    if (playAll) {
      playAll.addEventListener('click', handlePlayAllClick);
    }

    // Translation toggle button
    var toggleBtn = container.querySelector('.dialogue-translation-toggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', handleTranslationToggle);
    }

    // Hint icon clicks (step 2)
    var hintIcons = container.querySelectorAll('.dialogue-hint-icon');
    for (var h = 0; h < hintIcons.length; h++) {
      hintIcons[h].addEventListener('click', handleHintIconClick);
      hintIcons[h].addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleHintIconClick(e);
        }
      });
    }

    // Volver button
    var volverBtn = container.querySelector('.dialogue-volver-btn');
    if (volverBtn) {
      volverBtn.addEventListener('click', function() {
        App.nav.show('home');
      });
    }

    // Comprehension quiz wiring (step 3)
    wireComprehension(container);
  }

  /**
   * Handle a single TTS button click.
   * @param {Event} e
   */
  function handleTtsClick(e) {
    var btn = e.currentTarget;
    var text = btn.getAttribute('data-text');
    if (text && App.SpeechManager) {
      App.SpeechManager.speak(text);
    }
  }

  /**
   * Handle the "Play all" button click — plays each line sequentially.
   * @param {Event} e
   */
  function handlePlayAllClick(e) {
    var btn = e.currentTarget;
    var texts;
    try {
      texts = JSON.parse(btn.getAttribute('data-texts') || '[]');
    } catch (err) {
      return;
    }
    playAllSequential(texts, 0);
  }

  /**
   * Play dialogue lines sequentially with a 1-second pause between them.
   * @param {string[]} texts
   * @param {number} idx
   */
  function playAllSequential(texts, idx) {
    if (idx >= texts.length) return;
    if (App.SpeechManager) {
      App.SpeechManager.speak(texts[idx]);
    }
    setTimeout(function() {
      playAllSequential(texts, idx + 1);
    }, 1000);
  }

  /**
   * Handle translation toggle button click.
   * Shows or hides all .dialogue-translation elements.
   * @param {Event} e
   */
  function handleTranslationToggle(e) {
    var btn = e.currentTarget;
    var container = btn.closest('.dialogue-viewer');
    if (!container) return;
    var isVisible = btn.getAttribute('data-visible') === 'true';
    var translations = container.querySelectorAll('.dialogue-translation');
    for (var t = 0; t < translations.length; t++) {
      translations[t].style.display = isVisible ? 'none' : '';
    }
    btn.setAttribute('data-visible', isVisible ? 'false' : 'true');
    btn.textContent = isVisible ? 'Mostrar traducciones' : 'Ocultar traducciones';
  }

  /**
   * Handle hint icon click (step 2) — toggles tooltip visibility.
   * @param {Event} e
   */
  function handleHintIconClick(e) {
    var icon = e.currentTarget;
    var tooltip = icon.parentNode.querySelector('.dialogue-hint-tooltip');
    if (tooltip) {
      tooltip.classList.toggle('visible');
    }
  }

  /* ==========================================
     COMPREHENSION QUIZ WIRING
     ========================================== */

  /**
   * Wire comprehension quiz interactions (step 3).
   * @param {HTMLElement} container
   */
  function wireComprehension(container) {
    var quiz = container.querySelector('.comprehension-quiz');
    if (!quiz) {
      // Also check if step 3 needs Next disabled initially
      // (when comprehension data exists but quiz element wasn't found)
      if (_state.currentStep === 2) {
        var dataStep = _state.data.steps && _state.data.steps[2];
        if (dataStep && dataStep.type === 'comprension') {
          disableNextBtn();
        }
      }
      return;
    }

    // Step 3 always starts with Next disabled
    disableNextBtn();

    // Wire radio buttons
    var radios = quiz.querySelectorAll('.comprehension-radio');
    for (var r = 0; r < radios.length; r++) {
      radios[r].addEventListener('change', handleComprehensionAnswer);
    }

    // Wire retry button
    var retryBtn = quiz.querySelector('.comprehension-retry-btn');
    if (retryBtn) {
      retryBtn.addEventListener('click', function() {
        resetComprehension(quiz);
      });
    }
  }

  /**
   * Handle a comprehension answer selection.
   * @param {Event} e
   */
  function handleComprehensionAnswer(e) {
    var radio = e.currentTarget;
    var questionEl = radio.closest('.comprehension-question');
    if (!questionEl) return;
    if (questionEl.getAttribute('data-answered') === 'true') return;

    var quiz = questionEl.closest('.comprehension-quiz');
    if (!quiz) return;

    var selectedIndex = parseInt(radio.value, 10);
    var correctIndex = parseInt(questionEl.getAttribute('data-correctindex'), 10);
    var isCorrect = selectedIndex === correctIndex;

    // Mark question as answered
    questionEl.setAttribute('data-answered', 'true');

    // Disable all radios in this question
    var qRadios = questionEl.querySelectorAll('.comprehension-radio');
    for (var r = 0; r < qRadios.length; r++) {
      qRadios[r].disabled = true;
    }

    // Highlight correct and incorrect options
    var options = questionEl.querySelectorAll('.comprehension-option');
    for (var o = 0; o < options.length; o++) {
      var optRadio = options[o].querySelector('.comprehension-radio');
      if (!optRadio) continue;
      var optVal = parseInt(optRadio.value, 10);
      if (optVal === correctIndex) {
        options[o].classList.add('comprehension-correct');
      } else if (optVal === selectedIndex && !isCorrect) {
        options[o].classList.add('comprehension-incorrect');
      }
    }

    // Show per-question feedback
    var feedback = questionEl.querySelector('.comprehension-feedback');
    if (feedback) {
      feedback.textContent = isCorrect ? '✓ ¡Correcto!' : '✗ Incorrecto';
      feedback.className = 'comprehension-feedback ' + (isCorrect ? 'comprehension-feedback--correct' : 'comprehension-feedback--incorrect');
    }

    // Update global quiz counters
    var total = parseInt(quiz.getAttribute('data-total'), 10);
    var answered = parseInt(quiz.getAttribute('data-answered'), 10) + 1;
    var correct = parseInt(quiz.getAttribute('data-correct'), 10) + (isCorrect ? 1 : 0);
    quiz.setAttribute('data-answered', answered);
    quiz.setAttribute('data-correct', correct);

    // Check if all questions are answered
    if (answered >= total) {
      showComprehensionResult(quiz, correct, total);
    }
  }

  /**
   * Show the final comprehension result and enable/disable Next.
   * @param {HTMLElement} quiz
   * @param {number} correct
   * @param {number} total
   */
  function showComprehensionResult(quiz, correct, total) {
    var pct = Math.round((correct / total) * 100);
    var resultEl = quiz.querySelector('.comprehension-result');
    var scoreEl = quiz.querySelector('.comprehension-score');
    var msgEl = quiz.querySelector('.comprehension-message');
    var navHint = quiz.querySelector('.comprehension-nav-hint');

    if (resultEl) resultEl.style.display = 'block';
    if (scoreEl) scoreEl.textContent = 'Puntuación: ' + correct + '/' + total + ' (' + pct + '%)';
    if (navHint) navHint.style.display = 'block';

    if (pct >= 80) {
      if (msgEl) msgEl.textContent = '✅ ¡Bien hecho! Puedes continuar a la siguiente lección.';
      enableNextBtn();
    } else {
      if (msgEl) {
        msgEl.innerHTML = '📖 Necesitas un 80% o más. <a href="#" class="comprehension-review-link" data-go-step="0">Revisa el diálogo</a> y vuelve a intentarlo.';
        var link = msgEl.querySelector('.comprehension-review-link');
        if (link) {
          link.addEventListener('click', function(e) {
            e.preventDefault();
            goToStep(0);
          });
        }
      }
      disableNextBtn();
    }
  }

  /**
   * Reset the comprehension quiz for a retry.
   * @param {HTMLElement} quiz
   */
  function resetComprehension(quiz) {
    quiz.setAttribute('data-answered', '0');
    quiz.setAttribute('data-correct', '0');

    var questions = quiz.querySelectorAll('.comprehension-question');
    for (var q = 0; q < questions.length; q++) {
      questions[q].setAttribute('data-answered', 'false');

      // Re-enable and uncheck radios
      var radios = questions[q].querySelectorAll('.comprehension-radio');
      for (var r = 0; r < radios.length; r++) {
        radios[r].disabled = false;
        radios[r].checked = false;
      }

      // Remove highlight classes
      var options = questions[q].querySelectorAll('.comprehension-option');
      for (var o = 0; o < options.length; o++) {
        options[o].classList.remove('comprehension-correct', 'comprehension-incorrect');
      }

      // Clear feedback
      var feedback = questions[q].querySelector('.comprehension-feedback');
      if (feedback) {
        feedback.textContent = '';
        feedback.className = 'comprehension-feedback';
      }
    }

    // Hide result
    var resultEl = quiz.querySelector('.comprehension-result');
    if (resultEl) resultEl.style.display = 'none';

    var navHint = quiz.querySelector('.comprehension-nav-hint');
    if (navHint) navHint.style.display = 'none';

    // Disable Next until they pass again
    disableNextBtn();
  }

  /**
   * Enable the Next navigation button.
   */
  function enableNextBtn() {
    var nextBtn = document.querySelector('.step-next');
    if (nextBtn) {
      nextBtn.disabled = false;
    }
  }

  /**
   * Disable the Next navigation button.
   */
  function disableNextBtn() {
    var nextBtn = document.querySelector('.step-next');
    if (nextBtn) {
      nextBtn.disabled = true;
    }
  }

  /* ==========================================
     STEP 1 & 2: Dialogue Viewer
     ========================================== */

  /**
   * Render step 1 — situacion-comunicativa dialogue viewer.
   * @param {object} stepData
   * @returns {string} HTML
   */
  function renderStep1(stepData) {
    return renderDialogueViewer(stepData, { isStep2: false });
  }

  /**
   * Render step 2 — descubrimiento dialogue viewer with observation prompt and hints.
   * @param {object} stepData
   * @returns {string} HTML
   */
  function renderStep2(stepData) {
    return renderDialogueViewer(stepData, { isStep2: true });
  }

  /**
   * Render dialogue bubbles for steps 1 (situacion-comunicativa) and 2 (descubrimiento).
   * @param {object} stepData
   * @param {object} opts - { isStep2 }
   * @returns {string} HTML
   */
  function renderDialogueViewer(stepData, opts) {
    var isStep2 = opts && opts.isStep2;
    var lines = stepData.dialogue || [];
    var hasObservation = isStep2 && stepData.observation_prompt;

    // Empty dialogue fallback
    if (!lines || lines.length === 0) {
      return '<div class="dialogue-viewer"><p class="dialogue-objective">Diálogo no disponible.</p></div>';
    }

    // Collect all texts for play-all
    var allTexts = [];
    for (var i = 0; i < lines.length; i++) {
      allTexts.push(lines[i].text);
    }

    var html = '<div class="dialogue-viewer">';

    // Volver button at top
    html += '<div class="dialogue-volver">' +
      '<button class="dialogue-volver-btn" data-action="go-home" aria-label="Volver al inicio">← Volver al inicio</button>' +
    '</div>';

    // Objective (step 1) or observation_prompt (step 2) at TOP
    if (!isStep2 && stepData.objective) {
      html += '<div class="dialogue-objective">🎯 ' + escapeHtml(stepData.objective) + '</div>';
    }
    if (hasObservation) {
      html += '<div class="observation-prompt" style="margin-bottom:12px">' + escapeHtml(stepData.observation_prompt) + '</div>';
    }

    // Play-all + translation toggle row
    html += '<div class="dialogue-controls">' +
      '<button class="secondary-btn dialogue-play-all-btn" data-texts=\'' + JSON.stringify(allTexts) + '\'>▶ Reproducir todo</button>' +
      '<button class="secondary-btn dialogue-translation-toggle" data-visible="true">Ocultar traducciones</button>' +
    '</div>';

    // Dialogue bubbles
    html += '<div class="dialogue-scene">';

    for (var j = 0; j < lines.length; j++) {
      var line = lines[j];
      html += '<div class="dialogue-bubble">';

      // Speaker name
      if (line.speaker) {
        html += '<span class="dialogue-speaker">' + escapeHtml(line.speaker) + '</span>';
      }

      // Content area
      html += '<div class="dialogue-content">' +
        '<div class="dialogue-text">' + escapeHtml(line.text) + '</div>';

      // Translation (always rendered, toggleable via CSS class)
      html += '<div class="dialogue-translation">' + escapeHtml(line.translation || '') + '</div>';

      // Hint (step 2 only — displayed as clickable 💡 icon with tooltip)
      if (line.hint && isStep2) {
        html += '<div class="dialogue-hint-container">' +
          '<span class="dialogue-hint-icon" title="Ver pista gramatical" role="button" tabindex="0">💡</span>' +
          '<div class="dialogue-hint-tooltip">' + escapeHtml(line.hint) + '</div>' +
        '</div>';
      }

      html += '</div>'; // .dialogue-content

      // TTS button — call with language hint
      html += '<button class="dialogue-tts-btn" data-text="' + escapeAttr(line.text) + '" title="Escuchar" aria-label="Escuchar">🔊</button>';

      html += '</div>'; // .dialogue-bubble
    }

    html += '</div>'; // .dialogue-scene
    html += '</div>'; // .dialogue-viewer
    return html;
  }

  /* ==========================================
     STEP 3: Comprehension Quiz
     ========================================== */

  /**
   * Render step 3 — comprension: inline multiple-choice quiz over dialogue content.
   * @param {object} stepData
   * @returns {string} HTML
   */
  function renderComprehension(stepData) {
    var questions = stepData.questions || [];

    if (!questions || questions.length === 0) {
      return '<div class="coming-soon-card">' +
        '<div class="coming-soon-icon">🔜</div>' +
        '<div class="coming-soon-title">Próximamente</div>' +
        '<p class="coming-soon-message">Las preguntas de comprensión estarán disponibles pronto.</p></div>';
    }

    var html = '<div class="comprehension-quiz" data-total="' + questions.length + '" data-answered="0" data-correct="0">' +
      '<p class="comprehension-intro">Responde las siguientes preguntas sobre el diálogo:</p>';

    for (var i = 0; i < questions.length; i++) {
      var q = questions[i];
      html += '<div class="comprehension-question" data-index="' + i + '" data-answered="false" data-correctindex="' + q.correctIndex + '">' +
        '<div class="comprehension-question-text">' + (i + 1) + '. ' + escapeHtml(q.question) + '</div>' +
        '<div class="comprehension-options">';

      for (var j = 0; j < q.options.length; j++) {
        html += '<label class="comprehension-option">' +
          '<input type="radio" name="cq-' + i + '" value="' + j + '" class="comprehension-radio" data-qindex="' + i + '">' +
          '<span class="comprehension-option-text">' + escapeHtml(q.options[j]) + '</span>' +
        '</label>';
      }

      html += '</div>' + // .comprehension-options
        '<div class="comprehension-feedback"></div>' +
      '</div>'; // .comprehension-question
    }

    // Result area (hidden until all answered)
    html += '<div class="comprehension-result" style="display:none">' +
      '<div class="comprehension-score"></div>' +
      '<div class="comprehension-message"></div>' +
      '<button class="secondary-btn comprehension-retry-btn">🔄 Reintentar</button>' +
    '</div>';

    // Navigation hint
    html += '<p class="comprehension-nav-hint" style="display:none">✅ Todas las preguntas respondidas. Revisa tu resultado arriba.</p>';

    html += '</div>'; // .comprehension-quiz
    return html;
  }

  /* ==========================================
     STEP 4: Grammar Card
     ========================================== */

  /**
   * Render a grammar explanation card with table and tips.
   * @param {object} stepData
   * @returns {string} HTML
   */
  function renderGrammar(stepData) {
    var table = stepData.table || {};
    var headers = table.headers || [];
    var rows = table.rows || [];
    var tips = stepData.tips || [];
    var audioExs = stepData.audio_examples || [];

    var html = '<div class="grammar-card">';

    // Explanation paragraph
    if (stepData.explanation) {
      html += '<p class="grammar-explanation">' + escapeHtml(stepData.explanation) + '</p>';
    }

    // Grammar table
    if (headers.length > 0 && rows.length > 0) {
      html += '<div class="grammar-table-wrap"><table class="grammar-table"><thead><tr>';
      for (var h = 0; h < headers.length; h++) {
        html += '<th>' + escapeHtml(headers[h]) + '</th>';
      }
      html += '</tr></thead><tbody>';
      for (var r = 0; r < rows.length; r++) {
        html += '<tr>';
        for (var c = 0; c < rows[r].length; c++) {
          html += '<td>' + escapeHtml(rows[r][c]) + '</td>';
        }
        html += '</tr>';
      }
      html += '</tbody></table></div>';
    }

    // Audio examples
    if (audioExs.length > 0) {
      html += '<div class="grammar-audio-list" style="margin-bottom:16px">';
      for (var a = 0; a < audioExs.length; a++) {
        html += '<div class="grammar-audio-item" style="padding:6px 0;display:flex;align-items:center;gap:8px">' +
          '<button class="dialogue-tts-btn grammar-tts-btn" data-text="' + escapeAttr(audioExs[a].example) + '" title="Escuchar" aria-label="Escuchar" style="flex-shrink:0">🔊</button> ' +
          '<strong>' + escapeHtml(audioExs[a].word) + '</strong>' +
          (audioExs[a].example ? ' — ' + escapeHtml(audioExs[a].example) : '') +
        '</div>';
      }
      html += '</div>';
    }

    // Tips
    if (tips.length > 0) {
      html += '<div class="grammar-tips">';
      for (var t = 0; t < tips.length; t++) {
        html += '<div class="grammar-tip">' + tips[t] + '</div>';
      }
      html += '</div>';
    }

    html += '</div>';
    return html;
  }

  /* ==========================================
     STEP 6: Rule Card
     ========================================== */

  /**
   * Render a grammar rule with conjugation pattern, exceptions, and common mistakes.
   * @param {object} stepData
   * @returns {string} HTML
   */
  function renderRule(stepData) {
    var conjugation = stepData.conjugation || {};
    var pattern = conjugation.pattern || [];
    var mistakes = stepData.common_mistakes || [];

    var html = '<div class="rule-card">';

    // Rule text
    if (stepData.rule) {
      html += '<p class="rule-text">' + escapeHtml(stepData.rule) + '</p>';
    }

    // Conjugation pattern grid
    if (pattern.length > 0) {
      html += '<div class="rule-conjugation">' +
        '<div class="rule-conjugation-title">' + escapeHtml(conjugation.verb || 'Conjugación') + '</div>' +
        '<div class="rule-pattern">';
      for (var p = 0; p < pattern.length; p++) {
        html += '<div class="rule-pattern-item">' +
          '<span class="rule-pattern-pronoun">' + escapeHtml(pattern[p].pronoun) + '</span>' +
          '<span class="rule-pattern-form">' + escapeHtml(pattern[p].form) + '</span>' +
          (pattern[p].example ? '<span class="rule-pattern-example" style="color:var(--text-secondary);font-size:0.85rem"> — ' + escapeHtml(pattern[p].example) + '</span>' : '') +
        '</div>';
      }
      html += '</div></div>';
    }

    // Exceptions
    if (stepData.exceptions) {
      html += '<div class="rule-exceptions">⚠️ ' + escapeHtml(stepData.exceptions) + '</div>';
    }

    // Common mistakes
    if (mistakes.length > 0) {
      html += '<div class="rule-mistakes">';
      for (var m = 0; m < mistakes.length; m++) {
        html += '<div class="rule-mistake">' + mistakes[m] + '</div>';
      }
      html += '</div>';
    }

    html += '</div>';
    return html;
  }

  /* ==========================================
     STEP 7: Reference Table
     ========================================== */

  /**
   * Render a multi-section reference table (cheat sheet).
   * @param {object} stepData
   * @returns {string} HTML
   */
  function renderReference(stepData) {
    var sheet = stepData.cheat_sheet || {};
    var sections = sheet.sections || [];

    if (sections.length === 0) {
      return '<div class="reference-card"><p>No hay datos de referencia disponibles.</p></div>';
    }

    var html = '<div class="reference-card">';

    for (var s = 0; s < sections.length; s++) {
      var section = sections[s];
      var headers = section.headers || [];
      var rows = section.rows || [];

      // Section title
      if (section.title) {
        html += '<div class="reference-section-title">' + escapeHtml(section.title) + '</div>';
      }

      // Section table
      if (headers.length > 0 && rows.length > 0) {
        html += '<div class="grammar-table-wrap"><table class="grammar-table"><thead><tr>';
        for (var h = 0; h < headers.length; h++) {
          html += '<th>' + escapeHtml(headers[h]) + '</th>';
        }
        html += '</tr></thead><tbody>';
        for (var r = 0; r < rows.length; r++) {
          html += '<tr>';
          for (var c = 0; c < rows[r].length; c++) {
            html += '<td>' + escapeHtml(rows[r][c]) + '</td>';
          }
          html += '</tr>';
        }
        html += '</tbody></table></div>';
      }
    }

    html += '</div>';
    return html;
  }

  /* ==========================================
     STEP 11: Culture Card
     ========================================== */

  /**
   * Render a culture note card with icon, text, and curiosities.
   * @param {object} stepData
   * @returns {string} HTML
   */
  function renderCulture(stepData) {
    var curiosities = stepData.curiosities || [];

    var html = '<div class="culture-card">';

    // Icon
    if (stepData.icon) {
      html += '<div class="culture-icon">' + stepData.icon + '</div>';
    }

    // Note text
    if (stepData.note) {
      html += '<p class="culture-note">' + escapeHtml(stepData.note) + '</p>';
    }

    // Curiosities list
    if (curiosities.length > 0) {
      html += '<div class="culture-curiosities">';
      for (var c = 0; c < curiosities.length; c++) {
        html += '<div class="culture-curiosity">' + curiosities[c] + '</div>';
      }
      html += '</div>';
    }

    html += '</div>';
    return html;
  }

  /* ==========================================
     STEP 14: Summary Card
     ========================================== */

  /**
   * Render a visual summary card with items grid.
   * @param {object} stepData
   * @returns {string} HTML
   */
  function renderSummary(stepData) {
    var items = stepData.items || [];

    var html = '<div class="summary-card">';

    // Title
    html += '<h3 class="summary-title">' + escapeHtml(stepData.title || 'Resumen') + '</h3>';

    // Encouragement message
    if (stepData.encouragement) {
      html += '<p class="summary-encouragement">' + stepData.encouragement + '</p>';
    }

    // Items grid
    if (items.length > 0) {
      html += '<div class="summary-items">';
      for (var i = 0; i < items.length; i++) {
        var item = items[i];
        html += '<div class="summary-item">';
        if (item.icon) {
          html += '<span class="summary-item-icon">' + item.icon + '</span>';
        }
        html += '<span class="summary-item-label">' + escapeHtml(item.label) + '</span>';
        if (item.mastered) {
          html += '<span class="summary-item-check">✅</span>';
        }
        if (item.count !== undefined && item.count !== null) {
          html += '<span class="summary-item-count">' + item.count + '</span>';
        }
        html += '</div>';
      }
      html += '</div>';
    }

    html += '</div>';
    return html;
  }

  /* ==========================================
     COMING SOON / FALLBACK
     ========================================== */

  /**
   * Render a coming-soon stub card or an unknown-type fallback.
   * @param {object} stepData
   * @returns {string} HTML
   */
  function renderComingSoon(stepData) {
    var message = stepData.message || 'Este paso estará disponible próximamente.';
    var isExplicitStub = stepData.type === 'coming-soon' || !stepData.type;

    // Log warning for unknown step types
    if (stepData.type && stepData.type !== 'coming-soon') {
      console.warn('[UnitRenderer] Unknown step type: "' + stepData.type + '", rendering fallback.');
    }

    var icon = isExplicitStub ? '⏳' : '🚧';
    var title = stepData.title || (isExplicitStub ? 'Próximamente' : 'En construcción');

    return '<div class="coming-soon-card">' +
      '<div class="coming-soon-icon">' + icon + '</div>' +
      '<div class="coming-soon-title">' + escapeHtml(title) + '</div>' +
      '<p class="coming-soon-message">' + escapeHtml(message) + '</p>' +
    '</div>';
  }

  /* ==========================================
     UTILITY HELPERS
     ========================================== */

  /**
   * Escape a string for safe insertion into HTML text content.
   * @param {string} str
   * @returns {string}
   */
  function escapeHtml(str) {
    if (!str && str !== 0) return '';
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(String(str)));
    return div.innerHTML;
  }

  /**
   * Escape a string for safe use in an HTML attribute value (double-quoted).
   * @param {string} str
   * @returns {string}
   */
  function escapeAttr(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* ==========================================
     PUBLIC API
     ========================================== */

  return {
    render: renderUnit,
    goToStep: goToStep,
    nextStep: nextStep,
    prevStep: prevStep,
    getProgress: getProgress
  };

  /* ==========================================
     NAVIGATION (PUBLIC API BODY)
     ========================================== */

  /**
   * Navigate to a specific step by 0-based index.
   * @param {number} stepIndex
   */
  function goToStep(stepIndex) {
    if (_state.isTransitioning) return;
    if (stepIndex < 0 || stepIndex >= _state.totalSteps) return;
    _state.isTransitioning = true;
    _state.currentStep = stepIndex;
    renderCurrentStep();
    _state.isTransitioning = false;
  }

  /**
   * Advance to the next step.
   */
  function nextStep() {
    if (_state.isTransitioning) return;
    var next = _state.currentStep + 1;
    if (next >= _state.totalSteps) return;
    goToStep(next);
  }

  /**
   * Go back to the previous step.
   */
  function prevStep() {
    if (_state.isTransitioning) return;
    var prev = _state.currentStep - 1;
    if (prev < 0) return;
    goToStep(prev);
  }

  /**
   * Get current progress information.
   * @returns {object} { currentStep, totalSteps, percent }
   */
  function getProgress() {
    return {
      currentStep: _state.currentStep,
      totalSteps: _state.totalSteps,
      percent: _state.totalSteps > 0
        ? Math.round(((_state.currentStep + 1) / _state.totalSteps) * 100)
        : 0
    };
  }
})();
