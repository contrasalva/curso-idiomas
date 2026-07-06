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
    'construccion':           renderStep5,
    'regla':                  renderRule,
    'tabla-referencia':       renderReference,
    'ejercicios-escalonados': renderStep8,
    'vocabulario':            renderStep9,
    'pronunciacion':          renderStep10,
    'cultura':                renderCulture,
    'conversacion-guiada':    renderStep12,
    'conversacion-libre':     renderStep13,
    'resumen-visual':         renderSummary,
    'repaso-inteligente':     renderStep15,
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

    // Hide static section-nav — nav is now rendered dynamically inside .step-sticky
    var unitSection = document.getElementById('section-unit');
    if (unitSection) {
      var staticNav = unitSection.querySelector('.section-nav');
      if (staticNav) staticNav.style.display = 'none';
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
      '<div class="step-sticky">' +
        '<nav class="step-sticky-nav" aria-label="Navegación">' +
          '<button class="nav-home-btn" data-section="home" aria-label="Ir al inicio">🏠 Inicio</button>' +
          '<span class="nav-separator">›</span>' +
          '<span class="nav-current">' + escapeHtml(unit.title) + '</span>' +
        '</nav>' +
      '</div>' +
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

    // 1. Sticky bar: breadcrumb nav + step header + progress
    html += '<div class="step-sticky">';

    // Breadcrumb nav (moved from static HTML into the sticky wrapper)
    var unitName = _state.data.title || 'Unidad';
    html += '<nav class="step-sticky-nav" aria-label="Navegación">' +
      '<button class="nav-home-btn" data-section="home" aria-label="Ir al inicio">🏠 Inicio</button>' +
      '<span class="nav-separator">›</span>' +
      '<span class="nav-current">' + escapeHtml(unitName) + '</span>' +
      '</nav>';

    // Step header with phase badge
    html += '<div class="step-header">';
    if (phase.badge) {
      html += '<span class="step-phase-badge" style="background:' + phase.color + '20;color:' + phase.color + '">' +
        phase.badge + '</span>';
    }
    html += '<h2 class="step-title">' + escapeHtml(stepTitle) + '</h2>';
    html += '</div>';

    // Progress bar
    var pct = Math.round(((idx + 1) / 15) * 100);
    html += '<div class="step-progress">' +
      '<div class="step-progress-bar">' +
        '<div class="step-progress-fill" style="width:' + pct + '%"></div>' +
      '</div>' +
      '<div class="step-progress-label">Paso ' + (idx + 1) + ' de 15 · ' + pct + '%</div>' +
    '</div>';

    html += '</div>'; // step-sticky

    // 3. Step content (delegate to type-specific renderer)
    var renderFn = STEP_RENDERERS[stepData.type] || renderComingSoon;
    html += '<div class="step-content">' + renderFn(stepData) + '</div>';

    // 4. Step indicator dots (15 color-coded dots)
    html += buildIndicatorHtml(displaySteps, idx);

    // 5. Navigation buttons
    var isFirst = idx === 0;
    var isLast = idx === 14;
    var nextLabel = isLast ? '🏠 Ir al inicio' : 'Siguiente →';
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
          profile.unitProgress[_state.unitId] = { levelScores: {} };
        }
        if (!profile.unitProgress[_state.unitId].levelScores) {
          profile.unitProgress[_state.unitId].levelScores = {};
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
      profile.unitProgress[_state.unitId] = { levelScores: {} };
    }
    if (!profile.unitProgress[_state.unitId].levelScores) {
      profile.unitProgress[_state.unitId].levelScores = {};
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

    // Token builder wiring (step 5)
    wireStep5(container);

    // Step 8 — ejercicios-escalonados wiring
    wireStep8(container);

    // Step 9 — vocabulario wiring
    wireStep9(container);

    // Step 10 — pronunciacion wiring
    wireStep10(container);

    // Step 12 & 13 — conversation wiring
    wireConversation(container);

    // Step 15 — smart review wiring
    wireStep15(container);
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
     STEP 5: Construcción — Token Builder
     ========================================== */

  /**
   * Color mapping for token roles.
   */
  var TOKEN_COLORS = {
    subject: '#2563eb',
    verb: '#16a34a',
    complement: '#ea580c'
  };

  /**
   * Background (20% opacity) for token roles.
   */
  function getTokenBg(role) {
    switch (role) {
      case 'subject': return '#2563eb20';
      case 'verb': return '#16a34a20';
      case 'complement': return '#ea580c20';
      default: return '#6b728020';
    }
  }

  /**
   * Fisher-Yates shuffle (returns new array, does not mutate original).
   * @param {Array} arr
   * @returns {Array}
   */
  function shuffleArray(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i];
      a[i] = a[j];
      a[j] = tmp;
    }
    return a;
  }

  /**
   * Render step 5 — construccion: color-coded token builder.
   * Renders static containers; wiring is done in wireStep5.
   * @param {object} stepData
   * @returns {string} HTML
   */
  function renderStep5(stepData) {
    var sentences = stepData.sentences || [];
    if (!sentences || sentences.length === 0) {
      return renderComingSoon(stepData);
    }

    // Build empty scaffold — wireStep5 will populate dynamically
    var html = '<div class="construccion-container" data-step5-init="true">' +
      '<p class="builder-hint"></p>' +
      '<div class="builder-slots"></div>' +
      '<div class="word-tokens"></div>' +
      '<div class="builder-feedback"></div>' +
      '<div class="builder-progress"></div>' +
    '</div>';

    return html;
  }

  /**
   * Wire step 5 interactions: token placement, validation, progression.
   * @param {HTMLElement} container
   */
  function wireStep5(container) {
    var construccion = container.querySelector('.construccion-container');
    if (!construccion) return;

    var stepData = _state.data.steps[_state.currentStep];
    var sentences = stepData.sentences || [];
    if (!sentences || sentences.length === 0) return;

    var currentIdx = 0;
    var slots = [];     // Array of {text,role}|null — one per position
    var pool = [];      // Array of {text,role} — available tokens
    var isTransitioning = false;

    /** Disable Next until all sentences are done */
    disableNextBtn();

    /** Setup a sentence at the given index */
    function setupSentence(idx) {
      var sentence = sentences[idx];
      if (!sentence) return;

      slots = sentence.tokens.map(function() { return null; });
      pool = shuffleArray(sentence.tokens.map(function(t) {
        return { text: t.text, role: t.role };
      }));
      isTransitioning = false;
      renderSentence(sentence, idx);
    }

    /** Re-render the slots and token pool for current state */
    function renderSentence(sentence, idx) {
      if (!construccion) return;

      // Hint
      var hintEl = construccion.querySelector('.builder-hint');
      if (hintEl) hintEl.textContent = sentence.translation;

      // Slots
      var slotsEl = construccion.querySelector('.builder-slots');
      slotsEl.innerHTML = '';
      for (var s = 0; s < slots.length; s++) {
        var slotDiv = document.createElement('div');
        slotDiv.className = 'builder-slot';
        slotDiv.setAttribute('data-slot-index', s);
        if (slots[s]) {
          slotDiv.classList.add('builder-slot--filled');
          slotDiv.textContent = slots[s].text;
          slotDiv.style.borderColor = TOKEN_COLORS[slots[s].role] || '#94a3b8';
          slotDiv.style.color = TOKEN_COLORS[slots[s].role] || '#94a3b8';
        }
        slotsEl.appendChild(slotDiv);
      }

      // Wire slot clicks — tap filled slot returns token to pool
      var slotDivs = slotsEl.querySelectorAll('.builder-slot');
      for (var si = 0; si < slotDivs.length; si++) {
        (function(slotIdx) {
          slotDivs[slotIdx].addEventListener('click', function() {
            if (isTransitioning) return;
            if (slots[slotIdx]) {
              pool.push(slots[slotIdx]);
              slots[slotIdx] = null;
              renderSentence(sentence, idx);
            }
          });
        })(si);
      }

      // Token pool
      var poolEl = construccion.querySelector('.word-tokens');
      poolEl.innerHTML = '';
      for (var t = 0; t < pool.length; t++) {
        var token = pool[t];
        var color = TOKEN_COLORS[token.role] || '#6b7280';
        var btn = document.createElement('button');
        btn.className = 'word-token';
        btn.textContent = token.text;
        btn.setAttribute('data-text', token.text);
        btn.setAttribute('data-role', token.role);
        btn.style.backgroundColor = getTokenBg(token.role);
        btn.style.color = color;
        btn.style.borderColor = color;
        poolEl.appendChild(btn);
      }

      // Wire token clicks — tap to place in next empty slot
      var tokenBtns = poolEl.querySelectorAll('.word-token');
      for (var tb = 0; tb < tokenBtns.length; tb++) {
        (function(btn) {
          btn.addEventListener('click', function() {
            if (isTransitioning) return;
            var text = btn.getAttribute('data-text');
            var role = btn.getAttribute('data-role');

            // Find first empty slot
            var emptyIdx = -1;
            for (var e = 0; e < slots.length; e++) {
              if (!slots[e]) {
                emptyIdx = e;
                break;
              }
            }
            if (emptyIdx === -1) return;

            // Find matching token in pool
            var poolIdx = -1;
            for (var p = 0; p < pool.length; p++) {
              if (pool[p].text === text && pool[p].role === role) {
                poolIdx = p;
                break;
              }
            }
            if (poolIdx === -1) return;

            // Move token from pool to slot
            var tok = pool.splice(poolIdx, 1)[0];
            slots[emptyIdx] = tok;
            renderSentence(sentence, idx);

            // Check if all slots are now filled
            var allFilled = true;
            for (var f = 0; f < slots.length; f++) {
              if (!slots[f]) { allFilled = false; break; }
            }
            if (allFilled) {
              validateSentence(sentence);
            }
          });
        })(tokenBtns[tb]);
      }

      // Progress
      var progressEl = construccion.querySelector('.builder-progress');
      if (progressEl) {
        progressEl.textContent = 'Frase ' + (idx + 1) + ' de ' + sentences.length;
      }

      // Clear feedback
      var feedbackEl = construccion.querySelector('.builder-feedback');
      if (feedbackEl) {
        feedbackEl.textContent = '';
        feedbackEl.className = 'builder-feedback';
      }
    }

    /** Validate the current sentence after all slots are filled */
    function validateSentence(sentence) {
      isTransitioning = true;

      var allCorrect = true;
      var slotEls = construccion.querySelectorAll('.builder-slot');

      for (var v = 0; v < slots.length; v++) {
        if (slots[v] && slots[v].text === sentence.tokens[v].text) {
          slotEls[v].classList.add('builder-slot--correct');
        } else {
          slotEls[v].classList.add('builder-slot--incorrect');
          allCorrect = false;
        }
      }

      var feedbackEl = construccion.querySelector('.builder-feedback');

      if (allCorrect) {
        feedbackEl.textContent = '✓ ¡Correcto!';
        feedbackEl.className = 'builder-feedback builder-feedback--correct';

        setTimeout(function() {
          if (currentIdx + 1 < sentences.length) {
            currentIdx++;
            setupSentence(currentIdx);
          } else {
            // All sentences completed — enable Next
            feedbackEl.textContent = '✓ ¡Todas las frases completadas!';
            feedbackEl.className = 'builder-feedback builder-feedback--correct';
            enableNextBtn();
          }
        }, 1500);
      } else {
        feedbackEl.textContent = '✗ Intenta de nuevo';
        feedbackEl.className = 'builder-feedback builder-feedback--incorrect';

        // Return wrong tokens to pool; keep correct ones in place
        var newSlots = slots.slice();
        for (var w = 0; w < slots.length; w++) {
          if (slots[w] && slots[w].text !== sentence.tokens[w].text) {
            pool.push(slots[w]);
            newSlots[w] = null;
          }
        }
        slots = newSlots;

        // Re-render after brief delay (removes red/green classes)
        setTimeout(function() {
          isTransitioning = false;
          renderSentence(sentence, currentIdx);
        }, 1200);
      }
    }

    // Bootstrap with first sentence
    setupSentence(0);
  }

  /* ==========================================
     STEP 8: Ejercicios Escalonados
     ========================================== */

  /**
   * Render step 8 — difficulty-tiered exercises (N1-N7).
   * Displays difficulty tabs, current question, submit/validate flow.
   * @param {object} stepData
   * @returns {string} HTML
   */
  function renderStep8(stepData) {
    var questions = stepData.questions || [];
    if (questions.length === 0) return renderComingSoon(stepData);

    // Group questions by nivel
    var byNivel = {};
    for (var qi = 0; qi < questions.length; qi++) {
      var q = questions[qi];
      var n = q.nivel || 1;
      if (!byNivel[n]) byNivel[n] = [];
      byNivel[n].push(q);
    }

    // Ensure levels 1-7 all exist
    for (var li = 1; li <= 7; li++) {
      if (!byNivel[li]) byNivel[li] = [];
    }

    // Difficulty profile from Progress
    var profile = null;
    try {
      profile = App.Progress.get('default');
    } catch (e) { /* ignore */ }

    var html = '<div class="step8-container" data-step8="true">';

    // Difficulty tabs
    html += '<div class="difficulty-tabs" role="tablist">';
    for (var ni = 1; ni <= 7; ni++) {
      var levelQuestions = byNivel[ni] || [];
      var isUnlocked = App.DifficultyEngine.isLevelUnlocked(ni, profile);
      var lockedLevels = App.DifficultyEngine.getLockedLevels(profile);
      var isLocked = lockedLevels.indexOf(ni) >= 0;
      var scores = App.DifficultyEngine.getLevelScores(profile);
      var levelScore = scores ? scores[ni] : null;
      var isPassed = levelScore && levelScore >= 80;

      var tabClass = 'difficulty-tab';
      if (isLocked) tabClass += ' difficulty-tab--locked';
      else if (isPassed) tabClass += ' difficulty-tab--passed';
      if (ni === 1 || isUnlocked) tabClass += ' difficulty-tab--active';

      html += '<button class="' + tabClass + '" data-nivel="' + ni + '" role="tab" ' +
        (isLocked ? 'disabled' : '') + '>' +
        '<span class="level-badge">N' + ni + '</span>' +
        '<span class="difficulty-progress">' + (levelQuestions.length) + ' ejercicios</span>' +
        (levelScore !== null ? '<span class="difficulty-score">' + levelScore + '%</span>' : '') +
        (isPassed ? '<span class="difficulty-check">✓</span>' : '') +
      '</button>';
    }
    html += '</div>';

    // Content area for questions — rendered dynamically
    html += '<div class="step8-content" id="step8-content"></div>';

    // Submit button row
    html += '<div class="step8-actions" style="margin-top:16px;display:flex;gap:8px">' +
      '<button class="primary-btn step8-submit-btn" id="step8-submit" style="display:none">Comprobar</button>' +
    '</div>';

    // Level feedback area
    html += '<div class="step8-feedback" id="step8-feedback" style="margin-top:12px;font-size:0.95rem;font-weight:600;min-height:28px"></div>';

    html += '</div>';

    return html;
  }

  /**
   * Wire step 8 interactions once the DOM is rendered.
   * Called from wireTtsButtons (or independently after renderCurrentStep builds the DOM).
   * @param {HTMLElement} container
   */
  function wireStep8(container) {
    var step8 = container.querySelector('.step8-container');
    if (!step8) return;

    var stepData = _state.data.steps[_state.currentStep];
    if (!stepData) return;

    var questions = stepData.questions || [];
    if (questions.length === 0) return;

    // Group & sort questions by nivel
    var byNivel = {};
    for (var qi = 0; qi < questions.length; qi++) {
      var q = questions[qi];
      var n = q.nivel || 1;
      if (!byNivel[n]) byNivel[n] = [];
      byNivel[n].push(q);
    }
    for (var li = 1; li <= 7; li++) {
      if (!byNivel[li]) byNivel[li] = [];
    }

    // State
    var currentNivel = 1;
    var levelProgress = {};   // { nivel: { currentQ: 0, answers: [], scores: [] } }
    for (var li2 = 1; li2 <= 7; li2++) {
      levelProgress[li2] = { currentQ: 0, answers: [], scores: [] };
    }

    var profile = null;
    try {
      profile = App.Progress.get('default');
    } catch (e) { /* ignore */ }

    var submitBtn = document.getElementById('step8-submit');
    var feedbackEl = document.getElementById('step8-feedback');
    var contentEl = document.getElementById('step8-content');

    /** Render current question for the active nivel */
    function renderCurrentQuestion() {
      if (!contentEl) return;
      var prog = levelProgress[currentNivel];
      var levelQs = byNivel[currentNivel] || [];

      if (prog.currentQ >= levelQs.length) {
        // All questions for this level answered — show completion
        contentEl.innerHTML = '<div style="text-align:center;padding:32px">' +
          '<div style="font-size:2rem;margin-bottom:12px">✅</div>' +
          '<p style="font-size:1.1rem;font-weight:600">Nivel ' + currentNivel + ' completado</p>' +
          '</div>';
        if (submitBtn) submitBtn.style.display = 'none';
        return;
      }

      var questionData = levelQs[prog.currentQ];
      contentEl.innerHTML = '';
      App.ExerciseEngine.renderQuestion(questionData, currentNivel, contentEl);

      if (submitBtn) {
        // Hide submit for N1 (auto-submits on radio change); show for others
        submitBtn.style.display = currentNivel === 1 ? 'none' : '';
        submitBtn.disabled = false;
      }
      if (feedbackEl) feedbackEl.textContent = '';
    }

    /** Gather user answer from the DOM based on nivel type */
    function gatherAnswer(nivel, questionData) {
      var contentEl = document.getElementById('step8-content');
      if (!contentEl) return null;

      switch (nivel) {
        case 1: {
          // Read selected radio
          var selectedRadio = contentEl.querySelector('.nlevel-radio:checked');
          return selectedRadio ? parseInt(selectedRadio.value, 10) : null;
        }
        case 2:
        case 5: {
          // Read input value
          var input = contentEl.querySelector('input.nlevel-input[name="nlevel-answer"]');
          return input ? input.value.trim() : null;
        }
        case 3:
        case 6:
        case 7: {
          // Read textarea value
          var ta = contentEl.querySelector('textarea.nlevel-textarea[name="nlevel-answer"]');
          return ta ? ta.value.trim() : null;
        }
        case 4: {
          // Read reorder selected words from wrapper._reorderSelected
          var wrapper = contentEl.querySelector('.nlevel-reorder');
          if (wrapper && wrapper._reorderSelected) {
            if (wrapper._reorderSelected.length === wrapper._reorderCorrectLength) {
              return wrapper._reorderSelected.slice();
            }
            return null; // Not all words placed yet
          }
          return null;
        }
        default:
          return null;
      }
    }

    /** Submit the current question for validation */
    function submitCurrentQuestion() {
      var prog = levelProgress[currentNivel];
      var levelQs = byNivel[currentNivel] || [];
      if (prog.currentQ >= levelQs.length) return;

      var questionData = levelQs[prog.currentQ];

      // Gather user answer based on nivel type
      var userAnswer = gatherAnswer(currentNivel, questionData);
      if (userAnswer === null || userAnswer === undefined || userAnswer === '') {
        if (feedbackEl) feedbackEl.textContent = 'Responde la pregunta primero.';
        return;
      }

      var result = App.ExerciseEngine.validateAnswer(userAnswer, questionData, currentNivel);
      prog.answers.push(userAnswer);
      prog.scores.push(result.score);

      if (feedbackEl) {
        feedbackEl.textContent = result.feedback;
        feedbackEl.style.color = result.isCorrect ? '#16a34a' : '#ef4444';
      }

      // Disable submit for this question
      if (submitBtn) submitBtn.disabled = true;

      // Emit exercise:submitted event
      var evt = new CustomEvent('exercise:submitted', {
        detail: {
          stepIndex: _state.currentStep,
          nivel: currentNivel,
          questionIndex: prog.currentQ,
          answer: userAnswer,
          score: result.score,
          isCorrect: result.isCorrect
        }
      });
      document.dispatchEvent(evt);

      // Auto-advance to next question after a brief delay
      setTimeout(function () {
        prog.currentQ++;

        if (prog.currentQ >= levelQs.length) {
          // Level complete — calculate score and unlock next
          var avgScore = 0;
          for (var si = 0; si < prog.scores.length; si++) {
            avgScore += prog.scores[si];
          }
          avgScore = Math.round(avgScore / prog.scores.length);

          // Save level score via DifficultyEngine
          App.DifficultyEngine.submitLevelScore(currentNivel, avgScore, profile);
          if (profile) {
            App.Progress.save('default', profile);
          }

          // Unlock next level if passed
          if (avgScore >= 80 && currentNivel < 7) {
            currentNivel++;
            // Update tab active state
            updateTabs();
            renderCurrentQuestion();
            if (feedbackEl) {
              feedbackEl.textContent = '✓ ¡Nivel superado! Avanzando a N' + currentNivel + '...';
              feedbackEl.style.color = '#16a34a';
            }
          } else if (avgScore < 80 && currentNivel < 7) {
            // Failed — enable Next button if step wants to let them through
            // (allow continuing even if failed — pedagogical choice)
            renderCurrentQuestion();
            if (feedbackEl) {
              feedbackEl.textContent = 'Intenta de nuevo o continúa. Puedes repetir este nivel más tarde.';
              feedbackEl.style.color = '#f59e0b';
            }
          } else {
            // Last level (N7) completed
            renderCurrentQuestion();
            enableNextBtn();
          }
        } else {
          renderCurrentQuestion();
        }
      }, 800);
    }

    /** Update tab active/locked/passed styles */
    function updateTabs() {
      var tabs = step8.querySelectorAll('.difficulty-tab');
      for (var ti = 0; ti < tabs.length; ti++) {
        var tab = tabs[ti];
        var nivel = parseInt(tab.getAttribute('data-nivel'), 10);
        var isLocked = App.DifficultyEngine.getLockedLevels(profile).indexOf(nivel) >= 0;
        var scores = App.DifficultyEngine.getLevelScores(profile);
        var scoreVal = scores ? scores[nivel] : null;
        var isPassed = scoreVal && scoreVal >= 80;

        tab.classList.remove('difficulty-tab--active', 'difficulty-tab--passed', 'difficulty-tab--locked');
        if (isLocked) tab.classList.add('difficulty-tab--locked');
        else if (isPassed) tab.classList.add('difficulty-tab--passed');
        if (nivel === currentNivel) tab.classList.add('difficulty-tab--active');
      }
    }

    // Wire tab clicks
    var tabs = step8.querySelectorAll('.difficulty-tab:not([disabled])');
    for (var ti2 = 0; ti2 < tabs.length; ti2++) {
      tabs[ti2].addEventListener('click', function () {
        var nivel = parseInt(this.getAttribute('data-nivel'), 10);
        if (App.DifficultyEngine.isLevelUnlocked(nivel, profile)) {
          currentNivel = nivel;
          updateTabs();
          renderCurrentQuestion();
          if (submitBtn) submitBtn.style.display = '';
          if (feedbackEl) feedbackEl.textContent = '';
        }
      });
    }

    // Wire submit button
    if (submitBtn) {
      submitBtn.addEventListener('click', submitCurrentQuestion);
    }

    // Render first question
    renderCurrentQuestion();

    // Disable Next by default until level work progresses
    disableNextBtn();
  }

  /* ==========================================
     STEP 9: Vocabulario
     ========================================== */

  /**
   * Render step 9 — vocabulary word cards with TTS, flip, and mastered toggle.
   * @param {object} stepData
   * @returns {string} HTML
   */
  function renderStep9(stepData) {
    var words = stepData.words || [];
    if (words.length === 0) return renderComingSoon(stepData);

    var html = '<div class="step9-container" data-step9="true">';

    // Word count + search/filter header
    html += '<div class="vocab-header" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">' +
      '<p class="vocab-count" style="font-size:0.9rem;color:var(--text-secondary)">' + words.length + ' palabras en esta unidad</p>' +
      '<button class="secondary-btn vocab-flip-all-btn" id="vocab-flip-all"> Voltear todas</button>' +
    '</div>';

    // VocabularyViewer container — will be populated dynamically
    html += '<div class="vocab-viewer-container" id="vocab-viewer-container"></div>';

    html += '</div>';

    return html;
  }

  /**
   * Wire step 9 interactions — renders vocabulary viewer into the container.
   * @param {HTMLElement} container
   */
  function wireStep9(container) {
    var step9 = container.querySelector('.step9-container');
    if (!step9) return;

    var stepData = _state.data.steps[_state.currentStep];
    if (!stepData) return;

    var words = stepData.words || [];
    if (words.length === 0) return;

    var viewerContainer = document.getElementById('vocab-viewer-container');
    if (!viewerContainer) return;

    // Use VocabularyManager to render the paginated viewer
    if (App.VocabularyManager && typeof App.VocabularyManager.renderVocabularyViewer === 'function') {
      var viewer = App.VocabularyManager.renderVocabularyViewer(words, 12);
      viewerContainer.appendChild(viewer);
    } else {
      // Fallback: render basic cards
      fallbackRenderVocabulary(words, viewerContainer);
    }

    // Wire "Flip all" button
    var flipAllBtn = document.getElementById('vocab-flip-all');
    if (flipAllBtn) {
      var isFlipped = false;
      flipAllBtn.addEventListener('click', function () {
        isFlipped = !isFlipped;
        var cards = container.querySelectorAll('.vocab-card');
        for (var ci = 0; ci < cards.length; ci++) {
          if (isFlipped) {
            cards[ci].classList.add('vocab-card--flipped');
          } else {
            cards[ci].classList.remove('vocab-card--flipped');
          }
        }
        flipAllBtn.textContent = isFlipped ? ' Voltear todas' : ' Voltear todas';
      });
    }
  }

  /**
   * Fallback vocabulary renderer if VocabularyManager is not available.
   * @param {Array} words
   * @param {HTMLElement} container
   */
  function fallbackRenderVocabulary(words, container) {
    var perPage = 12;
    var totalPages = Math.max(1, Math.ceil(words.length / perPage));
    var currentPage = 0;

    var grid = document.createElement('div');
    grid.className = 'vocab-grid';

    var pagination = document.createElement('div');
    pagination.className = 'vocab-pagination';

    function renderPage(pageIdx) {
      grid.innerHTML = '';
      var start = pageIdx * perPage;
      var pageWords = words.slice(start, start + perPage);

      pageWords.forEach(function (w) {
        var card = document.createElement('div');
        card.className = 'vocab-card';

        var front = document.createElement('div');
        front.className = 'vocab-card__front';
        front.textContent = w.word;
        card.appendChild(front);

        var back = document.createElement('div');
        back.className = 'vocab-card__back';
        back.textContent = w.translation;
        card.appendChild(back);

        card.addEventListener('click', function () {
          card.classList.toggle('vocab-card--flipped');
        });

        grid.appendChild(card);
      });
    }

    container.appendChild(grid);
    renderPage(0);
  }

  /* ==========================================
     STEP 10: Pronunciación
     ========================================== */

  /**
   * Normalize a word for comparison: lowercase, strip diacritics and punctuation.
   * @param {string} word
   * @returns {string}
   */
  function normalizeWord(word) {
    return word.toLowerCase().trim()
      .replace(/[àáâãäå]/g, 'a')
      .replace(/[èéêë]/g, 'e')
      .replace(/[ìíîï]/g, 'i')
      .replace(/[òóôõö]/g, 'o')
      .replace(/[ùúûü]/g, 'u')
      .replace(/[.,!?;:'"¿¡-]/g, '');
  }

  /**
   * Compare an expected word against a recognized/typed word.
   * @param {string} expected
   * @param {string} recognized
   * @returns {{ status: string, score: number }}
   */
  function compareWord(expected, recognized) {
    var normExp = normalizeWord(expected);
    var normRec = normalizeWord(recognized);

    if (normExp === normRec) {
      return { status: 'correct', score: 100 };
    }

    // Check if one contains the other (partial match)
    if (normExp.indexOf(normRec) !== -1 || normRec.indexOf(normExp) !== -1) {
      return { status: 'partial', score: 50 };
    }

    // Check common prefix for close matches (e.g. "stai" vs "stay")
    if (normExp.length > 2 && normRec.length > 2) {
      var minLen = normExp.length < normRec.length ? normExp.length : normRec.length;
      var commonLen = 0;
      for (var ci = 0; ci < minLen; ci++) {
        if (normExp[ci] === normRec[ci]) commonLen++; else break;
      }
      if (commonLen >= Math.ceil(normExp.length * 0.6)) {
        return { status: 'partial', score: 50 };
      }
    }

    return { status: 'incorrect', score: 0 };
  }

  /**
   * Render step 10 — pronunciacion: listen, repeat, word-by-word feedback.
   * @param {object} stepData
   * @returns {string} HTML
   */
  function renderStep10(stepData) {
    var phrases = stepData.phrases || [];
    if (!phrases || phrases.length === 0) return renderComingSoon(stepData);

    var html = '<div class="pronunciation-container" data-step10="true">';

    // Intro
    html += '<p class="pronunciation-intro" style="margin-bottom:20px;font-size:0.95rem;color:var(--text-secondary);line-height:1.6">' +
      'Escucha cada frase, luego repítela en voz alta. Recibirás retroalimentación palabra por palabra.' +
    '</p>';

    // Phrase cards
    for (var pi = 0; pi < phrases.length; pi++) {
      var phrase = phrases[pi];

      html += '<div class="pronunciation-phrase-card" data-phrase-index="' + pi + '" style="' + (pi > 0 ? 'display:none' : '') + '">';

      // Phrase text
      html += '<div class="pronunciation-phrase-text" style="font-size:1.3rem;font-weight:700;color:var(--text);margin-bottom:4px">' +
        escapeHtml(phrase.text) +
      '</div>';

      // Translation
      if (phrase.translation) {
        html += '<div class="pronunciation-phrase-translation" style="font-size:0.9rem;color:var(--text-secondary);margin-bottom:16px">' +
          escapeHtml(phrase.translation) +
        '</div>';
      }

      // Word containers (for highlighting and feedback coloring)
      html += '<div class="pronunciation-words" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px;justify-content:center">';
      if (phrase.words) {
        for (var wi = 0; wi < phrase.words.length; wi++) {
          html += '<span class="pronunciation-word" data-word-index="' + wi + '">' +
            escapeHtml(phrase.words[wi]) +
          '</span>';
        }
      }
      html += '</div>';

      // Controls
      html += '<div class="pronunciation-controls" style="display:flex;gap:8px;justify-content:center;margin-bottom:12px">' +
        '<button class="secondary-btn pronunciation-play-btn" data-phrase-index="' + pi + '" data-phrase-text="' + escapeAttr(phrase.text) + '">🔊 Reproducir</button>' +
        '<button class="primary-btn pronunciation-record-btn" data-phrase-index="' + pi + '">🎤 Grabar</button>' +
      '</div>';

      // Feedback area
      html += '<div class="pronunciation-feedback" data-phrase-index="' + pi + '" style="text-align:center;font-size:1rem;font-weight:600;min-height:28px;margin-bottom:4px"></div>';

      // Retry count
      html += '<div class="pronunciation-retry-count" data-phrase-index="' + pi + '" style="text-align:center;font-size:0.85rem;color:var(--text-secondary);min-height:22px"></div>';

      html += '</div>'; // .pronunciation-phrase-card
    }

    // Progress indicator
    html += '<div class="pronunciation-progress" style="text-align:center;font-size:0.9rem;color:var(--text-secondary);margin-top:16px">Frase 1 de ' + phrases.length + '</div>';

    // Text input fallback (hidden by default)
    html += '<div class="pronunciation-text-fallback" style="display:none;margin-top:16px;text-align:center">' +
      '<input type="text" class="pronunciation-text-input" placeholder="Escribe lo que escuchaste" style="padding:10px 14px;font-size:1rem;border:2px solid var(--border);border-radius:10px;width:80%;max-width:360px;margin-bottom:8px">' +
      '<div><button class="primary-btn pronunciation-check-btn">Comprobar</button></div>' +
    '</div>';

    html += '</div>'; // .pronunciation-container

    return html;
  }

  /**
   * Wire step 10 interactions: play, record, word comparison, progression.
   * @param {HTMLElement} container
   */
  function wireStep10(container) {
    var step10 = container.querySelector('.pronunciation-container');
    if (!step10) return;

    var stepData = _state.data.steps[_state.currentStep];
    var phrases = stepData.phrases || [];
    if (!phrases || phrases.length === 0) return;

    // Per-phrase state
    var phraseStates = {};
    for (var psi = 0; psi < phrases.length; psi++) {
      phraseStates[psi] = { retries: 0, passed: false };
    }

    var currentPhraseIdx = 0;
    var totalPhrases = phrases.length;

    // Disable Next until all phrases are completed
    disableNextBtn();

    /** Show only the current phrase card, hide others */
    function showCurrentPhrase() {
      var cards = step10.querySelectorAll('.pronunciation-phrase-card');
      for (var sci = 0; sci < cards.length; sci++) {
        cards[sci].style.display = (sci === currentPhraseIdx) ? '' : 'none';
      }

      // Update progress
      var progEl = step10.querySelector('.pronunciation-progress');
      if (progEl) {
        progEl.textContent = 'Frase ' + (currentPhraseIdx + 1) + ' de ' + totalPhrases;
      }

      // Clear word classes and feedback for current phrase
      var card = step10.querySelector('.pronunciation-phrase-card[data-phrase-index="' + currentPhraseIdx + '"]');
      if (card) {
        var wordEls = card.querySelectorAll('.pronunciation-word');
        for (var wei = 0; wei < wordEls.length; wei++) {
          wordEls[wei].className = 'pronunciation-word';
        }
      }

      var fbEl = step10.querySelector('.pronunciation-feedback[data-phrase-index="' + currentPhraseIdx + '"]');
      if (fbEl) {
        fbEl.textContent = '';
        fbEl.className = 'pronunciation-feedback';
      }

      // Update retry display
      var state = phraseStates[currentPhraseIdx];
      var retryEl = step10.querySelector('.pronunciation-retry-count[data-phrase-index="' + currentPhraseIdx + '"]');
      if (retryEl) {
        retryEl.textContent = state.retries > 0 ? 'Intento ' + (state.retries + 1) + ' de 3' : '';
      }

      // Hide text fallback
      var fallbackEl = step10.querySelector('.pronunciation-text-fallback');
      if (fallbackEl) fallbackEl.style.display = 'none';
    }

    showCurrentPhrase();

    /* --- Play button wiring --- */
    var playBtns = step10.querySelectorAll('.pronunciation-play-btn');
    for (var pbi = 0; pbi < playBtns.length; pbi++) {
      playBtns[pbi].addEventListener('click', function(e) {
        var btn = e.currentTarget;
        var phraseIdx = parseInt(btn.getAttribute('data-phrase-index'), 10);
        var text = btn.getAttribute('data-phrase-text');
        var card = step10.querySelector('.pronunciation-phrase-card[data-phrase-index="' + phraseIdx + '"]');
        if (!card) return;
        var wordEls = card.querySelectorAll('.pronunciation-word');
        var activeWord = -1;

        function onWordBoundary(wordIndex) {
          // Remove highlight from previous word
          if (activeWord >= 0 && wordEls[activeWord]) {
            wordEls[activeWord].classList.remove('pronunciation-word--speaking');
          }
          // Highlight current word
          activeWord = wordIndex;
          if (wordEls[wordIndex]) {
            wordEls[wordIndex].classList.add('pronunciation-word--speaking');
          }
        }

        App.SpeechManager.speakWithHighlight(text, onWordBoundary).then(function() {
          // Clear all highlights on completion
          if (activeWord >= 0 && wordEls[activeWord]) {
            wordEls[activeWord].classList.remove('pronunciation-word--speaking');
          }
          activeWord = -1;
        });
      });
    }

    /* --- Record button wiring --- */
    var recordBtns = step10.querySelectorAll('.pronunciation-record-btn');
    for (var rbi = 0; rbi < recordBtns.length; rbi++) {
      recordBtns[rbi].addEventListener('click', function(e) {
        var btn = e.currentTarget;
        var phraseIdx = parseInt(btn.getAttribute('data-phrase-index'), 10);
        var phrase = phrases[phraseIdx];
        if (!phrase) return;

        // Show text fallback if speech recognition is not supported
        if (!App.SpeechManager.isSupported()) {
          showTextFallback(phraseIdx);
          return;
        }

        // Start speech recognition
        btn.disabled = true;
        btn.textContent = '🎤 Escuchando...';

        var timeoutId = setTimeout(function() {
          window.removeEventListener('speech:result', onResultHandler);
          btn.disabled = false;
          btn.textContent = '🎤 Grabar';
          var fb = step10.querySelector('.pronunciation-feedback[data-phrase-index="' + phraseIdx + '"]');
          if (fb) {
            fb.textContent = 'No se detectó voz. Intenta de nuevo o escribe.';
            fb.className = 'pronunciation-feedback pronunciation-feedback--incorrect';
          }
        }, 8000);

        function onResultHandler(event) {
          var detail = event.detail;
          if (!detail.isFinal) return;
          window.removeEventListener('speech:result', onResultHandler);
          clearTimeout(timeoutId);

          btn.disabled = false;
          btn.textContent = '🎤 Grabar';

          var transcript = detail.transcript || '';
          processRecognition(phraseIdx, transcript.trim());
        }

        window.addEventListener('speech:result', onResultHandler);
        App.SpeechManager.start();
      });
    }

    /**
     * Show text input fallback for a phrase (when SpeechRecognition unavailable).
     * @param {number} phraseIdx
     */
    function showTextFallback(phraseIdx) {
      var fallbackEl = step10.querySelector('.pronunciation-text-fallback');
      if (!fallbackEl) return;
      fallbackEl.style.display = 'block';

      var input = fallbackEl.querySelector('.pronunciation-text-input');
      var checkBtn = fallbackEl.querySelector('.pronunciation-check-btn');
      if (!input || !checkBtn) return;

      input.value = '';
      input.focus();

      // Replace button to avoid duplicate listeners
      var newBtn = checkBtn.cloneNode(true);
      checkBtn.parentNode.replaceChild(newBtn, checkBtn);

      newBtn.addEventListener('click', function() {
        var text = input.value.trim();
        if (!text) return;
        processRecognition(phraseIdx, text);
        fallbackEl.style.display = 'none';
      });
    }

    /**
     * Process a recognition result (speech or typed text).
     * Compares word by word, shows color-coded feedback, handles retries.
     * @param {number} phraseIdx
     * @param {string} transcript
     */
    function processRecognition(phraseIdx, transcript) {
      var phrase = phrases[phraseIdx];
      var state = phraseStates[phraseIdx];
      var expectedWords = phrase.words || [];
      var recognizedWords = transcript ? transcript.split(/\s+/) : [];

      var card = step10.querySelector('.pronunciation-phrase-card[data-phrase-index="' + phraseIdx + '"]');
      var wordEls = card ? card.querySelectorAll('.pronunciation-word') : [];
      var totalScore = 0;

      // Compare each expected word
      for (var wi = 0; wi < expectedWords.length; wi++) {
        var expected = expectedWords[wi];
        var recognized = wi < recognizedWords.length ? recognizedWords[wi] : '';
        var result = compareWord(expected, recognized);
        totalScore += result.score;

        if (wordEls[wi]) {
          wordEls[wi].className = 'pronunciation-word';
          if (result.status === 'correct') {
            wordEls[wi].classList.add('pronunciation-word--correct');
          } else if (result.status === 'partial') {
            wordEls[wi].classList.add('pronunciation-word--partial');
          } else {
            wordEls[wi].classList.add('pronunciation-word--incorrect');
          }
        }
      }

      // Mark any extra recognized words as incorrect (they exceed expected count)
      for (var xi = expectedWords.length; xi < recognizedWords.length; xi++) {
        totalScore += 0; // extra words = 0
        // No word element for extra words, but they drag the score down
      }

      var avgScore = Math.round(totalScore / expectedWords.length);
      var feedbackEl = step10.querySelector('.pronunciation-feedback[data-phrase-index="' + phraseIdx + '"]');

      if (avgScore >= 80) {
        state.passed = true;
        if (feedbackEl) {
          feedbackEl.textContent = '✓ ¡Excelente! (' + avgScore + '%)';
          feedbackEl.className = 'pronunciation-feedback pronunciation-feedback--correct';
        }
        moveToNextPhrase(phraseIdx);
      } else {
        state.retries++;

        if (state.retries >= 3) {
          // Record to missed items in profile
          var profile = App.Progress.get('default');
          if (profile) {
            if (!profile.missedItems) profile.missedItems = [];
            profile.missedItems.push({
              unitId: _state.unitId,
              phrase: phrase.text,
              type: 'pronunciation',
              timestamp: Date.now()
            });
            App.Progress.save('default', profile);
          }

          if (feedbackEl) {
            feedbackEl.textContent = 'Puedes continuar, pero practica más tarde (' + avgScore + '%)';
            feedbackEl.className = 'pronunciation-feedback pronunciation-feedback--warning';
          }
          moveToNextPhrase(phraseIdx);
        } else {
          if (feedbackEl) {
            feedbackEl.textContent = 'Intenta de nuevo (' + avgScore + '%). Necesitas 80% o más.';
            feedbackEl.className = 'pronunciation-feedback pronunciation-feedback--incorrect';
          }
          var retryEl = step10.querySelector('.pronunciation-retry-count[data-phrase-index="' + phraseIdx + '"]');
          if (retryEl) {
            retryEl.textContent = 'Intento ' + (state.retries + 1) + ' de 3';
          }

          // Re-enable record button for retry
          var recordBtn = step10.querySelector('.pronunciation-record-btn[data-phrase-index="' + phraseIdx + '"]');
          if (recordBtn) {
            recordBtn.disabled = false;
            recordBtn.textContent = '🎤 Grabar';
          }
        }
      }
    }

    /**
     * Advance to the next phrase, or enable Next when all are done.
     * @param {number} currentIdx
     */
    function moveToNextPhrase(currentIdx) {
      if (currentIdx + 1 < totalPhrases) {
        currentPhraseIdx = currentIdx + 1;
        showCurrentPhrase();
      } else {
        // All phrases completed — enable Next button
        var progEl = step10.querySelector('.pronunciation-progress');
        if (progEl) {
          progEl.textContent = '✓ Todas las frases completadas';
        }
        enableNextBtn();
      }
    }
  }

  /* ==========================================
     STEP 12: Conversación Guiada (Guided)
     STEP 13: Conversación Libre (Free)
     ========================================== */

  /**
   * Render step 12 — conversacion-guiada: guided conversation with hints and feedback.
   * @param {object} stepData
   * @returns {string} HTML
   */
  function renderStep12(stepData) {
    return renderConversationCard(stepData);
  }

  /**
   * Render step 13 — conversacion-libre: free conversation without hints/feedback.
   * @param {object} stepData
   * @returns {string} HTML
   */
  function renderStep13(stepData) {
    return renderConversationCard(stepData);
  }

  /**
   * Render the conversation card HTML (shared by guided and free).
   * @param {object} stepData
   * @returns {string} HTML
   */
  function renderConversationCard(stepData) {
    var tree = stepData.dialogTree;
    if (!tree || !tree.nodes || !tree.startNodeId) {
      return renderComingSoon(stepData);
    }

    var startNode = tree.nodes[tree.startNodeId];
    var initialPrompt = startNode ? startNode.prompt : '';
    var initialTranslation = startNode ? (startNode.promptTranslation || '') : '';

    var html = '<div class="conv-card">';

    // IA bubble with TTS
    html += '<div class="conv-bubble">' +
      '<div class="conv-bubble-text">' + escapeHtml(initialPrompt) + '</div>' +
      '<div class="conv-bubble-translation">' + escapeHtml(initialTranslation) + '</div>' +
      '<button class="dialogue-tts-btn conv-tts-btn" data-text="' + escapeAttr(initialPrompt) + '" title="Escuchar" aria-label="Escuchar">🔊</button>' +
    '</div>';

    // Hints area (hidden in free mode via CSS, populated by JS in guided)
    html += '<div class="conv-hints"></div>';

    // Input area
    html += '<div class="conv-input-area">' +
      '<input type="text" class="conv-input" placeholder="Escribe tu respuesta en italiano..." autocomplete="off">' +
      '<button class="conv-send-btn" title="Enviar">Enviar</button>' +
      '<button class="conv-mic-btn" title="Usar micrófono">🎤</button>' +
    '</div>';

    // Feedback area
    html += '<div class="conv-feedback"></div>';

    html += '</div>'; // .conv-card

    return html;
  }

  /**
   * Wire conversation interactions for both guided and free modes.
   * Called from wireTtsButtons after the DOM is rendered.
   * @param {HTMLElement} container
   */
  function wireConversation(container) {
    var convCard = container.querySelector('.conv-card');
    if (!convCard) return;

    var stepData = _state.data.steps[_state.currentStep];
    if (!stepData || !stepData.dialogTree) return;

    var stepType = stepData.type;
    var mode = stepType === 'conversacion-libre' ? 'free' : 'guided';

    // Disable Next until conversation completes
    disableNextBtn();

    // DOM references
    var bubbleTextEl = convCard.querySelector('.conv-bubble-text');
    var bubbleTransEl = convCard.querySelector('.conv-bubble-translation');
    var ttsBtn = convCard.querySelector('.conv-tts-btn');
    var hintsEl = convCard.querySelector('.conv-hints');
    var inputEl = convCard.querySelector('.conv-input');
    var sendBtn = convCard.querySelector('.conv-send-btn');
    var micBtn = convCard.querySelector('.conv-mic-btn');
    var feedbackEl = convCard.querySelector('.conv-feedback');

    // Track consecutive misses per node (for free mode)
    var _consecutiveMisses = 0;

    // Register TTS click for this specific step's bubble
    if (ttsBtn) {
      // Remove old listener by cloning (safety against re-wiring)
      // Note: handleTtsClick already wires .dialogue-tts-btn globally via wireTtsButtons.
      // The data-text attribute is updated in onPrompt, so the global handler works.
    }

    // Start the ConversationEngine
    App.ConversationEngine.startDialog(stepData.dialogTree, mode, {
      onPrompt: function(node) {
        // Determine prompt text (use variation in free mode)
        var promptText = node._currentPrompt || node.prompt || '';
        var promptTrans = node.promptTranslation || '';

        bubbleTextEl.textContent = promptText;
        if (bubbleTransEl) {
          bubbleTransEl.textContent = promptTrans;
        }

        // Update TTS data attribute
        if (ttsBtn) {
          ttsBtn.setAttribute('data-text', promptText);
        }

        // Update hints (guided mode only)
        updateHints();

        // Clear input and feedback for next turn
        inputEl.value = '';
        feedbackEl.textContent = '';
        feedbackEl.className = 'conv-feedback';

        // Reset consecutive miss counter on node change
        _consecutiveMisses = 0;
      },

      onFeedback: function(feedback, isCorrect) {
        if (mode === 'guided') {
          // Show feedback in guided mode
          feedbackEl.textContent = feedback;
          feedbackEl.className = 'conv-feedback '
            + (isCorrect ? 'conv-feedback--correct' : 'conv-feedback--incorrect');
        } else {
          // Free mode: track misses silently, do not show feedback
          if (!isCorrect) {
            _consecutiveMisses++;
            // After 3 consecutive misses, save to missedItems in profile
            if (_consecutiveMisses >= 3) {
              saveMissedKeywords();
              _consecutiveMisses = 0;
            }
          } else {
            _consecutiveMisses = 0;
          }
        }
      },

      onComplete: function() {
        // Save any remaining missed items
        if (mode === 'free') {
          saveMissedKeywords();
        }

        feedbackEl.textContent = '✓ Conversazione completata!';
        feedbackEl.className = 'conv-feedback conv-feedback--correct';
        enableNextBtn();
      }
    });

    /**
     * Update hint chips in guided mode.
     */
    function updateHints() {
      if (mode === 'free') {
        hintsEl.innerHTML = '';
        hintsEl.style.display = 'none';
        return;
      }

      var hints = App.ConversationEngine.getHints();
      hintsEl.innerHTML = '';

      if (hints.length === 0) {
        hintsEl.style.display = 'none';
        return;
      }

      hintsEl.style.display = 'flex';
      for (var hi = 0; hi < hints.length; hi++) {
        (function(hintText) {
          var chip = document.createElement('button');
          chip.className = 'conv-hint-chip';
          chip.textContent = hintText;
          chip.addEventListener('click', function() {
            inputEl.value = hintText;
            inputEl.focus();
          });
          hintsEl.appendChild(chip);
        })(hints[hi]);
      }
    }

    /**
     * Save missed keywords from the engine to the learner profile.
     */
    function saveMissedKeywords() {
      var missedItems = App.ConversationEngine.getMissedItems();
      if (!missedItems || missedItems.length === 0) return;

      var learner = App.state && App.state.currentLearner;
      if (!learner) return;
      var profile = App.Progress.get(learner);
      if (!profile) return;
      if (!profile.missedItems) profile.missedItems = [];

      for (var mi = 0; mi < missedItems.length; mi++) {
        profile.missedItems.push({
          unitId: _state.unitId,
          stepIndex: _state.currentStep,
          prompt: missedItems[mi].prompt,
          userInput: missedItems[mi].userInput,
          expectedKeywords: missedItems[mi].expectedKeywords,
          type: 'conversation',
          timestamp: missedItems[mi].timestamp
        });
      }
      App.Progress.save(learner, profile);
    }

    /**
     * Send the current input to the conversation engine.
     */
    function sendResponse() {
      var text = inputEl.value.trim();
      if (!text) return;
      App.ConversationEngine.processResponse(text);
    }

    // Wire send button
    sendBtn.addEventListener('click', sendResponse);

    // Wire Enter key in input
    inputEl.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        sendResponse();
      }
    });

    // Wire mic button (voice input)
    if (micBtn) {
      micBtn.addEventListener('click', function() {
        if (!App.SpeechManager.isSupported()) {
          feedbackEl.textContent = 'Reconocimiento de voz no soportado. Escribe tu respuesta.';
          feedbackEl.className = 'conv-feedback conv-feedback--incorrect';
          return;
        }

        micBtn.disabled = true;
        micBtn.textContent = '🎤 Ascoltando...';

        var timeoutId = setTimeout(function() {
          window.removeEventListener('speech:result', onResultHandler);
          micBtn.disabled = false;
          micBtn.textContent = '🎤';
          feedbackEl.textContent = 'No se detectó voz. Intenta de nuevo o escribe.';
          feedbackEl.className = 'conv-feedback conv-feedback--incorrect';
        }, 10000);

        function onResultHandler(event) {
          var detail = event.detail;
          if (!detail.isFinal) return;
          window.removeEventListener('speech:result', onResultHandler);
          clearTimeout(timeoutId);
          micBtn.disabled = false;
          micBtn.textContent = '🎤';

          var transcript = detail.transcript || '';
          if (transcript) {
            inputEl.value = transcript;
            sendResponse();
          }
        }

        window.addEventListener('speech:result', onResultHandler);
        App.SpeechManager.start();
      });
    }
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
     STEP 15: Repaso Inteligente (Smart Review)
     ========================================== */

  /**
   * Render step 15 — repaso-inteligente: smart review of missed items.
   * Returns a container; wiring is done in wireStep15.
   * @param {object} stepData
   * @returns {string} HTML
   */
  function renderStep15(stepData) {
    return '<div class="smart-review-container" data-step15-init="true">' +
      '<div class="review-progress" id="review-progress"></div>' +
      '<div class="review-content" id="review-content"></div>' +
      '<div class="review-actions" id="review-actions"></div>' +
    '</div>';
  }

  /**
   * Wire step 15 interactions: query SmartReview, show review cards,
   * handle scoring, and show congratulations when done.
   * Called from wireTtsButtons after the DOM is rendered.
   * @param {HTMLElement} container
   */
  function wireStep15(container) {
    var step15 = container.querySelector('.smart-review-container');
    if (!step15) return;

    var learner = App.state && App.state.currentLearner;
    if (!learner) return;
    var profile = App.Progress.get(learner);
    if (!profile) return;

    var unitId = _state.unitId;
    var missedItems = App.SmartReview.getMissedItems(profile, unitId);
    var currentReviewIdx = 0;
    var reviewTotal = missedItems.length;
    var reviewPassed = 0;

    var contentEl = document.getElementById('review-content');
    var progressEl = document.getElementById('review-progress');
    var actionsEl = document.getElementById('review-actions');

    // Disable Next until review is complete
    disableNextBtn();

    /**
     * Show the congratulations card and wire the completion button.
     */
    function showCongratulations() {
      var reviewScore = App.SmartReview.getReviewScore(profile, unitId);
      var opts = {
        reviewedCount: reviewScore.reviewed,
        totalCount: reviewScore.total,
        score: reviewScore.percentage
      };
      App.SmartReview.renderCongratulations(contentEl, opts);

      if (progressEl) progressEl.innerHTML = '';

      // Wire "Completar unidad" button
      var completeBtn = document.getElementById('review-complete-unit');
      if (completeBtn) {
        completeBtn.addEventListener('click', function() {
          completeUnitWithScore();
        });
      }
    }

    /**
     * Complete the unit with score calculation and save.
     */
    function completeUnitWithScore() {
      // Calculate overall unit score
      var levelScores = profile.unitProgress &&
        profile.unitProgress[unitId] &&
        profile.unitProgress[unitId].levelScores;

      var levelScoreSum = 0;
      var levelScoreCount = 0;
      if (levelScores) {
        for (var key in levelScores) {
          if (levelScores.hasOwnProperty(key)) {
            levelScoreSum += levelScores[key];
            levelScoreCount++;
          }
        }
      }

      var avgLevelScore = levelScoreCount > 0 ? Math.round(levelScoreSum / levelScoreCount) : 100;
      var reviewScoreData = App.SmartReview.getReviewScore(profile, unitId);
      var overallScore = Math.round((avgLevelScore + reviewScoreData.percentage) / 2);

      // Save unit completion
      if (!profile.unitProgress) profile.unitProgress = {};
      if (!profile.unitProgress[unitId]) {
        profile.unitProgress[unitId] = { levelScores: {} };
      }
      profile.unitProgress[unitId].completed = true;
      profile.unitProgress[unitId].score = overallScore;
      profile.unitProgress[unitId].currentStep = 14; // final step
      profile.currentUnit = unitId;
      profile.currentStep = 14;
      App.Progress.save(learner, profile);

      // Show completion message
      if (contentEl) {
        contentEl.innerHTML =
          '<div class="review-congratulations">' +
            '<div class="review-congrats-icon" style="font-size:3rem">🎉</div>' +
            '<h3 class="review-congrats-title">¡Unidad completada!</h3>' +
            '<div class="review-congrats-stats">' +
              '<div class="review-congrats-stat">' +
                '<span class="review-congrats-stat-value">' + overallScore + '%</span>' +
                '<span class="review-congrats-stat-label">puntuación total</span>' +
              '</div>' +
            '</div>' +
            '<p style="color:var(--text-secondary);margin-top:12px;font-size:0.95rem">' +
              'Nivel: ' + (avgLevelScore) + '% · Repaso: ' + reviewScoreData.percentage + '%' +
            '</p>' +
          '</div>';
      }

      if (progressEl) progressEl.innerHTML = '';

      // Enable the Next button (shows "🏠 Ir al inicio")
      enableNextBtn();
    }

    /**
     * Show the next missed item for review, or show congratulations if all done.
     */
    function showNextReviewItem() {
      if (currentReviewIdx >= reviewTotal) {
        // All items reviewed — show congratulations
        showCongratulations();
        return;
      }

      var item = missedItems[currentReviewIdx];

      // Update progress
      if (progressEl) {
        progressEl.innerHTML = '<div class="review-progress-text">Repaso: ' +
          (currentReviewIdx + 1) + ' de ' + reviewTotal + '</div>';
      }

      // Render the review card
      App.SmartReview.renderReviewItem(item, contentEl);

      // Wire the "Comprobar" button
      var card = contentEl.querySelector('.review-card');
      if (!card) return;

      var checkBtn = card._checkBtn;
      var input = card._input;
      var fb = card._feedback;

      if (checkBtn) {
        checkBtn.addEventListener('click', function() {
          var answer = input ? input.value.trim() : '';
          if (!answer) {
            fb.textContent = 'Escribe tu respuesta primero.';
            fb.style.color = '#f59e0b';
            return;
          }

          // Score the re-attempt
          var result = App.SmartReview.scoreReviewItem(item, answer);

          if (result.passed) {
            fb.textContent = '✓ ' + result.feedback + ' (' + result.score + '%)';
            fb.style.color = '#16a34a';
            reviewPassed++;
            // Auto-advance after a brief pause
            setTimeout(function() {
              currentReviewIdx++;
              showNextReviewItem();
            }, 1200);
          } else {
            fb.textContent = '✗ ' + result.feedback;
            fb.style.color = '#ef4444';
            // Show message that they'll see it later
            var laterMsg = document.createElement('div');
            laterMsg.className = 'review-later-msg';
            laterMsg.textContent = 'Volverás a ver esto más tarde.';
            laterMsg.style.cssText = 'color:var(--text-secondary);font-size:0.85rem;margin-top:8px';
            card.appendChild(laterMsg);
            // Auto-advance after a brief pause
            setTimeout(function() {
              currentReviewIdx++;
              showNextReviewItem();
            }, 2000);
          }
        });
      }

      // Focus the input
      if (input) {
        setTimeout(function() { input.focus(); }, 100);
      }
    }

    // Start the review flow
    if (reviewTotal === 0) {
      // No missed items — show congratulations directly
      showCongratulations();
    } else {
      showNextReviewItem();
    }
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
