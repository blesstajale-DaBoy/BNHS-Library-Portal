import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

const silenceViteHmrWebsocketErrorPlugin = () => ({
  name: 'silence-vite-hmr-ws-error',
  transformIndexHtml: {
    order: 'pre' as const,
    handler() {
      return [
        {
          tag: 'script',
          injectTo: 'head-prepend' as const,
          children: `
(function () {
  if (typeof window === 'undefined' || !window.WebSocket) return;
  var NativeWebSocket = window.WebSocket;
  function SafeWebSocket(url, protocols) {
    var protoStr = Array.isArray(protocols) ? protocols.join(',') : String(protocols || '');
    var urlStr = String(url || '');
    if (protoStr.indexOf('vite') !== -1 || urlStr.indexOf('token=') !== -1) {
      var target = new EventTarget();
      target.url = urlStr;
      target.protocol = protoStr;
      target.readyState = 1;
      target.bufferedAmount = 0;
      target.extensions = '';
      target.binaryType = 'blob';
      target.send = function () {};
      target.close = function () { target.readyState = 3; };
      setTimeout(function () {
        var openEvt = new Event('open');
        if (typeof target.onopen === 'function') target.onopen(openEvt);
        target.dispatchEvent(openEvt);
      }, 0);
      return target;
    }
    return protocols !== undefined
      ? new NativeWebSocket(url, protocols)
      : new NativeWebSocket(url);
  }
  SafeWebSocket.prototype = NativeWebSocket.prototype;
  SafeWebSocket.CONNECTING = NativeWebSocket.CONNECTING;
  SafeWebSocket.OPEN = NativeWebSocket.OPEN;
  SafeWebSocket.CLOSING = NativeWebSocket.CLOSING;
  SafeWebSocket.CLOSED = NativeWebSocket.CLOSED;
  window.WebSocket = SafeWebSocket;
})();
          `.trim(),
        },
      ];
    },
  },
});

export default defineConfig(() => {
  return {
    plugins: [silenceViteHmrWebsocketErrorPlugin(), react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
