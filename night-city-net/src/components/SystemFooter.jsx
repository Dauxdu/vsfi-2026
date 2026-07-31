// components/SystemFooter.jsx
import React from 'react';
import { OFFLINE_METADATA } from '../utils/constants';

const SystemFooter = ({ systemStatus = 'OFFLINE', metadata = OFFLINE_METADATA }) => {
    const { sysId, uplink, encryptLevel, latency } = metadata;
    const offline = systemStatus === 'OFFLINE' || !uplink;

    const footerItems = [
        { label: 'SYS_ID:', value: sysId },
        { label: 'UPLINK:', value: offline ? 'OFFLINE' : 'ACTIVE', isStatus: true, offline },
        { label: 'ENCRYPT:', value: encryptLevel },
        { label: 'LATENCY:', value: `${latency}ms` },
    ];

    return (
        <footer className="system-footer">
            <div className="footer-status-bar">
                {footerItems.map((item, index) => (
                    <React.Fragment key={item.label}>
                        {index > 0 && <div className="footer-divider">|</div>}
                        <div className="footer-item">
                            <span className="footer-label">{item.label}</span>
                            <span className={`footer-value ${item.isStatus ? (item.offline ? 'offline' : 'online') : ''}`}>
                {item.value}
              </span>
                        </div>
                    </React.Fragment>
                ))}
                <div className="footer-spacer"></div>
                <div className="footer-item">
                    <span className="footer-copyright">© 2026 NIGHT_CITY_NETWORK</span>
                </div>
            </div>
        </footer>
    );
};

export default SystemFooter;