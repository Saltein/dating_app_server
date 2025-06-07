const express = require('express')
const router = express.Router()
const pool = require('../config/db')
const authenticateToken = require('../middleware/authMiddleware')

// Helper to calculate age in SQL
// GET 10 profiles sorted by interest_coefficient
router.post('/other-profiles', authenticateToken, async (req, res) => {
    const viewerId = req.body.viewerId;
    if (!viewerId) {
        return res.status(400).json({ error: 'viewerId is required' });
    }

    try {
        const query = `
      WITH filtered_users AS (
        SELECT ua.id
        FROM user_account ua
        WHERE ua.id <> $1
          AND NOT EXISTS (
            SELECT 1 FROM views v
            WHERE v.viewer_id = $1
              AND v.viewed_id = ua.id
              AND v.viewed_at > NOW() - INTERVAL '7 days'
          )
      ), top_users AS (
        SELECT fu.id, up.interest_coefficient
        FROM filtered_users fu
        JOIN user_profile up ON fu.id = up.user_id
        ORDER BY up.interest_coefficient DESC
        LIMIT 10
      )
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
          WHERE um.user_id = ua.id OR ub.user_id = ua.id
        ) AS films_books,
        usm.marital_status_id AS marital_status,
        usa.smoking_attitude_id AS smoking_attitude,
        uaa.alcohol_attitude_id AS alcohol_attitude,
        upa.physical_activity_id AS physical_activity,
        uca.children_attitude_id AS children_attitude,
        uh.height_cm AS height,
        COALESCE(json_agg(DISTINCT uph.url) FILTER (WHERE uph.url IS NOT NULL), '[]') AS photo
      FROM top_users tu
      JOIN user_account ua ON ua.id = tu.id
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
      GROUP BY ua.id, up.birth_date, up.description,
        usm.marital_status_id, usa.smoking_attitude_id,
        uaa.alcohol_attitude_id, upa.physical_activity_id,
        uca.children_attitude_id, uh.height_cm, tu.interest_coefficient
      ORDER BY tu.interest_coefficient DESC;
    `;

        const { rows } = await pool.query(query, [viewerId]);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/liked-by/:userId', authenticateToken, async (req, res) => {
    const { userId } = req.params;
    try {
        const query = `
      WITH likers AS (
        SELECT from_user AS id
        FROM likes
        WHERE to_user = $1 AND type = 'like'
      )
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
          WHERE um.user_id = ua.id OR ub.user_id = ua.id
        ) AS films_books,
        usm.marital_status_id AS marital_status,
        usa.smoking_attitude_id AS smoking_attitude,
        uaa.alcohol_attitude_id AS alcohol_attitude,
        upa.physical_activity_id AS physical_activity,
        uca.children_attitude_id AS children_attitude,
        uh.height_cm AS height,
        COALESCE(json_agg(DISTINCT uph.url) FILTER (WHERE uph.url IS NOT NULL), '[]') AS photo
      FROM likers l
      JOIN user_account ua ON ua.id = l.id
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
      WHERE NOT EXISTS (
        SELECT 1 FROM matches m
        WHERE (m.user1 = $1 AND m.user2 = ua.id)
           OR (m.user1 = ua.id AND m.user2 = $1)
      )
      AND NOT EXISTS (
        SELECT 1 FROM rejects r
        WHERE r.rejector_id = $1 AND r.rejected_id = ua.id
      )
      GROUP BY ua.id, up.birth_date, up.description,
        usm.marital_status_id, usa.smoking_attitude_id,
        uaa.alcohol_attitude_id, upa.physical_activity_id,
        uca.children_attitude_id, uh.height_cm;
    `;
        const { rows } = await pool.query(query, [userId]);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});


module.exports = router;