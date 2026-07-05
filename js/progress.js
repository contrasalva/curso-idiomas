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
   * Create a default profile object (v2 schema).
   * @param {string} name
   * @returns {object}
   */
  function createDefault(name) {
    return {
      name: name,
      createdAt: Date.now(),
      lastActive: Date.now(),
      streak: 0,
      modules: {},
      track: 'a1-a2',
      currentUnit: 0,
      currentStep: 0,
      unitProgress: {},
      missedItems: [],
      vocabularySeen: []
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

  /* ==========================================
     V2: DEBOUNCED SAVE & QUOTA HANDLING
     ========================================== */

  /**
   * Debounce timer for save.
   */
  var _saveTimer = null;

  /**
   * Save a profile with debouncing (300ms).
   * Handles QuotaExceededError with partial save fallback.
   * @param {string} name
   * @param {object} data
   */
  function saveSafe(name, data) {
    if (_saveTimer) {
      clearTimeout(_saveTimer);
    }
    _saveTimer = setTimeout(function() {
      _saveTimer = null;
      try {
        var serialized = JSON.stringify(data);
        localStorage.setItem(profileKey(name), serialized);
      } catch (e) {
        if (e.name === 'QuotaExceededError' || e.code === 22) {
          console.warn('[Progress] localStorage quota exceeded. Performing partial save.');
          // Fallback: save only essential data
          var minimal = {
            name: data.name,
            createdAt: data.createdAt,
            lastActive: Date.now(),
            streak: data.streak || 0,
            modules: data.modules || {},
            track: data.track || 'a1-a2',
            currentUnit: data.currentUnit || 0,
            currentStep: data.currentStep || 0,
            unitProgress: data.unitProgress || {},
            missedItems: data.missedItems || [],
            vocabularySeen: data.vocabularySeen || []
          };
          try {
            localStorage.setItem(profileKey(name), JSON.stringify(minimal));
          } catch (e2) {
            // Evacuation: keep only unitProgress
            try {
              var evacuation = {
                name: data.name,
                lastActive: Date.now(),
                unitProgress: data.unitProgress || {}
              };
              localStorage.setItem(profileKey(name), JSON.stringify(evacuation));
            } catch (e3) {
              console.error('[Progress] Unable to save profile. Storage is full.');
            }
          }
        } else {
          console.error('[Progress] Save error:', e);
        }
      }
    }, 300);
  }

  /* ==========================================
     V2: MIGRATION
     ========================================== */

  /**
   * Migrate a legacy profile (with moduleProgress but no unitProgress)
   * to the v2 schema. Idempotent — skips if unitProgress already exists.
   * @param {object} oldProfile - The old profile object (mutated in place)
   */
  function migrateLegacyProfile(oldProfile) {
    if (!oldProfile) return;
    // Skip if already migrated
    if (oldProfile.unitProgress) return;

    // Add new fields
    oldProfile.track = oldProfile.track || 'a1-a2';
    oldProfile.currentUnit = oldProfile.currentUnit || 0;
    oldProfile.currentStep = oldProfile.currentStep || 0;
    oldProfile.unitProgress = {};
    oldProfile.missedItems = oldProfile.missedItems || [];
    oldProfile.vocabularySeen = oldProfile.vocabularySeen || [];

    // Map old moduleProgress → unitProgress if it exists
    if (oldProfile.moduleProgress) {
      for (var modId in oldProfile.moduleProgress) {
        if (oldProfile.moduleProgress.hasOwnProperty(modId)) {
          var oldMod = oldProfile.moduleProgress[modId];
          oldProfile.unitProgress[modId] = {
            currentStep: oldMod.currentStep !== undefined ? oldMod.currentStep : 0,
            completed: oldMod.completed === true,
            score: oldMod.score || 0,
            levelScores: oldMod.levelScores || {}
          };
        }
      }
    }

    // Keep old modules data as is
  }

  /* ==========================================
     V2: PROGRESS TRACKING METHODS
     ========================================== */

  /**
   * Save progress for a specific unit: step and optional score.
   * Debounced.
   * @param {number} unitId
   * @param {number} step - Current step index (0-based)
   * @param {number|undefined} score - Optional unit score
   */
  function saveUnitProgress(unitId, step, score) {
    var learner = App.state && App.state.currentLearner;
    if (!learner) return;
    var profile = get(learner);
    if (!profile) return;

    if (!profile.unitProgress) profile.unitProgress = {};
    if (!profile.unitProgress[unitId]) {
      profile.unitProgress[unitId] = {
        currentStep: 0,
        completed: false,
        score: 0,
        levelScores: {}
      };
    }

    profile.unitProgress[unitId].currentStep = step;
    profile.currentUnit = unitId;
    profile.currentStep = step;

    if (score !== undefined && score !== null) {
      profile.unitProgress[unitId].score = score;
    }

    saveSafe(learner, profile);
  }

  /**
   * Update the score for a specific difficulty level within a unit.
   * Saves immediately (no debounce since it's called on level completion).
   * @param {number} unitId
   * @param {number|string} nivel - Level number (1-7)
   * @param {number} score - 0-100
   */
  function updateLevelScore(unitId, nivel, score) {
    var learner = App.state && App.state.currentLearner;
    if (!learner) return;
    var profile = get(learner);
    if (!profile) return;

    if (!profile.unitProgress) profile.unitProgress = {};
    if (!profile.unitProgress[unitId]) {
      profile.unitProgress[unitId] = {
        currentStep: 0,
        completed: false,
        score: 0,
        levelScores: {}
      };
    }
    if (!profile.unitProgress[unitId].levelScores) {
      profile.unitProgress[unitId].levelScores = {};
    }

    // Keep best score
    var prev = profile.unitProgress[unitId].levelScores[nivel];
    if (prev === undefined || score > prev) {
      profile.unitProgress[unitId].levelScores[nivel] = score;
    }

    save(learner, profile);
  }

  /**
   * Record a missed item by delegating to App.SmartReview.recordMissedItem.
   * Saves via debounced save.
   * @param {object} item - Missed item data object
   */
  function recordMissedItem(item) {
    var learner = App.state && App.state.currentLearner;
    if (!learner) return;
    var profile = get(learner);
    if (!profile) return;

    if (App.SmartReview && App.SmartReview.recordMissedItem) {
      App.SmartReview.recordMissedItem(item, profile);
      saveSafe(learner, profile);
    }
  }

  /**
   * Update vocabulary seen for a word. If not seen yet, adds it.
   * If already seen, updates the mastered flag.
   * @param {string} word - The Italian word
   * @param {boolean} mastered - Whether the user has mastered it
   */
  function updateVocabularySeen(word, mastered) {
    var learner = App.state && App.state.currentLearner;
    if (!learner) return;
    var profile = get(learner);
    if (!profile) return;

    if (!profile.vocabularySeen) {
      profile.vocabularySeen = [];
    }

    var found = false;
    for (var i = 0; i < profile.vocabularySeen.length; i++) {
      if (profile.vocabularySeen[i].word === word) {
        profile.vocabularySeen[i].seen = (profile.vocabularySeen[i].seen || 0) + 1;
        if (mastered !== undefined) {
          profile.vocabularySeen[i].mastered = mastered;
        }
        found = true;
        break;
      }
    }

    if (!found) {
      profile.vocabularySeen.push({
        word: word,
        seen: 1,
        mastered: mastered === true
      });
    }

    saveSafe(learner, profile);
  }

  /* ==========================================
     BOOT-TIME MIGRATION CHECK
     ========================================== */

  /**
   * Run migration on all existing profiles on boot.
   * Called automatically when this module loads.
   */
  function runBootMigration() {
    var names = listProfiles();
    for (var i = 0; i < names.length; i++) {
      var profile = get(names[i]);
      if (profile) {
        // Check if old schema (no unitProgress)
        if (!profile.unitProgress) {
          migrateLegacyProfile(profile);
          save(names[i], profile);
          console.log('[Progress] Migrated profile "' + names[i] + '" to v2 schema.');
        }
      }
    }
  }

  // Run boot migration immediately
  runBootMigration();

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
    getStandings: getStandings,
    // V2 API
    saveSafe: saveSafe,
    migrateLegacyProfile: migrateLegacyProfile,
    saveUnitProgress: saveUnitProgress,
    updateLevelScore: updateLevelScore,
    recordMissedItem: recordMissedItem,
    updateVocabularySeen: updateVocabularySeen
  };
})();
