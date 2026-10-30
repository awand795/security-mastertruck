import React, { useEffect, useState } from 'react';
import { useSecurityStore } from './store/useSecurityStore';
import { applyTheme, useThemeStore } from './store/useThemeStore';
import { LoginSecurity } from './views/LoginSecurity';
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';
import { SecurityTab } from './components/layout/MobileBottomNav';
import { BottomChrome, BottomChromeProvider } from './components/layout/BottomChrome';
import { CheckInView } from './views/CheckInView';
import { CheckOutView } from './views/CheckOutView';
import { ActiveInsideView } from './views/ActiveInsideView';
import { TodayExitView } from './views/TodayExitView';

export const App: React.FC = () => {
  const { isAuthenticated } = useSecurityStore();
  const [activeTab, setActiveTab] = useState<SecurityTab>('check-in');
  const [checkoutPlate, setCheckoutPlate] = useState<string | null>(null);

  // Sinkronkan tema saat mount + ikuti perubahan preferensi OS (mode "Otomatis")
  useEffect(() => {
    applyTheme();

    if (!window.matchMedia) return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (useThemeStore.getState().mode === 'system') applyTheme('system');
    };
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, []);

  if (!isAuthenticated) {
    return <LoginSecurity />;
  }

  const handleNavigateToCheckout = (plate: string) => {
    setCheckoutPlate(plate);
    setActiveTab('check-out');
  };

  const renderActiveView = () => {
    switch (activeTab) {
      case 'check-out':
        return (
          <CheckOutView
            initialPlate={checkoutPlate || undefined}
            onClearInitialPlate={() => setCheckoutPlate(null)}
          />
        );
      case 'active-inside':
        return <ActiveInsideView onNavigateToCheckout={handleNavigateToCheckout} />;
      case 'today-exit':
        return <TodayExitView />;
      case 'check-in':
      default:
        return <CheckInView />;
    }
  };

  return (
    <BottomChromeProvider>
      <div className="app-layout flex h-[100dvh] flex-col bg-surface font-sans text-ink">
        {/* Top Header (mobile & desktop) */}
        <Navbar activeTab={activeTab} onChangeTab={setActiveTab} />

        <div className="flex min-h-0 w-full flex-1">
          {/* Sidebar: desktop >= xl */}
          <Sidebar activeTab={activeTab} onChangeTab={setActiveTab} />

          {/* Area scroll utama */}
          <main className="dashboard-page min-h-0 flex-1 overflow-y-auto overscroll-contain bg-surface">
            <div className="mx-auto w-full max-w-3xl px-4 pb-[calc(var(--bottom-chrome-h,7.5rem)+1rem)] pt-4 sm:px-6 md:max-w-4xl xl:max-w-[1400px] xl:px-8 xl:pb-10 xl:pt-6">
              <div key={activeTab} className="app-page-transition w-full">
                {renderActiveView()}
              </div>
            </div>
          </main>
        </div>

        {/* Bottom chrome: tab bar + slot aksi (mobile & tablet, < 1280px) */}
        <BottomChrome activeTab={activeTab} onChangeTab={setActiveTab} />
      </div>
    </BottomChromeProvider>
  );
};

export default App;
