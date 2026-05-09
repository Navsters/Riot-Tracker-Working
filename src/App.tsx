import './App.css'

import { AppErrorBoundary } from './components/AppErrorBoundary'
import { ValorantDashboard } from './components/ValorantDashboard'

export default function App() {
  return (
    <AppErrorBoundary>
      <div className="app-root">
        <ValorantDashboard />
      </div>
    </AppErrorBoundary>
  )
}
