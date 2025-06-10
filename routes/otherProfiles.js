const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const authenticateToken = require('../middleware/authMiddleware');

// Common SELECT fragment
const baseSelect = `
  SELECT
    ua.id,
    ua.first_name AS name,
    DATE_PART('year', AGE(CURRENT_DATE, up.birth_date)) AS age,
    up.description,
    COALESCE(json_agg(DISTINCT jsonb_build_object('id', i.id, 'title', i.name)) FILTER (WHERE i.id IS NOT NULL), '[]') AS interest,
    COALESCE(json_agg(DISTINCT jsonb_build_object('id', mo.id, 'title', mo.name)) FILTER (WHERE mo.id IS NOT NULL), '[]') AS music,
    COALESCE(json_agg(DISTINCT jsonb_build_object('id', go.id, 'title', go.name)) FILTER (WHERE go.id IS NOT NULL), '[]') AS games,
    (
      SELECT jsonb_build_object(
        'films', COALESCE(json_agg(DISTINCT um.title) FILTER (WHERE um.title IS NOT NULL), '[]'),
        'books', COALESCE(json_agg(DISTINCT ub.title) FILTER (WHERE ub.title IS NOT NULL), '[]')
      )
      FROM user_movie um
      FULL JOIN user_book ub ON ub.user_id = um.user_id
      WHERE (um.user_id = ua.id OR ub.user_id = ua.id)
    ) AS films_books,
    usm.marital_status_id AS marital_status,
    usa.smoking_attitude_id AS smoking_attitude,
    uaa.alcohol_attitude_id AS alcohol_attitude,
    upa.physical_activity_id AS physical_activity,
    uca.children_attitude_id AS children_attitude,
    uh.height_cm AS height,
    COALESCE(json_agg(DISTINCT uph.url) FILTER (WHERE uph.url IS NOT NULL), '[]') AS photo`;

/**
 * Fetch profiles based on a CTE, with optional ordering and extra grouping fields.
 * @param {string} cte SQL for the CTE, must alias columns appropriately
 * @param {Array} params Replacements for the CTE query
 * @param {Object} options
 * @param {string} [options.orderBy] SQL ORDER BY clause (without 'ORDER BY')
 * @param {string[]} [options.extraGroupFields] Additional fields to include in GROUP BY
 */
async function fetchProfiles(cte, params, options = {}) {
  const { orderBy, extraGroupFields = [] } = options;
  // Standard group by columns
  const groupCols = [
    'ua.id',
    'up.birth_date',
    'up.description',
    'usm.marital_status_id',
    'usa.smoking_attitude_id',
    'uaa.alcohol_attitude_id',
    'upa.physical_activity_id',
    'uca.children_attitude_id',
    'uh.height_cm',
    ...extraGroupFields
  ];

  const query = `
    WITH cte AS (${cte})
    ${baseSelect}
    FROM cte
    JOIN user_account ua ON ua.id = cte.id
    JOIN user_profile up ON ua.id = up.user_id
    LEFT JOIN user_interest ui ON ui.user_id = ua.id
    LEFT JOIN interest i ON i.id = ui.interest_id
    LEFT JOIN user_music umu ON umu.user_id = ua.id
    LEFT JOIN music_option mo ON mo.id = umu.music_option_id
    LEFT JOIN user_game ug ON ug.user_id = ua.id
    LEFT JOIN game_option go ON go.id = ug.game_option_id
    LEFT JOIN user_marital_status usm ON usm.user_id = ua.id
    LEFT JOIN user_smoking_attitude usa ON usa.user_id = ua.id
    LEFT JOIN user_alcohol_attitude uaa ON uaa.user_id = ua.id
    LEFT JOIN user_physical_activity upa ON upa.user_id = ua.id
    LEFT JOIN user_children_attitude uca ON uca.user_id = ua.id
    LEFT JOIN user_height uh ON uh.user_id = ua.id
    LEFT JOIN user_photo uph ON uph.user_id = ua.id AND uph.active = TRUE
    GROUP BY ${groupCols.join(', ')}
    ${orderBy ? `ORDER BY ${orderBy}` : ''}
  `;

  const { rows } = await pool.query(query, params);
  return rows;
}

// POST /other-profiles
router.post('/other-profiles', authenticateToken, async (req, res) => {
  const { viewerId, viewerGender } = req.body;
  console.log('viewerId, viewerGender', viewerId, viewerGender)
  if (!viewerId) {
    return res.status(400).json({ error: 'viewerId is required' });
  }
  if (!viewerGender) {
    return res.status(400).json({ error: 'viewerGender is required' });
  }

  const cte = `
    SELECT ua.id, up.interest_coefficient
    FROM user_account ua
    JOIN user_profile up ON ua.id = up.user_id
    WHERE ua.id <> $1
      AND up.gender <> $2                    -- только противоположный пол
      AND NOT EXISTS (
        SELECT 1 FROM views v
        WHERE v.viewer_id = $1
          AND v.viewed_id = ua.id
          AND v.viewed_at > NOW() - INTERVAL '7 days'
      )
    ORDER BY up.interest_coefficient DESC
    LIMIT 10
  `;

  try {
    const rows = await fetchProfiles(
      cte,
      [viewerId, viewerGender],             // передаём viewerGender как второй параметр
      {
        orderBy: 'cte.interest_coefficient DESC',
        extraGroupFields: ['cte.interest_coefficient']
      }
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /liked-by/:userId
router.get('/liked-by/:userId', authenticateToken, async (req, res) => {
  const { userId } = req.params;

  const cte = `
    SELECT from_user AS id
    FROM likes
    WHERE to_user = $1 AND type = 'like'
      AND NOT EXISTS (
        SELECT 1 FROM matches m
        WHERE (m.user1 = $1 AND m.user2 = from_user)
          OR (m.user1 = from_user AND m.user2 = $1)
      )
      AND NOT EXISTS (
        SELECT 1 FROM rejects r
        WHERE r.rejector_id = $1 AND r.rejected_id = from_user
      )
  `;

  try {
    const rows = await fetchProfiles(cte, [userId]);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /matches/:userId
router.get('/matches/:userId', authenticateToken, async (req, res) => {
  const { userId } = req.params;

  const query = `
    WITH cte AS (
      SELECT
        m.id         AS match_id,
        CASE
          WHEN m.user1 = $1 THEN m.user2
          ELSE m.user1
        END         AS user_id
      FROM matches m
      WHERE m.user1 = $1 OR m.user2 = $1
    )
    SELECT
      cte.match_id,
      jsonb_build_object(
        'id', ua.id,
        'name', ua.first_name,
        'age', DATE_PART('year', AGE(CURRENT_DATE, up.birth_date)),
        'description', up.description,
        'interest', COALESCE(
          json_agg(DISTINCT jsonb_build_object('id', i.id, 'title', i.name))
          FILTER (WHERE i.id IS NOT NULL), '[]'
        ),
        'music', COALESCE(
          json_agg(DISTINCT jsonb_build_object('id', mo.id, 'title', mo.name))
          FILTER (WHERE mo.id IS NOT NULL), '[]'
        ),
        'games', COALESCE(
          json_agg(DISTINCT jsonb_build_object('id', go.id, 'title', go.name))
          FILTER (WHERE go.id IS NOT NULL), '[]'
        ),
        'films_books', (
          SELECT jsonb_build_object(
            'films', COALESCE(json_agg(DISTINCT um.title) FILTER (WHERE um.title IS NOT NULL), '[]'),
            'books', COALESCE(json_agg(DISTINCT ub.title) FILTER (WHERE ub.title IS NOT NULL), '[]')
          )
          FROM user_movie um
          FULL JOIN user_book ub ON ub.user_id = um.user_id
          WHERE um.user_id = ua.id OR ub.user_id = ua.id
        ),
        'marital_status', usm.marital_status_id,
        'smoking_attitude', usa.smoking_attitude_id,
        'alcohol_attitude', uaa.alcohol_attitude_id,
        'physical_activity', upa.physical_activity_id,
        'children_attitude', uca.children_attitude_id,
        'height', uh.height_cm,
        'photo', COALESCE(
          json_agg(DISTINCT uph.url) FILTER (WHERE uph.url IS NOT NULL), '[]'
        )
      ) AS user
    FROM cte
    JOIN user_account ua    ON ua.id = cte.user_id
    JOIN user_profile up    ON up.user_id = ua.id
    LEFT JOIN user_interest ui       ON ui.user_id = ua.id
    LEFT JOIN interest i             ON i.id = ui.interest_id
    LEFT JOIN user_music umu         ON umu.user_id = ua.id
    LEFT JOIN music_option mo        ON mo.id = umu.music_option_id
    LEFT JOIN user_game ug           ON ug.user_id = ua.id
    LEFT JOIN game_option go         ON go.id = ug.game_option_id
    LEFT JOIN user_marital_status usm     ON usm.user_id = ua.id
    LEFT JOIN user_smoking_attitude usa   ON usa.user_id = ua.id
    LEFT JOIN user_alcohol_attitude uaa   ON uaa.user_id = ua.id
    LEFT JOIN user_physical_activity upa  ON upa.user_id = ua.id
    LEFT JOIN user_children_attitude uca ON uca.user_id = ua.id
    LEFT JOIN user_height uh              ON uh.user_id = ua.id
    LEFT JOIN user_photo uph              
      ON uph.user_id = ua.id AND uph.active = TRUE
    GROUP BY cte.match_id, ua.id, up.birth_date, up.description,
             usm.marital_status_id, usa.smoking_attitude_id,
             uaa.alcohol_attitude_id, upa.physical_activity_id,
             uca.children_attitude_id, uh.height_cm;
  `;

  try {
    const { rows } = await pool.query(query, [userId]);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching matches:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
module.exports = router;
