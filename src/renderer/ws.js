// LiveSplit WebSocket client - shared between index and editor pages
// LiveSplit Server (WebSocket) sends commands as plain text responses.
// We poll the current split index via the command protocol.

class LiveSplitWS {
  constructor({ onEvent, onStatus }) {
    this.onEvent = onEvent;
    this.onStatus = onStatus;
    this.ws = null;
    this.url = 'ws://localhost:16834/livesplit';
    this.pollInterval = null;
    this.pendingResolvers = [];
    this._splitIndex = -1;
    this._phase = 'NotRunning'; // NotRunning | Running | Paused | Ended
    this._failCount = 0;
  }

  connect(url) {
    if (url) this.url = url;
    this._failCount = 0;
    this._disconnect();
    this._tryConnect();
  }

  retry() {
    this._failCount = 0;
    this._disconnect();
    this._tryConnect();
  }

  _tryConnect() {
    this.onStatus('connecting');
    try {
      this.ws = new WebSocket(this.url);
    } catch (e) {
      this.onStatus('error');
      this._scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this._failCount = 0;
      this.onStatus('connected');
      this._startPolling();
    };

    this.ws.onmessage = (e) => {
      const text = e.data.trim();
      // Resolve the oldest pending promise if any
      if (this.pendingResolvers.length) {
        const resolve = this.pendingResolvers.shift();
        resolve(text);
      }
    };

    this.ws.onclose = () => {
      this.onStatus('disconnected');
      this._stopPolling();
      this._scheduleReconnect();
    };

    this.ws.onerror = () => {
      this.onStatus('error');
    };
  }

  _disconnect() {
    this._stopPolling();
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
  }

  _scheduleReconnect() {
    this._failCount++;
    if (this._failCount >= 10) {
      this.onStatus('failed');
      return;
    }
    setTimeout(() => this._tryConnect(), 3000);
  }

  send(command) {
    return new Promise((resolve) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        resolve(null);
        return;
      }
      this.pendingResolvers.push(resolve);
      this.ws.send(command);
      // Safety timeout
      setTimeout(() => {
        const idx = this.pendingResolvers.indexOf(resolve);
        if (idx !== -1) {
          this.pendingResolvers.splice(idx, 1);
          resolve(null);
        }
      }, 1000);
    });
  }

  async _poll() {
    // Sequential sends - order is guaranteed, no Promise.all mixing
    const phaseRaw = await this.send('getcurrenttimerphase');
    const indexRaw = await this.send('getsplitindex');

    const phase = phaseRaw || 'NotRunning';
    const index = indexRaw !== null ? parseInt(indexRaw, 10) : -1;

    const phaseChanged = phase !== this._phase;
    const indexChanged = !Number.isNaN(index) && index !== this._splitIndex;

    if (phaseChanged) {
      this._phase = phase;
      this.onEvent({ type: 'phase', phase });
    }

    if (!Number.isNaN(index) && indexChanged) {
      const prev = this._splitIndex;
      this._splitIndex = index;
      // Fetch the name of the split we just landed on
      const splitName = (await this.send('getcurrentsplitname')) || '';
      if (phase === 'Running' && index > prev && prev !== -1) {
        this.onEvent({ type: 'split', splitIndex: index, splitName });
      } else {
        this.onEvent({ type: 'index', splitIndex: index, phase, splitName });
      }
    }
  }

  _startPolling() {
    this._splitIndex = -1;
    this._phase = 'NotRunning';
    this.pollInterval = setInterval(() => this._poll(), 200);
  }

  _stopPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    this.pendingResolvers = [];
  }

  // Fetch the currently active split { index, name } via a dedicated WS connection.
  // Returns { index, name } or { error: string }.
  fetchCurrentSplit() {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (result) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try { ws.onopen = ws.onmessage = ws.onerror = ws.onclose = null; ws.close(); } catch (_) {}
        resolve(result);
      };

      const timer = setTimeout(
        () => finish({ error: 'LiveSplit did not respond (timeout).' }),
        3000
      );

      let ws;
      try { ws = new WebSocket(this.url); }
      catch (e) { clearTimeout(timer); resolve({ error: 'Could not open WebSocket connection.' }); return; }

      let step = 0;
      let splitIndex = -1;

      ws.onopen = () => ws.send('getsplitindex');

      ws.onmessage = (e) => {
        const text = e.data.trim();
        if (step === 0) {
          splitIndex = parseInt(text, 10);
          if (isNaN(splitIndex) || splitIndex < 0) { finish({ error: `Invalid index: "${text}"` }); return; }
          step = 1;
          ws.send('getcurrentsplitname');
        } else {
          finish({ index: splitIndex, name: text || `Split ${splitIndex + 1}` });
        }
      };

      ws.onerror = () => finish({ error: 'WebSocket error.' });
      ws.onclose = () => finish({ error: 'Connection closed unexpectedly.' });
    });
  }

  disconnect() {
    this._disconnect();
  }
}
