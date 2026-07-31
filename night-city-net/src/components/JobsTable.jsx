// components/JobsTable.jsx
import React from 'react';
import { getRiskColor, getStatusClass } from '../utils/helpers';

const JobsTable = ({ jobs, onAcceptJob, onViewJob }) => {
    return (
        <div className="jobs-table-container">
            <table className="jobs-table">
                <thead>
                <tr>
                    <th>JOB ID</th>
                    <th>TITLE</th>
                    <th>CLIENT</th>
                    <th>PAY (₡)</th>
                    <th>RISK LEVEL</th>
                    <th>LOCATION</th>
                    <th>STATUS</th>
                    <th>TIMESTAMP</th>
                    <th>ACTION</th>
                </tr>
                </thead>
                <tbody>
                {jobs.map((job, index) => (
                    <tr
                        key={job.id}
                        className="job-row"
                        style={{ animationDelay: `${index * 0.1}s` }}
                    >
                        <td className="job-id">{job.id}</td>
                        <td className="job-title">{job.title}</td>
                        <td>{job.client}</td>
                        <td className="job-pay">₡{job.pay.toLocaleString()}</td>
                        <td>
                <span
                    className="risk-badge"
                    style={{
                        borderColor: getRiskColor(job.risk),
                        color: getRiskColor(job.risk),
                    }}
                >
                  {job.risk}
                </span>
                        </td>
                        <td>{job.location}</td>
                        <td>
                <span className={`status-badge ${getStatusClass(job.status)}`}>
                  {job.status}
                </span>
                        </td>
                        <td className="timestamp">{job.time}</td>
                        <td>
                            <div className="action-buttons">
                                <button
                                    className="action-btn accept"
                                    disabled={job.status === 'COMPLETED' || job.status === 'FAILED'}
                                    onClick={() => onAcceptJob(job.id)}
                                >
                                    ACCEPT
                                </button>
                                <button
                                    className="action-btn view"
                                    onClick={() => onViewJob(job.id)}
                                >
                                    VIEW
                                </button>
                            </div>
                        </td>
                    </tr>
                ))}
                </tbody>
            </table>

            {jobs.length === 0 && (
                <div className="empty-state">
                    <div className="empty-icon">📭</div>
                    <p className="empty-text">NO_ACTIVE_JOBS_FOUND</p>
                    <p className="empty-subtext">Awaiting live feed or connection lost</p>
                </div>
            )}
        </div>
    );
};

export default JobsTable;