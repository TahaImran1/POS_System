import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './style.css'
import '@fortawesome/fontawesome-free/css/all.min.css'
import App from './App.vue'

// Unregister stale service workers to prevent cached dist bundle locks in Electron/Browser
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      registration.unregister()
    }
  })
}

const app = createApp(App)

app.use(createPinia())

app.mount('#app')
