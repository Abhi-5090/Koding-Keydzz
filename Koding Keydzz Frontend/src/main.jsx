import React from 'react'
import ReactDOM from 'react-dom/client'
import registerServiceWorker from './registerServiceWorker'
import { Provider } from 'react-redux'
import { store } from './app/store'
import App from './App'
import './index.css'

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
      <App />
    </Provider>
  </React.StrictMode>
)
