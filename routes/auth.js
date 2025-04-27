const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// POST /auth/register
router.post('/register', async (req, res) => {
    const { first_name, last_name, email, password, passwordCheck, city, dateOfBirth } = req.body;

    if (!first_name || !email || !password || !passwordCheck) {
        return res.status(400).json({ error: 'Не все поля заполнены' });
    }
    if (password !== passwordCheck) {
        return res.status(400).json({ error: 'Пароли не совпадают' });
    }

    try {
        const { rowCount } = await pool.query('SELECT 1 FROM user_account WHERE email = $1', [email]);
        if (rowCount) {
            return res.status(409).json({ error: 'Email уже занят' });
        }

        const password_hash = await bcrypt.hash(password, 10);

        const result = await pool.query(
            `INSERT INTO user_account (first_name, last_name, email, password_hash)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
            [first_name, last_name || null, email, password_hash]
        );
        const userId = result.rows[0].id;

        await pool.query(
            `INSERT INTO user_profile (user_id, birth_date, city)
       VALUES ($1, $2, $3)`,
            [userId, dateOfBirth || null, city || null]
        );

        res.status(201).json({ message: 'Регистрация успешна' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// POST /auth/login
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email и пароль обязательны' });
    }

    try {
        const { rows, rowCount } = await pool.query(
            'SELECT id, password_hash FROM user_account WHERE email = $1',
            [email]
        );
        if (!rowCount) {
            return res.status(401).json({ error: 'Неверный email или пароль' });
        }

        const { id, password_hash } = rows[0];
        const isMatch = await bcrypt.compare(password, password_hash);
        if (!isMatch) {
            return res.status(401).json({ error: 'Неверный email или пароль' });
        }

        const token = jwt.sign({ userId: id }, process.env.JWT_SECRET, {
            expiresIn: process.env.JWT_EXPIRES_IN,
        });

        res.json({ token });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

module.exports = router;
