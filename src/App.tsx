import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import ScorecardScreen from './screens/ScorecardScreen'
import { CropDataProvider } from './state/CropDataContext'
import { ViewProvider } from './state/ViewContext'
import { WorkspaceProvider } from './workspace/WorkspaceContext'

// The screens with charts load on demand, so the first screen (the Scorecard) opens quickly on a phone.
const CultivationScreen = lazy(() => import('./screens/CultivationScreen'))
const FacilitiesScreen = lazy(() => import('./screens/FacilitiesScreen'))
const DataChecksScreen = lazy(() => import('./screens/DataChecksScreen'))
const MoreScreen = lazy(() => import('./screens/MoreScreen'))
const SetupScreen = lazy(() => import('./screens/SetupScreen'))
const FruitTypesScreen = lazy(() => import('./screens/FruitTypesScreen'))
const EditLogScreen = lazy(() => import('./screens/EditLogScreen'))
const AboutScreen = lazy(() => import('./screens/AboutScreen'))
const SignInScreen = lazy(() => import('./screens/SignInScreen'))

export default function App() {
  return (
    <WorkspaceProvider>
    <CropDataProvider>
      <ViewProvider>
        <AppShell>
          <Suspense fallback={<p role="status" className="p-6 text-center text-ink-2">Loading…</p>}>
            <Routes>
              <Route path="/" element={<ScorecardScreen />} />
              <Route path="/cultivation/:id" element={<CultivationScreen />} />
              <Route path="/facilities" element={<FacilitiesScreen />} />
              <Route path="/checks" element={<DataChecksScreen />} />
              <Route path="/more" element={<MoreScreen />} />
              <Route path="/setup" element={<SetupScreen />} />
              <Route path="/fruit-types" element={<FruitTypesScreen />} />
              <Route path="/edits" element={<EditLogScreen />} />
              <Route path="/about" element={<AboutScreen />} />
              <Route path="/sign-in" element={<SignInScreen />} />
              <Route path="*" element={<ScorecardScreen />} />
            </Routes>
          </Suspense>
        </AppShell>
      </ViewProvider>
    </CropDataProvider>
    </WorkspaceProvider>
  )
}
