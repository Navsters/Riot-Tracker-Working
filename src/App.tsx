import './App.css'

import { AppErrorBoundary } from './components/AppErrorBoundary'
import { ValorantDashboard } from './components/ValorantDashboard'

// TEST UPDATE: context marker to verify latest push.
export default function App() {
  return (
    <AppErrorBoundary>
      <div className="app-root">
        <ValorantDashboard />
      </div>
    </AppErrorBoundary>
  )
}
