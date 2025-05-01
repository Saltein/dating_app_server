const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const transporter = require('../config/mailer');

// Функция генерации 6-значного кода
function generateCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// POST /auth/send-code
router.post('/send-code', async (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ error: 'Email обязателен' });
    }

    try {
        const code = generateCode();

        await pool.query(
            `INSERT INTO confirmation_code (email, code, sent_at)
             VALUES ($1, $2, NOW())`,
            [email, code]
        );

        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Ваш код подтверждения',
            text: `Ваш код подтверждения: ${code}`,
        });

        res.json({ message: 'Код отправлен на почту' });
        console.log('code ', code);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка отправки кода' });
    }
});

// POST /auth/verify-code
router.post('/verify-code', async (req, res) => {
    const { email, code } = req.body;
    if (!email || !code) {
        return res.status(400).json({ error: 'Email и код обязательны' });
    }

    try {
        const { rows, rowCount } = await pool.query(
            `SELECT code, sent_at
             FROM confirmation_code
             WHERE email = $1
             ORDER BY sent_at DESC
             LIMIT 1`,
            [email]
        );

        if (!rowCount) {
            return res.status(404).json({ error: 'Код не найден' });
        }

        const { code: storedCode, sent_at } = rows[0];

        const now = new Date();
        const sentAt = new Date(sent_at);
        const diffMinutes = (now - sentAt) / 1000 / 60;

        if (diffMinutes > 10) {
            return res.status(400).json({ error: 'Код истёк' });
        }

        if (storedCode !== code) {
            return res.status(400).json({ error: 'Неверный код' });
        }

        // Теперь нужно проверить, зарегистрирован ли уже этот email
        const { rowCount: userCount } = await pool.query(
            `SELECT id FROM user_account WHERE email = $1`,
            [email]
        );

        if (userCount) {
            // Если пользователь есть — отмечаем его как верифицированного
            await pool.query(
                `UPDATE user_profile
                 SET verified = true
                 WHERE user_id = (SELECT id FROM user_account WHERE email = $1)`,
                [email]
            );
        }

        res.json({ message: 'Email подтверждён' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка проверки кода' });
    }
});


// POST /auth/register
router.post('/register', async (req, res) => {
    const { first_name, email, password, passwordCheck, city, dateOfBirth } = req.body;

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
            `INSERT INTO user_account (first_name, email, password_hash)
             VALUES ($1, $2, $3)
             RETURNING id`,
            [first_name, email, password_hash] // Теперь только 3 параметра
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

        // сохраняем токен в базу
        await pool.query(
            `INSERT INTO refresh_tokens (user_id, token, issued_at, expires_at)
             VALUES ($1, $2, NOW(), NOW() + INTERVAL '7 days')`,
            [id, token]
        );

        res.json({ token });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

module.exports = router;
