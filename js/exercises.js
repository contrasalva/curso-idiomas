/* ============================================
   Italiano B1 — exercises.js
   App.ExerciseEngine: JSON-driven renderer,
   validation, scoring, feedback for 8 types
   ============================================ */

var App = window.App || {};

App.ExerciseEngine = (function() {
  var currentExercise = null;
  var currentIndex = 0;
  var moduleExercises = [];
  var attemptCount = 0;
  var lastVoiceConfidence = undefined;
  var answered = false;
  var hintShown = false;

  // Exam state
  var examData = null;
  var examState = {
    sectionIndex: 0,
    questionIndex: 0,
    answers: {},
    timer: null,
    secondsRemaining: 0,
    mode: 'practice'
  };

  /* ---- Public API ---- */

  /**
   * Load all exercises for a given module.
   * Returns true if exercises were found.
   */
  function loadModule(moduleId) {
    var dataEl = document.getElementById('data-exercises');
    if (!dataEl) return false;

    var allExercises;
    try {
      allExercises = JSON.parse(dataEl.textContent);
    } catch (e) {
      console.warn('[ExerciseEngine] Failed to parse exercise data:', e);
      return false;
    }

    var prefix = 'mod' + moduleId + '-';
    moduleExercises = allExercises.filter(function(ex) {
      return ex.id && ex.id.indexOf(prefix) === 0;
    });
    return moduleExercises.length > 0;
  }

  /**
   * Return the ID of the first exercise in the current module, or null.
   */
  function getFirstExerciseId() {
    return moduleExercises.length > 0 ? moduleExercises[0].id : null;
  }

  /**
   * Return how many exercises are in the current module.
   */
  function getExerciseCount() {
    return moduleExercises.length;
  }

  /**
   * Load a specific exercise by ID from the embedded data.
   */
  function load(exerciseId) {
    var dataEl = document.getElementById('data-exercises');
    if (!dataEl) return null;

    var all;
    try {
      all = JSON.parse(dataEl.textContent);
    } catch (e) {
      return null;
    }

    currentExercise = all.find(function(ex) { return ex.id === exerciseId; });
    return currentExercise;
  }

  /**
   * Map exercise type to a readable Spanish label.
   */
  function getTypeLabel(type) {
    var labels = {
      'multiple-choice': 'Opción múltiple',
      'fill-in-blank': 'Completar espacio',
      'reorder-words': 'Ordenar palabras',
      'error-correction': 'Corregir errores',
      'listen-and-repeat': 'Escuchar y repetir',
      'sentence-transformation': 'Transformar oración',
      'situational-dialogue': 'Diálogo situacional',
      'describe-image': 'Describir imagen'
    };
    return labels[type] || 'Ejercicio';
  }

  /**
   * Map exercise type to an emoji icon.
   */
  function getTypeIcon(type) {
    var icons = {
      'multiple-choice': '🔘',
      'fill-in-blank': '✏️',
      'reorder-words': '🔄',
      'error-correction': '🔧',
      'listen-and-repeat': '🎤',
      'sentence-transformation': '🔄',
      'situational-dialogue': '💬',
      'describe-image': '🖼️'
    };
    return icons[type] || '📝';
  }

  /**
   * Render the current exercise into the exercise section DOM.
   * Uses the existing HTML structure with IDs.
   */
  function render() {
    if (!currentExercise) return;

    answered = false;
    attemptCount = 0;
    hintShown = false;

    var ex = currentExercise;
    var idx = moduleExercises.findIndex(function(e) { return e.id === ex.id; });
    currentIndex = idx >= 0 ? idx : 0;

    // Get container
    var container = document.getElementById('exercise-container');
    if (!container) return;

    // Progress
    var progressEl = document.getElementById('ex-progress');
    if (progressEl) {
      progressEl.textContent = 'Ejercicio ' + (currentIndex + 1) + ' de ' + moduleExercises.length;
    }

    // Mini-lección automática (si tiene explicación)
    var existingLesson = container.querySelector('.mini-lesson');
    if (existingLesson) existingLesson.remove();

    if (ex.explicacion) {
      var lessonEl = document.createElement('div');
      lessonEl.className = 'mini-lesson';
      lessonEl.setAttribute('role', 'region');
      lessonEl.setAttribute('aria-label', 'Lección');

      var lessonHeader = document.createElement('div');
      lessonHeader.className = 'lesson-header';

      var lessonIcon = document.createElement('span');
      lessonIcon.textContent = '📖';
      lessonIcon.style.fontSize = '1.2rem';

      var lessonTitle = document.createElement('span');
      lessonTitle.className = 'lesson-title';
      lessonTitle.textContent = 'Mini-lección';

      var toggleBtn = document.createElement('button');
      toggleBtn.className = 'lesson-toggle';
      toggleBtn.textContent = '✕';
      toggleBtn.setAttribute('aria-label', 'Ocultar lección');
      toggleBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        lessonEl.classList.toggle('collapsed');
        toggleBtn.textContent = lessonEl.classList.contains('collapsed') ? '📖' : '✕';
      });

      lessonHeader.appendChild(lessonIcon);
      lessonHeader.appendChild(lessonTitle);
      lessonHeader.appendChild(toggleBtn);
      lessonEl.appendChild(lessonHeader);

      var lessonBody = document.createElement('div');
      lessonBody.className = 'lesson-body';
      // Parse the explanation - make it warmer by wrapping in a friendly message
      lessonBody.textContent = ex.explicacion;
      lessonEl.appendChild(lessonBody);

      // Insert at top of exercise card
      container.insertBefore(lessonEl, container.firstChild);
    }

    // Prompt
    var promptEl = document.getElementById('ex-prompt');
    if (promptEl) {
      promptEl.textContent = ex.prompt;
      
      var promptContainer = promptEl.parentNode;
      
      // Remove old phonetic if present
      var oldFon = promptContainer.querySelector('.ex-fonetica');
      if (oldFon) oldFon.remove();
      
      // If there's a lesson, wrap in prompt-section
      if (ex.explicacion) {
        var existingWrap = promptContainer.querySelector('.prompt-section');
        if (!existingWrap) {
          var promptWrap = document.createElement('div');
          promptWrap.className = 'prompt-section';
          var typeIcon = getTypeIcon(ex.type);
          var typeLabel = getTypeLabel(ex.type);
          promptWrap.innerHTML = '<div class="prompt-label">' + typeIcon + ' ' + typeLabel + '</div>';
          promptContainer.insertBefore(promptWrap, promptEl);
          promptWrap.appendChild(promptEl);
        }
      }
      
      // Add phonetic if available (inside the same container as prompt)
      if (ex.fonetica) {
        var foneticaEl = document.createElement('div');
        foneticaEl.className = 'ex-fonetica';
        foneticaEl.textContent = '//' + ex.fonetica + '//';
        promptEl.parentNode.insertBefore(foneticaEl, promptEl.nextSibling);
      }
    }

    // Hint
    var hintEl = document.getElementById('ex-hint');
    if (hintEl) {
      hintEl.textContent = '';
      hintEl.style.display = 'none';
    }

    // Feedback
    var feedbackEl = document.getElementById('ex-feedback');
    if (feedbackEl) {
      feedbackEl.innerHTML = '';
      feedbackEl.className = 'ex-feedback';
    }

    // Input area
    var inputEl = document.getElementById('ex-input');
    if (inputEl) {
      inputEl.innerHTML = '';
      buildInput(inputEl, ex);
    }

    // Action buttons
    var actionsEl = document.getElementById('ex-actions');
    if (actionsEl) {
      actionsEl.innerHTML = '';
      buildActions(actionsEl);
    }
  }

  /**
   * Submit an answer for validation.
   * @param {string[]} answer - User's answer as array
   */
  function submitAnswer(answer) {
    if (answered || !currentExercise) return;
    answered = true;
    attemptCount++;

    var ex = currentExercise;
    var result = validateAnswer(answer, ex);

    // Save score
    var learner = App.state.currentLearner;
    if (learner) {
      App.Progress.updateScore(learner, App.state.currentModule, ex.id, result.score);
    }

    // Update streak on any attempt
    if (learner) {
      var profile = App.Progress.get(learner);
      if (profile) {
        profile.lastActive = Date.now();
        // Increment streak if lastActive was yesterday
        var today = new Date(); today.setHours(0, 0, 0, 0);
        var last = new Date(profile.lastActive || 0); last.setHours(0, 0, 0, 0);
        var diff = Math.floor((today - last) / (1000 * 60 * 60 * 24));
        if (diff === 0) {
          // Same day, no change
        } else if (diff === 1) {
          profile.streak = (profile.streak || 0) + 1;
        } else {
          profile.streak = 0;
        }
        profile.lastActive = Date.now();
        App.Progress.save(learner, profile);
        updateStreakDisplay(learner);
      }
    }

    // Show encouragement toast if points were gained
    if (learner && result.score > 0) {
      var standings = App.Progress.getStandings(learner);
      if (standings.length >= 2 && App.showCheer) {
        App.showCheer(result.score, learner, standings);
      }
    }

    // Update points header display
    if (learner && result.score > 0) {
      var newPoints = App.Progress.getTotalPoints(learner);
      var ptsEl = document.getElementById('points-header-count');
      if (ptsEl) {
        ptsEl.textContent = newPoints;
        ptsEl.style.transition = 'transform 300ms ease';
        ptsEl.style.transform = 'scale(1.3)';
        setTimeout(function() { ptsEl.style.transform = 'scale(1)'; }, 300);
      }
    }

    // Refresh competition display on home page
    if (App.renderCompetition && learner) {
      App.renderCompetition();
    }

    // Render feedback
    renderFeedback(result, ex);
  }

  /**
   * Navigate to a specific exercise index within the current module.
   */
  function goTo(index) {
    if (index >= 0 && index < moduleExercises.length) {
      var ex = moduleExercises[index];
      App.state.currentExercise = ex.id;
      currentExercise = ex;
      currentIndex = index;
      render();
    }
  }

  /* ---- Input Builders ---- */

  function buildInput(container, ex) {
    switch (ex.type) {
      case 'multiple-choice':
        buildMultipleChoice(container, ex);
        break;
      case 'fill-in-blank':
        buildFillInBlank(container, ex);
        break;
      case 'listen-and-repeat':
        buildListenAndRepeat(container, ex);
        break;
      case 'reorder-words':
        buildReorderWords(container, ex);
        break;
      case 'error-correction':
        buildErrorCorrection(container, ex);
        break;
      case 'sentence-transformation':
        buildFillInBlank(container, ex); // Same as fill-in-blank
        break;
      case 'describe-image':
        buildDescribeImage(container, ex);
        break;
      case 'situational-dialogue':
        buildSituationalDialogue(container, ex);
        break;
      default:
        container.textContent = 'Tipo de ejercicio no soportado: ' + ex.type;
    }
  }

  function buildMultipleChoice(container, ex) {
    var wrapper = document.createElement('div');
    wrapper.className = 'mc-options';

    var options = ex.options || [];
    options.forEach(function(opt, i) {
      var btn = document.createElement('button');
      btn.className = 'mc-option';
      btn.textContent = opt;
      btn.addEventListener('click', function() {
        if (answered) return;
        submitAnswer([i.toString()]);
      });
      wrapper.appendChild(btn);
    });

    container.appendChild(wrapper);
  }

  function buildFillInBlank(container, ex) {
    var input = document.createElement('input');
    input.type = 'text';
    input.className = 'text-input';
    input.placeholder = 'Escribe aquí...';
    input.setAttribute('autocomplete', 'off');
    container.appendChild(input);

    input.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !answered) {
        submitAnswer([input.value.trim()]);
      }
    });

    // Focus input after render
    setTimeout(function() { input.focus(); }, 50);
  }

  function buildListenAndRepeat(container, ex) {
    var row = document.createElement('div');
    row.className = 'input-row';

    // Play button
    var playBtn = document.createElement('button');
    playBtn.className = 'mic-btn';
    playBtn.innerHTML = '🔊';
    playBtn.setAttribute('aria-label', 'Escuchar pronunciación');
    playBtn.addEventListener('click', function() {
      if (window.App && App.SpeechManager && App.SpeechManager.speak) {
        App.SpeechManager.speak(ex.correctAnswers[0]);
      } else {
        try {
          var utter = new SpeechSynthesisUtterance(ex.correctAnswers[0]);
          utter.lang = 'it-IT';
          speechSynthesis.speak(utter);
        } catch (e) {
          console.warn('Speech synthesis not available');
        }
      }
    });
    row.appendChild(playBtn);

    // Mic button — speech recognition
    var micBtn = document.createElement('button');
    micBtn.className = 'mic-btn mic-btn-record';
    micBtn.innerHTML = '🎤';
    micBtn.setAttribute('aria-label', 'Grabar respuesta');
    micBtn.title = 'Grabar respuesta';
    row.appendChild(micBtn);

    // Text fallback
    var input = document.createElement('input');
    input.type = 'text';
    input.className = 'text-input';
    input.placeholder = 'O escribe lo que escuchaste...';
    input.setAttribute('autocomplete', 'off');
    row.appendChild(input);

    container.appendChild(row);

    input.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !answered) {
        submitAnswer([input.value.trim()]);
      }
    });

    // Wire mic button to SpeechManager
    micBtn.addEventListener('click', function() {
      if (answered) return;
      if (!App.SpeechManager || !App.SpeechManager.isSupported()) {
        // Show notice and focus text input
        var notice = document.createElement('p');
        notice.className = 'voice-notice';
        notice.textContent = 'Reconocimiento de voz no disponible en este navegador. Escribe tu respuesta.';
        container.appendChild(notice);
        input.focus();
        return;
      }

      micBtn.classList.add('recording');
      micBtn.innerHTML = '⏺';

      App.SpeechManager.start();

      var onResult = function(e) {
        var result = e.detail;
        if (result.isFinal) {
          App.SpeechManager.stop();
          micBtn.classList.remove('recording');
          micBtn.innerHTML = '🎤';

          // Store confidence from first alternative
          var confidence = result.alternatives && result.alternatives.length > 0
            ? result.alternatives[0].confidence : undefined;
          lastVoiceConfidence = confidence;

          // Fill in the text input with transcript
          input.value = result.transcript;

          // Show alternatives if confidence is low
          if (confidence !== undefined && confidence < 0.5 && result.alternatives && result.alternatives.length > 1) {
            var altText = result.alternatives.slice(0, 3).map(function(a, i) {
              return (i + 1) + '. ' + a.transcript;
            }).join('  ');
            var altNotice = document.createElement('p');
            altNotice.className = 'voice-notice';
            altNotice.textContent = 'Quizás has dicho: ' + altText;
            var fb = container.querySelector('.exercise-feedback');
            if (fb) fb.parentNode.insertBefore(altNotice, fb);
          }

          // Auto-submit after short delay
          setTimeout(function() {
            submitAnswer([result.transcript]);
          }, 500);

          window.removeEventListener('speech:result', onResult);
          window.removeEventListener('speech:error', onError);
        }
      };

      var onError = function(e) {
        micBtn.classList.remove('recording');
        micBtn.innerHTML = '🎤';
        var error = e.detail;

        var notice = document.createElement('p');
        notice.className = 'voice-notice error';
        notice.textContent = error.message;
        container.appendChild(notice);

        input.focus();
        window.removeEventListener('speech:result', onResult);
        window.removeEventListener('speech:error', onError);
      };

      window.addEventListener('speech:result', onResult);
      window.addEventListener('speech:error', onError);

      // Timeout after 8 seconds
      setTimeout(function() {
        if (App.SpeechManager.isListening()) {
          App.SpeechManager.stop();
          micBtn.classList.remove('recording');
          micBtn.innerHTML = '🎤';
        }
      }, 8000);
    });
  }

  function buildReorderWords(container, ex) {
    var words = (ex.options || []).slice();

    // Shuffle Fisher-Yates
    for (var i = words.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = words[i]; words[i] = words[j]; words[j] = tmp;
    }

    var selected = [];
    var remaining = words.slice();

    var selectedRow = document.createElement('div');
    selectedRow.className = 'reorder-container';
    selectedRow.setAttribute('aria-label', 'Palabras seleccionadas');

    var remainingRow = document.createElement('div');
    remainingRow.className = 'reorder-container';
    remainingRow.setAttribute('aria-label', 'Palabras disponibles');

    function renderChips() {
      selectedRow.innerHTML = '';
      remainingRow.innerHTML = '';

      if (selected.length === 0) {
        var placeholderSelected = document.createElement('span');
        placeholderSelected.className = 'word-chip placeholder';
        placeholderSelected.textContent = 'Toca palabras para ordenarlas...';
        placeholderSelected.style.color = 'var(--text-secondary)';
        placeholderSelected.style.cursor = 'default';
        selectedRow.appendChild(placeholderSelected);
      } else {
        selected.forEach(function(w) {
          var chip = document.createElement('span');
          chip.className = 'word-chip selected placed';
          chip.textContent = w;
          chip.addEventListener('click', function() {
            if (answered) return;
            var idx = selected.indexOf(w);
            if (idx >= 0) selected.splice(idx, 1);
            remaining.push(w);
            renderChips();
          });
          selectedRow.appendChild(chip);
        });
      }

      remaining.forEach(function(w) {
        var chip = document.createElement('span');
        chip.className = 'word-chip';
        chip.textContent = w;
        chip.addEventListener('click', function() {
          if (answered) return;
          var idx = remaining.indexOf(w);
          if (idx >= 0) remaining.splice(idx, 1);
          selected.push(w);
          renderChips();
        });
        remainingRow.appendChild(chip);
      });
    }

    renderChips();
    container.appendChild(selectedRow);
    container.appendChild(remainingRow);
  }

  function buildErrorCorrection(container, ex) {
    var wrapper = document.createElement('div');
    wrapper.className = 'error-correction-text';

    var words2 = (ex.options || []).slice();
    var markedErrors = [];

    words2.forEach(function(w) {
      var span = document.createElement('span');
      span.className = 'error-word';
      span.textContent = w;
      span.addEventListener('click', function() {
        if (answered) return;
        span.classList.toggle('marked');
        var idx = markedErrors.indexOf(w);
        if (idx >= 0) {
          markedErrors.splice(idx, 1);
        } else {
          markedErrors.push(w);
        }
      });
      wrapper.appendChild(span);
    });

    container.appendChild(wrapper);
  }

  function buildDescribeImage(container, ex) {
    // Show the scene description as context
    if (ex.options && ex.options[0]) {
      var sceneDesc = document.createElement('p');
      sceneDesc.className = 'image-prompt';
      sceneDesc.style.fontStyle = 'italic';
      sceneDesc.style.marginBottom = '12px';
      sceneDesc.textContent = '📌 ' + ex.options[0];
      container.appendChild(sceneDesc);
    }

    var textarea = document.createElement('textarea');
    textarea.className = 'text-input textarea';
    textarea.placeholder = 'Describe la imagen en italiano...';
    textarea.rows = 4;
    textarea.style.width = '100%';
    textarea.style.padding = '12px';
    textarea.style.border = '2px solid var(--border)';
    textarea.style.borderRadius = 'var(--radius-sm)';
    textarea.style.fontSize = '1rem';
    textarea.style.fontFamily = 'inherit';
    textarea.style.backgroundColor = 'var(--bg)';
    textarea.style.color = 'var(--text)';
    textarea.style.resize = 'vertical';
    container.appendChild(textarea);
  }

  function buildSituationalDialogue(container, ex) {
    var wrapper = document.createElement('div');
    wrapper.className = 'mc-options';

    var options3 = ex.options || [];
    options3.forEach(function(opt, i) {
      var btn = document.createElement('button');
      btn.className = 'mc-option';
      btn.textContent = opt;
      btn.addEventListener('click', function() {
        if (answered) return;
        submitAnswer([i.toString()]);
      });
      wrapper.appendChild(btn);
    });

    container.appendChild(wrapper);
  }

  /* ---- Action Buttons ---- */

  function buildActions(container) {
    // Submit button (for types that need a submit action)
    if (needsSubmitButton(currentExercise)) {
      var submitBtn = document.createElement('button');
      submitBtn.id = 'ex-submit';
      submitBtn.className = 'btn btn-primary';
      submitBtn.textContent = '✓ Verificar';
      submitBtn.addEventListener('click', function() {
        if (answered) return;
        var input = getCurrentInput();
        if (input) submitAnswer(input);
      });
      container.appendChild(submitBtn);
    }

    // Skip button — becomes "Volver al módulo" on last exercise
    var skipBtn = document.createElement('button');
    skipBtn.className = 'btn btn-secondary';
    var isLast = currentIndex >= moduleExercises.length - 1;
    skipBtn.textContent = isLast ? '✅ Completado — Volver al módulo' : 'Siguiente →';
    skipBtn.addEventListener('click', function() {
      if (isLast) {
        // Go to module lesson view
        if (typeof App !== 'undefined' && App.nav) {
          App.nav.show('module', { module: App.state.currentModule });
        }
      } else if (currentIndex < moduleExercises.length - 1) {
        goTo(currentIndex + 1);
      }
    });
    container.appendChild(skipBtn);

    // Navigation buttons
    if (currentIndex > 0) {
      var prevBtn = document.createElement('button');
      prevBtn.className = 'btn btn-secondary';
      prevBtn.textContent = '← Anterior';
      prevBtn.addEventListener('click', function() {
        goTo(currentIndex - 1);
      });
      container.appendChild(prevBtn);
    }
  }

  /**
   * Collect the current answer from whichever exercise type is active.
   * Returns an array of strings, or null if no input found.
   */
  function getCurrentInput() {
    var ex = currentExercise;
    if (!ex) return null;
    var inputEl = document.getElementById('ex-input');
    if (!inputEl) return null;

    switch (ex.type) {
      case 'fill-in-blank':
      case 'sentence-transformation':
      case 'listen-and-repeat':
      case 'describe-image': {
        var input = inputEl.querySelector('.text-input');
        return input ? [input.value.trim()] : null;
      }
      case 'error-correction': {
        var marked = inputEl.querySelectorAll('.error-word.marked');
        var result = [];
        marked.forEach(function(el) { result.push(el.textContent); });
        return result.length > 0 ? result : null;
      }
      case 'reorder-words': {
        var placed = inputEl.querySelector('.reorder-container:first-child');
        if (!placed) return null;
        var chips = placed.querySelectorAll('.word-chip');
        var parts = [];
        chips.forEach(function(c) { parts.push(c.textContent); });
        return parts.length > 0 ? parts : null;
      }
      default:
        return null;
    }
  }

  function needsSubmitButton(ex) {
    if (!ex) return false;
    // These types don't auto-submit — they need a submit button
    return ['fill-in-blank', 'sentence-transformation', 'listen-and-repeat',
            'describe-image', 'error-correction', 'reorder-words'].indexOf(ex.type) >= 0;
  }

  /* ---- Validation & Scoring ---- */

  function validateAnswer(answer, ex) {
    var correct = false;
    var score = 0;
    var feedbackText = '';

    switch (ex.type) {
      case 'multiple-choice':
      case 'situational-dialogue':
        correct = ex.correctAnswers.indexOf(answer[0]) >= 0;
        score = correct ? 100 : 0;
        feedbackText = correct ? '¡Correcto! ✓' : 'No es correcto. ¡Intenta de nuevo!';
        break;

      case 'fill-in-blank':
      case 'sentence-transformation':
        var userAns = (answer[0] || '').toLowerCase().trim();
        correct = ex.correctAnswers.some(function(ca) {
          return ca.toLowerCase().trim() === userAns;
        });
        if (correct) {
          score = 100;
          feedbackText = '¡Correcto! ✓';
        } else {
          // Check for single typo
          var typoFound = false;
          var closest = '';
          ex.correctAnswers.forEach(function(ca) {
            var diff = levenshtein(ca.toLowerCase().trim(), userAns);
            if (diff === 1) {
              typoFound = true;
              closest = ca;
            }
          });
          if (typoFound) {
            score = 50;
            feedbackText = '¡Casi correcto! — Casi correcto: revisa la ortografía.';
            // Show what was expected
            if (closest) {
              feedbackText += ' (' + closest + ')';
            }
          } else {
            score = 0;
            feedbackText = 'No es correcto. ¡Intenta de nuevo!';
          }
        }
        break;

      case 'reorder-words':
        var expected = (ex.correctAnswers[0] || '').split(' ');
        correct = expected.length === answer.length &&
          expected.every(function(w, i) { return w === answer[i]; });
        score = correct ? 100 : 0;
        feedbackText = correct ? '¡Correcto! ✓' : 'Orden incorrecto. ¡Intenta de nuevo!';
        break;

      case 'error-correction':
        // User marks wrong words; compare to expected list
        correct = ex.correctAnswers.some(function(ca) {
          var expectedErrors = ca.split(',');
          return expectedErrors.length === answer.length &&
            expectedErrors.every(function(e) { return answer.indexOf(e) >= 0; });
        });
        score = correct ? 100 : 0;
        feedbackText = correct ? '¡Correcto! ✓ Has encontrado el error.' : 'No es correcto. Busca el error en la frase.';
        break;

      case 'listen-and-repeat':
        var userText = (answer[0] || '').toLowerCase().trim();
        var expectedText = ex.correctAnswers[0] || '';
        var confidence = lastVoiceConfidence;
        var comparison = compareTranscripts(expectedText, userText, confidence);
        lastVoiceConfidence = undefined; // reset
        score = comparison.score;
        correct = score >= 70;
        feedbackText = correct
          ? '¡Bien! ✓ Pronunciación correcta.'
          : 'La pronunciación puede mejorar. Intenta de nuevo.';
        // Store word-level data for voice feedback rendering
        result.voiceWords = comparison.words;
        result.voiceScore = comparison.score;
        break;

      case 'describe-image':
        var userText = (answer[0] || '').toLowerCase();
        var keywordCount = 0;
        ex.correctAnswers.forEach(function(ca) {
          if (userText.indexOf(ca.toLowerCase()) >= 0) keywordCount++;
        });
        score = Math.min(100, Math.round((keywordCount / Math.max(1, ex.correctAnswers.length)) * 100));
        correct = score >= 60;
        feedbackText = correct
          ? '¡Bien! ✓ Palabras clave encontradas.'
          : 'Intenta incluir más palabras clave.';
        break;
    }

    return {
      correct: correct,
      score: score,
      feedbackText: feedbackText,
      userAnswer: answer,
      correctAnswers: ex.correctAnswers
    };
  }

  /* ---- Feedback Rendering ---- */

  function renderFeedback(result, ex) {
    var feedbackEl = document.getElementById('ex-feedback');
    var hintEl = document.getElementById('ex-hint');
    if (!feedbackEl) return;

    feedbackEl.innerHTML = '';
    feedbackEl.className = 'ex-feedback ' + (result.correct ? 'correct' : 'incorrect');

    // Result icon and score
    var resultDiv = document.createElement('div');
    resultDiv.className = 'feedback-result';

    var icon = document.createElement('span');
    icon.className = 'feedback-icon';
    icon.textContent = result.correct ? '✅' : '❌';
    resultDiv.appendChild(icon);

    var scoreEl = document.createElement('span');
    scoreEl.className = 'feedback-score';
    scoreEl.textContent = ' ' + result.score + '%';
    resultDiv.appendChild(scoreEl);

    feedbackEl.appendChild(resultDiv);

    // Feedback text (or voice feedback for listen-and-repeat)
    if (result.voiceWords) {
      renderVoiceFeedback(result.voiceWords, result.voiceScore, feedbackEl);

      // TTS play button
      var ttsBtn = document.createElement('button');
      ttsBtn.className = 'tts-btn';
      ttsBtn.innerHTML = '🔊 Reproducir pronunciación';
      ttsBtn.addEventListener('click', function() {
        if (App.SpeechManager && App.SpeechManager.speak) {
          App.SpeechManager.speak(ex.correctAnswers[0]);
        }
      });
      feedbackEl.appendChild(ttsBtn);
    } else {
      var textP = document.createElement('p');
      textP.style.marginTop = '8px';
      textP.textContent = result.feedbackText;
      feedbackEl.appendChild(textP);
    }

    // Show correct answer if wrong and out of attempts
    if (!result.correct && attemptCount >= 3) {
      var correctP = document.createElement('p');
      correctP.className = 'correct-answer';
      correctP.style.marginTop = '8px';
      correctP.style.fontWeight = '500';
      correctP.textContent = 'Respuesta: ' + ex.correctAnswers[0];
      feedbackEl.appendChild(correctP);

      // TTS button
      var playBtn = document.createElement('button');
      playBtn.className = 'btn btn-secondary';
      playBtn.style.marginTop = '8px';
      playBtn.innerHTML = '🔊 Escuchar pronunciación';
      playBtn.addEventListener('click', function() {
        if (window.App && App.SpeechManager && App.SpeechManager.speak) {
          App.SpeechManager.speak(ex.correctAnswers[0]);
        } else {
          try {
            var utter = new SpeechSynthesisUtterance(ex.correctAnswers[0]);
            utter.lang = 'it-IT';
            speechSynthesis.speak(utter);
          } catch (e) {}
        }
      });
      feedbackEl.appendChild(playBtn);
    }

    // Show correct answer on correct submission too
    if (result.correct) {
      var correctP2 = document.createElement('p');
      correctP2.style.marginTop = '8px';
      correctP2.style.fontWeight = '400';
      correctP2.style.opacity = '0.8';
      correctP2.textContent = '✓ ' + ex.correctAnswers[0];
      feedbackEl.appendChild(correctP2);
    }

    // Progressive hints
    if (!result.correct && attemptCount < 3 && ex.hints && ex.hints.length > 0) {
      var hintIdx = Math.min(attemptCount - 1, ex.hints.length - 1);
      if (ex.hints[hintIdx]) {
        if (hintEl) {
          hintEl.textContent = '💡 ' + ex.hints[hintIdx];
          hintEl.style.display = 'block';
        }
      }

      // Allow retry if still have attempts
      answered = false;
      var retryBtn = document.createElement('button');
      retryBtn.className = 'btn btn-primary';
      retryBtn.style.marginTop = '12px';
      retryBtn.textContent = 'Intentar de nuevo (' + (3 - attemptCount) + ' intentos restantes)';
      retryBtn.addEventListener('click', function() {
        // Clear feedback
        feedbackEl.innerHTML = '';
        feedbackEl.className = 'ex-feedback';
        if (hintEl) {
          hintEl.textContent = '';
          hintEl.style.display = 'none';
        }
        answered = false;
        // Focus input
        var firstInput = document.querySelector('#ex-input .text-input');
        if (firstInput) firstInput.focus();
      });
      feedbackEl.appendChild(retryBtn);
    }

    feedbackEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /* ---- Utility ---- */

  function updateStreakDisplay(learner) {
    var streak = App.Progress.calcStreak(learner);
    var streakEl = document.getElementById('streak-count');
    if (streakEl) {
      streakEl.textContent = streak || 0;
    }
  }

  /**
   * Levenshtein distance for typo detection.
   */
  function levenshtein(a, b) {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    var matrix = [];
    for (var i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    for (var j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    for (var i = 1; i <= b.length; i++) {
      for (var j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
          );
        }
      }
    }
    return matrix[b.length][a.length];
  }

  /* ---- Voice Comparison ---- */

  /**
   * Compare an expected phrase against the user's spoken transcript.
   * Normalises both, tokenises, aligns by index, and classifies each word.
   * @param {string} expected - The correct answer phrase
   * @param {string} actual - The user's spoken (or typed) transcript
   * @returns {{words: Array, score: number}}
   */
  function compareTranscripts(expected, actual, confidence) {
    // Normalize: lowercase, trim, remove punctuation
    var norm = function(s) {
      return s.toLowerCase().trim().replace(/[.!?,\-;:]/g, '');
    };

    var expectedWords = norm(expected).split(/\s+/).filter(Boolean);
    var actualWords = norm(actual).split(/\s+/).filter(Boolean);

    var words = [];
    var maxLen = Math.max(expectedWords.length, actualWords.length);

    for (var i = 0; i < maxLen; i++) {
      var expectedWord = expectedWords[i] || '';
      var actualWord = actualWords[i] || '';

      if (actualWord === expectedWord) {
        // Use confidence if available
        if (confidence !== undefined && confidence < 0.7) {
          // Word matched but low confidence → yellow
          words.push({ text: expectedWord, status: 'typo', actual: actualWord, confidenceHint: confidence >= 0.3 ? 'Habla más claro' : 'Repite, por favor' });
        } else {
          words.push({ text: expectedWord, status: 'correct', actual: actualWord });
        }
      } else if (levenshtein(actualWord, expectedWord) <= 1 && expectedWord.length > 2) {
        words.push({ text: expectedWord, status: 'typo', actual: actualWord });
      } else if (actualWord && expectedWord) {
        words.push({ text: expectedWord, status: 'wrong', actual: actualWord });
      } else if (!actualWord) {
        words.push({ text: expectedWord, status: 'missing', actual: '' });
      } else {
        words.push({ text: actualWord, status: 'extra', actual: actualWord });
      }
    }

    var correctCount = words.filter(function(w) { return w.status === 'correct'; }).length;
    var score = expectedWords.length > 0 ? Math.round((correctCount / expectedWords.length) * 100) : 0;

    return { words: words, score: score, confidenceUsed: confidence };
  }

  /**
   * Render color-coded voice feedback (word-by-word display + score + message).
   * @param {Array} words - Array of { text, status, actual }
   * @param {number} score - Precision percentage 0-100
   * @param {HTMLElement} container - The feedback element to render into
   */
  function renderVoiceFeedback(words, score, container) {
    // Word-by-word display
    var wordsDisplay = document.createElement('div');
    wordsDisplay.className = 'voice-words';
    wordsDisplay.setAttribute('aria-label', 'Resultado de pronunciación');

    words.forEach(function(w) {
      var span = document.createElement('span');
      span.className = 'word-' + w.status;
      span.textContent = w.text;

      if (w.status === 'wrong' || w.status === 'missing') {
        span.setAttribute('data-expected', w.status === 'wrong' ? w.actual : w.text);
      }

      span.title = w.status === 'correct' ? 'Correcto ✓' :
        w.status === 'typo' ? 'Casi correcto' :
        w.status === 'wrong' ? 'Esperado: ' + w.text + ', dicho: ' + w.actual :
        w.status === 'missing' ? 'Falta esta palabra' :
        'Palabra extra: ' + w.actual;

      wordsDisplay.appendChild(span);
    });

    container.appendChild(wordsDisplay);

    // Score
    var scoreEl = document.createElement('div');
    scoreEl.className = 'voice-score';
    scoreEl.textContent = 'Precisión: ' + score + '%';
    scoreEl.style.color = score >= 70 ? 'var(--success)' :
      score >= 40 ? 'var(--warning)' : 'var(--error)';
    container.appendChild(scoreEl);

    // Overall feedback
    var feedback = document.createElement('p');
    feedback.className = 'voice-feedback-text';
    if (score >= 90) feedback.textContent = '¡Excelente! 🇮🇹';
    else if (score >= 70) feedback.textContent = '¡Muy bien! Sigue así.';
    else if (score >= 40) feedback.textContent = 'Buen intento. Prueba en voz alta.';
    else feedback.textContent = 'Escucha la pronunciación e intenta de nuevo.';
    container.appendChild(feedback);
  }

  /* ============================================
     Exam Engine
     ============================================ */

  function loadExam() {
    var dataEl = document.getElementById('data-exam');
    if (!dataEl) return false;
    try {
      examData = JSON.parse(dataEl.textContent);
    } catch (e) {
      console.warn('[ExamEngine] Failed to parse exam data:', e);
      return false;
    }
    return !!examData;
  }

  function startExam(mode) {
    examState = {
      sectionIndex: 0,
      questionIndex: 0,
      answers: {},
      timer: null,
      secondsRemaining: 0,
      mode: mode || 'practice'
    };

    if (!examData) loadExam();
    if (!examData) return;

    App.state.examInProgress = true;
    App.state.examMode = examState.mode;
    App.nav.show('exam');

    renderExamSection(0);
  }

  function renderExamSection(sectionIdx) {
    if (!examData || !examData.sections[sectionIdx]) {
      finishExam();
      return;
    }

    examState.sectionIndex = sectionIdx;
    examState.questionIndex = 0;

    var section = examData.sections[sectionIdx];
    var container = document.getElementById('section-exam');
    if (!container) return;

    container.innerHTML = '';

    // Section header
    var header = document.createElement('div');
    header.className = 'exam-header';

    var title = document.createElement('h2');
    title.textContent = section.title;
    header.appendChild(title);

    var progress = document.createElement('div');
    progress.className = 'exam-progress';
    var sectionNum = sectionIdx + 1;
    var totalSections = examData.sections.length;
    progress.textContent = 'Sección ' + sectionNum + ' de ' + totalSections;
    header.appendChild(progress);

    // Timer (only in exam mode)
    if (examState.mode === 'exam' && section.timeMinutes) {
      var timerEl = document.createElement('div');
      timerEl.className = 'exam-timer';
      timerEl.id = 'exam-timer';
      header.appendChild(timerEl);

      examState.secondsRemaining = section.timeMinutes * 60;
      startTimer(timerEl);
    }

    container.appendChild(header);

    // Question area
    var questionArea = document.createElement('div');
    questionArea.className = 'exam-questions';
    questionArea.id = 'exam-questions';
    container.appendChild(questionArea);

    renderExamQuestion(0);
  }

  function renderExamQuestion(qIdx) {
    var section = examData.sections[examState.sectionIndex];
    if (!section || !section.questions[qIdx]) return;

    examState.questionIndex = qIdx;
    var question = section.questions[qIdx];
    var area = document.getElementById('exam-questions');
    if (!area) return;

    area.innerHTML = '';

    // Question counter
    var counter = document.createElement('div');
    counter.className = 'exam-q-counter';
    counter.textContent = 'Pregunta ' + (qIdx + 1) + ' de ' + section.questions.length;
    area.appendChild(counter);

    // Points
    var pts = document.createElement('span');
    pts.className = 'exam-points';
    pts.textContent = '(' + question.points + ' puntos)';
    counter.appendChild(pts);

    // Prompt
    var prompt = document.createElement('div');
    prompt.className = 'exam-prompt';
    prompt.textContent = question.prompt;
    area.appendChild(prompt);

    // Input based on type
    if (question.type === 'multiple-choice') {
      var options = question.options || [];
      options.forEach(function(opt, i) {
        var btn = document.createElement('button');
        btn.className = 'exam-choice-btn';
        btn.textContent = String.fromCharCode(65 + i) + '. ' + opt;
        btn.addEventListener('click', function() {
          area.querySelectorAll('.exam-choice-btn').forEach(function(b) { b.classList.remove('selected'); });
          btn.classList.add('selected');
          examState.answers[question.id] = i;
        });
        area.appendChild(btn);
      });
    } else if (question.type === 'fill-in-blank') {
      var input = document.createElement('input');
      input.type = 'text';
      input.className = 'text-input';
      input.placeholder = 'Escribe la respuesta...';
      input.setAttribute('autocomplete', 'off');
      input.addEventListener('input', function() {
        examState.answers[question.id] = input.value.trim();
      });
      area.appendChild(input);
      setTimeout(function() { input.focus(); }, 50);
    } else if (question.type === 'error-correction') {
      var words = (question.options || []).slice();
      var chipsContainer = document.createElement('div');
      chipsContainer.className = 'exam-chips';

      words.forEach(function(w) {
        var chip = document.createElement('span');
        chip.className = 'exam-chip';
        chip.textContent = w;
        chip.addEventListener('click', function() {
          chip.classList.toggle('selected');
          var marked = [];
          area.querySelectorAll('.exam-chip.selected').forEach(function(c) {
            marked.push(c.textContent);
          });
          examState.answers[question.id] = marked;
        });
        chipsContainer.appendChild(chip);
      });
      area.appendChild(chipsContainer);
    } else if (question.type === 'listen-and-repeat' || question.type === 'describe-image') {
      var textarea = document.createElement('textarea');
      textarea.className = 'text-input textarea';
      textarea.placeholder = 'Habla (usa el micrófono) o escribe...';
      textarea.rows = 4;
      textarea.addEventListener('input', function() {
        examState.answers[question.id] = textarea.value.trim();
      });
      area.appendChild(textarea);

      // Use speech if available
      if (App.SpeechManager && App.SpeechManager.isSupported()) {
        var micBtn = document.createElement('button');
        micBtn.className = 'mic-btn mic-btn-record';
        micBtn.innerHTML = '🎤';
        micBtn.setAttribute('aria-label', 'Grabar respuesta de voz');
        micBtn.addEventListener('click', function() {
          App.SpeechManager.start();
          micBtn.classList.add('recording');
          var onResult = function(e) {
            if (e.detail.isFinal) {
              textarea.value = e.detail.transcript;
              examState.answers[question.id] = e.detail.transcript;
              App.SpeechManager.stop();
              micBtn.classList.remove('recording');
              window.removeEventListener('speech:result', onResult);
            }
          };
          window.addEventListener('speech:result', onResult);
          setTimeout(function() {
            App.SpeechManager.stop();
            micBtn.classList.remove('recording');
            window.removeEventListener('speech:result', onResult);
          }, 15000);
        });
        area.appendChild(micBtn);
      }
    }

    // Navigation buttons
    var nav = document.createElement('div');
    nav.className = 'exam-nav';

    if (qIdx > 0) {
      var prevBtn = document.createElement('button');
      prevBtn.className = 'nav-btn';
      prevBtn.textContent = '← Anterior';
      prevBtn.addEventListener('click', function() { renderExamQuestion(qIdx - 1); });
      nav.appendChild(prevBtn);
    }

    if (qIdx < section.questions.length - 1) {
      var nextBtn = document.createElement('button');
      nextBtn.className = 'nav-btn primary';
      nextBtn.textContent = 'Siguiente →';
      nextBtn.addEventListener('click', function() { renderExamQuestion(qIdx + 1); });
      nav.appendChild(nextBtn);
    } else {
      // Last question of section
      var nextSecBtn = document.createElement('button');
      nextSecBtn.className = 'nav-btn primary';
      nextSecBtn.textContent = 'Siguiente sección →';
      nextSecBtn.addEventListener('click', function() { renderExamSection(examState.sectionIndex + 1); });
      nav.appendChild(nextSecBtn);
    }

    area.appendChild(nav);
  }

  function startTimer(timerEl) {
    if (examState.timer) clearInterval(examState.timer);

    examState.timer = setInterval(function() {
      examState.secondsRemaining--;

      if (timerEl) {
        var mins = Math.floor(examState.secondsRemaining / 60);
        var secs = examState.secondsRemaining % 60;
        timerEl.textContent = '⏱ ' + mins + ':' + (secs < 10 ? '0' : '') + secs;

        // Color changes
        if (examState.secondsRemaining > 60) {
          timerEl.style.color = 'var(--accent)';
        } else if (examState.secondsRemaining > 30) {
          timerEl.style.color = 'var(--warning)';
          timerEl.classList.remove('urgent');
        } else {
          timerEl.style.color = 'var(--error)';
          timerEl.classList.add('urgent');
        }
      }

      if (examState.secondsRemaining <= 0) {
        clearInterval(examState.timer);
        examState.timer = null;
        // Auto-submit this section
        renderExamSection(examState.sectionIndex + 1);
      }
    }, 1000);
  }

  function finishExam() {
    if (examState.timer) {
      clearInterval(examState.timer);
      examState.timer = null;
    }
    App.state.examInProgress = false;

    // Calculate scores
    var results = {
      sections: [],
      total: 0,
      maxTotal: 0,
      date: new Date().toISOString(),
      mode: examState.mode
    };

    examData.sections.forEach(function(section) {
      var sectionResult = {
        title: section.title,
        score: 0,
        maxScore: 0,
        questions: []
      };

      section.questions.forEach(function(q) {
        sectionResult.maxScore += q.points;
        var userAnswer = examState.answers[q.id];
        var correct = false;

        if (q.type === 'multiple-choice') {
          correct = userAnswer === q.correctAnswer;
        } else if (q.type === 'fill-in-blank') {
          var userStr = (userAnswer || '').toLowerCase().trim();
          correct = q.correctAnswers.some(function(ca) {
            return ca.toLowerCase().trim() === userStr;
          });
        } else if (q.type === 'error-correction') {
          var userArr = userAnswer || [];
          correct = q.correctAnswers.some(function(ca) {
            return userArr.indexOf(ca) >= 0;
          });
        } else {
          // Oral: check keyword presence
          var text = (userAnswer || '').toLowerCase();
          var keywordCount = q.correctAnswers.filter(function(kw) {
            return text.indexOf(kw.toLowerCase()) >= 0;
          }).length;
          correct = keywordCount >= Math.ceil(q.correctAnswers.length * 0.4);
          var oralScore = Math.round((keywordCount / q.correctAnswers.length) * q.points);
          sectionResult.score += oralScore;
          sectionResult.questions.push({
            id: q.id,
            correct: correct,
            score: oralScore,
            maxScore: q.points
          });
          return; // skip the general score addition below
        }

        if (correct) sectionResult.score += q.points;
        sectionResult.questions.push({
          id: q.id,
          correct: correct,
          score: correct ? q.points : 0,
          maxScore: q.points
        });
      });

      results.sections.push(sectionResult);
      results.total += sectionResult.score;
      results.maxTotal += sectionResult.maxScore;
    });

    // Save exam result
    var learner = App.state.currentLearner;
    if (learner) {
      var profile = App.Progress.get(learner);
      if (profile) {
        if (!profile.exams) profile.exams = [];
        profile.exams.push(results);
        App.Progress.save(learner, profile);
      }
    }

    // Show results
    showExamResults(results);
  }

  function showExamResults(results) {
    App.nav.show('results');
    var container = document.getElementById('section-results');
    if (!container) return;

    container.innerHTML = '';

    var title = document.createElement('h1');
    title.textContent = 'Resultados del Examen';
    container.appendChild(title);

    var mode = document.createElement('p');
    mode.className = 'exam-mode-label';
    mode.textContent = 'Modalidad: ' + (results.mode === 'exam' ? 'Examen' : 'Práctica');
    container.appendChild(mode);

    // Total score
    var totalScore = document.createElement('div');
    totalScore.className = 'exam-total-score';
    var pct = results.maxTotal > 0 ? Math.round((results.total / results.maxTotal) * 100) : 0;
    totalScore.textContent = results.total + ' / ' + results.maxTotal + ' (' + pct + '%)';
    totalScore.style.color = pct >= 60 ? 'var(--success)' : pct >= 40 ? 'var(--warning)' : 'var(--error)';
    container.appendChild(totalScore);

    // Level
    var level = document.createElement('p');
    level.className = 'exam-level';
    if (pct >= 80) level.textContent = '✅ ¡Nivel B1 alcanzado! ¡Felicidades!';
    else if (pct >= 60) level.textContent = '👍 Buen resultado. Sigue practicando.';
    else level.textContent = '💪 Sigue estudiando e inténtalo de nuevo.';
    container.appendChild(level);

    // Section breakdown
    results.sections.forEach(function(section) {
      var sectionCard = document.createElement('div');
      sectionCard.className = 'exam-section-result';

      var sTitle = document.createElement('h3');
      sTitle.textContent = section.title;
      sectionCard.appendChild(sTitle);

      var sScore = document.createElement('div');
      sScore.className = 'exam-section-score';
      var sPct = section.maxScore > 0 ? Math.round((section.score / section.maxScore) * 100) : 0;
      sScore.textContent = section.score + ' / ' + section.maxScore + ' (' + sPct + '%)';
      sectionCard.appendChild(sScore);

      container.appendChild(sectionCard);
    });

    // Back button
    var backBtn = document.createElement('button');
    backBtn.className = 'nav-btn primary';
    backBtn.textContent = '← Volver a los módulos';
    backBtn.addEventListener('click', function() {
      App.nav.home();
    });
    container.appendChild(backBtn);
  }

  /* ============================================
     N-LEVEL EXERCISE SUPPORT (for step 8)
     ============================================ */

  /**
   * Render a question for a given difficulty level into a container.
   * @param {object} q - Question data object (type-specific)
   * @param {number} nivel - 1-7
   * @param {HTMLElement} container - Target DOM element
   */
  function renderQuestion(q, nivel, container) {
    if (!container) return;
    container.innerHTML = '';

    switch (nivel) {
      case 1:
        renderQuestionN1(q, container);
        break;
      case 2:
        renderQuestionN2(q, container);
        break;
      case 3:
        renderQuestionN3(q, container);
        break;
      case 4:
        renderQuestionN4(q, container);
        break;
      case 5:
        renderQuestionN5(q, container);
        break;
      case 6:
        renderQuestionN6(q, container);
        break;
      case 7:
        renderQuestionN7(q, container);
        break;
      default:
        container.textContent = 'Nivel no soportado: ' + nivel;
    }
  }

  /**
   * N1 — Multiple choice with radio buttons.
   */
  function renderQuestionN1(q, container) {
    var questionEl = document.createElement('div');
    questionEl.className = 'nlevel-mc';
    questionEl.setAttribute('data-nivel', '1');
    questionEl.setAttribute('data-correctindex', q.correctIndex);

    var questionText = document.createElement('p');
    questionText.className = 'nlevel-question';
    questionText.textContent = q.question;
    questionEl.appendChild(questionText);

    var optionsDiv = document.createElement('div');
    optionsDiv.className = 'nlevel-options';
    optionsDiv.style.display = 'flex';
    optionsDiv.style.flexDirection = 'column';
    optionsDiv.style.gap = '8px';

    (q.options || []).forEach(function(opt, i) {
      var label = document.createElement('label');
      label.className = 'nlevel-option';
      label.style.cssText = 'display:flex;align-items:center;gap:10px;padding:10px 14px;background:var(--bg);border:2px solid var(--border);border-radius:10px;cursor:pointer;font-size:0.95rem;color:var(--text);transition:all 200ms ease';

      var radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'nlevel-mc-' + Date.now();
      radio.value = i;
      radio.className = 'nlevel-radio';
      radio.style.accentColor = 'var(--accent)';

      var span = document.createElement('span');
      span.textContent = opt;

      label.appendChild(radio);
      label.appendChild(span);
      optionsDiv.appendChild(label);
    });

    questionEl.appendChild(optionsDiv);

    // Feedback area
    var feedback = document.createElement('div');
    feedback.className = 'nlevel-feedback';
    feedback.style.cssText = 'margin-top:12px;font-size:0.9rem;font-weight:600;min-height:24px';
    questionEl.appendChild(feedback);

    container.appendChild(questionEl);

    // Wire immediate feedback on radio change and auto-submit
    var radios = questionEl.querySelectorAll('.nlevel-radio');
    for (var r = 0; r < radios.length; r++) {
      radios[r].addEventListener('change', function(e) {
        var selectedIdx = parseInt(e.target.value, 10);
        var correctIdx = parseInt(questionEl.getAttribute('data-correctindex'), 10);
        var isCorrect = selectedIdx === correctIdx;

        // Highlight options
        var labels = questionEl.querySelectorAll('.nlevel-option');
        for (var l = 0; l < labels.length; l++) {
          labels[l].style.borderColor = 'var(--border)';
          labels[l].style.background = 'var(--bg)';
        }
        e.target.parentElement.style.borderColor = isCorrect ? '#16a34a' : '#ef4444';
        e.target.parentElement.style.background = isCorrect ? 'rgba(22,163,74,0.08)' : 'rgba(239,68,68,0.08)';

        // Show feedback
        feedback.textContent = isCorrect ? '✓ ¡Correcto!' : '✗ Incorrecto';
        feedback.style.color = isCorrect ? '#16a34a' : '#ef4444';
        questionEl.setAttribute('data-answered', 'true');

        // Auto-trigger the global submit to advance level progress
        var submitBtn = document.getElementById('step8-submit');
        if (submitBtn && !submitBtn.disabled) {
          submitBtn.click();
        }
      });
    }
  }

  /**
   * N2 — Fill in the blank with text input.
   * Uses wireStep8's global submit flow (no inline check button).
   */
  function renderQuestionN2(q, container) {
    var wrapper = document.createElement('div');
    wrapper.className = 'nlevel-fill';
    wrapper.setAttribute('data-nivel', '2');
    wrapper.setAttribute('data-question-id', q.id || 'q-' + Date.now());

    var questionText = document.createElement('p');
    questionText.className = 'nlevel-question';
    questionText.textContent = q.question;
    wrapper.appendChild(questionText);

    var input = document.createElement('input');
    input.type = 'text';
    input.className = 'nlevel-input';
    input.name = 'nlevel-answer';
    input.style.cssText = 'width:100%;padding:14px 18px;border:2px solid var(--border);border-radius:10px;font-size:1rem;font-family:inherit;background:var(--bg);color:var(--text);box-sizing:border-box';
    input.placeholder = 'Escribe aquí...';
    input.autocomplete = 'off';
    wrapper.appendChild(input);

    container.appendChild(wrapper);

    setTimeout(function() { input.focus(); }, 50);

    // Wire Enter key to trigger the global submit button
    input.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        var submitBtn = document.getElementById('step8-submit');
        if (submitBtn && !submitBtn.disabled) {
          submitBtn.click();
        }
      }
    });
  }

  /**
   * N3 — Write full answer with textarea.
   * Uses wireStep8's global submit flow (no inline check button).
   */
  function renderQuestionN3(q, container) {
    var wrapper = document.createElement('div');
    wrapper.className = 'nlevel-write';
    wrapper.setAttribute('data-nivel', '3');
    wrapper.setAttribute('data-question-id', q.id || 'q-' + Date.now());

    var questionText = document.createElement('p');
    questionText.className = 'nlevel-question';
    questionText.textContent = q.question;
    wrapper.appendChild(questionText);

    var textarea = document.createElement('textarea');
    textarea.className = 'nlevel-textarea';
    textarea.name = 'nlevel-answer';
    textarea.style.cssText = 'width:100%;padding:14px 18px;border:2px solid var(--border);border-radius:10px;font-size:1rem;font-family:inherit;background:var(--bg);color:var(--text);resize:vertical;min-height:80px;box-sizing:border-box';
    textarea.placeholder = 'Escribe la respuesta completa...';
    wrapper.appendChild(textarea);

    container.appendChild(wrapper);

    setTimeout(function() { textarea.focus(); }, 50);
  }

  /**
   * N4 — Reorder words (click to select position in sequence).
   */
  function renderQuestionN4(q, container) {
    var wrapper = document.createElement('div');
    wrapper.className = 'nlevel-reorder';
    wrapper.setAttribute('data-nivel', '4');

    var questionText = document.createElement('p');
    questionText.className = 'nlevel-question';
    questionText.textContent = q.question;
    wrapper.appendChild(questionText);

    // Shuffle words
    var shuffleArr = (q.words || []).slice();
    for (var si = shuffleArr.length - 1; si > 0; si--) {
      var sj = Math.floor(Math.random() * (si + 1));
      var tmp = shuffleArr[si]; shuffleArr[si] = shuffleArr[sj]; shuffleArr[sj] = tmp;
    }

    var selected = [];
    var remaining = shuffleArr.slice();

    var selectedRow = document.createElement('div');
    selectedRow.className = 'nlevel-reorder-selected';
    selectedRow.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;padding:16px;min-height:52px;border:2px dashed var(--border);border-radius:10px;margin-bottom:12px';

    var poolRow = document.createElement('div');
    poolRow.className = 'nlevel-reorder-pool';
    poolRow.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;padding:16px;min-height:52px;background:var(--bg);border-radius:10px;border:1px solid var(--border)';

    container.appendChild(wrapper);

    function renderReorderChips() {
      selectedRow.innerHTML = '';
      poolRow.innerHTML = '';

      if (selected.length === 0) {
        var ph = document.createElement('span');
        ph.textContent = 'Toca las palabras para ordenarlas...';
        ph.style.color = 'var(--text-secondary)';
        ph.style.fontStyle = 'italic';
        selectedRow.appendChild(ph);
      } else {
        selected.forEach(function(w, idx) {
          var chip = document.createElement('span');
          chip.textContent = w;
          chip.style.cssText = 'padding:8px 16px;background:var(--accent);color:#fff;border-radius:8px;font-size:0.95rem;font-weight:600;cursor:pointer;transition:opacity 200ms ease';
          chip.setAttribute('data-word', w);
          chip.addEventListener('click', function() {
            var wordIdx = selected.indexOf(w);
            if (wordIdx >= 0) selected.splice(wordIdx, 1);
            remaining.push(w);
            renderReorderChips();
          });
          selectedRow.appendChild(chip);
        });
      }

      remaining.forEach(function(w) {
        var chip = document.createElement('span');
        chip.textContent = w;
        chip.style.cssText = 'padding:8px 16px;background:var(--bg-card);border:2px solid var(--border);border-radius:8px;font-size:0.95rem;font-weight:600;cursor:pointer;transition:all 200ms ease';
        chip.setAttribute('data-word', w);
        chip.addEventListener('click', function() {
          var wordIdx = remaining.indexOf(w);
          if (wordIdx >= 0) remaining.splice(wordIdx, 1);
          selected.push(w);
          renderReorderChips();
        });
        poolRow.appendChild(chip);
      });
    }

    // Insert rows
    wrapper.insertBefore(selectedRow, wrapper.firstChild.nextSibling);
    wrapper.insertBefore(poolRow, wrapper.children[wrapper.children.length - 1]);

    renderReorderChips();

    // Expose selected array so gatherAnswer can read it
    wrapper._reorderSelected = selected;
    wrapper._reorderCorrectLength = q.correctOrder ? q.correctOrder.length : 0;
  }

  /**
   * N5 — Correct the sentence (show wrong, user writes correction).
   * Uses wireStep8's global submit flow (no inline check button).
   */
  function renderQuestionN5(q, container) {
    var wrapper = document.createElement('div');
    wrapper.className = 'nlevel-correct';
    wrapper.setAttribute('data-nivel', '5');
    wrapper.setAttribute('data-question-id', q.id || 'q-' + Date.now());

    var questionText = document.createElement('p');
    questionText.className = 'nlevel-question';
    questionText.textContent = q.question;
    wrapper.appendChild(questionText);

    var wrongSentence = document.createElement('div');
    wrongSentence.textContent = q.wrongSentence;
    wrongSentence.style.cssText = 'padding:14px 18px;background:rgba(239,68,68,0.08);border:2px solid #ef4444;border-radius:10px;font-size:1.1rem;font-weight:600;color:#ef4444;margin-bottom:12px;text-align:center';
    wrapper.appendChild(wrongSentence);

    var input = document.createElement('input');
    input.type = 'text';
    input.className = 'nlevel-input';
    input.name = 'nlevel-answer';
    input.style.cssText = 'width:100%;padding:14px 18px;border:2px solid var(--border);border-radius:10px;font-size:1rem;font-family:inherit;background:var(--bg);color:var(--text);box-sizing:border-box';
    input.placeholder = 'Escribe la frase corregida...';
    input.autocomplete = 'off';
    wrapper.appendChild(input);

    container.appendChild(wrapper);

    input.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        var submitBtn = document.getElementById('step8-submit');
        if (submitBtn && !submitBtn.disabled) {
          submitBtn.click();
        }
      }
    });
    setTimeout(function() { input.focus(); }, 50);
  }

  /**
   * N6 — Free text conversation (textarea).
   * Uses wireStep8's global submit flow.
   */
  function renderQuestionN6(q, container) {
    var wrapper = document.createElement('div');
    wrapper.className = 'nlevel-free';
    wrapper.setAttribute('data-nivel', '6');
    wrapper.setAttribute('data-question-id', q.id || 'q-' + Date.now());

    var questionText = document.createElement('p');
    questionText.className = 'nlevel-question';
    questionText.textContent = q.question;
    wrapper.appendChild(questionText);

    var textarea = document.createElement('textarea');
    textarea.className = 'nlevel-textarea';
    textarea.name = 'nlevel-answer';
    textarea.style.cssText = 'width:100%;padding:14px 18px;border:2px solid var(--border);border-radius:10px;font-size:1rem;font-family:inherit;background:var(--bg);color:var(--text);resize:vertical;min-height:80px;box-sizing:border-box';
    textarea.placeholder = 'Escribe tu respuesta en italiano...';
    wrapper.appendChild(textarea);

    container.appendChild(wrapper);

    setTimeout(function() { textarea.focus(); }, 50);
  }

  /**
   * N7 — Same as N6 but with mic icon placeholder.
   * Uses wireStep8's global submit flow.
   */
  function renderQuestionN7(q, container) {
    var wrapper = document.createElement('div');
    wrapper.className = 'nlevel-free';
    wrapper.setAttribute('data-nivel', '7');
    wrapper.setAttribute('data-question-id', q.id || 'q-' + Date.now());

    var questionText = document.createElement('p');
    questionText.className = 'nlevel-question';
    questionText.textContent = q.question;
    wrapper.appendChild(questionText);

    // Mic icon indicator
    var micRow = document.createElement('div');
    micRow.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:12px;padding:8px 12px;background:rgba(139,92,246,0.08);border-radius:8px;color:var(--text-secondary);font-size:0.85rem';
    micRow.innerHTML = '🎤 <span>Reconocimiento de voz (próximamente). Escribe tu respuesta.</span>';
    wrapper.appendChild(micRow);

    var textarea = document.createElement('textarea');
    textarea.className = 'nlevel-textarea';
    textarea.name = 'nlevel-answer';
    textarea.style.cssText = 'width:100%;padding:14px 18px;border:2px solid var(--border);border-radius:10px;font-size:1rem;font-family:inherit;background:var(--bg);color:var(--text);resize:vertical;min-height:80px;box-sizing:border-box';
    textarea.placeholder = 'Escribe tu respuesta en italiano...';
    wrapper.appendChild(textarea);

    container.appendChild(wrapper);

    setTimeout(function() { textarea.focus(); }, 50);
  }

  /**
   * Validate an answer for a given difficulty level.
   * Uses App.DifficultyEngine scoring models.
   * @param {string|string[]} userAnswer
   * @param {object} q - Question data
   * @param {number} nivel - 1-7
   * @returns {{ score: number, isCorrect: boolean, feedback: string }}
   */
  function validateLevelAnswer(userAnswer, q, nivel) {
    if (!q) return { score: 0, isCorrect: false, feedback: 'Error: datos de pregunta no válidos.' };

    var score = 0;
    var feedback = '';
    var de = App.DifficultyEngine;

    switch (nivel) {
      case 1: {
        // Multiple choice: exact match
        var correctIdx = typeof q.correctIndex === 'number' ? q.correctIndex : parseInt(q.correctIndex, 10);
        var userIdx = parseInt(String(userAnswer), 10);
        score = de.scoreExact(userIdx, correctIdx);
        feedback = score >= 80 ? '¡Correcto!' : 'Incorrecto.';
        break;
      }
      case 2: {
        // Fill blank: proportional scoring against answers[]
        var ua = String(userAnswer).trim();
        var bestScore = 0;
        var bestAnswer = '';
        (q.answers || []).forEach(function(ans) {
          var s = de.scoreProportional(ua, ans);
          if (s > bestScore) { bestScore = s; bestAnswer = ans; }
        });
        score = bestScore;
        feedback = score >= 80 ? '¡Correcto!' : 'Respuesta esperada: ' + (bestAnswer || q.answers[0]);
        break;
      }
      case 3: {
        // Write: exact with typo tolerance
        score = de.scoreExactTypo(String(userAnswer), q.expected);
        feedback = score >= 80 ? '¡Correcto!' : 'Esperado: "' + q.expected + '"';
        break;
      }
      case 4: {
        // Reorder: exact sequence match
        var userArr = Array.isArray(userAnswer) ? userAnswer : [];
        var expectedOrder = q.correctOrder || [];
        score = de.scoreExactSequence(userArr, expectedOrder);
        feedback = score >= 80 ? '¡Orden correcto!' : 'Orden incorrecto.';
        break;
      }
      case 5: {
        // Correct: exact match (or typo-tolerant) against correctSentence
        score = de.scoreExactTypo(String(userAnswer), q.correctSentence);
        feedback = score >= 80 ? '¡Corrección correcta!' : 'Esperado: "' + q.correctSentence + '"';
        break;
      }
      case 6:
      case 7: {
        // Free text: keyword proportion
        var keywords = q.expectedKeywords || [];
        score = de.scoreKeywordProportion(String(userAnswer), keywords);
        feedback = score >= 80
          ? '¡Bien! Has incluido las palabras clave.'
          : 'Intenta incluir palabras como: ' + keywords.join(', ');
        break;
      }
    }

    return {
      score: score,
      isCorrect: score >= 80,
      feedback: feedback
    };
  }

  /**
   * Score a set of answers and return aggregate.
   * @param {Array} answers - Array of user answer strings
   * @param {Array} questions - Array of question data objects
   * @param {number} nivel - 1-7
   * @returns {{ totalScore: number, passed: boolean }}
   */
  function scoreQuestionSet(answers, questions, nivel) {
    if (!answers || !questions || answers.length === 0 || questions.length === 0) {
      return { totalScore: 0, passed: false };
    }

    var total = 0;
    for (var i = 0; i < Math.min(answers.length, questions.length); i++) {
      var result = validateLevelAnswer(answers[i], questions[i], nivel);
      total += result.score;
    }

    var avg = Math.round(total / Math.min(answers.length, questions.length));
    return {
      totalScore: avg,
      passed: avg >= 80
    };
  }

  /* ---- Public API ---- */

  return {
    load: load,
    loadModule: loadModule,
    getFirstExerciseId: getFirstExerciseId,
    getExerciseCount: getExerciseCount,
    render: render,
    submitAnswer: submitAnswer,
    goTo: goTo,
    compareTranscripts: compareTranscripts,
    // N-Level exercise API (for step 8)
    renderQuestion: renderQuestion,
    validateAnswer: validateLevelAnswer,
    scoreQuestionSet: scoreQuestionSet,
    // Exam API
    loadExam: loadExam,
    startExam: startExam,
    finishExam: finishExam,
    renderExamSection: renderExamSection,
    renderExamQuestion: renderExamQuestion
  };
})();
