const express = require('express')
const router = express.Router()
const pool = require('../config/db')
const authenticateToken = require('../middleware/authMiddleware')

// Common helper: record a view
async function recordView(viewerId, viewedId) {
    // Insert view
    await pool.query(
        `INSERT INTO views(viewer_id, viewed_id)
         VALUES($1, $2)
         ON CONFLICT DO NOTHING`,
        [viewerId, viewedId]
    )

    // If newly inserted, increment counter
    const { rowCount } = await pool.query(
        `SELECT 1 FROM views WHERE viewer_id = $1 AND viewed_id = $2`,
        [viewerId, viewedId]
    )
    if (rowCount === 1) {
        await pool.query(
            `UPDATE user_profile SET views_received = views_received + 1 WHERE user_id = $1`,
            [viewedId]
        )
    }
}

// Helper: create match if mutual interaction exists, and create a chat
async function createMatchAndChatIfMutual(userA, userB, type) {
    // Check for existing reverse like/superlike
    const { rowCount } = await pool.query(
        `SELECT 1 FROM likes WHERE from_user = $1 AND to_user = $2 AND type = $3`,
        [userB, userA, type]
    )
    if (rowCount > 0) {
        // Determine ordering for match
        const [u1, u2] = userA < userB ? [userA, userB] : [userB, userA]
        // Insert into matches
        const matchResult = await pool.query(
            `INSERT INTO matches(user1, user2)
             VALUES($1, $2)
             ON CONFLICT DO NOTHING
             RETURNING id`,
            [u1, u2]
        )
        const matchId = matchResult.rows[0]?.id
        if (matchId) {
            // Create associated chat
            await pool.query(
                `INSERT INTO chat(match_id) VALUES($1)
                 ON CONFLICT DO NOTHING`,
                [matchId]
            )
        }
        return true
    }
    return false
}

// POST /interact/skip
router.post('/interact/skip', authenticateToken, async (req, res) => {
    const { viewerId, viewedId } = req.body
    if (!viewerId || !viewedId) return res.status(400).json({ error: 'viewerId and viewedId required' })
    try {
        await recordView(viewerId, viewedId)
        res.json({ success: true, action: 'skipped' })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Internal server error' })
    }
})

// POST /interact/like
router.post('/interact/like', authenticateToken, async (req, res) => {
    const { viewerId, viewedId } = req.body
    if (!viewerId || !viewedId) return res.status(400).json({ error: 'viewerId and viewedId required' })
    try {
        await pool.query(
            `INSERT INTO likes(from_user, to_user, type) VALUES($1, $2, 'like')`,
            [viewerId, viewedId]
        )
        await pool.query(
            `UPDATE user_profile SET likes_received = likes_received + 1 WHERE user_id = $1`,
            [viewedId]
        )
        await recordView(viewerId, viewedId)

        const match = await createMatchAndChatIfMutual(viewerId, viewedId, 'like')
        res.json({ success: true, action: 'liked', match })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Internal server error' })
    }
})

// POST /interact/superlike
router.post('/interact/superlike', authenticateToken, async (req, res) => {
    const { viewerId, viewedId } = req.body
    if (!viewerId || !viewedId) return res.status(400).json({ error: 'viewerId and viewedId required' })
    try {
        await pool.query(
            `INSERT INTO likes(from_user, to_user, type) VALUES($1, $2, 'superlike')`,
            [viewerId, viewedId]
        )
        await pool.query(
            `UPDATE subscriptions SET superlikes_limit = superlikes_limit - 1 WHERE user_id = $1 AND superlikes_limit > 0`,
            [viewerId]
        )
        await pool.query(
            `UPDATE user_profile SET superlikes_received = superlikes_received + 1 WHERE user_id = $1`,
            [viewedId]
        )
        await recordView(viewerId, viewedId)

        const match = await createMatchAndChatIfMutual(viewerId, viewedId, 'superlike')
        res.json({ success: true, action: 'superliked', match })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Internal server error' })
    }
})

router.post('/interact/reject', authenticateToken, async (req, res) => {
    const { rejector_id, rejected_id } = req.body;

    if (!rejector_id || !rejected_id) {
        return res.status(400).json({ error: 'rejector_id и rejected_id обязательны' });
    }

    if (rejector_id === rejected_id) {
        return res.status(400).json({ error: 'rejector_id и rejected_id не могут быть одинаковыми' });
    }

    try {
        const query = `
      INSERT INTO rejects (rejector_id, rejected_id, rejected_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT DO NOTHING
      RETURNING *;
    `;
        const result = await pool.query(query, [rejector_id, rejected_id]);

        if (result.rows.length === 0) {
            return res.status(409).json({ message: 'Запись уже существует' });
        }

        res.status(201).json({ message: 'Запись добавлена', data: result.rows[0] });
    } catch (error) {
        console.error('Ошибка при добавлении в rejects:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
})

// DELETE /interact/clear-views/:userId
router.delete('/interact/clear-views/:userId', authenticateToken, async (req, res) => {
    const { userId } = req.params
    try {
        await pool.query(`DELETE FROM views WHERE viewer_id = $1`, [userId])
        res.json({ success: true, action: 'cleared_views' })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Internal server error' })
    }
})

module.exports = router
