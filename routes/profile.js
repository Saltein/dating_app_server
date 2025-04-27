const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const authenticateToken = require('../middleware/authMiddleware');

router.get('/', authenticateToken, async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT ua.first_name, ua.last_name, up.birth_date, up.city
       FROM user_account ua
       JOIN user_profile up ON up.user_id = ua.id
       WHERE ua.id = $1`,
            [req.userId]
        );

        if (!rows.length) return res.sendStatus(404);
        res.json(rows[0]);
    } catch (err) {
        console.error(err);
        res.sendStatus(500);
    }
});

module.exports = router;
