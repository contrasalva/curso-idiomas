/**
 * Vocabulary Manager (App.VocabularyManager)
 * Manages vocabulary word progress, UI rendering, and TTS integration.
 * Depends on: App.SpeechManager (for speak() playback)
 */

(function () {
  'use strict';

  /**
   * @param {string} word
   * @param {string} translation
   * @returns {HTMLElement}
   */
  function renderWordCard(word, translation, progress) {
    var card = document.createElement('div');
    card.className = 'vocab-card';
    if (progress && progress.mastered) {
      card.classList.add('vocab-card--mastered');
    }

    var isMastered = progress && progress.mastered;

    // Word side
    var front = document.createElement('div');
    front.className = 'vocab-card__front';

    var wordEl = document.createElement('span');
    wordEl.className = 'vocab-card__word';
    wordEl.textContent = word;
    front.appendChild(wordEl);

    var playBtn = document.createElement('button');
    playBtn.className = 'vocab-card__play';
    playBtn.setAttribute('aria-label', 'Escuchar pronunciación');
    playBtn.innerHTML = '🔊';
    playBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (App.SpeechManager && typeof App.SpeechManager.speak === 'function') {
        App.SpeechManager.speak(word);
      }
    });
    front.appendChild(playBtn);

    card.appendChild(front);

    // Translation side (back) — shown via flip
    var back = document.createElement('div');
    back.className = 'vocab-card__back';

    var transEl = document.createElement('span');
    transEl.className = 'vocab-card__translation';
    transEl.textContent = translation;
    back.appendChild(transEl);

    card.appendChild(back);

    // Toggle mastered
    var toggleBtn = document.createElement('button');
    toggleBtn.className = 'vocab-card__toggle';
    toggleBtn.textContent = isMastered ? '✭' : '☆';
    toggleBtn.setAttribute('aria-label', isMastered ? 'Marcar como no aprendida' : 'Marcar como aprendida');
    if (isMastered) toggleBtn.classList.add('vocab-card__toggle--active');
    toggleBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      toggleBtn.classList.toggle('vocab-card__toggle--active');
      var nowMastered = toggleBtn.classList.contains('vocab-card__toggle--active');
      toggleBtn.textContent = nowMastered ? '✭' : '☆';
      toggleBtn.setAttribute('aria-label', nowMastered ? 'Marcar como no aprendida' : 'Marcar como aprendida');
      card.classList.toggle('vocab-card--mastered', nowMastered);
      App.VocabularyManager.markMastered(word, nowMastered);
    });
    card.appendChild(toggleBtn);

    // Click to flip
    card.addEventListener('click', function () {
      card.classList.toggle('vocab-card--flipped');
    });

    return card;
  }

  /**
   * Create a paginated vocabulary viewer element.
   * @param {Array} words - Array of { word, translation } objects
   * @param {number} [perPage=12]
   * @returns {HTMLElement}
   */
  function renderVocabularyViewer(words, perPage) {
    if (perPage === undefined || perPage === null) perPage = 12;

    var container = document.createElement('div');
    container.className = 'vocab-viewer';

    var totalPages = Math.max(1, Math.ceil(words.length / perPage));
    var currentPage = 0;

    // Grid wrapper
    var grid = document.createElement('div');
    grid.className = 'vocab-grid';
    container.appendChild(grid);

    // Pagination controls
    var pagination = document.createElement('div');
    pagination.className = 'vocab-pagination';
    pagination.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:16px;margin-top:24px';

    var prevBtn = document.createElement('button');
    prevBtn.className = 'vocab-pagination__btn';
    prevBtn.textContent = '‹ Anterior';
    prevBtn.style.cssText = 'padding:8px 18px;background:var(--accent);color:#fff;border:none;border-radius:8px;font-size:0.9rem;font-weight:600;cursor:pointer;opacity:0.5';
    prevBtn.disabled = true;

    var pageLabel = document.createElement('span');
    pageLabel.className = 'vocab-pagination__label';
    pageLabel.textContent = '1 / ' + totalPages;
    pageLabel.style.cssText = 'font-size:0.9rem;font-weight:600;color:var(--text-secondary)';

    var nextBtn = document.createElement('button');
    nextBtn.className = 'vocab-pagination__btn';
    nextBtn.textContent = 'Siguiente ›';
    nextBtn.style.cssText = 'padding:8px 18px;background:var(--accent);color:#fff;border:none;border-radius:8px;font-size:0.9rem;font-weight:600;cursor:pointer';
    if (totalPages <= 1) {
      nextBtn.style.opacity = '0.5';
      nextBtn.disabled = true;
    }

    pagination.appendChild(prevBtn);
    pagination.appendChild(pageLabel);
    pagination.appendChild(nextBtn);
    container.appendChild(pagination);

    function renderPage(pageIdx) {
      grid.innerHTML = '';
      var start = pageIdx * perPage;
      var pageWords = words.slice(start, start + perPage);

      pageWords.forEach(function (w) {
        var progress = App.VocabularyManager.getWordProgress(w.word);
        var card = renderWordCard(w.word, w.translation, progress);
        grid.appendChild(card);
      });

      if (pageWords.length === 0) {
        var emptyEl = document.createElement('p');
        emptyEl.textContent = 'No hay palabras en esta página.';
        emptyEl.style.cssText = 'color:var(--text-secondary);font-style:italic;text-align:center;padding:40px 0';
        grid.appendChild(emptyEl);
      }

      pageLabel.textContent = (pageIdx + 1) + ' / ' + totalPages;
      prevBtn.disabled = pageIdx === 0;
      prevBtn.style.opacity = pageIdx === 0 ? '0.5' : '1';
      nextBtn.disabled = pageIdx >= totalPages - 1;
      nextBtn.style.opacity = pageIdx >= totalPages - 1 ? '0.5' : '1';
    }

    prevBtn.addEventListener('click', function () {
      if (currentPage > 0) {
        currentPage--;
        renderPage(currentPage);
      }
    });

    nextBtn.addEventListener('click', function () {
      if (currentPage < totalPages - 1) {
        currentPage++;
        renderPage(currentPage);
      }
    });

    renderPage(0);
    return container;
  }

  // --- Persisted progress store ---

  var _progressKey = 'vocab_progress';
  var _progress = {};

  function loadProgress() {
    try {
      var raw = window.localStorage.getItem(_progressKey);
      if (raw) {
        _progress = JSON.parse(raw);
      }
    } catch (e) {
      _progress = {};
    }
  }

  function saveProgress() {
    try {
      window.localStorage.setItem(_progressKey, JSON.stringify(_progress));
    } catch (e) {
      // Silently ignore storage errors
    }
  }

  loadProgress();

  /** @type {App.VocabularyManager} */
  var VocabularyManager = {
    /**
     * Get vocabulary words with their progress.
     * If words array is not provided, returns all known words.
     * @param {Array} [words] - Array of { word, translation }
     * @returns {Array}
     */
    getWords: function (words) {
      if (!words) return Object.keys(_progress).map(function (w) { return { word: w, progress: _progress[w] }; });
      return words.map(function (w) {
        return {
          word: w.word,
          translation: w.translation,
          progress: _progress[w.word] || null
        };
      });
    },

    /**
     * Mark a word as mastered or not.
     * @param {string} word
     * @param {boolean} mastered
     */
    markMastered: function (word, mastered) {
      if (!_progress[word]) {
        _progress[word] = { mastered: false, updatedAt: null };
      }
      _progress[word].mastered = mastered;
      _progress[word].updatedAt = new Date().toISOString();
      saveProgress();
    },

    /**
     * Get progress for a single word.
     * @param {string} word
     * @returns {object|null}
     */
    getWordProgress: function (word) {
      return _progress[word] || null;
    },

    /**
     * Get all vocabulary progress data.
     * @returns {object}
     */
    getAllVocabulary: function () {
      return _progress;
    },

    /**
     * Render a single word card.
     * @param {string} word
     * @param {string} translation
     * @param {object} [progress]
     * @returns {HTMLElement}
     */
    renderWordCard: renderWordCard,

    /**
     * Render a full paginated vocabulary viewer.
     * @param {Array} words - Array of { word, translation }
     * @param {number} [perPage]
     * @returns {HTMLElement}
     */
    renderVocabularyViewer: renderVocabularyViewer
  };

  App.VocabularyManager = VocabularyManager;
})();
