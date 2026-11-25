export const formatSeconds = (seconds) => {
  const totalSeconds = Math.max(0, Math.round(Number(seconds) || 0));
  const hours = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }

  return `${mins}m ${secs}s`;
};

export const getScoreMessage = (score) => {
  if (score >= 80) return 'Excellent posture. Keep it up.';
  if (score >= 60) return 'Good progress. Keep an eye on your form.';
  return 'Focus on posture corrections during your next session.';
};
