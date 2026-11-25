import React from 'react';

export const PageLoader = ({ message = 'Loading...' }) => (
  <div className="state-card" role="status">
    <div className="state-spinner" aria-hidden="true" />
    <p>{message}</p>
  </div>
);

export const ErrorState = ({ message, onRetry }) => (
  <div className="state-card state-error" role="alert">
    <h3>Something went wrong</h3>
    <p>{message}</p>
    {onRetry ? (
      <button className="state-action-btn" onClick={onRetry}>
        Try again
      </button>
    ) : null}
  </div>
);

export const EmptyState = ({ title, message, action }) => (
  <div className="state-card">
    <h3>{title}</h3>
    <p>{message}</p>
    {action || null}
  </div>
);
