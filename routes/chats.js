const express = require('express')
const router = express.Router()
const pool = require('../config/db')
const authenticateToken = require('../middleware/authMiddleware')

/**
 * GET /chats/:match_id/messages
 * Retrieves all messages for a chat associated with a given match_id
 * Response: [{ id, chat_id, sender_id, content, sent_at }, ...]
 */
router.get('/:match_id/messages', authenticateToken, async (req, res) => {
    const { match_id } = req.params;

    try {
        // Find the chat corresponding to the given match_id
        const chatResult = await pool.query(
            'SELECT id FROM chat WHERE match_id = $1',
            [match_id]
        );

        if (chatResult.rowCount === 0) {
            return res.status(404).json({ error: 'Chat not found for this match_id' });
        }

        const chatId = chatResult.rows[0].id;

        // Retrieve all messages for this chat
        const messagesResult = await pool.query(
            `SELECT id, chat_id, sender_id, content, sent_at
       FROM message
       WHERE chat_id = $1
       ORDER BY sent_at ASC`,
            [chatId]
        );

        return res.json(messagesResult.rows);
    } catch (err) {
        console.error('Error fetching messages:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /chats/:match_id/messages
 * Добавляет сообщение в чат по match_id
 * Body: { content: string }
 */
router.post('/:match_id/messages', authenticateToken, async (req, res) => {
    const { match_id } = req.params;
    const { content } = req.body;
    const sender_id = req.user.id;

    if (!content || content.trim() === '') {
        return res.status(400).json({ error: 'Content cannot be empty' });
    }

    try {
        // Получаем chat_id по match_id
        const chatResult = await pool.query(
            'SELECT id FROM chat WHERE match_id = $1',
            [match_id]
        );

        if (chatResult.rowCount === 0) {
            return res.status(404).json({ error: 'Chat not found for this match_id' });
        }

        const chat_id = chatResult.rows[0].id;

        // Вставляем новое сообщение
        const insertResult = await pool.query(
            `INSERT INTO message (chat_id, sender_id, content)
       VALUES ($1, $2, $3)
       RETURNING id, chat_id, sender_id, content, sent_at`,
            [chat_id, sender_id, content]
        );

        return res.status(201).json(insertResult.rows[0]);
    } catch (err) {
        console.error('Error inserting message:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
