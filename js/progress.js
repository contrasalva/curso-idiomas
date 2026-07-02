/* ============================================
   Italiano B1 — progress.js
   App.Progress: localStorage CRUD, streak calc,
   resume detection, dual profile isolation
   ============================================ */

var App = window.App || {};

App.Progress = (function() {
  const STORAGE_PREFIX = 'italian-b1_';

  function profileKey(name) {
    return STORAGE_PREFIX + 'profile_' + name;
  }

  /**
   * Get a learner profile by name.
   * @param {string} name
   * @returns {object|null}
   */
  function get(name) {
    const data = localStorage.getItem(profileKey(name));
    return data ? JSON.parse(data) : null;
  }

  /**
   * Save a learner profile.
   * @param {string} name
   * @param {object} data
   */
  function save(name, data) {
    localStorage.setItem(profileKey(name), JSON.stringify(data));
  }

  /**
   * List all existing profile names.
   * @returns {string[]}
   */
  function listProfiles() {
    const profiles = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith(STORAGE_PREFIX + 'profile_')) {
        profiles.push(key.replace(STORAGE_PREFIX + 'profile_', ''));
      }
    }
    return profiles;
  }

  /**
   * Update the score for a specific module/exercise.
   * Keeps the best score.
   * @param {string} name - Learner name
   * @param {number} moduleId
   * @param {string} exerciseId - e.g. "mod3-ex4"
   * @param {number} score - 0-100
   */
  function updateScore(name, moduleId, exerciseId, score) {
    var profile = get(name) || createDefault(name);
    if (!profile.modules[moduleId]) {
      profile.modules[moduleId] = {};
    }
    // Keep best score
    var prev = profile.modules[moduleId][exerciseId];
    if (!prev || score > prev) {
      profile.modules[moduleId][exerciseId] = score;
    }
    profile.lastActive = Date.now();
    save(name, profile);
  }

  /**
   * Get average score for a module across all its exercises.
   * @param {string} name
   * @param {number} moduleId
   * @returns {number} 0-100
   */
  function getModuleScore(name, moduleId) {
    var profile = get(name);
    if (!profile || !profile.modules[moduleId]) return 0;
    var exercises = Object.values(profile.modules[moduleId]);
    if (exercises.length === 0) return 0;
    return Math.round(exercises.reduce(function(a, b) { return a + b; }, 0) / exercises.length);
  }

  /**
   * Calculate the current streak.
   * Streak increments if lastActive differs from today by exactly 1 day.
   * Same day = no change. Gap > 1 day = reset to 0.
   * @param {string} name
   * @returns {number}
   */
  function calcStreak(name) {
    var profile = get(name);
    if (!profile) return 0;

    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var lastActive = new Date(profile.lastActive || 0);
    lastActive.setHours(0, 0, 0, 0);

    var diffDays = Math.floor((today - lastActive) / (1000 * 60 * 60 * 24));

    if (diffDays > 1) return 0; // missed a day, reset
    return profile.streak || 0;
  }

  /**
   * Resume from the last incomplete exercise.
   * Returns null if all modules/exercises complete or profile missing.
   * @param {string} name
   * @returns {object|null} { module: number, exercise: string }
   */
  function resume(name) {
    var profile = get(name);
    if (!profile) return null;

    // For now, return the last incomplete — will be refined
    // with curriculum data in Phase 2
    for (var m = 0; m < 12; m++) {
      var mod = profile.modules[m];
      if (!mod) return { module: m, exercise: 'mod' + m + '-ex0' };
      // If a module exists but not all exercises complete, return first missing
      // Exact exercise count per module will be known in Phase 2
    }
    return null;
  }

  /**
   * Create a default profile object.
   * @param {string} name
   * @returns {object}
   */
  function createDefault(name) {
    return {
      name: name,
      createdAt: Date.now(),
      lastActive: Date.now(),
      streak: 0,
      modules: {}
    };
  }

  /**
   * Calculate total accumulated points for a learner.
   * Sum of all exercise scores across all modules.
   * @param {string} name
   * @returns {number}
   */
  function getTotalPoints(name) {
    var profile = get(name);
    if (!profile || !profile.modules) return 0;
    var total = 0;
    Object.keys(profile.modules).forEach(function(modId) {
      var scores = profile.modules[modId];
      Object.keys(scores).forEach(function(exId) {
        total += scores[exId];
      });
    });
    return total;
  }

  /**
   * Get sorted standings of all learners by total points.
   * @param {string} currentLearner
   * @returns {Array<{name:string, points:number, isCurrent:boolean}>}
   */

  function getStandings(currentLearner) {
    var learners = listProfiles();
    var standings = [];
    learners.forEach(function(name) {
      standings.push({
        name: name,
        points: getTotalPoints(name),
        isCurrent: name === currentLearner
      });
    });
    standings.sort(function(a, b) { return b.points - a.points; });
    return standings;
  }

  return {
    get: get,
    save: save,
    listProfiles: listProfiles,
    updateScore: updateScore,
    getModuleScore: getModuleScore,
    calcStreak: calcStreak,
    resume: resume,
    createDefault: createDefault,
    getTotalPoints: getTotalPoints,
    getStandings: getStandings
  };
})();
