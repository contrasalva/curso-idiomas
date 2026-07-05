/* ============================================
   Italiano B1 — conversation.js
   App.ConversationEngine: dialog tree interpreter
   for guided and free conversation steps.
   Pure state machine — no rendering.
   ============================================ */

var App = window.App || {};

App.ConversationEngine = (function() {
  'use strict';

  /* --- Private State --- */
  var _state = {
    treeData: null,
    currentNodeId: null,
    history: [],
    isComplete: false,
    visitCount: {},
    mode: 'guided',
    callbacks: null,
    inactivityTimer: null,
    missedItems: []
  };

  /* ==========================================
     PUBLIC API
     ========================================== */

  /**
   * Initialize the engine with a dialog tree.
   * @param {object} treeData - { startNodeId, nodes: { id: {...} } }
   * @param {string} mode - 'guided' or 'free'
   * @param {object} callbacks - { onPrompt, onFeedback, onComplete }
   */
  function startDialog(treeData, mode, callbacks) {
    _state.treeData = treeData;
    _state.mode = mode || 'guided';
    _state.callbacks = callbacks || {};
    _state.currentNodeId = treeData && treeData.startNodeId;
    _state.history = [];
    _state.isComplete = false;
    _state.visitCount = {};
    _state.missedItems = [];

    _resetInactivityTimer();

    // Fire initial prompt
    var startNode = _getNode(_state.currentNodeId);
    if (startNode && typeof _state.callbacks.onPrompt === 'function') {
      _state.callbacks.onPrompt(startNode);
    }
  }

  /**
   * Process a user input string.
   * Normalizes, matches branches, advances state.
   * @param {string} input
   */
  function processResponse(input) {
    if (_state.isComplete) return;
    if (!input || typeof input !== 'string') return;
    _resetInactivityTimer();

    var normalized = input.toLowerCase().trim();
    var currentNode = _getNode(_state.currentNodeId);
    if (!currentNode) return;

    // Record visit for cycle detection
    _state.history.push(_state.currentNodeId);
    var visits = (_state.visitCount[_state.currentNodeId] || 0) + 1;
    _state.visitCount[_state.currentNodeId] = visits;

    // Cycle detection — force complete after 3 visits to same node
    if (visits >= 3) {
      _state.isComplete = true;
      if (typeof _state.callbacks.onComplete === 'function') {
        _state.callbacks.onComplete();
      }
      return;
    }

    // Find matching branch
    var match = _findMatchingBranch(currentNode, normalized);

    if (!match) {
      // No match and no default — edge case, stay on same node
      return;
    }

    if (match.isDefault && match.keyword === '') {
      // Default fallback with empty keyword — user didn't match anything
      _trackMissedKeywords(currentNode, normalized);
      if (typeof _state.callbacks.onFeedback === 'function') {
        _state.callbacks.onFeedback(match.feedback, false);
      }
    } else if (!match.isDefault) {
      // Positive keyword match
      if (match.feedback && typeof _state.callbacks.onFeedback === 'function') {
        var feedbackText = match.feedback;
        if (match.feedbackTranslation) {
          feedbackText += ' (' + match.feedbackTranslation + ')';
        }
        _state.callbacks.onFeedback(feedbackText, true);
      }
    } else {
      // Default branch that was NOT an empty-keyword default (user entered something but only default matched)
      _trackMissedKeywords(currentNode, normalized);
      if (typeof _state.callbacks.onFeedback === 'function') {
        _state.callbacks.onFeedback(match.feedback, false);
      }
    }

    // Advance to next node
    _advanceToNode(match.nextNodeId);
  }

  /**
   * Get hint keyword chips for the current node.
   * Returns empty array in free mode.
   * @returns {string[]}
   */
  function getHints() {
    if (_state.mode === 'free') return [];

    var node = _getNode(_state.currentNodeId);
    if (!node || !node.branches) return [];

    var hints = [];
    for (var i = 0; i < node.branches.length; i++) {
      var b = node.branches[i];
      if (b.keyword && !b.isDefault) {
        hints.push(b.keyword);
      }
    }
    return hints;
  }

  /**
   * Get progress info.
   * @returns {object} { currentNodeId, totalNodes, completedNodes }
   */
  function getProgress() {
    var totalNodes = 0;
    var completedNodes = 0;
    var id;

    if (_state.treeData && _state.treeData.nodes) {
      for (id in _state.treeData.nodes) {
        if (_state.treeData.nodes.hasOwnProperty(id)) totalNodes++;
      }
    }
    for (id in _state.visitCount) {
      if (_state.visitCount.hasOwnProperty(id)) completedNodes++;
    }

    return {
      currentNodeId: _state.currentNodeId,
      totalNodes: totalNodes,
      completedNodes: completedNodes
    };
  }

  /**
   * Get tracked missed items (keywords the user failed to produce).
   * @returns {Array}
   */
  function getMissedItems() {
    return _state.missedItems;
  }

  /**
   * Reset and clean up the engine state.
   */
  function destroy() {
    if (_state.inactivityTimer) {
      clearTimeout(_state.inactivityTimer);
      _state.inactivityTimer = null;
    }
    _state.treeData = null;
    _state.currentNodeId = null;
    _state.history = [];
    _state.isComplete = false;
    _state.visitCount = {};
    _state.callbacks = null;
    _state.missedItems = [];
  }

  /* ==========================================
     PRIVATE HELPERS
     ========================================== */

  /**
   * Get a node by ID from the tree.
   * @param {string} nodeId
   * @returns {object|null}
   */
  function _getNode(nodeId) {
    if (!_state.treeData || !_state.treeData.nodes) return null;
    return _state.treeData.nodes[nodeId] || null;
  }

  /**
   * Find the first matching branch for the normalized input.
   * In guided mode: exact substring match.
   * In free mode: more lenient — input contains keyword OR keyword contains input.
   * @param {object} node
   * @param {string} normalizedInput
   * @returns {object|null} Branch object or null
   */
  function _findMatchingBranch(node, normalizedInput) {
    var branches = node.branches || [];
    var defaultBranch = null;

    for (var i = 0; i < branches.length; i++) {
      var branch = branches[i];

      if (branch.isDefault) {
        defaultBranch = branch;
        continue;
      }

      var keyword = branch.keyword ? branch.keyword.toLowerCase().trim() : '';

      if (!keyword) {
        // Empty keyword on non-default branch is treated as always-match
        return branch;
      }

      var isMatch;
      if (_state.mode === 'free') {
        // Free mode: partial match in either direction
        isMatch = normalizedInput.indexOf(keyword) !== -1
               || keyword.indexOf(normalizedInput) !== -1;
      } else {
        // Guided mode: exact substring match
        isMatch = normalizedInput.indexOf(keyword) !== -1;
      }

      if (isMatch) {
        return branch;
      }
    }

    return defaultBranch || null;
  }

  /**
   * Advance to the next node, fire callbacks.
   * @param {string} nextNodeId
   */
  function _advanceToNode(nextNodeId) {
    var nextNode = _getNode(nextNodeId);

    if (!nextNode) {
      _state.isComplete = true;
      if (typeof _state.callbacks.onComplete === 'function') {
        _state.callbacks.onComplete();
      }
      return;
    }

    _state.currentNodeId = nextNodeId;

    // End node
    if (nextNode.isEnd) {
      _state.isComplete = true;
      if (typeof _state.callbacks.onPrompt === 'function') {
        _state.callbacks.onPrompt(nextNode);
      }
      if (typeof _state.callbacks.onComplete === 'function') {
        _state.callbacks.onComplete();
      }
      return;
    }

    // Free mode: pick random prompt variation if available
    if (_state.mode === 'free'
        && nextNode.promptVariations
        && nextNode.promptVariations.length > 0) {
      var varIdx = Math.floor(Math.random() * nextNode.promptVariations.length);
      nextNode._currentPrompt = nextNode.promptVariations[varIdx];
    } else {
      nextNode._currentPrompt = null;
    }

    // Fire onPrompt for the new node
    if (typeof _state.callbacks.onPrompt === 'function') {
      _state.callbacks.onPrompt(nextNode);
    }

    _resetInactivityTimer();
  }

  /**
   * Track missed keywords in missedItems.
   * @param {object} node
   * @param {string} normalizedInput
   */
  function _trackMissedKeywords(node, normalizedInput) {
    var expectedKeywords = [];
    if (node.branches) {
      for (var bi = 0; bi < node.branches.length; bi++) {
        var br = node.branches[bi];
        if (br.keyword && !br.isDefault) {
          expectedKeywords.push(br.keyword);
        }
      }
    }

    _state.missedItems.push({
      nodeId: node.id,
      prompt: node.prompt,
      userInput: normalizedInput,
      expectedKeywords: expectedKeywords,
      timestamp: Date.now()
    });
  }

  /**
   * Reset the inactivity timer.
   * Fires a nudge message after 30s (guided) or 60s (free).
   */
  function _resetInactivityTimer() {
    if (_state.inactivityTimer) {
      clearTimeout(_state.inactivityTimer);
      _state.inactivityTimer = null;
    }
    if (_state.isComplete) return;

    var delay = _state.mode === 'guided' ? 30000 : 60000;

    _state.inactivityTimer = setTimeout(function() {
      if (_state.isComplete) return;
      if (typeof _state.callbacks.onFeedback === 'function') {
        var msg = _state.mode === 'guided'
          ? '¿Necesitas ayuda? Escribe tu respuesta o prueba con las sugerencias.'
          : '¿Sigues ahí? Intenta responder en italiano.';
        _state.callbacks.onFeedback(msg, false);
      }
    }, delay);
  }

  return {
    startDialog: startDialog,
    processResponse: processResponse,
    getHints: getHints,
    getProgress: getProgress,
    getMissedItems: getMissedItems,
    destroy: destroy
  };
})();
