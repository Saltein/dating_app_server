require('dotenv').config()
const express = require('express')
const cors = require('cors')
const http = require('http')
const { Server } = require('socket.io')
const { getMessagesFromDB, saveMessageToDB } = require('./services/chatService')

const app = express()
const server = http.createServer(app)

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

const io = new Server(server, {
    cors: {
        origin: 'http://localhost:3000',
        methods: ['GET', 'POST'],
        credentials: true
    }
})

io.on('connection', socket => {
    const { userId } = socket.handshake.query
    console.log(`Пользователь ${userId} подключился по WebSocket`)

    // Добавляем пользователя в комнату
    socket.join(userId)

    // Вход в комнату чата
    socket.on('joinRoom', roomId => {
        console.log(`Пользователь ${userId} зашел в чат ${roomId}`)
        socket.join(roomId)
    })

    socket.on('leaveRoom', roomId => {
        console.log(`Пользователь ${userId} покинул чат ${roomId}`)
        socket.leave(roomId)
    })

    socket.on('getMessages', async (chatId) => {
        const history = await getMessagesFromDB(chatId)
        socket.emit('messageHistory', history)
    })

    socket.on('sendMessage', async ({ chatId, text }) => {
        const message = await saveMessageToDB(chatId, userId, text)
        if (message) {
            io.to(chatId).emit('newMessage', message)
        }
    })

    socket.on('disconnect', () => {
        console.log(`Пользователь ${userId} отключился`)
    })
})


app.use('/auth', authRoutes)
app.use('/profile', profileRoutes)
app.use('/list', optionsRoutes)
app.use('/dating', otherProfiles)
app.use('/dating', interactions)
app.use('/chats', chats)

const PORT = process.env.PORT || 3000
server.listen(PORT, () => console.log(`Server + WebSocket запущен на порту ${PORT}`))
