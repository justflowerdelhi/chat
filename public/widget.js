(() => {
  if (window.FloraReceptionistWidgetLoaded) {
    return;
  }

  window.FloraReceptionistWidgetLoaded = true;

  const currentScript = document.currentScript;
  const scriptUrl = currentScript?.src ? new URL(currentScript.src) : new URL('/widget.js', window.location.origin);
  const cssUrl = new URL('widget.css', scriptUrl).toString();
  const openStateKey = 'floraReceptionistWidgetOpen';
  const sessionIdKey = 'floraReceptionistSessionId';
  const initialOpen = sessionStorage.getItem(openStateKey) === 'true';

  const state = {
    open: initialOpen,
    loading: false,
    sessionId: sessionStorage.getItem(sessionIdKey),
    messages: [
      {
        role: 'assistant',
        content: "Hello 👋\n\nWelcome to Just Flowers.\n\nI'm Flora.\n\nYour digital receptionist.\n\nHow may I help you today?",
        localOnly: true,
      },
    ],
  };

  const host = document.createElement('div');
  host.setAttribute('id', 'flora-receptionist-widget');
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: 'open' });
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = cssUrl;
  shadow.appendChild(link);

  const root = document.createElement('div');
  root.className = 'flora-widget-root';
  shadow.appendChild(root);

  function iconPlane() {
    return '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"></path><path d="M22 2 11 13"></path></svg>';
  }

  function escapeHtml(value) {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function persistOpenState() {
    sessionStorage.setItem(openStateKey, state.open ? 'true' : 'false');
  }

  function scrollToBottom() {
    const messages = shadow.querySelector('[data-flora-messages]');
    if (messages) {
      messages.scrollTop = messages.scrollHeight;
    }
  }

  function setOpen(open) {
    state.open = open;
    persistOpenState();
    render();
    if (open) {
      window.setTimeout(() => {
        shadow.querySelector('[data-flora-input]')?.focus();
        scrollToBottom();
      }, 0);
    }
  }

  function addMessage(role, content) {
    state.messages.push({ role, content });
    render();
    window.setTimeout(scrollToBottom, 0);
  }

  function setLoading(loading) {
    state.loading = loading;
    render();
    window.setTimeout(scrollToBottom, 0);
  }

  async function sendMessage() {
    const input = shadow.querySelector('[data-flora-input]');
    const value = input?.value.trim();

    if (!value || state.loading) {
      return;
    }

    input.value = '';
    addMessage('user', value);
    setLoading(true);

    try {
      const response = await fetch(new URL('api/public/chat', scriptUrl).toString(), {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: state.messages.filter((message) => !message.localOnly && (message.role === 'user' || message.role === 'assistant')),
          sessionId: state.sessionId,
        }),
      });

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const data = await response.json();
      if (data.sessionId) {
        state.sessionId = data.sessionId;
        sessionStorage.setItem(sessionIdKey, data.sessionId);
      }

      addMessage('assistant', data.reply || "Sorry, I'm having trouble connecting.\n\nPlease try again in a moment.");
    } catch {
      addMessage('assistant', "Sorry,\n\nI'm having trouble connecting.\n\nPlease try again in a moment.");
    } finally {
      setLoading(false);
    }
  }

  function renderMessages() {
    const rows = state.messages
      .map((message) => {
        const typeClass = message.role === 'user' ? 'flora-widget-message-user' : 'flora-widget-message-assistant';
        return `<div class="flora-widget-message ${typeClass}"><div class="flora-widget-bubble">${escapeHtml(message.content)}</div></div>`;
      })
      .join('');

    const loading = state.loading ? '<div class="flora-widget-typing" aria-live="polite">Flora is preparing...<br>Flora is typing...</div>' : '';
    return rows + loading;
  }

  function renderPanel() {
    return `
      <section class="flora-widget-panel" role="dialog" aria-label="Flora Receptionist chat" aria-modal="false">
        <header class="flora-widget-header">
          <div class="flora-widget-identity">
            <div class="flora-widget-avatar" aria-hidden="true">🌸</div>
            <div>
              <h2 class="flora-widget-title">Flora Receptionist</h2>
              <div class="flora-widget-subtitle"><span class="flora-widget-status-dot"></span><span>Online</span><span>Usually replies instantly</span></div>
            </div>
          </div>
          <button class="flora-widget-close" type="button" aria-label="Minimize Flora Receptionist" data-flora-close>×</button>
        </header>
        <div class="flora-widget-messages" data-flora-messages aria-live="polite">
          ${renderMessages()}
        </div>
        <footer class="flora-widget-footer">
          <form class="flora-widget-form" data-flora-form>
            <textarea class="flora-widget-input" rows="1" placeholder="Type your message..." aria-label="Type your message" data-flora-input ${state.loading ? 'disabled' : ''}></textarea>
            <button class="flora-widget-send" type="submit" aria-label="Send message" ${state.loading ? 'disabled' : ''}>${iconPlane()}</button>
          </form>
          <div class="flora-widget-brand">Powered by Floraprise</div>
        </footer>
      </section>
    `;
  }

  function renderButton() {
    return '<button class="flora-widget-button" type="button" aria-label="Open Flora Receptionist" data-flora-open>🌸</button>';
  }

  function bindEvents() {
    shadow.querySelector('[data-flora-open]')?.addEventListener('click', () => setOpen(true));
    shadow.querySelector('[data-flora-close]')?.addEventListener('click', () => setOpen(false));
    shadow.querySelector('[data-flora-form]')?.addEventListener('submit', (event) => {
      event.preventDefault();
      sendMessage();
    });
    shadow.querySelector('[data-flora-input]')?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
      }
    });
  }

  function render() {
    root.innerHTML = state.open ? renderPanel() : renderButton();
    bindEvents();
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && state.open) {
      setOpen(false);
    }
  });

  render();
})();
