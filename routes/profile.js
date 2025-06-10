const express = require('express')
const router = express.Router()
const pool = require('../config/db')
const authenticateToken = require('../middleware/authMiddleware')
const multer = require('multer');
const fs = require('fs');
require('dotenv').config();
const AWS = require('aws-sdk');

// Multer для временного сохранения:
const upload = multer({ dest: 'uploads/' });

// S3‑клиент для Filebase:
const s3 = new AWS.S3({
    endpoint: 'https://s3.filebase.com',
    accessKeyId: process.env.FILEBASE_ACCESS_KEY,
    secretAccessKey: process.env.FILEBASE_SECRET_KEY,
    region: 'us-east-1',
    s3ForcePathStyle: true
});

// Загрузка фото профиля
router.post('/upload-photo', authenticateToken, upload.single('avatar'), async (req, res) => {
    try {
        const file = req.file;
        if (!file) return res.status(400).json({ message: 'No file uploaded' });

        const bucket = process.env.FILEBASE_BUCKET;
        const key = `avatars/${req.userId}_${Date.now()}_${file.originalname}`;
        const params = { Bucket: bucket, Key: key, Body: fs.createReadStream(file.path), ContentType: file.mimetype };

        // Считываем CID из заголовков
        let savedCID;
        const request = s3.putObject(params);
        request.on('httpHeaders', (status, headers) => {
            savedCID = headers['x-amz-meta-cid'];
        });

        const result = await request.promise();
        fs.unlinkSync(file.path);

        if (!savedCID) {
            console.error('CID not received');
            return res.status(500).json({ message: 'Failed to obtain IPFS CID' });
        }

        const url = `https://ipfs.filebase.io/ipfs/${savedCID}`;

        await pool.query(
            `INSERT INTO user_photo (user_id, url, active) VALUES ($1, $2, true)`,
            [req.userId, url]
        );

        res.json({ url });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Upload error' });
    }
});

// Получение профиля пользователя
router.get('/', authenticateToken, async (req, res) => {
    const userId = req.userId;

    try {
        const profileResult = await pool.query(
            `
            SELECT
                u.id AS user_id,
                u.first_name AS name,
                EXTRACT(YEAR FROM AGE(up.birth_date)) AS age,
                up.description,
                up.likes_received,
                up.views_received,
                up.gender,

                -- справочники (id и name)
                ms.id AS marital_status_id,
                ms.name AS marital_status_name,
                sa.id AS smoking_attitude_id,
                sa.name AS smoking_attitude_name,
                aa.id AS alcohol_attitude_id,
                aa.name AS alcohol_attitude_name,
                pa.id AS physical_activity_id,
                pa.name AS physical_activity_name,
                ca.id AS children_attitude_id,
                ca.name AS children_attitude_name,
                uh.height_cm AS height_cm,

                -- интересы, музыка, игры
                JSON_AGG(DISTINCT JSONB_BUILD_OBJECT('id', i.id, 'title', i.name)) AS interests,
                JSON_AGG(DISTINCT JSONB_BUILD_OBJECT('id', m.id, 'title', m.name)) AS music,
                JSON_AGG(DISTINCT JSONB_BUILD_OBJECT('id', g.id, 'title', g.name)) AS games,

                -- фильмы и книги
                ARRAY_AGG(DISTINCT umv.title) FILTER (WHERE umv.title IS NOT NULL) AS films,
                ARRAY_AGG(DISTINCT ub.title)  FILTER (WHERE ub.title IS NOT NULL) AS books,

                -- фото
                ARRAY_AGG(DISTINCT uph.url) FILTER (WHERE uph.active = true) AS photos

            FROM user_account u
            LEFT JOIN user_profile up ON u.id = up.user_id

            LEFT JOIN user_marital_status ums ON u.id = ums.user_id
            LEFT JOIN marital_status ms ON ums.marital_status_id = ms.id

            LEFT JOIN user_smoking_attitude usa ON u.id = usa.user_id
            LEFT JOIN smoking_attitude sa ON usa.smoking_attitude_id = sa.id

            LEFT JOIN user_alcohol_attitude uaa ON u.id = uaa.user_id
            LEFT JOIN alcohol_attitude aa ON uaa.alcohol_attitude_id = aa.id

            LEFT JOIN user_physical_activity upa ON u.id = upa.user_id
            LEFT JOIN physical_activity pa ON upa.physical_activity_id = pa.id

            LEFT JOIN user_children_attitude uca ON u.id = uca.user_id
            LEFT JOIN children_attitude ca ON uca.children_attitude_id = ca.id

            LEFT JOIN user_height uh ON u.id = uh.user_id

            LEFT JOIN user_interest ui ON u.id = ui.user_id
            LEFT JOIN interest i ON ui.interest_id = i.id

            LEFT JOIN user_music um ON u.id = um.user_id
            LEFT JOIN music_option m ON um.music_option_id = m.id

            LEFT JOIN user_game ug ON u.id = ug.user_id
            LEFT JOIN game_option g ON ug.game_option_id = g.id

            LEFT JOIN user_movie umv ON u.id = umv.user_id
            LEFT JOIN user_book ub ON u.id = ub.user_id

            LEFT JOIN user_photo uph ON u.id = uph.user_id

            WHERE u.id = $1
            GROUP BY
                u.id, u.first_name,
                up.birth_date, up.description, up.likes_received, up.views_received, up.gender,
                ms.id, ms.name,
                sa.id, sa.name,
                aa.id, aa.name,
                pa.id, pa.name,
                ca.id, ca.name,
                uh.height_cm
            `,
            [userId]
        );

        if (profileResult.rows.length === 0) {
            return res.status(404).json({ message: 'Profile not found' });
        }

        const row = profileResult.rows[0];

        res.json({
            id: row.user_id,
            name: row.name,
            age: row.age !== null ? Number(row.age) : null,
            description: row.description || null,
            gender: row.gender || null,
            likes: row.likes_received || 0,
            views: row.views_received || 0,

            marital_status: row.marital_status_id || null,
            smoking_attitude: row.smoking_attitude_id || null,
            alcohol_attitude: row.alcohol_attitude_id || null,
            physical_activity: row.physical_activity_id || null,
            children_attitude: row.children_attitude_id || null,
            height_cm: row.height_cm !== null ? row.height_cm : null,

            photos: row.photos?.filter(url => url !== null) || [],
            interests: row.interests?.filter(i => i.id !== null) || [],
            music: row.music?.filter(m => m.id !== null) || [],
            games: row.games?.filter(g => g.id !== null) || [],
            films: row.films || [],
            books: row.books || []
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});



// Обновление профиля пользователя
router.put('/', authenticateToken, async (req, res) => {
    const userId = req.userId;
    const {
        description,

        // новое “качество” — по одному id из каждого справочника
        marital_status_id,
        smoking_attitude_id,
        alcohol_attitude_id,
        physical_activity_id,
        children_attitude_id,
        height_cm,

        photos,     // массив строк [url1, url2, ...]
        interests,  // [id1, id2, ...]
        music,      // [id1, id2, ...]
        games,      // [id1, id2, ...]
        films,      // ['Название фильма 1', 'Название фильма 2', ...]
        books,      // ['Название книги 1', 'Название книги 2', ...]
        interest_coefficient
    } = req.body;

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // --- 1) Обновление описания в user_profile ---
        if (description !== undefined) {
            await client.query(
                `UPDATE user_profile
                 SET description = $1
                 WHERE user_id = $2`,
                [description, userId]
            );
        }

        if (interest_coefficient !== undefined) {
            await client.query(
                `UPDATE user_profile
         SET interest_coefficient = $1
         WHERE user_id = $2`,
                [interest_coefficient, userId]
            );
        }

        // --- 2) Обновление единичных справочников ---
        // Функция “delete + insert” для tab_user_X (одно-ко-многим)
        const upsertOneToOne = async (tableName, columnName, value) => {
            if (value === undefined) {
                // ничего не меняем, если не передано
                return;
            }
            // сначала удаляем старую связь (если есть), затем вставляем новую
            await client.query(`DELETE FROM ${tableName} WHERE user_id = $1`, [userId]);
            if (value !== null) {
                await client.query(
                    `INSERT INTO ${tableName} (user_id, ${columnName}) VALUES ($1, $2)`,
                    [userId, value]
                );
            }
        };

        await upsertOneToOne('user_marital_status', 'marital_status_id', marital_status_id);
        await upsertOneToOne('user_smoking_attitude', 'smoking_attitude_id', smoking_attitude_id);
        await upsertOneToOne('user_alcohol_attitude', 'alcohol_attitude_id', alcohol_attitude_id);
        await upsertOneToOne('user_physical_activity', 'physical_activity_id', physical_activity_id);
        await upsertOneToOne('user_children_attitude', 'children_attitude_id', children_attitude_id);

        // Обновление роста (user_height)
        if (height_cm !== undefined) {
            // удаляем прошлую запись (если есть), потом вставляем новую, если не null
            await client.query(`DELETE FROM user_height WHERE user_id = $1`, [userId]);
            if (height_cm !== null) {
                await client.query(
                    `INSERT INTO user_height (user_id, height_cm) VALUES ($1, $2)`,
                    [userId, height_cm]
                );
            }
        }

        // --- 3) Обновление фотографий ---
        if (Array.isArray(photos)) {
            // помечаем все старые как inactive, либо можно просто удалить и вставить новые
            await client.query(`DELETE FROM user_photo WHERE user_id = $1`, [userId]);
            for (const url of photos) {
                await client.query(
                    `INSERT INTO user_photo (user_id, url) VALUES ($1, $2)`,
                    [userId, url]
                );
            }
        }

        // --- 4) Обновление “многие-ко-многим”: интересы, музыка, игры ---
        const updateM2M = async (tableName, columnName, values) => {
            if (!Array.isArray(values)) {
                return;
            }
            await client.query(`DELETE FROM ${tableName} WHERE user_id = $1`, [userId]);
            for (const id of values) {
                await client.query(
                    `INSERT INTO ${tableName} (user_id, ${columnName}) VALUES ($1, $2)`,
                    [userId, id]
                );
            }
        };

        await updateM2M('user_interest', 'interest_id', interests);
        await updateM2M('user_music', 'music_option_id', music);
        await updateM2M('user_game', 'game_option_id', games);

        // --- 5) Обновление фильмов и книг (простой список строк) ---
        if (Array.isArray(films)) {
            await client.query(`DELETE FROM user_movie WHERE user_id = $1`, [userId]);
            for (const title of films) {
                await client.query(
                    `INSERT INTO user_movie (user_id, title) VALUES ($1, $2)`,
                    [userId, title]
                );
            }
        }
        if (Array.isArray(books)) {
            await client.query(`DELETE FROM user_book WHERE user_id = $1`, [userId]);
            for (const title of books) {
                await client.query(
                    `INSERT INTO user_book (user_id, title) VALUES ($1, $2)`,
                    [userId, title]
                );
            }
        }

        await client.query('COMMIT');
        res.status(200).json({ message: 'Профиль успешно обновлён' });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ message: 'Ошибка при обновлении профиля' });
    } finally {
        client.release();
    }
});

module.exports = router;
