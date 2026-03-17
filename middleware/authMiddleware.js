const jwt = require("jsonwebtoken");
const pool = require("../config/db");

async function authenticateToken(req, res, next) {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) return res.sendStatus(401);

    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);

        // Проверяем, есть ли токен в БД
        const { rowCount } = await pool.query(
            `SELECT 1 FROM refresh_tokens WHERE token = $1`,
            [token],
        );

        if (!rowCount) return res.sendStatus(403);

        req.userId = payload.userId;
        next();
    } catch (err) {
        return res.sendStatus(403);
    }
}

module.exports = authenticateToken;
