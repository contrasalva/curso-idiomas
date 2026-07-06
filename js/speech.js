/* ============================================
   Italiano B1 — speech.js
   App.SpeechManager: Web Speech API wrapper,
   CustomEvents for speech lifecycle
   ============================================ */

var App = window.App || {};

App.SpeechManager = (function() {
  var recognition = null;
  var isSupported = false;
  var isListening = false;
  var synth = window.speechSynthesis;
  var cachedItalianVoice = null;
  var voicesLoaded = false;
  var _speechEnabled = true; // user toggle

  /**
   * Try to find the best Italian voice from available voices.
   * Prioritises high-quality voices: Google, Microsoft, Premium, enhanced.
   */
  function findBestItalianVoice() {
    if (!synth) return null;
    var voices = synth.getVoices();
    if (!voices || voices.length === 0) return null;

    // Filter to Italian voices only
    var itVoices = voices.filter(function(v) {
      return v.lang && (v.lang === 'it-IT' || v.lang.indexOf('it') === 0);
    });
    if (!itVoices.length) return null;

    // Scan quality indicators in the voice name
    var qualityPrefixes = ['google', 'microsoft', 'premium', 'enhanced', 'high'];
    for (var i = 0; i < qualityPrefixes.length; i++) {
      var found = itVoices.find(function(v) {
        return v.name && v.name.toLowerCase().indexOf(qualityPrefixes[i]) !== -1;
      });
      if (found) return found;
    }

    // Prefer the first non-default Italian voice (skip "default" if alternatives exist)
    var nonDefault = itVoices.find(function(v) {
      return v.name && v.name.toLowerCase().indexOf('default') === -1;
    });
    if (nonDefault) return nonDefault;

    // Last resort: any Italian voice
    return itVoices[0];
  }

  /**
   * Cache the best Italian voice for subsequent use.
   */
  function cacheItalianVoice() {
    if (!synth) return false;

    // Check user's saved preference first
    var savedName = '';
    try { savedName = localStorage.getItem('italian_voice_name') || ''; } catch(e) {}
    if (savedName) {
      var voices = synth.getVoices();
      if (voices) {
        var saved = voices.find(function(v) { return v.name === savedName; });
        if (saved) {
          cachedItalianVoice = saved;
          voicesLoaded = true;
          return true;
        }
      }
    }

    // Fall back to automatic best-voice selection
    cachedItalianVoice = findBestItalianVoice();
    voicesLoaded = true;
    return !!cachedItalianVoice;
  }

  /**
   * Set voice by exact name (used by the voice settings dialog in app.js).
   */
  function setVoiceByName(name) {
    if (!synth) return false;
    var voices = synth.getVoices();
    if (!voices) return false;
    var found = voices.find(function(v) { return v.name === name; });
    if (found) {
      cachedItalianVoice = found;
      try { localStorage.setItem('italian_voice_name', name); } catch(e) {}
      return true;
    }
    return false;
  }

  // Try immediate synchronous load (some browsers have them ready)
  cacheItalianVoice();

  // Listen for async voice loading
  if (synth && synth.onvoiceschanged !== undefined) {
    synth.addEventListener('voiceschanged', cacheItalianVoice);
  }

  // Feature detection with prefixes
  var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  isSupported = !!SpeechRecognition;

  /**
   * Initialize the SpeechRecognition instance with Italian config.
   */
  function init() {
    if (!isSupported) return false;
    recognition = new SpeechRecognition();
    recognition.lang = 'it-IT';
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 3;

    recognition.onstart = function() {
      isListening = true;
      emit('speech:start', {});
    };

    recognition.onend = function() {
      isListening = false;
      emit('speech:end', {});
    };

    recognition.onresult = function(event) {
      var alternatives = [];
      var final = '';
      var isFinal = false;

      for (var i = event.resultIndex; i < event.results.length; i++) {
        var result = event.results[i];
        isFinal = result.isFinal;
        for (var j = 0; j < result.length; j++) {
          alternatives.push({
            transcript: result[j].transcript,
            confidence: result[j].confidence
          });
        }
      }

      if (alternatives.length > 0) {
        final = alternatives[0].transcript;
      }

      emit('speech:result', {
        transcript: final,
        alternatives: alternatives,
        isFinal: isFinal
      });
    };

    recognition.onerror = function(event) {
      var messages = {
        'no-speech': 'No se detectó voz. Intenta de nuevo o escribe.',
        'audio-capture': 'No se encontró micrófono.',
        'not-allowed': 'Acceso al micrófono denegado.',
        'permission-denied': 'Acceso al micrófono denegado.',
        'network': 'Error de conexión. Intenta de nuevo.',
        'aborted': 'Grabación cancelada.',
        'language-not-supported': 'Idioma no soportado.',
        'service-not-allowed': 'Servicio de voz no disponible.'
      };

      emit('speech:error', {
        error: event.error,
        message: messages[event.error] || 'Error de voz: ' + event.error
      });

      isListening = false;
    };

    return true;
  }

  /**
   * Start speech recognition. Initialises on first call if needed.
   */
  function start() {
    if (!recognition) {
      if (!init()) {
        emit('speech:error', { error: 'unsupported', message: 'Reconocimiento de voz no soportado.' });
        return;
      }
    }
    if (isListening) return;
    try {
      recognition.start();
    } catch (e) {
      console.warn('SpeechRecognition start failed:', e);
    }
  }

  /**
   * Stop speech recognition.
   */
  function stop() {
    if (recognition && isListening) {
      recognition.stop();
      isListening = false;
    }
  }

  /**
   * Speak text via SpeechSynthesis with Italian voice.
   * @param {string} text - Text to speak
   * @param {object} [options] - Optional { rate, pitch, onEnd }
   */
  function speak(text, options) {
    if (!synth || !_speechEnabled) return;
    synth.cancel();

    // Chrome workaround: if voices aren't loaded yet, trigger a re-grab
    if (!voicesLoaded) cacheItalianVoice();

    var utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'it-IT';
    utterance.rate = (options && options.rate) || 0.9;
    utterance.pitch = (options && options.pitch) || 1;
    utterance.volume = 1;

    // Use cached Italian voice for natural pronunciation
    if (cachedItalianVoice) {
      utterance.voice = cachedItalianVoice;
    }

    utterance.onstart = function() { emit('speech:tts-start', {}); };
    utterance.onend = function() {
      emit('speech:tts-end', {});
      if (options && typeof options.onEnd === 'function') {
        options.onEnd();
      }
    };

    synth.speak(utterance);
  }

  /**
   * Speak text with word-level boundary callbacks and returns a Promise.
   * Highlights each word as it's spoken via the onWordBoundary callback.
   * @param {string} text - Text to speak
   * @param {function} onWordBoundary - callback(wordIndex, charIndex, charLength, word)
   * @returns {Promise<{wordResults: Array, score: number}>}
   */
  function speakWithHighlight(text, onWordBoundary) {
    if (!synth || !_speechEnabled) {
      return Promise.resolve({ wordResults: [], score: 0 });
    }

    synth.cancel();

    if (!voicesLoaded) cacheItalianVoice();

    var utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'it-IT';
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 1;

    // Use best Italian voice from our improved selector
    var bestVoice = findBestItalianVoice();
    if (bestVoice) {
      utterance.voice = bestVoice;
    } else if (cachedItalianVoice) {
      utterance.voice = cachedItalianVoice;
    }

    var wordIdx = 0;

    utterance.onboundary = function(event) {
      if (event.name !== 'word') return;
      var charIndex = event.charIndex;
      var charLength = event.charLength || 1;
      var word = text.substring(charIndex, charIndex + charLength).trim();

      if (typeof onWordBoundary === 'function') {
        onWordBoundary(wordIdx, charIndex, charLength, word);
      }
      wordIdx++;
    };

    return new Promise(function(resolve) {
      utterance.onend = function() {
        var detail = {
          phrase: text,
          wordResults: [],
          score: 0
        };
        var evt = new CustomEvent('speech:pronunciation', { detail: detail });
        document.dispatchEvent(evt);
        resolve(detail);
      };

      utterance.onerror = function() {
        resolve({ wordResults: [], score: 0 });
      };

      synth.speak(utterance);
    });
  }

  /**
   * Check if SpeechRecognition is supported in this browser.
   */
  function isRecognitionSupported() {
    return isSupported;
  }

  /**
   * Dispatch a CustomEvent on the window object.
   */
  function emit(eventName, detail) {
    var event = new CustomEvent(eventName, { detail: detail });
    window.dispatchEvent(event);
  }

  /**
   * Persist speech enabled state.
   */
  function loadState() {
    try {
      var val = localStorage.getItem('italian_speech_enabled');
      if (val !== null) _speechEnabled = val === 'true';
    } catch(e) {}
  }
  loadState();

  /**
   * Enable or disable speech (TTS).
   */
  function setEnabled(enabled) {
    _speechEnabled = !!enabled;
    if (!_speechEnabled) {
      if (synth) synth.cancel();
    }
    try { localStorage.setItem('italian_speech_enabled', _speechEnabled); } catch(e) {}
    emit('speech:toggle', { enabled: _speechEnabled });
  }

  /**
   * Toggle speech on/off.
   */
  function toggle() {
    setEnabled(!_speechEnabled);
  }

  /**
   * Check if speech is currently enabled.
   */
  function isEnabled() {
    return _speechEnabled;
  }

  // Attempt auto-init on load
  if (SpeechRecognition) {
    // Defer slightly to let DOM finish parsing
    setTimeout(function() { init(); }, 0);
  }

  return {
    start: start,
    stop: stop,
    speak: speak,
    speakWithHighlight: speakWithHighlight,
    isSupported: isRecognitionSupported,
    isListening: function() { return isListening; },
    setEnabled: setEnabled,
    toggle: toggle,
    isEnabled: isEnabled,
    setVoiceByName: setVoiceByName
  };
})();

/* Convenience alias */
App.Speech = App.SpeechManager;
