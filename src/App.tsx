import React, { useState } from 'react';
import { useSecurityStore } from './store/useSecurityStore';
import { LoginSecurity } from './views/LoginSecurity';
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';
import { MobileBottomNav, SecurityTab } from './components/layout/MobileBottomNav';
import { CheckInView } from './views/CheckInView';
import { CheckOutView } from './views/CheckOutView';
import { MemoKeluarView } from './views/MemoKeluarView';

export const App: React.FC = () => {
  const { isAuthenticated } = useSecurityStore();
  const [activeTab, setActiveTab] = useState<SecurityTab>('check-in');

  if (!isAuthenticated) {
    return <LoginSecurity />;
  }

  const renderActiveView = () => {
    switch (activeTab) {
      case 'check-out':
        return <CheckOutView />;
      case 'memo-keluar':
        return <MemoKeluarView />;
      case 'check-in':
      default:
        return <CheckInView />;
    }
  };

  return (
    <div className="app-layout min-h-screen bg-[#EEF2F7] flex flex-col font-sans text-[#0F172A] pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] lg:pb-0">
      {/* Top Navbar Header (Theme Web Fleet) */}
      <Navbar activeTab={activeTab} onChangeTab={setActiveTab} />

      <div className="flex flex-1 w-full overflow-hidden">
        {/* Desktop Sidebar (Theme Web Fleet, Layar >= 1024px) */}
        <Sidebar activeTab={activeTab} onChangeTab={setActiveTab} />

        {/* Main Content Dashboard Area */}
        <main className="dashboard-page flex-1 overflow-y-auto max-h-[calc(100vh-64px)] bg-[#EEF2F7]">
          <div className="max-w-[1400px] mx-auto px-4 py-4 sm:px-6 sm:py-5 lg:px-8 lg:py-6">
            <div key={activeTab} className="app-page-transition w-full">
              {renderActiveView()}
            </div>
          </div>
        </main>
      </div>

      {/* Floating Bottom Nav for Mobile & Tablet Viewport (< 1024px) */}
      <MobileBottomNav activeTab={activeTab} onChangeTab={setActiveTab} />
    </div>
  );
};

export default App;
