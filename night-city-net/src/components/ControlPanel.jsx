// components/ControlPanel.jsx
import React from 'react';

const ControlPanel = ({ connectionStatus }) => {
    const isLive = connectionStatus === 'connected';

    return (
        <div className="control-panel">
            <div className="panel-left">
                <h2 className="panel-title">
                    <span className="title-bracket">[</span>
                    ACTIVE_JOB_FEED
                    <span className="title-bracket">]</span>
                </h2>
                <div className="stream-indicator">
                    <span className={`stream-dot ${isLive ? 'active' : ''}`}></span>
                    {isLive ? 'LIVE_FEED' : 'FEED_OFFLINE'}
                </div>
            </div>
        </div>
    );
};

export default ControlPanel;
