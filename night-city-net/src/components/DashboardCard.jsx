// components/DashboardCard.jsx
import React from 'react';

const DashboardCard = ({ icon, label, value, trend, trendType, isStatus, statusType }) => {
    return (
        <div className="dashboard-card">
            <div className="card-icon">{icon}</div>
            <div className="card-content">
                <span className="card-label">{label}</span>
                {isStatus ? (
                    <span className={`card-value ${statusType}`}>{value}</span>
                ) : (
                    <span className="card-value">{value}</span>
                )}
            </div>
            {trend && (
                <div className={`card-trend ${trendType}`}>{trend}</div>
            )}
            {isStatus && (
                <div className={`connection-indicator ${statusType}`}></div>
            )}
        </div>
    );
};

export default DashboardCard;