/* ============================================
   Italiano B1 — difficulty.js
   App.DifficultyEngine: N-level difficulty system
   (N1-Reconocer to N7-Hablar)
   ============================================ */
/* gentle-ai: SDD-apply generated */
var App = window.App || {};

App.DifficultyEngine = (function() {
  'use strict';

  /* --- Level Definitions --- */
  var LEVELS = [
    { nivel: 1, name: 'Reconocer', scoring: 'exact', description: 'Multiple choice sobre el diálogo' },
    { nivel: 2, name: 'Completar', scoring: 'proportional', description: 'Rellenar el espacio en blanco' },
    { nivel: 3, name: 'Escribir', scoring: 'exact-typo', description: 'Escribe la respuesta completa' },
    { nivel: 4, name: 'Ordenar', scoring: 'exact-sequence', description: 'Ordena las palabras' },
    { nivel: 5, name: 'Corregir', scoring: 'exact-minor', description: 'Encuentra y corrige el error' },
    { nivel: 6, name: 'Conversar', scoring: 'keyword-proportion', description: 'Respuesta libre con palabras clave' },
    { nivel: 7, name: 'Hablar', scoring: 'keyword-proportion', description: 'Ejercicio de pronunciación' }
  ];

  var PASS_THRESHOLD = 80;

  /* ==========================================
     PUBLIC API — Unlock & Score
     ========================================== */

  /**
   * Check if a given difficulty level is unlocked for a unit.
   * N1 is always unlocked. N(n) requires N(n-1) score >= 80.
   * @param {number|string} unitId
   * @param {number} nivel - 1-7
   * @param {object} profile - Learner profile with unitProgress
   * @returns {boolean}
   */
  function isLevelUnlocked(unitId, nivel, profile) {
    if (!profile) return nivel === 1;
    if (nivel <= 1) return true;
    if (nivel > 7) return false;

    var prevNivel = nivel - 1;
    var scores = getLevelScores(unitId, profile);
    var prevScore = scores[prevNivel];
    return typeof prevScore === 'number' && prevScore >= PASS_THRESHOLD;
  }

  /**
   * Get an array of locked level numbers for a unit.
   * @param {number|string} unitId
   * @param {object} profile
   * @returns {number[]}
   */
  function getLockedLevels(unitId, profile) {
    var locked = [];
    for (var i = 1; i <= LEVELS.length; i++) {
      if (!isLevelUnlocked(unitId, i, profile)) {
        locked.push(i);
      }
    }
    return locked;
  }

  /**
   * Submit a score for a given level and persist to the profile.
   * Only saves if the new score is higher than the existing one.
   * @param {number|string} unitId
   * @param {number} nivel - 1-7
   * @param {number} score - 0-100
   * @param {object} profile - Learner profile (mutated and saved)
   * @returns {object} { nivel, score, unlocked, lockedLevels }
   */
  function submitLevelScore(unitId, nivel, score, profile) {
    if (!profile) return { nivel: nivel, score: score, unlocked: false, lockedLevels: [] };

    // Ensure progress structure
    if (!profile.unitProgress) profile.unitProgress = {};
    if (!profile.unitProgress[unitId]) {
      profile.unitProgress[unitId] = { levelScores: {} };
    }
    if (!profile.unitProgress[unitId].levelScores) {
      profile.unitProgress[unitId].levelScores = {};
    }

    // Keep best score
    var current = profile.unitProgress[unitId].levelScores[nivel];
    if (typeof current !== 'number' || score > current) {
      profile.unitProgress[unitId].levelScores[nivel] = score;
    }

    // Update profile lastActive
    profile.lastActive = Date.now();

    return {
      nivel: nivel,
      score: Math.max(score, current || 0),
      unlocked: isLevelUnlocked(unitId, nivel + 1, profile),
      lockedLevels: getLockedLevels(unitId, profile)
    };
  }

  /**
   * Get the level scores map for a unit from a profile.
   * @param {number|string} unitId
   * @param {object} profile
   * @returns {object} e.g. { 1: 100, 2: 85, 3: 0 }
   */
  function getLevelScores(unitId, profile) {
    if (!profile || !profile.unitProgress || !profile.unitProgress[unitId]) {
      return {};
    }
    return profile.unitProgress[unitId].levelScores || {};
  }

  /**
   * Get the list of all level definitions (read-only copy).
   * @returns {Array}
   */
  function getLevels() {
    return LEVELS.slice();
  }

  /* ==========================================
     SCORING MODELS
     ========================================== */

  /**
   * Exact match: 100 for exact string equality, 0 otherwise.
   * @param {string} userAnswer
   * @param {string} expected
   * @returns {number} 0 or 100
   */
  function scoreExact(userAnswer, expected) {
    return String(userAnswer).trim() === String(expected).trim() ? 100 : 0;
  }

  /**
   * Proportional scoring: percentage of correct characters.
   * @param {string} userAnswer
   * @param {string} expected
   * @returns {number} 0-100
   */
  function scoreProportional(userAnswer, expected) {
    var ua = String(userAnswer).trim();
    var exp = String(expected).trim();
    if (!exp) return 0;
    if (!ua) return 0;

    var matched = 0;
    var len = Math.max(ua.length, exp.length);
    for (var i = 0; i < Math.min(ua.length, exp.length); i++) {
      if (ua[i] === exp[i]) matched++;
    }
    return Math.round((matched / len) * 100);
  }

  /**
   * Exact match with typo tolerance:
   *   - 100 if exact match
   *   - 100 if only 1 character differs
   *   - 100 if only diacritics differ (e.g. 'è' vs 'e')
   *   - 0 otherwise
   * @param {string} userAnswer
   * @param {string} expected
   * @returns {number} 0 or 100
   */
  function scoreExactTypo(userAnswer, expected) {
    var ua = String(userAnswer).trim();
    var exp = String(expected).trim();

    if (ua === exp) return 100;

    // Check 1-char diff (allow 1 insertion, deletion, or substitution)
    if (Math.abs(ua.length - exp.length) <= 1) {
      var diffs = 0;
      var minLen = Math.min(ua.length, exp.length);
      for (var i = 0; i < minLen; i++) {
        if (ua[i] !== exp[i]) diffs++;
      }
      // Account for the extra character if lengths differ
      diffs += Math.abs(ua.length - exp.length);
      if (diffs <= 1) return 100;
    }

    // Check diacritics-only diff
    var normalize = function(s) {
      return s.normalize ? s.normalize('NFD').replace(/[\u0300-\u036f]/g, '') : s;
    };
    if (normalize(ua) === normalize(exp)) return 100;

    return 0;
  }

  /**
   * Exact sequence matching for array answers.
   * 100 if ALL positions match expected order, 0 otherwise.
   * @param {string[]} userAnswer - Ordered array of strings
   * @param {string[]} expected - Expected array
   * @returns {number} 0 or 100
   */
  function scoreExactSequence(userAnswer, expected) {
    if (!Array.isArray(userAnswer) || !Array.isArray(expected)) return 0;
    if (userAnswer.length !== expected.length) return 0;

    for (var i = 0; i < expected.length; i++) {
      if (String(userAnswer[i]).trim() !== String(expected[i]).trim()) {
        return 0;
      }
    }
    return 100;
  }

  /**
   * Keyword proportion: percentage of expected keywords found in the answer.
   * Case-insensitive, trims whitespace.
   * @param {string} userAnswer
   * @param {string[]} expectedKeywords
   * @returns {number} 0-100
   */
  function scoreKeywordProportion(userAnswer, expectedKeywords) {
    var ua = String(userAnswer).toLowerCase().trim();
    if (!ua || !expectedKeywords || expectedKeywords.length === 0) return 0;

    var matched = 0;
    for (var k = 0; k < expectedKeywords.length; k++) {
      var kw = String(expectedKeywords[k]).toLowerCase().trim();
      if (kw && ua.indexOf(kw) !== -1) {
        matched++;
      }
    }
    return Math.round((matched / expectedKeywords.length) * 100);
  }

  /* ==========================================
     PUBLIC API
     ========================================== */

  return {
    // Unlock chain
    isLevelUnlocked: isLevelUnlocked,
    getLockedLevels: getLockedLevels,
    submitLevelScore: submitLevelScore,
    getLevelScores: getLevelScores,
    getLevels: getLevels,

    // Scoring models
    scoreExact: scoreExact,
    scoreProportional: scoreProportional,
    scoreExactTypo: scoreExactTypo,
    scoreExactSequence: scoreExactSequence,
    scoreKeywordProportion: scoreKeywordProportion,

    // Constants
    PASS_THRESHOLD: PASS_THRESHOLD,
    LEVELS: LEVELS
  };
})();
