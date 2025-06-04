const express = require('express')
const router = express.Router()
const pool = require('../config/db')
const authenticateToken = require('../middleware/authMiddleware')

// Получить список интересов
router.get('/interests', authenticateToken, async (req, res) => {
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

router.get('/marital_status', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name AS title FROM marital_status ORDER BY name')
    res.json(result.rows)
  } catch (err) {
    console.error('Error fetching marital_status options:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.get('/alcohol_attitude', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name AS title FROM alcohol_attitude ORDER BY name')
    res.json(result.rows)
  } catch (err) {
    console.error('Error fetching alcohol_attitude options:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.get('/smoking_attitude', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name AS title FROM smoking_attitude ORDER BY name')
    res.json(result.rows)
  } catch (err) {
    console.error('Error fetching smoking_attitude options:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.get('/physical_activity', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name AS title FROM physical_activity ORDER BY name')
    res.json(result.rows)
  } catch (err) {
    console.error('Error fetching physical_activity options:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.get('/children_attitude', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name AS title FROM children_attitude ORDER BY name')
    res.json(result.rows)
  } catch (err) {
    console.error('Error fetching children_attitude options:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

module.exports = router
