// components/Header.jsx
import React from 'react';

const Header = ({currentTime, systemStatus, metadata}) => {
    const securityLevel = metadata?.securityLevel ?? 0;

    return (
        <header className="cyberpunk-header">
            <div className="header-top">
                <div className="logo">
                    <span className="logo-brackets">[</span>
                    <span className="logo-text">NIGHT_CITY_NET</span>
                    <span className="logo-brackets">]</span>
                </div>

                <div className="header-status">
                    <div className="status-item">
                        <span className={`status-dot ${systemStatus === 'ONLINE' ? 'online' : 'offline'}`}></span>
                        <span className="status-label">SYS.{systemStatus}</span>
                    </div>
                    <div className="status-divider">|</div>
                    <div className="status-item">
                        <span className="status-label">SEC://</span>
                        <span className="status-value">LVL_{securityLevel}</span>
                    </div>
                </div>
            </div>

            <div className="header-bottom">
                <div className="time-display">
                    <span className="time-prefix">{'<TIME_STAMP>'}</span>
                    <span className="time-value">
            {currentTime.toLocaleTimeString('en-US', {
                hour12: false,
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
            })}
          </span>
                    <span className="time-suffix">{'</TIME_STAMP>'}</span>
                </div>
            </div>
        </header>
    );
};

export default Header;