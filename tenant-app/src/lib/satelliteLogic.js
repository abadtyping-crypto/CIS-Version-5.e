/**
 * Master Satellite Intelligence - Client Usage Scoring logic.
 */

export const computeUsageScore = (client) => {
  const recencyWeight = client.lastAccessed ? client.lastAccessed.toMillis ? client.lastAccessed.toMillis() : new Date(client.lastAccessed).getTime() : 0;
  
  // Normalize recency (using current timestamp as reference)
  const now = Date.now();
  const diffHours = (now - recencyWeight) / (1000 * 60 * 60);
  const normalizedRecency = Math.exp(-diffHours / 168); // Decay over 1 week

  const frequencyWeight = Number(client.hitCount || 0);
  // Normalize frequency using logarithmic scaling
  const normalizedFrequency = Math.log1p(frequencyWeight) / Math.log1p(100);

  return (normalizedRecency * 0.7) + (normalizedFrequency * 0.3);
};
