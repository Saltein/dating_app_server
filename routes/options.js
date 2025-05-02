const express = require('express')
const router = express.Router()
const pool = require('../config/db')
const authenticateToken = require('../middleware/authMiddleware')

// Получить список интересов
router.get('/interest', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name AS title FROM interest ORDER BY name')
    res.json(result.rows)
  } catch (err) {
    console.error('Error fetching interests:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Получить список музыкальных предпочтений
router.get('/music', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name AS title FROM music_option ORDER BY name')
    res.json(result.rows)
  } catch (err) {
    console.error('Error fetching music options:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Получить список игровых предпочтений
router.get('/games', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name AS title FROM game_option ORDER BY name')
    res.json(result.rows)
  } catch (err) {
    console.error('Error fetching game options:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

module.exports = router
