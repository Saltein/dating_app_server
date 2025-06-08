require('dotenv').config()
const express = require('express')
const cors = require('cors')
const app = express()

const authRoutes = require('./routes/auth')
const profileRoutes = require('./routes/profile')
const optionsRoutes = require('./routes/options')
const otherProfiles = require('./routes/otherProfiles')
const interactions = require('./routes/interactions')
const chats = require('./routes/chats')

app.use(cors({
    origin: 'http://localhost:3000',
    credentials: true
}));
app.use(express.json())

app.use('/auth', authRoutes)
app.use('/profile', profileRoutes)
app.use('/list', optionsRoutes)
app.use('/dating', otherProfiles)
app.use('/dating', interactions)
app.use('/chats', chats)

const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log(`Server running on port ${PORT}`))
