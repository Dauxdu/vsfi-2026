// App.jsx
import React, { useState, useEffect } from 'react';
import './App.css';
import Header from './components/Header';
import TabNavigation from './components/TabNavigation';
import JobsDatabase from './components/JobsDatabase';
import SurveillanceModule from './components/SurveillanceModule';
import SystemFooter from './components/SystemFooter';
import { useSystemStatus } from './hooks/useSystemStatus';

const App = () => {
  const [activeTab, setActiveTab] = useState('jobs');
  const [currentTime, setCurrentTime] = useState(new Date());

  // Real backend probe: ONLINE only when /jobs/system-metadata responds,
  // OFFLINE (with fallback metadata) when the backend is missing.
  const { status: systemStatus, metadata } = useSystemStatus();

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
      <div className="cyberpunk-app">
        <div className="scanlines"></div>
        <div className="noise"></div>

        <Header
            currentTime={currentTime}
            systemStatus={systemStatus}
            metadata={metadata}
        />

        <TabNavigation activeTab={activeTab} setActiveTab={setActiveTab} />

        <main className="main-content">
          {activeTab === 'jobs' && <JobsDatabase />}
          {activeTab === 'surveillance' && <SurveillanceModule />}
        </main>

        <SystemFooter systemStatus={systemStatus} metadata={metadata} />
      </div>
  );
};

export default App;