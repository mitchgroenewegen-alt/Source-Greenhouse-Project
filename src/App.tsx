import { Route, Routes } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import CultivationScreen from './screens/CultivationScreen'
import FacilitiesScreen from './screens/FacilitiesScreen'
import ScorecardScreen from './screens/ScorecardScreen'
import { CropDataProvider } from './state/CropDataContext'
import { ViewProvider } from './state/ViewContext'

export default function App() {
  return (
    <CropDataProvider>
      <ViewProvider>
        <AppShell>
          <Routes>
            <Route path="/" element={<ScorecardScreen />} />
            <Route path="/facilities" element={<FacilitiesScreen />} />
            <Route path="/cultivation/:id" element={<CultivationScreen />} />
            <Route path="*" element={<ScorecardScreen />} />
          </Routes>
        </AppShell>
      </ViewProvider>
    </CropDataProvider>
  )
}
