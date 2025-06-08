const pool = require('../config/db')

async function getChatIdByMatchId(matchId) {
    const res = await pool.query(
        'SELECT id FROM chat WHERE match_id = $1',
        [matchId]
    );
    return res.rows[0]?.id || null;
}

async function getMessagesFromDB(matchId) {
    const chatId = await getChatIdByMatchId(matchId);
    if (!chatId) return [];

    const res = await pool.query(
        `SELECT id, chat_id, match_id, sender_id, content, sent_at
     FROM message
     WHERE chat_id = $1
     ORDER BY sent_at ASC`,
        [chatId]
    );
    return res.rows;
}

async function saveMessageToDB(matchId, senderId, content) {
    const chatId = await getChatIdByMatchId(matchId);
    if (!chatId) return null;

    const res = await pool.query(
        `INSERT INTO message (chat_id, match_id, sender_id, content)
         VALUES ($1, $2, $3, $4)
         RETURNING id, chat_id, match_id, sender_id, content, sent_at`,
        [chatId, matchId, senderId, content]
    );
    return res.rows[0];
}

module.exports = {
    getMessagesFromDB,
    saveMessageToDB
};
