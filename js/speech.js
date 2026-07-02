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

  /**
   * Try to find and cache an Italian voice from available voices.
   */
  function cacheItalianVoice() {
    if (!synth) return false;
    var voices = synth.getVoices();
    if (!voices || voices.length === 0) return false;
    // Prefer exact 'it-IT', fall back to any 'it' prefix
    cachedItalianVoice = voices.find(function(v) { return v.lang === 'it-IT'; })
      || voices.find(function(v) { return v.lang && v.lang.startsWith('it'); });
    voicesLoaded = true;
    return !!cachedItalianVoice;
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
   * @param {object} [options] - Optional { rate, pitch }
   */
  function speak(text, options) {
    if (!synth) return;
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
    utterance.onend = function() { emit('speech:tts-end', {}); };

    synth.speak(utterance);
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

  // Attempt auto-init on load
  if (SpeechRecognition) {
    // Defer slightly to let DOM finish parsing
    setTimeout(function() { init(); }, 0);
  }

  return {
    start: start,
    stop: stop,
    speak: speak,
    isSupported: isRecognitionSupported,
    isListening: function() { return isListening; }
  };
})();

/* Convenience alias */
App.Speech = App.SpeechManager;
