const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const authenticateToken = require('../middleware/authMiddleware');

// Получение профиля пользователя
router.get('/', authenticateToken, async (req, res) => {
    const userId = req.userId; // Получаем userId из токена

    try {
        const profileResult = await pool.query(`
            SELECT 
                u.first_name AS name,
                EXTRACT(YEAR FROM AGE(up.birth_date)) AS age,
                up.description, 
                up.likes_received,
                up.views_received,
                ARRAY_AGG(DISTINCT q.name) AS quality,
                ARRAY_AGG(DISTINCT i.name) AS interest,
                ARRAY_AGG(DISTINCT m.name) AS music,
                ARRAY_AGG(DISTINCT umv.title) AS films,
                ARRAY_AGG(DISTINCT ub.title) AS books,
                ARRAY_AGG(DISTINCT g.name) AS games,
                JSON_AGG(DISTINCT uph.url) AS photo
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
            GROUP BY u.id, up.user_id, up.likes_received, up.views_received
        `, [userId]);

        if (profileResult.rows.length === 0) {
            return res.status(404).json({ message: 'Profile not found' });
        }

        const profile = profileResult.rows[0];

        res.json({
            id: userId,
            photo: profile.photo?.filter(url => url !== null) || [],
            name: profile.name,
            age: profile.age,
            description: profile.description,
            quality: profile.quality?.filter(item => item !== null) || [],
            interest: profile.interest?.filter(item => item !== null) || [],
            music: profile.music?.filter(item => item !== null) || [],
            films_books: {
                films: profile.films?.filter(item => item !== null) || [],
                books: profile.books?.filter(item => item !== null) || [],
            },
            games: profile.games?.filter(item => item !== null) || [],
            likes: profile.likes_received || 0,
            views: profile.views_received || 0,
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

router.put('/', authenticateToken, async (req, res) => {
    const userId = req.userId;
    const {
        description,
        photos,        // [url1, url2, ...]
        qualityIds,    // [1, 2, 3]
        interestIds,   // [1, 2]
        musicIds,      // [1, 2]
        gameIds,       // [1, 2]
        films,         // ['Film 1', 'Film 2']
        books          // ['Book 1', 'Book 2']
    } = req.body;

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        if (description !== undefined) {
            await client.query(
                'UPDATE user_profile SET description = $1 WHERE user_id = $2',
                [description, userId]
            );
        }

        if (Array.isArray(photos)) {
            await client.query('DELETE FROM user_photo WHERE user_id = $1', [userId]);
            for (const url of photos) {
                await client.query(
                    'INSERT INTO user_photo (user_id, url) VALUES ($1, $2)',
                    [userId, url]
                );
            }
        }

        const updateManyToMany = async (table, column, values) => {
            if (!Array.isArray(values)) return;
            await client.query(`DELETE FROM ${table} WHERE user_id = $1`, [userId]);
            for (const id of values) {
                await client.query(
                    `INSERT INTO ${table} (user_id, ${column}) VALUES ($1, $2)`,
                    [userId, id]
                );
            }
        };

        await updateManyToMany('user_quality', 'quality_id', qualityIds);
        await updateManyToMany('user_interest', 'interest_id', interestIds);
        await updateManyToMany('user_music', 'music_option_id', musicIds);
        await updateManyToMany('user_game', 'game_option_id', gameIds);

        if (Array.isArray(films)) {
            await client.query('DELETE FROM user_movie WHERE user_id = $1', [userId]);
            for (const title of films) {
                await client.query(
                    'INSERT INTO user_movie (user_id, title) VALUES ($1, $2)',
                    [userId, title]
                );
            }
        }

        if (Array.isArray(books)) {
            await client.query('DELETE FROM user_book WHERE user_id = $1', [userId]);
            for (const title of books) {
                await client.query(
                    'INSERT INTO user_book (user_id, title) VALUES ($1, $2)',
                    [userId, title]
                );
            }
        }

        await client.query('COMMIT');
        res.status(200).json({ message: 'Профиль обновлен успешно' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(error);
        res.status(500).json({ error: 'Ошибка при обновлении профиля' });
    } finally {
        client.release();
    }
});

module.exports = router;