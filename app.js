require('dotenv').config();
const express = require('express');
const app = express();

const authRoutes = require('./routes/auth');
const profileRoutes = require('./routes/profile');

app.use(express.json());

app.use('/auth', authRoutes);    // /auth/register, /auth/login
app.use('/profile', profileRoutes); // /profile (защищённый)

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
