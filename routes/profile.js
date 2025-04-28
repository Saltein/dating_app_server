const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const authenticateToken = require('../middleware/authMiddleware');

// Получение профиля пользователя
router.get('/', authenticateToken, async (req, res) => {
    const userId = req.userId; // Берём userId из токена

    try {
        // Запрос к базе для получения данных профиля и фотографий
        const profileResult = await pool.query(`
            SELECT 
                u.first_name || ' ' || u.last_name AS name,
                EXTRACT(YEAR FROM AGE(up.birth_date)) AS age,  -- Используем up.birth_date
                up.description, 
                ARRAY_AGG(DISTINCT q.name) AS quality,  -- Добавлено для агрегирования качеств
                ARRAY_AGG(DISTINCT i.name) AS interest,  -- Добавлено для агрегирования интересов
                ARRAY_AGG(DISTINCT m.name) AS music,    -- Добавлено для агрегирования музыки
                ARRAY_AGG(DISTINCT umv.title) AS films,  -- Исправлено на umv.title для фильмов
                ARRAY_AGG(DISTINCT ub.title) AS books,   -- Исправлено на ub.title для книг
                ARRAY_AGG(DISTINCT g.name) AS games,    -- Добавлено для агрегирования игр
                json_agg(DISTINCT uph.url) AS photo
            FROM user_account u
            LEFT JOIN user_profile up ON u.id = up.user_id
            LEFT JOIN user_quality uq ON u.id = uq.user_id
            LEFT JOIN quality q ON uq.quality_id = q.id
            LEFT JOIN user_interest ui ON u.id = ui.user_id
            LEFT JOIN interest i ON ui.interest_id = i.id
            LEFT JOIN user_music um ON u.id = um.user_id
            LEFT JOIN music_option m ON um.music_option_id = m.id
            LEFT JOIN user_game ug ON u.id = ug.user_id
            LEFT JOIN game_option g ON ug.game_option_id = g.id
            LEFT JOIN user_movie umv ON u.id = umv.user_id
            LEFT JOIN user_book ub ON u.id = ub.user_id
            LEFT JOIN user_photo uph ON u.id = uph.user_id AND uph.active = true
            WHERE u.id = $1
            GROUP BY u.id, up.user_id`, [userId]);

        if (profileResult.rows.length === 0) {
            return res.status(404).json({ message: 'Profile not found' });
        }

        // Отправляем данные профиля
        const profile = profileResult.rows[0];
        res.json({
            id: userId,
            photo: profile.photo || [],
            name: profile.name,
            age: profile.age,
            description: profile.description,
            quality: profile.quality || [],
            interest: profile.interest || [],
            music: profile.music || [],
            films_books: {
                films: profile.films || [],
                books: profile.books || [],
            },
            games: profile.games || [],
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});


// Вспомогательная функция для подсчета возраста
// function calculateAge(birthDate) {
//     const today = new Date();
//     const birth = new Date(birthDate);
//     let age = today.getFullYear() - birth.getFullYear();
//     const m = today.getMonth() - birth.getMonth();
//     if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
//         age--;
//     }
//     return age;
// }

module.exports = router;