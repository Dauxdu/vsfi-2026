// components/TabNavigation.jsx
import React from 'react';

const TabNavigation = ({ activeTab, setActiveTab }) => {
    const tabs = [
        {
            id: 'jobs',
            number: '01',
            icon: '',
            label: 'NightCity Jobs Database',
        },
        {
            id: 'surveillance',
            number: '02',
            icon: '',
            label: 'Corpo Surveillance Module',
        },
    ];

    return (
        <nav className="tab-navigation">
            {tabs.map(tab => (
                <button
                    key={tab.id}
                    className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
                    onClick={() => setActiveTab(tab.id)}
                >
                    <span className="tab-number">{tab.number}</span>
                    <span className="tab-icon">{tab.icon}</span>
                    <span className="tab-label">{tab.label}</span>
                    <span className="tab-indicator"></span>
                </button>
            ))}
            <div className="tab-divider"></div>
        </nav>
    );
};

export default TabNavigation;