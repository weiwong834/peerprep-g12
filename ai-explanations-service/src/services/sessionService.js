/**
 * Retrieves session details from the collaboration service.
 *
 * Returns:
 * - { ok: true, session } if successful
 * - { ok: false, status, error } if request fails
 *
 * @param {string} sessionId - Session ID
 * @param {string} authorization - Authorization header (Bearer token)
 * @returns {Object} Result object containing session data or error info
 */
export const fetchSessionById = async (sessionId, authorization) => {
  const response = await fetch(
    `${process.env.COLLAB_SERVICE_URL}/sessions/${sessionId}`,
    {
      method: "GET",
      headers: {
        Authorization: authorization,
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.ok) {
    const text = await response.text();
    return { ok: false, status: response.status, error: text };
  }

  const data = await response.json();
  return { ok: true, session: data };
};