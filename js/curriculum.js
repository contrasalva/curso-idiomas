/* ============================================
   Italiano B1 — curriculum.js
   App.Curriculum: module unlock logic,
   progress ring computation, grid/exercise renderers
   ============================================ */

var App = window.App || {};
App.Curriculum = (function() {

  /**
   * Module N is unlocked if:
   *   - Module 0 is always unlocked
   *   - Previous module has >= 60% average completion
   */
  function isUnlocked(moduleId, progress) {
    if (moduleId === 0) return true;
    if (!progress || !progress.modules) return false;

    var prevProgress = progress.modules[moduleId - 1];
    if (!prevProgress) return false;

    var exerciseKeys = Object.keys(prevProgress);
    if (exerciseKeys.length === 0) return false;

    var total = exerciseKeys.reduce(function(sum, key) {
      return sum + (prevProgress[key] || 0);
    }, 0);
    var avg = total / exerciseKeys.length;
    return avg >= 60;
  }

  /**
   * Completion percentage for a module based on completed exercises.
   */
  function completionPct(moduleId, progress) {
    if (!progress || !progress.modules || !progress.modules[moduleId]) return 0;

    var exercises = Object.values(progress.modules[moduleId]);
    if (exercises.length === 0) return 0;
    return Math.round(exercises.reduce(function(a, b) { return a + b; }, 0) / exercises.length);
  }

  /**
   * Count completed exercises (score >= 60) in a module.
   */
  function completedCount(moduleId, totalExercises, progress) {
    if (!progress || !progress.modules || !progress.modules[moduleId]) return 0;

    var scores = Object.values(progress.modules[moduleId]);
    if (scores.length === 0) return 0;

    var completed = scores.filter(function(s) { return s >= 60; }).length;
    // Clamp to totalExercises
    return Math.min(completed, totalExercises);
  }

  /**
   * Render the full module grid into a container element.
   * Reads module data from embedded <script id="data-modules">.
   */
  function renderModuleGrid(container, progress) {
    var dataEl = document.getElementById('data-modules');
    if (!dataEl) return;
    var modules;
    try {
      modules = JSON.parse(dataEl.textContent);
    } catch (e) {
      console.warn('[Curriculum] Failed to parse module data:', e);
      return;
    }

    container.innerHTML = '';

    modules.forEach(function(mod) {
      var unlocked = isUnlocked(mod.id, progress);
      var pct = completionPct(mod.id, progress);

      var card = document.createElement('div');
      card.className = 'module-card' + (unlocked ? '' : ' locked');
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', unlocked ? '0' : '-1');
      card.setAttribute('aria-label', unlocked ? mod.title : mod.title + ' — bloqueado');
      if (unlocked) {
        card.addEventListener('click', function() {
          App.state.currentModule = mod.id;
          App.nav.show('module', { module: mod.id });
        });
      }

      // Progress ring (SVG)
      var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 36 36');
      svg.setAttribute('class', 'progress-ring');
      svg.setAttribute('aria-hidden', 'true');

      var bgCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      bgCircle.setAttribute('cx', '18'); bgCircle.setAttribute('cy', '18');
      bgCircle.setAttribute('r', '15.9'); bgCircle.setAttribute('fill', 'none');
      bgCircle.setAttribute('class', 'progress-ring-bg');

      var circumference = 2 * Math.PI * 15.9;

      var fgCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      fgCircle.setAttribute('cx', '18'); fgCircle.setAttribute('cy', '18');
      fgCircle.setAttribute('r', '15.9'); fgCircle.setAttribute('fill', 'none');
      fgCircle.setAttribute('class', 'progress-ring-fill');
      fgCircle.setAttribute('stroke', unlocked ? 'var(--accent)' : '#9ca3af');
      fgCircle.style.strokeDasharray = circumference;
      fgCircle.style.strokeDashoffset = circumference - (pct / 100) * circumference;

      svg.appendChild(bgCircle);
      svg.appendChild(fgCircle);

      var text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', '18'); text.setAttribute('y', '20.5');
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('font-size', '6');
      text.setAttribute('fill', 'currentColor');
      text.textContent = pct + '%';
      svg.appendChild(text);

      card.appendChild(svg);

      // Info block
      var info = document.createElement('div');
      info.className = 'module-info';

      var number = document.createElement('span');
      number.className = 'module-number';
      number.textContent = 'Módulo ' + mod.id;

      var title = document.createElement('h3');
      title.className = 'module-title';
      title.textContent = (unlocked ? '' : '🔒 ') + mod.title;

      var desc = document.createElement('p');
      desc.textContent = mod.subtitle || '';

      var meta = document.createElement('span');
      meta.className = 'module-meta';
      meta.textContent = mod.exerciseCount + ' ejercicios · ' + mod.vocabCount + ' palabras';

      info.appendChild(number);
      info.appendChild(title);
      info.appendChild(desc);
      info.appendChild(meta);
      card.appendChild(info);

      container.appendChild(card);
    });
  }

  /**
   * Render the exercise list for a specific module.
   * Target: <ol id="exercise-list">
   * Reads exercises from embedded <script id="data-exercises">.
   */
  function renderExerciseList(moduleId) {
    var listEl = document.getElementById('exercise-list');
    if (!listEl) return;

    var dataEl = document.getElementById('data-exercises');
    if (!dataEl) return;
    var allExercises;
    try {
      allExercises = JSON.parse(dataEl.textContent);
    } catch (e) {
      console.warn('[Curriculum] Failed to parse exercise data:', e);
      return;
    }

    var prefix = 'mod' + moduleId + '-';
    var moduleExs = allExercises.filter(function(ex) {
      return ex.id && ex.id.indexOf(prefix) === 0;
    });

    listEl.innerHTML = '';

    moduleExs.forEach(function(ex, idx) {
      var li = document.createElement('li');
      li.className = 'exercise-item';
      li.setAttribute('role', 'button');
      li.setAttribute('tabindex', '0');
      li.setAttribute('aria-label', 'Ejercicio ' + (idx + 1) + ': ' + (ex.prompt || '').substring(0, 50));

      var numSpan = document.createElement('span');
      numSpan.className = 'exercise-number';
      numSpan.textContent = (idx + 1) + '.';

      var typeIcon = document.createElement('span');
      typeIcon.className = 'exercise-type-icon';
      typeIcon.textContent = getTypeIcon(ex.type);

      var titleSpan = document.createElement('span');
      titleSpan.className = 'exercise-title';
      titleSpan.textContent = typeLabel(ex.type);

      li.appendChild(numSpan);
      li.appendChild(typeIcon);
      li.appendChild(titleSpan);

      // Show score if available
      var learner = App.state.currentLearner;
      if (learner) {
        var progress = App.Progress.get(learner);
        if (progress && progress.modules && progress.modules[moduleId]) {
          var score = progress.modules[moduleId][ex.id];
          if (score !== undefined) {
            var scoreSpan = document.createElement('span');
            scoreSpan.className = 'exercise-score';
            scoreSpan.textContent = score + '%';
            li.appendChild(scoreSpan);
          }
        }
      }

      li.addEventListener('click', function() {
        App.state.currentModule = moduleId;
        App.state.currentExercise = ex.id;
        App.nav.show('exercise', { module: moduleId, exercise: ex.id });
      });

      listEl.appendChild(li);
    });
  }

  /**
   * Render sidebar module list into <ul id="sidebar-module-list">.
   */
  function renderSidebar(progress) {
    var listEl = document.getElementById('sidebar-module-list');
    if (!listEl) return;

    var dataEl = document.getElementById('data-modules');
    if (!dataEl) return;
    var modules;
    try {
      modules = JSON.parse(dataEl.textContent);
    } catch (e) {
      return;
    }

    listEl.innerHTML = '';

    modules.forEach(function(mod) {
      var unlocked = isUnlocked(mod.id, progress);
      var pct = completionPct(mod.id, progress);
      var active = App.state.currentModule === mod.id && App.state.activeSection === 'module';

      var li = document.createElement('li');
      li.className = active ? 'active' : '';
      li.setAttribute('role', 'button');
      li.setAttribute('tabindex', '0');
      li.setAttribute('aria-label', mod.title);

      // Small ring
      var ringSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      ringSvg.setAttribute('viewBox', '0 0 36 36');
      ringSvg.setAttribute('class', 'sidebar-ring');
      ringSvg.setAttribute('aria-hidden', 'true');

      var bgC = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      bgC.setAttribute('cx', '18'); bgC.setAttribute('cy', '18');
      bgC.setAttribute('r', '15.9'); bgC.setAttribute('fill', 'none');
      bgC.setAttribute('stroke', 'var(--border)'); bgC.setAttribute('stroke-width', '3');

      var fgC = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      fgC.setAttribute('cx', '18'); fgC.setAttribute('cy', '18');
      fgC.setAttribute('r', '15.9'); fgC.setAttribute('fill', 'none');
      fgC.setAttribute('stroke', unlocked ? 'var(--accent)' : '#9ca3af');
      fgC.setAttribute('stroke-width', '3');
      fgC.setAttribute('stroke-linecap', 'round');
      var circ = 2 * Math.PI * 15.9;
      fgC.style.strokeDasharray = circ;
      fgC.style.strokeDashoffset = circ - (pct / 100) * circ;

      ringSvg.appendChild(bgC);
      ringSvg.appendChild(fgC);

      li.appendChild(ringSvg);

      var label = document.createElement('span');
      label.className = 'sidebar-label';
      label.textContent = mod.title;
      li.appendChild(label);

      li.addEventListener('click', function() {
        if (!unlocked) return;
        App.state.currentModule = mod.id;
        App.nav.show('module', { module: mod.id });
      });

      listEl.appendChild(li);
    });
  }

  /* --- Helpers --- */

  function getTypeIcon(type) {
    var icons = {
      'multiple-choice': '🔘',
      'fill-in-blank': '✏️',
      'listen-and-repeat': '🎧',
      'reorder-words': '🔀',
      'describe-image': '🖼️',
      'situational-dialogue': '💬',
      'error-correction': '🔍',
      'sentence-transformation': '🔄'
    };
    return icons[type] || '📝';
  }

  function typeLabel(type) {
    var labels = {
      'multiple-choice': 'Opción múltiple',
      'fill-in-blank': 'Completar',
      'listen-and-repeat': 'Escuchar y repetir',
      'reorder-words': 'Ordenar palabras',
      'describe-image': 'Describir imagen',
      'situational-dialogue': 'Diálogo situacional',
      'error-correction': 'Corregir errores',
      'sentence-transformation': 'Transformar frase'
    };
    return labels[type] || type;
  }

  /**
   * Render the lesson view for a specific module.
   * Shows grammar, explanation, and examples before exercises.
   */
  function renderModuleLesson(moduleId) {
    var dataEl = document.getElementById('data-modules');
    if (!dataEl) return;
    var modules;
    try { modules = JSON.parse(dataEl.textContent); } catch(e) { return; }
    var mod = modules[moduleId];
    if (!mod) return;

    // If module has interactive lesson (leccion), use stepper
    if (mod.leccion && mod.leccion.length > 0) {
      renderLessonStepper(mod, moduleId);
      return;
    }

    // Traditional lesson view for modules without leccion
    renderTraditionalLesson(mod, moduleId);
  }

  /**
   * Render the traditional lesson view (grammar list, explanation, examples, tables).
   */
  function renderTraditionalLesson(mod, moduleId) {
    var titleEl = document.getElementById('module-title');
    if (titleEl) titleEl.textContent = mod.title;
    var descEl = document.getElementById('module-description');
    if (descEl) descEl.textContent = mod.description;

    // Grammar list
    var grammarList = document.getElementById('grammar-list');
    if (grammarList) {
      grammarList.innerHTML = '';
      if (mod.grammar) {
        mod.grammar.forEach(function(g) {
          var li = document.createElement('li');
          li.textContent = g;
          grammarList.appendChild(li);
        });
      }
    }

    // Explanation
    var explDiv = document.getElementById('lesson-explicacion');
    if (explDiv) {
      explDiv.textContent = mod.explicacion || 'Sin explicación disponible.';
    }

    // Examples
    var ejemplosDiv = document.getElementById('lesson-ejemplos');
    if (ejemplosDiv) {
      ejemplosDiv.innerHTML = '';
      if (mod.ejemplos && mod.ejemplos.length > 0) {
        mod.ejemplos.forEach(function(ej) {
          var row = document.createElement('div');
          row.className = 'ejemplo-row';

          var topRow = document.createElement('div');
          topRow.className = 'ejemplo-top-row';

          var itSpan = document.createElement('div');
          itSpan.className = 'ejemplo-it';
          itSpan.textContent = '🇮🇹 ' + ej.it;

          // Add phonetic pronunciation if available
          if (ej.fonetica) {
            var foneticaSpan = document.createElement('div');
            foneticaSpan.className = 'ejemplo-fonetica';
            foneticaSpan.textContent = '//' + ej.fonetica + '//';
            itSpan.appendChild(foneticaSpan);
          }

          var listenBtn = document.createElement('button');
          listenBtn.className = 'listen-btn';
          listenBtn.innerHTML = '🔊';
          listenBtn.setAttribute('aria-label', 'Escuchar pronunciación: ' + ej.it);
          listenBtn.setAttribute('title', 'Escuchar pronunciación');
          listenBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            if (typeof App !== 'undefined' && App.SpeechManager && App.SpeechManager.speak) {
              App.SpeechManager.speak(ej.it);
            }
          });

          topRow.appendChild(itSpan);
          topRow.appendChild(listenBtn);
          row.appendChild(topRow);

          var esSpan = document.createElement('div');
          esSpan.className = 'ejemplo-es';
          esSpan.textContent = '🇪🇸 ' + ej.es;

          row.appendChild(esSpan);
          ejemplosDiv.appendChild(row);
        });
      } else {
        ejemplosDiv.textContent = 'Ejemplos disponibles en los ejercicios.';
      }
    }

    // Tables
    var tablasSection = document.getElementById('lesson-tables');
    var tablasContainer = document.getElementById('tablas-container');
    if (tablasContainer && tablasSection) {
      tablasContainer.innerHTML = '';
      if (mod.tablas && mod.tablas.length > 0) {
        tablasSection.style.display = 'block';
        mod.tablas.forEach(function(tabla) {
          var tableCard = document.createElement('div');
          tableCard.className = 'tabla-card';

          var tableTitle = document.createElement('h4');
          tableTitle.className = 'tabla-title';
          tableTitle.textContent = tabla.titulo;
          tableCard.appendChild(tableTitle);

          var table = document.createElement('table');
          table.className = 'grammar-table';

          // Header row
          if (tabla.encabezados) {
            var thead = document.createElement('thead');
            var headerRow = document.createElement('tr');
            tabla.encabezados.forEach(function(h) {
              var th = document.createElement('th');
              th.textContent = h;
              headerRow.appendChild(th);
            });
            thead.appendChild(headerRow);
            table.appendChild(thead);
          }

          // Body rows
          var tbody = document.createElement('tbody');
          tabla.filas.forEach(function(fila) {
            var tr = document.createElement('tr');
            fila.forEach(function(celda) {
              var td = document.createElement('td');
              td.textContent = celda;
              tr.appendChild(td);
            });
            tbody.appendChild(tr);
          });
          table.appendChild(tbody);

          tableCard.appendChild(table);
          tablasContainer.appendChild(tableCard);
        });
      } else {
        tablasSection.style.display = 'none';
      }
    }

    // Show lesson, hide exercises
    var lessonDiv = document.getElementById('module-lesson');
    var exercisesDiv = document.getElementById('module-exercises');
    if (lessonDiv) lessonDiv.style.display = 'block';
    if (exercisesDiv) exercisesDiv.style.display = 'none';
  }

  /* ============================================
     Interactive Lesson Stepper
     Used when a module has "leccion" data (step-by-step).
     ============================================ */

  var _stepperState = { step: 0, moduleId: 0, total: 0 };

  function renderLessonStepper(mod, moduleId) {
    _stepperState.step = 0;
    _stepperState.moduleId = moduleId;
    _stepperState.total = mod.leccion.length;

    // Hide traditional sections, show stepper
    var sections = ['lesson-grammar','lesson-explanation','lesson-examples','lesson-tables'];
    sections.forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
    var stepperEl = document.getElementById('lesson-stepper');
    if (stepperEl) stepperEl.style.display = 'block';

    // Show title & description
    var titleEl = document.getElementById('module-title');
    if (titleEl) titleEl.textContent = mod.title;
    var descEl = document.getElementById('module-description');
    if (descEl) descEl.textContent = mod.description;

    // Hide start-exercises initially
    var startBtn = document.getElementById('start-exercises-btn');
    if (startBtn) startBtn.style.display = 'none';

    renderStepperStep(mod);
  }

  /** Get a professional emoji and label for a given lesson step */
  function _getStepEmoji(step) {
    var emojis = [
      { emoji: '👤', label: 'Pronombres' },      // 0
      { emoji: '📋', label: 'Verbos -ARE' },      // 1
      { emoji: '📖', label: 'Verbos -ERE / -IRE' },// 2
      { emoji: '🛡️', label: 'Artículos' },         // 3
      { emoji: '⚤', label: 'Género' },            // 4
      { emoji: '❓', label: 'Preguntas' },          // 5
      { emoji: '📍', label: 'C\'è / Ci sono' },    // 6
      { emoji: '🔑', label: 'Posesivos' }           // 7
    ];
    return emojis[step % emojis.length];
  }

  function renderStepperStep(mod) {
    var stepperEl = document.getElementById('lesson-stepper');
    if (!stepperEl) return;

    var state = _stepperState;
    var step = mod.leccion[state.step];
    if (!step) return;

    // Step color palette — each step gets a unique pro accent
    var stepColors = [
      { bg: '#3b82f6', light: '#eff6ff', grad: 'linear-gradient(135deg, #3b82f6, #6366f1)' },   // 0: Pronombres — blue
      { bg: '#14b8a6', light: '#f0fdfa', grad: 'linear-gradient(135deg, #14b8a6, #0ea5e9)' },   // 1: -ARE — teal
      { bg: '#10b981', light: '#ecfdf5', grad: 'linear-gradient(135deg, #10b981, #059669)' },   // 2: -ERE/-IRE — emerald
      { bg: '#8b5cf6', light: '#f5f3ff', grad: 'linear-gradient(135deg, #8b5cf6, #a855f7)' },   // 3: Artículos — violet
      { bg: '#ec4899', light: '#fdf2f8', grad: 'linear-gradient(135deg, #ec4899, #f472b6)' },   // 4: Género — pink
      { bg: '#f59e0b', light: '#fffbeb', grad: 'linear-gradient(135deg, #f59e0b, #f97316)' },   // 5: Preguntar — amber
      { bg: '#ef4444', light: '#fef2f2', grad: 'linear-gradient(135deg, #ef4444, #f97316)' },   // 6: C\'è/Ci sono — red
      { bg: '#6366f1', light: '#eef2ff', grad: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }    // 7: Posesivos — indigo
    ];
    var c = stepColors[state.step % stepColors.length];
    var stepEmoji = _getStepEmoji(state.step);

    // Build step content
    var html = '';

    // Progress bar
    var pct = Math.round(((state.step + 1) / state.total) * 100);
    html += '<div class="stepper-progress">';
    html += '  <div class="stepper-progress-bar"><div class="stepper-progress-fill" style="width:' + pct + '%;background:' + c.grad.replace(/['"]/g, '') + '"></div></div>';
    html += '  <div class="stepper-progress-label">Paso ' + (state.step + 1) + ' de ' + state.total + '</div>';
    html += '</div>';

    // Step dots — active dot gets step color
    html += '<div class="stepper-dots">';
    for (var i = 0; i < state.total; i++) {
      var dotClass = 'stepper-dot';
      if (i < state.step) dotClass += ' completed';
      else if (i === state.step) dotClass += ' active';
      var dotStyle = '';
      if (i <= state.step) dotStyle = ' style="background:' + c.grad.replace(/['"]/g, '') + '"';
      html += '<span class="' + dotClass + '"' + dotStyle + ' title="Paso ' + (i + 1) + '"></span>';
    }
    html += '</div>';

    // Step card
    html += '<div class="stepper-card" style="border-top:4px solid ' + c.bg + '">';

    // Hero illustration — abstract CSS art + professional emoji
    html += '<div class="stepper-hero" style="--hero-bg:' + c.bg + ';--hero-grad:' + c.grad.replace(/['"]/g, '') + '">';
    html += '  <div class="hero-art">';
    html += '    <div class="hero-circle hero-circle-1"></div>';
    html += '    <div class="hero-circle hero-circle-2"></div>';
    html += '    <div class="hero-circle hero-circle-3"></div>';
    html += '    <div class="hero-icon-wrap">';
    html += '      <span class="hero-emoji">' + stepEmoji.emoji + '</span>';
    html += '    </div>';
    html += '    <div class="hero-dots">';
    html += '      <span></span><span></span><span></span><span></span>';
    html += '    </div>';
    html += '  </div>';
    html += '</div>';

    // Step number badge
    html += '<div class="stepper-step-badge" style="background:' + c.grad.replace(/['"]/g, '') + '">Paso ' + (state.step + 1) + '</div>';

    // Title
    html += '<h3 class="stepper-title">' + step.titulo + '</h3>';

    // Intro
    if (step.intro) {
      html += '<div class="stepper-intro">' + step.intro + '</div>';
    }

    // Atencion tip (colored box)
    if (step.atencion) {
      html += '<div class="stepper-tip">' + step.atencion + '</div>';
    }

    // Examples
    if (step.ejemplos && step.ejemplos.length > 0) {
      html += '<div class="stepper-ejemplos"><h4 class="stepper-ejemplos-title">📝 Ejemplos</h4>';
      step.ejemplos.forEach(function(ej, idx) {
        var dataAttr = 'data-stepper-ejemplo="' + state.step + '-' + idx + '"';
        html += '<div class="ejemplo-row stepper-ejemplo-row">';
        html += '  <div class="ejemplo-top-row">';
        html += '    <div class="ejemplo-it">🇮🇹 ' + ej.it;
        if (ej.fonetica) {
          html += '      <div class="ejemplo-fonetica">//' + ej.fonetica + '//</div>';
        }
        html += '    </div>';
        html += '    <button class="listen-btn" ' + dataAttr + ' aria-label="Escuchar: ' + ej.it + '" title="Escuchar">🔊</button>';
        html += '  </div>';
        html += '  <div class="ejemplo-es">🇪🇸 ' + ej.es + '</div>';
        html += '</div>';
      });
      html += '</div>';
    }

    // Practice (micro-interactive question)
    if (step.practica) {
      var p = step.practica;
      var practicaId = 'stepper-practica-' + state.step;
      html += '<div class="stepper-practica">';
      html += '  <h4 class="stepper-practica-title">✋ ¡Practica!</h4>';
      html += '  <div class="stepper-practica-question">' + p.pregunta + '</div>';
      html += '  <div class="stepper-practica-opts" id="' + practicaId + '">';
      p.opciones.forEach(function(opt, optIdx) {
        var dataAttr = 'data-practica-opt="' + state.step + '-' + optIdx + '"';
        html += '    <button class="practica-opt" ' + dataAttr + '>' + opt + '</button>';
      });
      html += '  </div>';
      html += '  <div class="stepper-practica-feedback" id="stepper-feedback-' + state.step + '"></div>';
      html += '</div>';
    }

    // Navigation
    html += '<div class="stepper-nav">';
    if (state.step > 0) {
      html += '<button id="stepper-prev-btn" class="secondary-btn">← Anterior</button>';
    } else {
      html += '<div></div>'; // spacer
    }
    if (state.step < state.total - 1) {
      html += '<button id="stepper-next-btn" class="primary-btn">Siguiente →</button>';
    } else {
      html += '<button id="stepper-finish-btn" class="primary-btn">▶ ¡Empezar ejercicios!</button>';
    }
    html += '</div>';

    html += '</div>'; // close stepper-card

    stepperEl.innerHTML = html;

    // Wire TTS buttons
    step.ejemplos.forEach(function(ej, idx) {
      var btn = stepperEl.querySelector('[data-stepper-ejemplo="' + state.step + '-' + idx + '"]');
      if (btn) {
        btn.addEventListener('click', function(e) {
          e.stopPropagation();
          if (typeof App !== 'undefined' && App.SpeechManager && App.SpeechManager.speak) {
            App.SpeechManager.speak(ej.it);
          }
        });
      }
    });

    // Wire practice options
    if (step.practica) {
      var practica = step.practica;
      var opted = stepperEl.querySelectorAll('[data-practica-opt^="' + state.step + '-"]');
      var feedbackEl = document.getElementById('stepper-feedback-' + state.step);
      opted.forEach(function(btn) {
        btn.addEventListener('click', function() {
          opted.forEach(function(b) { b.disabled = true; b.classList.remove('practica-opt-correct', 'practica-opt-wrong'); });
          var idx = parseInt(btn.getAttribute('data-practica-opt').split('-')[1], 10);
          var isCorrect = idx === practica.correcta;
          btn.classList.add(isCorrect ? 'practica-opt-correct' : 'practica-opt-wrong');
          if (feedbackEl) {
            feedbackEl.className = 'stepper-practica-feedback ' + (isCorrect ? 'feedback-ok' : 'feedback-err');
            feedbackEl.textContent = isCorrect ? practica.feedback : (practica.feedback_err || '❌ Intenta de nuevo.');
          }
        });
      });
    }

    // Wire navigation
    var prevBtn = document.getElementById('stepper-prev-btn');
    if (prevBtn) {
      prevBtn.addEventListener('click', function() {
        if (state.step > 0) {
          state.step--;
          renderStepperStep(mod);
        }
      });
    }

    var nextBtn = document.getElementById('stepper-next-btn');
    if (nextBtn) {
      nextBtn.addEventListener('click', function() {
        if (state.step < state.total - 1) {
          state.step++;
          renderStepperStep(mod);
        }
      });
    }

    var finishBtn = document.getElementById('stepper-finish-btn');
    if (finishBtn) {
      finishBtn.addEventListener('click', function() {
        // Show the exercise button and scroll to it
        var startBtn = document.getElementById('start-exercises-btn');
        if (startBtn) {
          startBtn.style.display = 'block';
          startBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });
    }
  }

  return {
    isUnlocked: isUnlocked,
    completionPct: completionPct,
    completedCount: completedCount,
    renderModuleGrid: renderModuleGrid,
    renderExerciseList: renderExerciseList,
    renderSidebar: renderSidebar,
    renderModuleLesson: renderModuleLesson
  };
})();
