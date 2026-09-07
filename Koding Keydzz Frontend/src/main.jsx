import React from 'react'
import ReactDOM from 'react-dom/client'
import registerServiceWorker from './registerServiceWorker'
import { Provider } from 'react-redux'
import { store } from './app/store'
import App from './App'
import { ToastProvider } from './components/ui/toast/ToastProvider'
import { preloadGsap } from './motion/gsapCore'
import './index.css'

/**
 * Fetch the animation engine during the browser's idle time, right after the
 * app boots.
 *
 * It is imported lazily so it stays out of the initial bundle, which is right
 * — but that meant the FIRST screen to reveal anything paid for the download
 * before it could animate, and the dashboard immediately after sign-in is
 * always that screen. `preloadGsap` waits for an idle moment (or 1.2s), so by
 * the time a page wants it, it is there. It no-ops under reduced motion, since
 * nothing will ask for it.
 */
preloadGsap()

/**
 * Offline support, registered after first paint.
 *
 * The worker caches the app shell and the big self-hosted runtimes so a dropped
 * school connection does not blank the page. It NEVER caches /api — this app
 * examines children, and a stale answer sheet or another pupil's data served
 * from a cache would be far worse than an honest offline error. See public/sw.js.
 */
registerServiceWorker()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Provider store={store}>
      {/* Inside the store provider so the error middleware's dispatcher exists
          before the first request can fail. */}
      <ToastProvider>
        <App />
      </ToastProvider>
    </Provider>
  </React.StrictMode>
)
