import React, { lazy, Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter, Routes, Route } from 'react-router-dom'
import App from './App.jsx'
import './index.css'

const AdminApp = lazy(() => import('./admin/AdminApp.jsx'))
const LoginView = lazy(() => import('./admin/LoginView.jsx'))
const ResumePayPage = lazy(() => import('./ResumePayPage.jsx'))

function RouteFallback() {
  return (
    <div style={{ padding: '40vh 0', textAlign: 'center', color: '#5f6368' }}>
      Loading...
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/pay/:ref" element={<ResumePayPage />} />
          <Route path="/admin/login" element={<LoginView />} />
          <Route path="/admin/*" element={<AdminApp />} />
        </Routes>
      </Suspense>
    </HashRouter>
  </React.StrictMode>
)
