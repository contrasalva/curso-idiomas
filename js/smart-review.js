/* ============================================
   Italiano B1 — smart-review.js
   App.SmartReview: Intelligent review system
   for missed items across units
   ============================================ */

var App = window.App || {};

App.SmartReview = (function() {
  'use strict';

  /* ==========================================
     PUBLIC API
     ========================================== */

  /**
   * Get all missed items for a given unitId that are not yet reviewed.
   * @param {object} profile - Learner profile
   * @param {number} unitId - Unit ID
   * @returns {Array} Array of missed item objects
   */
  function getMissedItems(profile, unitId) {
    if (!profile || !profile.missedItems || !Array.isArray(profile.missedItems)) {
      return [];
    }
    return profile.missedItems.filter(function(item) {
      return item.unitId === unitId && item.reviewed !== true;
    });
  }

  /**
   * Render a review card for a single missed item into a container.
   * Shows what they got wrong, their answer, and a re-attempt input.
   * @param {object} missedItem - The missed item object
   * @param {HTMLElement} container - Target DOM element
   */
  function renderReviewItem(missedItem, container) {
    if (!container) return;
    container.innerHTML = '';

    var card = document.createElement('div');
    card.className = 'review-card';
    card.setAttribute('data-review-item', 'true');

    // What they were working on
    var phraseLabel = document.createElement('div');
    phraseLabel.className = 'review-phrase-label';
    phraseLabel.textContent = 'Frase o ejercicio:';
    card.appendChild(phraseLabel);

    var phraseEl = document.createElement('div');
    phraseEl.className = 'review-phrase';
    phraseEl.textContent = missedItem.phrase || '';
    card.appendChild(phraseEl);

    // Their incorrect answer
    var wrongLabel = document.createElement('div');
    wrongLabel.className = 'review-wrong-label';
    wrongLabel.textContent = 'Tu respuesta (incorrecta):';
    card.appendChild(wrongLabel);

    var wrongEl = document.createElement('div');
    wrongEl.className = 'review-wrong-answer';
    wrongEl.textContent = missedItem.userAnswer || '(no disponible)';
    card.appendChild(wrongEl);

    // Re-attempt input
    var reattemptLabel = document.createElement('div');
    reattemptLabel.className = 'review-reattempt-label';
    reattemptLabel.textContent = 'Intenta de nuevo:';
    card.appendChild(reattemptLabel);

    var input = document.createElement('input');
    input.type = 'text';
    input.className = 'review-input';
    input.placeholder = 'Escribe tu respuesta...';
    input.setAttribute('autocomplete', 'off');
    card.appendChild(input);

    // Comprobar button
    var checkBtn = document.createElement('button');
    checkBtn.className = 'primary-btn review-check-btn';
    checkBtn.textContent = 'Comprobar';
    card.appendChild(checkBtn);

    // Feedback area
    var fb = document.createElement('div');
    fb.className = 'review-feedback';
    fb.style.minHeight = '28px';
    fb.style.marginTop = '12px';
    fb.style.fontSize = '0.95rem';
    fb.style.fontWeight = '600';
    card.appendChild(fb);

    container.appendChild(card);

    // Wire Enter key
    input.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        checkBtn.click();
      }
    });

    // Store references for wiring
    card._input = input;
    card._feedback = fb;
    card._checkBtn = checkBtn;
  }

  /**
   * Validate a re-attempt answer for a missed item.
   * If score >= 80, marks item.reviewed = true.
   * @param {object} missedItem - The missed item object (mutated in place)
   * @param {string} userAnswer - The new answer from the user
   * @returns {{ passed: boolean, score: number, feedback: string }}
   */
  function scoreReviewItem(missedItem, userAnswer) {
    if (!missedItem || !userAnswer) {
      return { passed: false, score: 0, feedback: 'Por favor, escribe una respuesta.' };
    }

    var cleanAnswer = String(userAnswer).trim().toLowerCase();
    var cleanPhrase = String(missedItem.phrase || '').trim().toLowerCase();

    if (!cleanPhrase) {
      return { passed: false, score: 0, feedback: 'No hay referencia para comparar.' };
    }

    // Compare: exact match gets 100, contains match gets 80
    var score = 0;
    var feedback = '';

    if (cleanAnswer === cleanPhrase) {
      score = 100;
      feedback = '¡Perfecto! Respuesta correcta.';
    } else if (cleanAnswer.indexOf(cleanPhrase) !== -1 || cleanPhrase.indexOf(cleanAnswer) !== -1) {
      score = 80;
      feedback = '¡Muy bien! Has acertado.';
    } else {
      // Check for high character overlap (typo tolerance)
      var maxLen = cleanAnswer.length > cleanPhrase.length ? cleanAnswer.length : cleanPhrase.length;
      var sameChars = 0;
      var minLen = cleanAnswer.length < cleanPhrase.length ? cleanAnswer.length : cleanPhrase.length;
      for (var i = 0; i < minLen; i++) {
        if (cleanAnswer[i] === cleanPhrase[i]) {
          sameChars++;
        }
      }
      var ratio = maxLen > 0 ? sameChars / maxLen : 0;
      if (ratio >= 0.7) {
        score = 80;
        feedback = '¡Casi correcto! Has acertado.';
      } else {
        score = 0;
        feedback = 'No es correcto. La respuesta correcta es: ' + (missedItem.phrase || '');
      }
    }

    var passed = score >= 80;

    if (passed) {
      missedItem.reviewed = true;
      missedItem.tries = (missedItem.tries || 0) + 1;
    } else {
      missedItem.reviewed = false;
      missedItem.tries = (missedItem.tries || 0) + 1;
    }

    return {
      passed: passed,
      score: score,
      feedback: feedback
    };
  }

  /**
   * Get review summary score for a unit.
   * @param {object} profile - Learner profile
   * @param {number} unitId - Unit ID
   * @returns {{ reviewed: number, total: number, percentage: number }}
   */
  function getReviewScore(profile, unitId) {
    if (!profile || !profile.missedItems) {
      return { reviewed: 0, total: 0, percentage: 100 };
    }

    var total = 0;
    var reviewed = 0;
    for (var i = 0; i < profile.missedItems.length; i++) {
      var item = profile.missedItems[i];
      if (item.unitId === unitId) {
        total++;
        if (item.reviewed === true) {
          reviewed++;
        }
      }
    }

    var percentage = total > 0 ? Math.round((reviewed / total) * 100) : 100;
    return {
      reviewed: reviewed,
      total: total,
      percentage: percentage
    };
  }

  /**
   * Record a missed item into the profile.
   * Upserts by exerciseId. If same exerciseId exists, increments tries.
   * If no exerciseId, upserts by type+phrase combination.
   * @param {object} item - Missed item data object
   * @param {object} profile - Learner profile (mutated in place)
   */
  function recordMissedItem(item, profile) {
    if (!profile || !item) return;
    if (!profile.missedItems) {
      profile.missedItems = [];
    }

    // Determine unique key for matching
    var matchKey = item.exerciseId || (item.type + '|' + (item.phrase || ''));

    // Look for existing item
    for (var i = 0; i < profile.missedItems.length; i++) {
      var existing = profile.missedItems[i];
      var existingKey = existing.exerciseId || (existing.type + '|' + (existing.phrase || ''));

      if (existingKey === matchKey) {
        // Found existing — increment tries, update timestamp
        existing.tries = (existing.tries || 0) + 1;
        existing.timestamp = Date.now();
        if (item.userAnswer) {
          existing.userAnswer = item.userAnswer;
        }
        return;
      }
    }

    // Not found — push new item
    var newItem = {
      unitId: item.unitId,
      type: item.type || 'exercise',
      phrase: item.phrase || '',
      userAnswer: item.userAnswer || '',
      exerciseId: item.exerciseId || null,
      timestamp: Date.now(),
      reviewed: false,
      tries: 1
    };
    profile.missedItems.push(newItem);
  }

  /**
   * Render a congratulations card showing completion stats.
   * @param {HTMLElement} container - Target DOM element
   * @param {object} options - Optional { score: number, reviewedCount: number, totalCount: number }
   */
  function renderCongratulations(container, options) {
    if (!container) return;

    options = options || {};

    var html =
      '<div class="review-congratulations">' +
        '<div class="review-congrats-icon">🏆</div>' +
        '<h3 class="review-congrats-title">¡Excelente trabajo!</h3>' +
        '<p class="review-congrats-text">Has completado el repaso inteligente de esta unidad.</p>';

    if (options.reviewedCount !== undefined) {
      html += '<div class="review-congrats-stats">' +
        '<div class="review-congrats-stat">' +
          '<span class="review-congrats-stat-value">' + options.totalCount + '</span>' +
          '<span class="review-congrats-stat-label">ítems revisados</span>' +
        '</div>' +
        '<div class="review-congrats-stat">' +
          '<span class="review-congrats-stat-value">' + options.reviewedCount + '</span>' +
          '<span class="review-congrats-stat-label">corregidos</span>' +
        '</div>';
      if (options.score !== undefined) {
        html += '<div class="review-congrats-stat">' +
          '<span class="review-congrats-stat-value">' + options.score + '%</span>' +
          '<span class="review-congrats-stat-label">puntuación</span>' +
        '</div>';
      }
      html += '</div>';
    }

    html += '<button class="primary-btn review-complete-btn" id="review-complete-unit">🎉 Completar unidad</button>';

    html += '</div>';

    container.innerHTML = html;
  }

  return {
    getMissedItems: getMissedItems,
    renderReviewItem: renderReviewItem,
    scoreReviewItem: scoreReviewItem,
    getReviewScore: getReviewScore,
    recordMissedItem: recordMissedItem,
    renderCongratulations: renderCongratulations
  };
})();
