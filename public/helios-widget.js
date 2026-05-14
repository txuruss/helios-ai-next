/**
 * Helios AI Chat Widget
 * Embed: <script src="https://yourdomain.com/helios-widget.js" data-widget-id="wgt_..."></script>
 *
 * Loads widget configuration from /api/widget/config and renders a floating chat interface.
 * No build step required — pure vanilla JavaScript.
 */
(function () {
  'use strict';

  // ── 1. Locate this script tag ──────────────────────────────────
  var scripts = document.querySelectorAll('script[data-widget-id]');
  var script  = scripts[scripts.length - 1];
  if (!script) return;

  var widgetId = script.getAttribute('data-widget-id');
  if (!widgetId) return;

  // Derive base URL from script src so the widget calls the same origin
  var baseUrl;
  try {
    baseUrl = new URL(script.src).origin;
  } catch (e) {
    baseUrl = window.location.origin;
  }

  var storageKey = 'helios_sess_' + widgetId;   // localStorage key for session_id

  // ── 2. Load config from server ────────────────────────────────
  fetch(baseUrl + '/api/widget/config?widget_id=' + encodeURIComponent(widgetId))
    .then(function (r) { return r.json(); })
    .then(function (config) {
      if (!config || !config.is_enabled) return;
      init(config);
    })
    .catch(function (err) {
      if (window.console) console.error('[Helios Widget] Failed to load config:', err);
    });

  // ── 3. Widget initialisation ──────────────────────────────────
  function init(cfg) {
    var color      = cfg.primary_color    || '#ff7a18';
    var botName    = cfg.agent_display_name || 'AI Assistant';
    var greeting   = cfg.greeting         || 'Hi! How can I help you today?';
    var placeholder = cfg.placeholder     || 'Type a message…';
    var position   = cfg.position         || 'bottom-right';
    var businessId = cfg.business_id;

    // Inject CSS
    var styleEl = document.createElement('style');
    styleEl.textContent = [
      '#helios-widget-fab{position:fixed;bottom:24px;' + (position === 'bottom-left' ? 'left:24px' : 'right:24px') + ';width:56px;height:56px;border-radius:50%;border:none;cursor:pointer;z-index:99998;display:flex;align-items:center;justify-content:center;font-size:22px;box-shadow:0 4px 24px rgba(0,0,0,0.45);transition:transform 0.18s ease,box-shadow 0.18s ease;}',
      '#helios-widget-fab:hover{transform:scale(1.08);box-shadow:0 6px 32px rgba(0,0,0,0.55);}',
      '#helios-widget-panel{position:fixed;bottom:92px;' + (position === 'bottom-left' ? 'left:16px' : 'right:16px') + ';width:360px;max-width:calc(100vw - 32px);height:520px;max-height:calc(100vh - 120px);background:#0f1012;border:1px solid rgba(255,255,255,0.08);border-radius:20px;box-shadow:0 8px 48px rgba(0,0,0,0.7);display:flex;flex-direction:column;z-index:99999;overflow:hidden;transform:scale(0.95) translateY(8px);opacity:0;pointer-events:none;transition:transform 0.2s ease,opacity 0.2s ease;}',
      '#helios-widget-panel.open{transform:scale(1) translateY(0);opacity:1;pointer-events:all;}',
      '#helios-widget-header{display:flex;align-items:center;gap:10px;padding:14px 16px;background:#0a0b0d;border-bottom:1px solid rgba(255,255,255,0.06);flex-shrink:0;}',
      '#helios-widget-header .hw-avatar{width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;}',
      '#helios-widget-header .hw-name{font-size:14px;font-weight:600;color:#f3f3f3;flex:1;font-family:system-ui,sans-serif;}',
      '#helios-widget-header .hw-close{width:28px;height:28px;border:none;background:rgba(255,255,255,0.06);border-radius:8px;cursor:pointer;color:#9a9a9d;font-size:16px;display:flex;align-items:center;justify-content:center;transition:background 0.15s;}',
      '#helios-widget-header .hw-close:hover{background:rgba(255,255,255,0.12);color:#f3f3f3;}',
      '#helios-widget-messages{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px;}',
      '#helios-widget-messages::-webkit-scrollbar{width:4px;}',
      '#helios-widget-messages::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:2px;}',
      '.hw-msg{max-width:84%;font-family:system-ui,sans-serif;font-size:13.5px;line-height:1.55;word-break:break-word;}',
      '.hw-msg.bot{align-self:flex-start;background:rgba(255,255,255,0.05);color:#e8e8ea;border-radius:16px 16px 16px 4px;padding:10px 14px;}',
      '.hw-msg.user{align-self:flex-end;color:#fff;border-radius:16px 16px 4px 16px;padding:10px 14px;}',
      '.hw-typing{display:flex;gap:4px;align-items:center;padding:10px 14px;}',
      '.hw-dot{width:6px;height:6px;border-radius:50%;background:rgba(255,255,255,0.35);animation:hw-bounce 1.1s infinite;}',
      '.hw-dot:nth-child(2){animation-delay:0.18s;}',
      '.hw-dot:nth-child(3){animation-delay:0.36s;}',
      '@keyframes hw-bounce{0%,60%,100%{transform:translateY(0);}30%{transform:translateY(-5px);}}',
      '#helios-widget-input-row{display:flex;gap:8px;padding:12px;border-top:1px solid rgba(255,255,255,0.06);flex-shrink:0;}',
      '#helios-widget-input{flex:1;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:12px;color:#f3f3f3;font-family:system-ui,sans-serif;font-size:13.5px;padding:10px 14px;outline:none;resize:none;line-height:1.4;max-height:100px;overflow-y:auto;transition:border-color 0.15s;}',
      '#helios-widget-input:focus{border-color:rgba(255,122,24,0.4);}',
      '#helios-widget-input::placeholder{color:#6a6a6e;}',
      '#helios-widget-send{width:38px;height:38px;border:none;border-radius:10px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:opacity 0.15s;flex-shrink:0;}',
      '#helios-widget-send:disabled{opacity:0.4;cursor:default;}',
      '#helios-widget-powered{text-align:center;padding:6px 0 10px;font-size:11px;color:#6a6a6e;font-family:system-ui,sans-serif;}',
      '#helios-widget-powered a{color:#6a6a6e;text-decoration:none;}',
      '#helios-widget-powered a:hover{color:#9a9a9d;}',
      '.hw-error{padding:8px 12px;background:rgba(255,106,90,0.1);border:1px solid rgba(255,106,90,0.25);border-radius:10px;color:#ff8a7a;font-size:12.5px;font-family:system-ui,sans-serif;}',
    ].join('');
    document.head.appendChild(styleEl);

    // FAB button
    var fab = document.createElement('button');
    fab.id = 'helios-widget-fab';
    fab.setAttribute('aria-label', 'Open chat');
    fab.style.background = color;
    fab.innerHTML = '&#128172;';
    document.body.appendChild(fab);

    // Chat panel
    var panel = document.createElement('div');
    panel.id = 'helios-widget-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', botName + ' chat');

    panel.innerHTML = [
      '<div id="helios-widget-header">',
      '  <div class="hw-avatar" style="background:' + color + ';">&#10022;</div>',
      '  <span class="hw-name">' + esc(botName) + '</span>',
      '  <button class="hw-close" id="helios-widget-close" aria-label="Close chat">&#10005;</button>',
      '</div>',
      '<div id="helios-widget-messages" aria-live="polite"></div>',
      '<div id="helios-widget-input-row">',
      '  <textarea id="helios-widget-input" rows="1" placeholder="' + esc(placeholder) + '" aria-label="Your message"></textarea>',
      '  <button id="helios-widget-send" style="background:' + color + ';" aria-label="Send message" disabled>',
      '    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round"><path d="M5 12h14M13 5l7 7-7 7"/></svg>',
      '  </button>',
      '</div>',
      cfg.show_powered_by ? '<div id="helios-widget-powered">Powered by <a href="https://helios.ai" target="_blank" rel="noopener">Helios AI</a></div>' : '',
    ].join('');
    document.body.appendChild(panel);

    // ── State ──────────────────────────────────────────────────
    var messages  = [];    // {role, content}
    var sessionId = localStorage.getItem(storageKey) || null;
    var isOpen    = false;
    var isBusy    = false;

    var msgList   = panel.querySelector('#helios-widget-messages');
    var input     = panel.querySelector('#helios-widget-input');
    var sendBtn   = panel.querySelector('#helios-widget-send');

    // Add greeting
    addMessage('assistant', greeting);

    // ── Toggle open/close ──────────────────────────────────────
    function open() {
      isOpen = true;
      panel.classList.add('open');
      fab.innerHTML = '&#10005;';
      fab.setAttribute('aria-label', 'Close chat');
      setTimeout(function () { input.focus(); }, 220);
    }
    function close() {
      isOpen = false;
      panel.classList.remove('open');
      fab.innerHTML = '&#128172;';
      fab.setAttribute('aria-label', 'Open chat');
    }

    fab.addEventListener('click', function () { isOpen ? close() : open(); });
    panel.querySelector('#helios-widget-close').addEventListener('click', close);

    // Close on Escape
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && isOpen) close();
    });

    // ── Input handling ─────────────────────────────────────────
    input.addEventListener('input', function () {
      sendBtn.disabled = !input.value.trim() || isBusy;
      // Auto-resize
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 100) + 'px';
    });

    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!sendBtn.disabled) send();
      }
    });

    sendBtn.addEventListener('click', send);

    // ── Send message ───────────────────────────────────────────
    function send() {
      var text = input.value.trim();
      if (!text || isBusy) return;

      input.value = '';
      input.style.height = 'auto';
      sendBtn.disabled = true;

      addMessage('user', text);
      messages.push({ role: 'user', content: text });
      showTyping();
      isBusy = true;

      fetch(baseUrl + '/api/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_id: businessId,
          messages:    messages,
          session_id:  sessionId || undefined,
        }),
      })
        .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d, status: r.status }; }); })
        .then(function (res) {
          hideTyping();
          isBusy = false;

          if (!res.ok) {
            var errMap = {
              429: 'Too many messages — please wait a moment.',
              403: 'Chat is currently unavailable.',
              503: 'Service not available. Please try again later.',
            };
            addError(errMap[res.status] || (res.data && res.data.error) || 'Something went wrong. Please try again.');
            return;
          }

          var reply = res.data.reply || '';
          if (reply) {
            addMessage('assistant', reply);
            messages.push({ role: 'assistant', content: reply });
          }

          // Persist session_id (does not contain sensitive data)
          if (res.data.session_id && !sessionId) {
            sessionId = res.data.session_id;
            try { localStorage.setItem(storageKey, sessionId); } catch (e) {}
          }

          // Limit in-memory history to last 40 messages
          if (messages.length > 40) messages = messages.slice(-40);
        })
        .catch(function (err) {
          hideTyping();
          isBusy = false;
          addError('Network error. Please check your connection and try again.');
          if (window.console) console.error('[Helios Widget]', err);
        });
    }

    // ── DOM helpers ────────────────────────────────────────────
    var typingEl = null;

    function addMessage(role, content) {
      var el = document.createElement('div');
      el.className = 'hw-msg ' + role;
      if (role === 'user') el.style.background = color;
      el.textContent = content;
      msgList.appendChild(el);
      scrollBottom();
    }

    function addError(msg) {
      var el = document.createElement('div');
      el.className = 'hw-error';
      el.textContent = msg;

      var retry = document.createElement('button');
      retry.style.cssText = 'margin-top:6px;background:none;border:1px solid rgba(255,106,90,0.35);color:#ff8a7a;border-radius:6px;padding:3px 10px;font-size:11.5px;cursor:pointer;font-family:inherit;';
      retry.textContent = 'Retry';
      retry.onclick = function () {
        el.remove();
        if (messages.length > 0) {
          var last = messages[messages.length - 1];
          if (last && last.role === 'user') {
            messages.pop();
            input.value = last.content;
            sendBtn.disabled = false;
            input.focus();
          }
        }
      };
      el.appendChild(retry);
      msgList.appendChild(el);
      scrollBottom();
    }

    function showTyping() {
      typingEl = document.createElement('div');
      typingEl.className = 'hw-msg bot hw-typing';
      typingEl.innerHTML = '<div class="hw-dot"></div><div class="hw-dot"></div><div class="hw-dot"></div>';
      msgList.appendChild(typingEl);
      scrollBottom();
    }

    function hideTyping() {
      if (typingEl && typingEl.parentNode) {
        typingEl.parentNode.removeChild(typingEl);
        typingEl = null;
      }
    }

    function scrollBottom() {
      msgList.scrollTop = msgList.scrollHeight;
    }
  }

  function esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
})();
