/* ============================================
   Italiano B1 — app.js
   App.state, App.nav, dark mode, boot sequence,
   section render dispatch, profile wiring
   Load order: utility → data → modules → app.js
   ============================================ */

var App = window.App || {};

/* --- Global State --- */
App.state = {
  activeSection: 'home',
  currentLearner: null,
  currentModule: 0,
  currentExercise: 'mod0-ex0',
  examInProgress: false,
  examMode: 'practice',
  examTimer: null,
  darkMode: false,
  activeUnit: null,
  currentStep: 0,
  activeTrack: 'a1-a2'
};

/* --- Navigation --- */
App.nav = (function() {
  var sections = document.querySelectorAll('main > section');

  /**
   * Show a section by its ID suffix.
   * @param {string} sectionId - e.g. 'home', 'module', 'exercise'
   * @param {object} [params] - optional params (module, exercise, etc.)
   */
  function show(sectionId, params) {
    sections.forEach(function(s) {
      s.classList.remove('active');
    });
    var target = document.getElementById('section-' + sectionId);
    if (!target) return;

    target.classList.add('active');
    App.state.activeSection = sectionId;

    // Section-specific rendering
    switch (sectionId) {
      case 'home':
        renderHome();
        break;
      case 'module':
        renderModule(params);
        break;
      case 'exercise':
        renderExercise(params);
        break;
      case 'unit':
        renderUnit(params);
        break;
    }

    // Update sidebar active state
    updateSidebar();

    // Focus management: move focus to the heading
    var h = target.querySelector('h1, h2, h3');
    if (h) {
      h.setAttribute('tabindex', '-1');
      h.focus();
    }
  }

  function home() {
    show('home');
  }

  /* ---- Internal Render Dispatch ---- */

  function renderHome() {
    var gridContainer = document.getElementById('unit-grid');
    var trackContainer = document.getElementById('track-selector');
    var legacyContainer = document.getElementById('module-grid');

    var learner = App.state.currentLearner;
    var progress = learner ? App.Progress.get(learner) : null;
    if (!progress && learner) {
      progress = App.Progress.createDefault(learner);
      App.Progress.save(learner, progress);
    }

    // Render track selector
    if (trackContainer) {
      App.Curriculum.renderTrackSelector(trackContainer, App.state.activeTrack, function(track) {
        App.state.activeTrack = track;
        if (progress) {
          progress.track = track;
          App.Progress.save(learner, progress);
        }
        renderHome();
      });
    }

    // Render unit grid (replaces old module grid)
    if (gridContainer) {
      App.Curriculum.renderUnitGrid(gridContainer, App.state.activeTrack, progress);
    }

    // Preserve legacy module grid rendering for backward compat
    if (legacyContainer) {
      App.Curriculum.renderModuleGrid(legacyContainer, progress);
    }

    renderProgressSummary(progress);
    renderCompetition();
  }

  function renderProgressSummary(progress) {
    var container = document.getElementById('progress-stats');
    var bar = document.getElementById('overall-progress-bar');
    var pctText = document.getElementById('overall-pct-text');
    if (!container) return;

    var totalModules = 12;
    var completed = 0;
    var totalPct = 0;
    var exerciseCount = 0;
    var exerciseDone = 0;

    // Parse modules for progress
    var dataEl = document.getElementById('data-modules');
    if (dataEl) {
      try {
        var modules = JSON.parse(dataEl.textContent);
        modules.forEach(function(mod) {
          var pct = App.Curriculum.completionPct(mod.id, progress);
          totalPct += pct;
          if (pct >= 60) completed++;
        });
        totalPct = totalModules > 0 ? Math.round(totalPct / totalModules) : 0;
      } catch(e) { totalPct = 0; }
    }

    // Count exercises done
    if (progress && progress.modules) {
      Object.keys(progress.modules).forEach(function(modId) {
        var exScores = progress.modules[modId];
        Object.keys(exScores).forEach(function(exId) {
          exerciseCount++;
          if (exScores[exId] > 0) exerciseDone++;
        });
      });
    }

    var streak = (progress && progress.streak) || 0;
    var streakDays = streak;

    container.innerHTML =
      '<div class="stat-item">' +
        '<span class="stat-value">' + completed + '<span class="stat-unit">/' + totalModules + '</span></span>' +
        '<span class="stat-label">Módulos</span>' +
      '</div>' +
      '<div class="stat-item">' +
        '<span class="stat-value">' + totalPct + '<span class="stat-unit">%</span></span>' +
        '<span class="stat-label">Global</span>' +
      '</div>' +
      '<div class="stat-item">' +
        '<span class="stat-value">' + exerciseDone + '<span class="stat-unit">/' + exerciseCount + '</span></span>' +
        '<span class="stat-label">Ejercicios</span>' +
      '</div>' +
      '<div class="stat-item">' +
        '<span class="stat-value">' + streakDays + '<span class="stat-unit">días</span></span>' +
        '<span class="stat-label">🔥 Racha</span>' +
      '</div>';

    // Update progress bar
    if (bar) bar.style.width = totalPct + '%';
    if (pctText) pctText.textContent = totalPct + '%';
  }

  function renderCompetition() {
    var container = document.getElementById('competition-stats');
    if (!container) return;

    var currentLearner = App.state.currentLearner;
    var allLearners = App.Progress.listProfiles();

    // If only one learner, show a message
    if (!allLearners || allLearners.length < 2) {
      container.innerHTML = '<div class="competition-empty">Crea dos perfiles para empezar la competencia.</div>';
      return;
    }

    // Calculate points for each learner
    var standings = [];
    allLearners.forEach(function(name) {
      var prog = App.Progress.get(name);
      var points = 0;
      var exDone = 0;
      if (prog && prog.modules) {
        Object.keys(prog.modules).forEach(function(modId) {
          var scores = prog.modules[modId];
          Object.keys(scores).forEach(function(exId) {
            var s = scores[exId];
            if (s > 0) {
              points += s;
              exDone++;
            }
          });
        });
      }
      standings.push({
        name: name,
        points: points,
        exercises: exDone,
        isCurrent: name === currentLearner
      });
    });

    // Sort by points descending
    standings.sort(function(a, b) { return b.points - a.points; });

    var maxPoints = Math.max(standings[0].points, 1);

    var html = '';
    standings.forEach(function(s, i) {
      var pct = Math.round((s.points / maxPoints) * 100);
      var medal = '';
      var label = '';
      if (i === 0 && standings.length > 1) {
        medal = '🥇';
        label = '¡En cabeza!';
      } else if (standings.length > 1) {
        var diff = standings[0].points - s.points;
        var emoji = s.isCurrent ? '😤' : '';
        label = diff > 0 ? 'a ' + diff + ' pts' : '';
        if (s.isCurrent && i > 0) label += ' ¡A darle!';
      }
      var activeClass = s.isCurrent ? ' competitor-active' : '';

      html += '<div class="competitor-row' + activeClass + '">' +
        '<div class="competitor-info">' +
          '<span class="competitor-name"><span class="competitor-avatar">👤</span> ' + s.name + ' ' + medal + '</span>' +
          '<span class="competitor-points">' + s.points + ' pts</span>' +
        '</div>' +
        '<div class="competitor-bar-container">' +
          '<div class="competitor-bar" style="width:' + pct + '%"></div>' +
        '</div>' +
        '<div class="competitor-label">' + s.exercises + ' ejercicios' + (label ? ' · ' + label : '') + '</div>' +
      '</div>';
    });

    container.innerHTML = html;

    // Update the competition card visibility
    var card = document.getElementById('competition-card');
    if (card) {
      card.style.display = allLearners.length >= 2 ? 'block' : 'none';
    }
  }

  /**
   * Show an animated cheer/encouragement toast after earning points.
   * @param {number} points - Points gained
   * @param {string} learner - Current learner name
   * @param {Array} standings - Current standings
   */
  function showCheer(points, learner, standings) {
    if (!points || points <= 0) return;
    var pos = -1;
    for (var i = 0; i < standings.length; i++) {
      if (standings[i].name === learner) { pos = i; break; }
    }
    var isFirst = pos === 0;
    var isLast = pos === standings.length - 1;
    var leader = standings[0];
    var rival = standings.length > 1 ? (pos === 0 ? standings[1] : standings[0]) : null;

    var message = '';
    var icon = '';

    if (isFirst && standings.length > 1) {
      // They're #1
      var msgs = [
        '¡+{p}! ¡ERES EL/LA NÚMERO 1! 🏆',
        '¡+{p}! {r} se queda atrás. ¡A seguir ampliando la ventaja! 🚀',
        '¡+{p}! ¡LIDERATO ASEGURADO! Sigue así 👑'
      ];
      icon = '🏆';
      message = msgs[Math.floor(Math.random() * msgs.length)]
        .replace('{p}', points).replace('{r}', rival ? rival.name : '');
    } else if (pos === 0) {
      icon = '🎉';
      message = '¡+{p} puntos! Sigue así, cada ejercicio cuenta 📈'
        .replace('{p}', points);
    } else if (leader && Math.abs(leader.points - standings[pos].points) <= 200) {
      // Close to the leader
      var diff = leader.points - standings[pos].points;
      var closeMsgs = [
        '¡+{p}! ¡Le pisas los talones a {l}! A {d} pts 💪',
        '¡+{p}! Ya casi alcanzas a {l} 😤',
        '¡+{p}! {l} está a solo {d} pts — ¡a por ello! 🔥'
      ];
      icon = '💪';
      message = closeMsgs[Math.floor(Math.random() * closeMsgs.length)]
        .replace('{p}', points).replace('{l}', leader.name).replace('{d}', diff);
    } else if (isLast && standings.length > 1) {
      var lastMsgs = [
        '¡+{p}! ¡Ánimo, cada paso cuenta! {l} empezó antes 💪',
        '¡+{p}! No te rindas, la constancia gana 🐢🚀',
        '¡+{p}! Tú a tu ritmo, pero sin bajar el ritmo 🔥'
      ];
      icon = '💪';
      message = lastMsgs[Math.floor(Math.random() * lastMsgs.length)]
        .replace('{p}', points).replace('{l}', leader.name);
    } else if (leader) {
      var diff = leader.points - standings[pos].points;
      var normalMsgs = [
        '¡+{p} puntos! Excelente, a {d} de {l} 📈',
        '¡+{p}! Buen trabajo, {l} está a {d} pts 🚀',
        '¡+{p} puntos! Sigue así, {l} te espera 😤'
      ];
      icon = '🚀';
      message = normalMsgs[Math.floor(Math.random() * normalMsgs.length)]
        .replace('{p}', points).replace('{l}', leader.name).replace('{d}', diff);
    } else {
      message = '¡+{p} puntos! Buen trabajo 🎉'.replace('{p}', points);
    }

    // Build and show toast
    var toast = document.createElement('div');
    toast.className = 'cheer-toast';
    toast.innerHTML =
      '<div class="cheer-toast-icon">' + icon + '</div>' +
      '<div class="cheer-toast-body">' +
        '<div class="cheer-toast-title">' + message + '</div>' +
      '</div>' +
      '<button class="cheer-toast-close" aria-label="Cerrar">×</button>';

    document.body.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(function() {
      toast.classList.add('cheer-toast-visible');
    });

    // Auto-dismiss after 5s
    var dismissTimer = setTimeout(function() {
      dismissCheer(toast);
    }, 5000);

    // Close button
    toast.querySelector('.cheer-toast-close').addEventListener('click', function() {
      clearTimeout(dismissTimer);
      dismissCheer(toast);
    });
  }

  function dismissCheer(toast) {
    if (!toast || toast.classList.contains('cheer-toast-leaving')) return;
    toast.classList.add('cheer-toast-leaving');
    setTimeout(function() {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 300);
  }

  function renderModule(params) {
    var moduleId = (params && params.module !== undefined) ? params.module : App.state.currentModule;
    App.state.currentModule = moduleId;
    var navName = document.getElementById('nav-module-name');
    if (navName) {
      var dataEl = document.getElementById('data-modules');
      if (dataEl) {
        try {
          var modules = JSON.parse(dataEl.textContent);
          if (modules[moduleId]) navName.textContent = modules[moduleId].title;
        } catch(e) {}
      }
    }

    // Show lesson view (hides exercise list)
    App.Curriculum.renderModuleLesson(moduleId);
  }

  function renderExercise(params) {
    var moduleId = (params && params.module !== undefined) ? params.module : App.state.currentModule;

    App.state.currentModule = moduleId;

    // Load module and pick first exercise if none specified
    App.ExerciseEngine.loadModule(moduleId);
    var firstEx = App.ExerciseEngine.getFirstExerciseId();
    var exerciseId = (params && params.exercise !== undefined && params.exercise !== null) ? params.exercise : firstEx;

    App.state.currentExercise = exerciseId;
    App.ExerciseEngine.load(exerciseId);
    App.ExerciseEngine.render();
  }

  function renderUnit(params) {
    var unitId = (params && params.unit !== undefined) ? params.unit : (App.state.activeUnit || 0);
    App.state.activeUnit = unitId;

    var navName = document.getElementById('nav-unit-name');
    if (navName) {
      navName.textContent = 'Unidad ' + (parseInt(unitId, 10) + 1);
    }

    if (App.UnitRenderer) {
      App.UnitRenderer.render(parseInt(unitId, 10));
    }
  }

  function updateSidebar() {
    renderSidebar();
  }

  return {
    show: show,
    home: home,
    showCheer: showCheer,
    renderCompetition: renderCompetition
  };
})();

/**
 * Show a compact counter of exercises in the module instead of a list.
 * Defined outside App.nav IIFE so it's accessible from other IIFEs.
 */
function updateExerciseCounter(moduleId) {
  var container = document.getElementById('exercise-counter');
  if (!container) return;

  App.ExerciseEngine.loadModule(moduleId);
  var total = App.ExerciseEngine.getExerciseCount();
  if (total === 0) {
    container.innerHTML = '<p class="counter-empty">No hay ejercicios en este módulo.</p>';
    return;
  }

  // Count completed
  var done = 0;
  var learner = App.state.currentLearner;
  if (learner) {
    var progress = App.Progress.get(learner);
    if (progress && progress.modules && progress.modules[moduleId]) {
      var scores = progress.modules[moduleId];
      Object.keys(scores).forEach(function(exId) {
        if (scores[exId] >= 60) done++;
      });
    }
  }

  container.innerHTML =
    '<div class="counter-info">' +
      '<span class="counter-big">' + done + '<span class="counter-sep">/</span>' + total + '</span>' +
      '<span class="counter-label">ejercicios completados</span>' +
    '</div>' +
    '<div class="counter-dots">' + getProgressDots(total, done) + '</div>' +
    '<button id="go-first-exercise-btn" class="primary-btn" style="margin-top:16px">' +
      '▶ Empezar ejercicios' +
    '</button>';

  // Wire the start button
  var goBtn = document.getElementById('go-first-exercise-btn');
  if (goBtn) {
    goBtn.addEventListener('click', function() {
      App.nav.show('exercise', { module: moduleId, exercise: null });
    });
  }
}

/**
 * Generate dot indicators for exercise progress.
 */
function getProgressDots(total, done) {
  var html = '';
  for (var i = 0; i < total; i++) {
    var cls = i < done ? 'dot done' : 'dot pending';
    html += '<span class="' + cls + '" title="Ejercicio ' + (i + 1) + '"></span>';
  }
  return html;
}

/* --- Dark Mode --- */
(function() {
  var stored = localStorage.getItem('italian-b1_darkMode');
  App.state.darkMode = stored === 'true';

  function apply() {
    var theme = App.state.darkMode ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);

    var toggleBtn = document.getElementById('dark-toggle');
    if (toggleBtn) {
      toggleBtn.textContent = App.state.darkMode ? '☀️' : '🌙';
      toggleBtn.setAttribute('aria-label', App.state.darkMode ? 'Activar modo claro' : 'Activar modo oscuro');
    }

    var settingsToggle = document.getElementById('settings-dark-toggle');
    if (settingsToggle) {
      settingsToggle.textContent = App.state.darkMode ? '☀️' : '🌙';
      settingsToggle.setAttribute('aria-checked', App.state.darkMode ? 'true' : 'false');
    }
  }

  function toggle() {
    App.state.darkMode = !App.state.darkMode;
    localStorage.setItem('italian-b1_darkMode', App.state.darkMode);
    apply();
  }

  apply();
  window.__darkToggle = toggle;
})();

/* --- Profile & Settings Wiring --- */
(function() {
  document.addEventListener('DOMContentLoaded', function() {
    // --- Dark mode toggles ---
    var darkBtn = document.getElementById('dark-toggle');
    if (darkBtn) darkBtn.addEventListener('click', window.__darkToggle);

    var settingsDarkBtn = document.getElementById('settings-dark-toggle');
    if (settingsDarkBtn) settingsDarkBtn.addEventListener('click', window.__darkToggle);

    // --- Home button (logo) ---
    var homeBtn = document.getElementById('home-btn');
    if (homeBtn) {
      homeBtn.addEventListener('click', function() {
        App.nav.show('home');
        // Close sidebar if open
        var sidebar = document.getElementById('sidebar');
        if (sidebar) sidebar.classList.remove('open');
      });
    }

    // --- Hamburger menu ---
    var hamburger = document.getElementById('hamburger-btn');
    var sidebar = document.getElementById('sidebar');
    if (hamburger && sidebar) {
      hamburger.addEventListener('click', function(e) {
        e.stopPropagation();
        sidebar.classList.toggle('open');
      });

      // Close sidebar when clicking outside (mobile)
      document.addEventListener('click', function(e) {
        if (window.innerWidth < 768 && sidebar.classList.contains('open')) {
          if (!sidebar.contains(e.target) && e.target !== hamburger) {
            sidebar.classList.remove('open');
          }
        }
      });

      // Close sidebar on nav change (mobile)
      window.addEventListener('nav:change', function() {
        if (window.innerWidth < 768) sidebar.classList.remove('open');
      });
    }

    // --- Profile creation (dual profiles) ---
    var nameInput1 = document.getElementById('profile-name-1');
    var nameInput2 = document.getElementById('profile-name-2');
    var startBtn = document.getElementById('profile-start');
    if (startBtn && nameInput1) {
      startBtn.addEventListener('click', function() {
        var name1 = nameInput1.value.trim();
        var name2 = nameInput2 ? nameInput2.value.trim() : '';

        if (!name1) {
          nameInput1.style.borderColor = 'var(--error)';
          nameInput1.focus();
          return;
        }
        nameInput1.style.borderColor = '';
        if (nameInput2) nameInput2.style.borderColor = '';

        // Create profile 1
        if (!App.Progress.get(name1)) {
          App.Progress.save(name1, App.Progress.createDefault(name1));
        }

        // Create profile 2 if provided
        if (name2 && name2 !== name1) {
          if (!App.Progress.get(name2)) {
            App.Progress.save(name2, App.Progress.createDefault(name2));
          }
        }

        App.state.currentLearner = name1;
        updateLearnerUI(name1);
        checkResume(name1);
      });

      nameInput1.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && nameInput2) nameInput2.focus();
      });
      if (nameInput2) {
        nameInput2.addEventListener('keydown', function(e) {
          if (e.key === 'Enter') startBtn.click();
        });
      }
    }

    // --- Learner switcher (#switcher-btn from phase 1-3, keep for backwards compat) ---
    var switcherBtn = document.getElementById('switcher-btn');
    if (switcherBtn) {
      switcherBtn.addEventListener('click', cycleLearner);
    }

    // Also support new ID if both exist
    var switchLearnerBtn = document.getElementById('switch-learner');
    if (switchLearnerBtn && switchLearnerBtn !== switcherBtn) {
      switchLearnerBtn.addEventListener('click', cycleLearner);
    }

    // --- Nav buttons (home, back to module) ---
    document.querySelectorAll('.nav-home-btn, .nav-module-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var section = btn.getAttribute('data-section');
        if (section === 'module') {
          var moduleId = App.state.currentModule;
          App.nav.show('module', { module: moduleId });
        } else {
          App.nav.show('home');
        }
      });
    });

    function cycleLearner() {
      var profiles = App.Progress.listProfiles();
      if (profiles.length === 0) {
        App.nav.show('profile');
        return;
      }

      var current = App.state.currentLearner;
      var nextProfile = null;

      // Cycle to next profile
      for (var i = 0; i < profiles.length; i++) {
        if (profiles[i] === current) {
          nextProfile = profiles[(i + 1) % profiles.length];
          break;
        }
      }
      if (!nextProfile && profiles.length > 0) {
        nextProfile = profiles[0];
      }

      if (nextProfile) {
        App.state.currentLearner = nextProfile;
        updateLearnerUI(nextProfile);
        App.nav.show(App.state.activeSection);
      }
    }

    // --- Exam start buttons ---
    var startExamBtn = document.getElementById('start-exam-btn');
    if (startExamBtn) {
      startExamBtn.addEventListener('click', function() {
        App.ExerciseEngine.startExam('exam');
      });
    }
    var startPracticeBtn = document.getElementById('start-practice-btn');
    if (startPracticeBtn) {
      startPracticeBtn.addEventListener('click', function() {
        App.ExerciseEngine.startExam('practice');
      });
    }

    // --- Lesson/Exercise toggle buttons ---
    var startExBtn = document.getElementById('start-exercises-btn');
    if (startExBtn) {
      startExBtn.addEventListener('click', function() {
        var lessonDiv = document.getElementById('module-lesson');
        var exercisesDiv = document.getElementById('module-exercises');
        if (lessonDiv) lessonDiv.style.display = 'none';
        if (exercisesDiv) {
          exercisesDiv.style.display = 'block';
          updateExerciseCounter(App.state.currentModule);
        }
      });
    }

    var backToLessonBtn = document.getElementById('back-to-lesson-btn');
    if (backToLessonBtn) {
      backToLessonBtn.addEventListener('click', function() {
        var lessonDiv = document.getElementById('module-lesson');
        var exercisesDiv = document.getElementById('module-exercises');
        if (lessonDiv) lessonDiv.style.display = 'block';
        if (exercisesDiv) exercisesDiv.style.display = 'none';
      });
    }

    // --- Settings: add profile ---
    var addProfileBtn = document.getElementById('settings-add-profile');
    if (addProfileBtn) {
      addProfileBtn.addEventListener('click', function() {
        App.nav.show('profile');
      });
    }

    // --- Settings: profile list ---
    function renderSettingsProfiles() {
      var listEl = document.getElementById('settings-profile-list');
      if (!listEl) return;
      var profiles = App.Progress.listProfiles();
      listEl.innerHTML = '';
      profiles.forEach(function(name) {
        var li = document.createElement('li');
        li.textContent = name;

        var deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn btn-secondary';
        deleteBtn.textContent = 'Eliminar';
        deleteBtn.style.fontSize = '0.85rem';
        deleteBtn.style.padding = '4px 12px';
        deleteBtn.addEventListener('click', function() {
          var key = 'italian-b1_profile_' + name;
          localStorage.removeItem(key);

          if (App.state.currentLearner === name) {
            var remaining = App.Progress.listProfiles();
            if (remaining.length > 0) {
              App.state.currentLearner = remaining[0];
              var nameEl3 = document.getElementById('learner-name');
              if (nameEl3) nameEl3.textContent = remaining[0];
            } else {
              App.state.currentLearner = null;
              var nameEl3b = document.getElementById('learner-name');
              if (nameEl3b) nameEl3b.textContent = '';
              App.nav.show('profile');
              return;
            }
          }
          renderSettingsProfiles();
          App.nav.show(App.state.activeSection);
        });
        li.appendChild(deleteBtn);
        listEl.appendChild(li);
      });
    }

    renderSettingsProfiles();

    var settingsSection = document.getElementById('section-settings');
    if (settingsSection) {
      var observer = new MutationObserver(function() {
        if (settingsSection.classList.contains('active')) {
          renderSettingsProfiles();
        }
      });
      observer.observe(settingsSection, { attributes: true, attributeFilter: ['class'] });
    }
  });
})();

/* --- Sidebar Renderer --- */
function renderSidebar() {
  var sidebar = document.getElementById('sidebar');
  if (!sidebar) return;

  var data = document.getElementById('data-modules');
  var modules = data ? JSON.parse(data.textContent) : [];
  var profile = App.state.currentLearner ? App.Progress.get(App.state.currentLearner) : null;
  var progress = profile || App.Progress.createDefault('');

  sidebar.innerHTML = '';
  var heading = document.createElement('h3');
  heading.className = 'sidebar-heading';
  heading.textContent = 'Módulos';
  sidebar.appendChild(heading);

  modules.forEach(function(mod) {
    var item = document.createElement('div');
    item.className = 'sidebar-item';
    var unlocked = App.Curriculum.isUnlocked(mod.id, progress);
    item.classList.toggle('locked', !unlocked);

    var pct = App.Curriculum.completionPct(mod.id, progress);

    var title = document.createElement('span');
    title.textContent = (unlocked ? '' : '🔒 ') + mod.title;
    item.appendChild(title);

    var pctEl = document.createElement('span');
    pctEl.className = 'sidebar-pct';
    pctEl.textContent = pct + '%';
    item.appendChild(pctEl);

    if (unlocked) {
      item.setAttribute('role', 'button');
      item.setAttribute('tabindex', '0');
      item.addEventListener('click', function() {
        App.nav.show('module', { module: mod.id });
      });
      item.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') App.nav.show('module', { module: mod.id });
      });
    }

    sidebar.appendChild(item);
  });
}

/* --- Learner UI Update (shared helper) --- */
function updateLearnerUI(name) {
  var nameEl = document.getElementById('learner-name');
  if (nameEl) nameEl.textContent = name;

  var streak = App.Progress.calcStreak(name);
  var streakEl = document.getElementById('streak-count');
  if (streakEl) streakEl.textContent = streak || 0;

  var points = App.Progress.getTotalPoints(name);
  var ptsEl = document.getElementById('points-header-count');
  if (ptsEl) ptsEl.textContent = points;

  renderSidebar();
}

/* --- Resume Prompt --- */
function checkResume(learnerName) {
  var profile = App.Progress.get(learnerName);
  if (!profile) { App.nav.home(); return; }

  // Check if there's any saved progress
  var hasProgress = false;
  for (var m in profile.modules) {
    if (Object.keys(profile.modules[m]).length > 0) { hasProgress = true; break; }
  }

  if (!hasProgress) { App.nav.home(); return; }

  // Create resume dialog
  var overlay = document.createElement('div');
  overlay.className = 'resume-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Continuar progreso');

  var dialog = document.createElement('div');
  dialog.className = 'resume-dialog';

  var icon = document.createElement('div');
  icon.textContent = '📚';
  icon.style.fontSize = '2.5rem';
  icon.style.marginBottom = '12px';

  var msg = document.createElement('p');
  msg.textContent = 'Tienes progreso guardado. ¿Quieres continuar desde donde lo dejaste?';
  msg.style.fontSize = '1.1rem';
  msg.style.marginBottom = '20px';
  msg.style.color = 'var(--text)';

  var btnRow = document.createElement('div');
  btnRow.style.display = 'flex';
  btnRow.style.gap = '12px';
  btnRow.style.justifyContent = 'center';

  var yesBtn = document.createElement('button');
  yesBtn.className = 'primary-btn';
  yesBtn.textContent = 'Sí, continuar';
  yesBtn.addEventListener('click', function() {
    overlay.remove();
    // Navigate to the module with progress
    var resumePoint = App.Progress.resume(learnerName);
    if (resumePoint) {
      App.state.currentLearner = learnerName;
      App.nav.show('module', { module: resumePoint.module });
    } else {
      App.nav.home();
    }
  });

  var noBtn = document.createElement('button');
  noBtn.className = 'secondary-btn';
  noBtn.textContent = 'No, empezar de nuevo';
  noBtn.addEventListener('click', function() {
    overlay.remove();
    App.nav.home();
  });

  btnRow.appendChild(yesBtn);
  btnRow.appendChild(noBtn);
  dialog.appendChild(icon);
  dialog.appendChild(msg);
  dialog.appendChild(btnRow);
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  // Focus "Yes" by default
  setTimeout(function() { yesBtn.focus(); }, 100);
}

/* --- Boot Sequence --- */
(function() {
  document.addEventListener('DOMContentLoaded', function() {
    var profiles = App.Progress.listProfiles();

    if (profiles.length === 0) {
      // First visit: show profile creation
      App.nav.show('profile');
    } else if (profiles.length === 1) {
      // Single profile: select it and check resume
      App.state.currentLearner = profiles[0];
      updateLearnerUI(profiles[0]);
      checkResume(profiles[0]);
    } else {
      // Multiple profiles: show profile creation with existing profile buttons
      App.nav.show('profile');

      // Add existing profile buttons to the profile-setup div
      var setupDiv = document.querySelector('.profile-setup');
      if (setupDiv) {
        var existingSection = document.createElement('div');
        existingSection.className = 'existing-profiles';
        existingSection.style.marginTop = '24px';

        var label = document.createElement('p');
        label.textContent = 'O selecciona un perfil existente:';
        label.style.fontWeight = '500';
        label.style.marginBottom = '8px';
        label.style.color = 'var(--text-secondary)';
        existingSection.appendChild(label);

        profiles.forEach(function(name) {
          var btn = document.createElement('button');
          btn.className = 'secondary-btn';
          btn.style.margin = '4px';
          btn.textContent = name;
          btn.addEventListener('click', function() {
            App.state.currentLearner = name;
            updateLearnerUI(name);
            checkResume(name);
          });
          existingSection.appendChild(btn);
        });

        setupDiv.appendChild(existingSection);
      }
    }

    // Check voice support on boot, update UI accordingly
    if (App.SpeechManager && !App.SpeechManager.isSupported()) {
      document.body.classList.add('no-voice');
    }

    // --- Sticky header: pure JS position:fixed approach ---
    // position: sticky is unreliable in complex layouts. We use scroll-driven
    // position: fixed with a spacer to prevent content jump.
    (function initStickyFallback() {
      var HEADER_H = 56; // px
      var stickyEl = null;
      var sentinel = null;

      function getSticky() {
        var section = document.querySelector('main > section.active');
        if (!section) return null;
        // Only activate for unit section (has step-sticky)
        if (section.id !== 'section-unit') return null;
        // If welcome screen is showing, don't sticky the nav (it's fine inline)
        var welcome = section.querySelector('.welcome-screen');
        return welcome ? null : section.querySelector('.step-sticky');
      }

      function findOrCreateSentinel(el) {
        // Look for existing sentinel
        var s = el.parentNode.querySelector('.step-sticky-sentinel');
        if (s) return s;
        // Create a sentinel right after the sticky element
        s = document.createElement('div');
        s.className = 'step-sticky-sentinel';
        el.parentNode.insertBefore(s, el.nextSibling);
        return s;
      }

      function updateSticky() {
        var el = getSticky();

        if (!el) {
          if (stickyEl) {
            stickyEl.classList.remove('step-sticky-fixed');
            if (sentinel) {
              sentinel.style.display = 'none';
              sentinel.style.height = '0';
            }
            stickyEl = null;
            sentinel = null;
          }
          return;
        }

        // If this is a new element, clear previous state
        if (el !== stickyEl) {
          if (stickyEl) {
            stickyEl.classList.remove('step-sticky-fixed');
          }
          stickyEl = el;
          sentinel = findOrCreateSentinel(el);
        }

        // Read original position once and cache it
        // origTop = distance from document top to the element's natural position
        if (!el._origTop) {
          el._origTop = el.getBoundingClientRect().top + window.scrollY;
        }

        var scrollY = window.scrollY;
        // Fix when scrolled past the natural position minus header height
        var fixAt = el._origTop - HEADER_H;

        if (scrollY > fixAt + 5) { // +5 for slight hysteresis
          if (!el.classList.contains('step-sticky-fixed')) {
            el.classList.add('step-sticky-fixed');
            // Spacer prevents content jump when element becomes fixed
            var h = el.offsetHeight;
            if (sentinel) {
              sentinel.style.display = 'block';
              sentinel.style.height = h + 'px';
            }
          }
        } else {
          if (el.classList.contains('step-sticky-fixed')) {
            el.classList.remove('step-sticky-fixed');
            if (sentinel) {
              sentinel.style.display = 'none';
              sentinel.style.height = '0';
            }
          }
        }
      }

      // Throttled scroll
      var ticking = false;
      window.addEventListener('scroll', function() {
        if (!ticking) {
          requestAnimationFrame(function() {
            updateSticky();
            ticking = false;
          });
          ticking = true;
        }
      });

      // Re-init on section change
      var origShow = App.nav.show;
      if (origShow) {
        App.nav._origShow = origShow;
        App.nav.show = function(sectionId, params) {
          var result = App.nav._origShow(sectionId, params);
          // Reset cached positions on section switch
          var allSticky = document.querySelectorAll('.step-sticky');
          allSticky.forEach(function(s) { delete s._origTop; });
          updateSticky();
          return result;
        };
      }

      // Also re-init on resize (viewport changes)
      window.addEventListener('resize', function() {
        if (!ticking) {
          requestAnimationFrame(function() {
            // Invalidate cached positions
            var allSticky = document.querySelectorAll('.step-sticky');
            allSticky.forEach(function(s) { delete s._origTop; });
            updateSticky();
            ticking = false;
          });
          ticking = true;
        }
      });

      // Initial call after DOM settles
      setTimeout(updateSticky, 100);

      // Watch for step content changes (only #step-container)
      var stepContainer = document.getElementById('step-container');
      if (stepContainer) {
        var mo = new MutationObserver(function() {
          var allSticky = document.querySelectorAll('.step-sticky');
          allSticky.forEach(function(s) { delete s._origTop; });
          updateSticky();
        });
        mo.observe(stepContainer, { childList: true });
      }
    })();

    // Mark body as ready
    document.body.classList.add('ready');
  });
})();
