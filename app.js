require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();

const authRoutes = require('./routes/auth');
const profileRoutes = require('./routes/profile');
const optionsRoutes = require('./routes/options')

app.use(cors({
    origin: 'http://localhost:3000',
    credentials: true
}));
app.use(express.json())

app.use('/auth', authRoutes)
app.use('/profile', profileRoutes)
app.use('/list', optionsRoutes)

const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log(`Server running on port ${PORT}`))
