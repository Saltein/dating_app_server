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

module.exports = router;
