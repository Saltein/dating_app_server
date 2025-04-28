const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const authenticateToken = require('../middleware/authMiddleware');

// Получение профиля пользователя
router.get('/', authenticateToken, async (req, res) => {
    const userId = req.userId; // предполагаем, что authMiddleware кладет id в req.user.id

    try {
        // 1. Основная информация
        const userInfoQuery = `
            SELECT ua.id, ua.first_name, ua.last_name, up.birth_date, up.description
            FROM user_account ua
            LEFT JOIN user_profile up ON ua.id = up.user_id
            WHERE ua.id = $1
        `;
        const { rows: userRows } = await pool.query(userInfoQuery, [userId]);
        const user = userRows[0];

        if (!user) {
            return res.status(404).json({ message: 'Пользователь не найден' });
        }

        // 2. Качества
        const { rows: qualities } = await pool.query(`
            SELECT q.name FROM user_quality uq
            JOIN quality q ON uq.quality_id = q.id
            WHERE uq.user_id = $1
        `, [userId]);

        // 3. Интересы
        const { rows: interests } = await pool.query(`
            SELECT i.name FROM user_interest ui
            JOIN interest i ON ui.interest_id = i.id
            WHERE ui.user_id = $1
        `, [userId]);

        // 4. Музыка
        const { rows: music } = await pool.query(`
            SELECT mo.name FROM user_music um
            JOIN music_option mo ON um.music_option_id = mo.id
            WHERE um.user_id = $1
        `, [userId]);

        // 5. Игры
        const { rows: games } = await pool.query(`
            SELECT go.name FROM user_game ug
            JOIN game_option go ON ug.game_option_id = go.id
            WHERE ug.user_id = $1
        `, [userId]);

        // 6. Фильмы
        const { rows: movies } = await pool.query(`
            SELECT title FROM user_movie
            WHERE user_id = $1
        `, [userId]);

        // 7. Книги
        const { rows: books } = await pool.query(`
            SELECT title FROM user_book
            WHERE user_id = $1
        `, [userId]);

        // Собираем финальный объект
        const profile = {
            id: user.id,
            name: `${user.first_name} ${user.last_name || ''}`.trim(),
            age: user.birth_date ? calculateAge(user.birth_date) : null,
            description: user.description || '',
            quality: qualities.map(q => q.name),
            interest: interests.map(i => i.name),
            music: music.map(m => m.name),
            films_books: {
                films: movies.map(m => m.title),
                books: books.map(b => b.title),
            },
            games: games.map(g => g.name)
        };

        res.json(profile);
    } catch (error) {
        console.error('Ошибка получения профиля:', error);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

// Вспомогательная функция для подсчета возраста
function calculateAge(birthDate) {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
        age--;
    }
    return age;
}

module.exports = router;