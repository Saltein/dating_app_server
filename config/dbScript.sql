-- 1. Таблица учетных записей пользователей (аутентификация)
CREATE TABLE user_account (
  id SERIAL PRIMARY KEY,
  first_name VARCHAR(50) NOT NULL,
  last_name VARCHAR(50),
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE confirmation_code (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  code VARCHAR(10) NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Таблица публичного профиля
CREATE TABLE user_profile (
  user_id               INT             PRIMARY KEY
                                     REFERENCES user_account(id)
                                       ON DELETE CASCADE,
  birth_date            DATE,
  city                  VARCHAR(100),
  description           TEXT,
  verified              BOOLEAN         NOT NULL DEFAULT FALSE,
  superlikes_received   INT             NOT NULL DEFAULT 0,
  views_received        INT             NOT NULL DEFAULT 0,
  likes_received        INT             NOT NULL DEFAULT 0,
  interest_coefficient  NUMERIC(5,2)    NOT NULL DEFAULT 0,
  gender                   CHAR(1)         NOT NULL DEFAULT 'M'
                                     CHECK (gender IN ('M', 'F'))
);

-- 3. Справочники для «многие-ко-многим»
-- Новые справочники
CREATE TABLE marital_status (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE smoking_attitude (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE alcohol_attitude (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE physical_activity (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE children_attitude (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE
);

-- Таблицы связей пользователь – справочник (один к одному)
CREATE TABLE user_marital_status (
  user_id INT PRIMARY KEY REFERENCES user_account(id) ON DELETE CASCADE,
  marital_status_id INT REFERENCES marital_status(id)
);

CREATE TABLE user_smoking_attitude (
  user_id INT PRIMARY KEY REFERENCES user_account(id) ON DELETE CASCADE,
  smoking_attitude_id INT REFERENCES smoking_attitude(id)
);

CREATE TABLE user_alcohol_attitude (
  user_id INT PRIMARY KEY REFERENCES user_account(id) ON DELETE CASCADE,
  alcohol_attitude_id INT REFERENCES alcohol_attitude(id)
);

CREATE TABLE user_physical_activity (
  user_id INT PRIMARY KEY REFERENCES user_account(id) ON DELETE CASCADE,
  physical_activity_id INT REFERENCES physical_activity(id)
);

CREATE TABLE user_children_attitude (
  user_id INT PRIMARY KEY REFERENCES user_account(id) ON DELETE CASCADE,
  children_attitude_id INT REFERENCES children_attitude(id)
);

-- Таблица роста
CREATE TABLE user_height (
  user_id INT PRIMARY KEY REFERENCES user_account(id) ON DELETE CASCADE,
  height_cm INT NOT NULL CHECK (height_cm > 0)
);

CREATE TABLE interest       (id SERIAL PRIMARY KEY, name VARCHAR(50) NOT NULL UNIQUE);
CREATE TABLE music_option   (id SERIAL PRIMARY KEY, name VARCHAR(50) NOT NULL UNIQUE);
CREATE TABLE game_option    (id SERIAL PRIMARY KEY, name VARCHAR(50) NOT NULL UNIQUE);

-- 4. Таблицы связей пользователь – справочник
CREATE TABLE user_interest  (user_id INT REFERENCES user_account(id) ON DELETE CASCADE, interest_id INT REFERENCES interest(id), PRIMARY KEY(user_id, interest_id));
CREATE TABLE user_music     (user_id INT REFERENCES user_account(id) ON DELETE CASCADE, music_option_id INT REFERENCES music_option(id), PRIMARY KEY(user_id, music_option_id));
CREATE TABLE user_game      (user_id INT REFERENCES user_account(id) ON DELETE CASCADE, game_option_id INT REFERENCES game_option(id), PRIMARY KEY(user_id, game_option_id));

-- 5. Фильмы и книги (вписывается вручную)
CREATE TABLE user_movie (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES user_account(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL
);

CREATE TABLE user_book (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES user_account(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL
);

-- 6. Фото профиля
CREATE TABLE user_photo (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES user_account(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  active BOOLEAN NOT NULL DEFAULT TRUE
);

-- 7. Лайки и суперлайки
CREATE TABLE likes (
  id SERIAL PRIMARY KEY,
  from_user INT REFERENCES user_account(id) ON DELETE CASCADE,
  to_user INT REFERENCES user_account(id) ON DELETE CASCADE,
  type VARCHAR(10) NOT NULL CHECK (type IN ('like', 'superlike')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE rejects (
  rejector_id INT NOT NULL REFERENCES user_account(id) ON DELETE CASCADE,
  rejected_id INT NOT NULL REFERENCES user_account(id) ON DELETE CASCADE,
  rejected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (rejector_id, rejected_id)
);

-- 8. Просмотры анкет
CREATE TABLE views (
  id SERIAL PRIMARY KEY,
  viewer_id INT REFERENCES user_account(id) ON DELETE CASCADE,
  viewed_id INT REFERENCES user_account(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. Кэш взаимных лайков (матчи)
CREATE TABLE IF NOT EXISTS matches (
  id SERIAL PRIMARY KEY,
  user1 INT NOT NULL REFERENCES user_account(id) ON DELETE CASCADE,
  user2 INT NOT NULL REFERENCES user_account(id) ON DELETE CASCADE,
  matched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user1, user2)
);
-- 2. Новая таблица чатов, жёстко связанная с матчем
CREATE TABLE chat (
  id            SERIAL PRIMARY KEY,
  match_id      INT NOT NULL UNIQUE
                  REFERENCES matches(id)
                    ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at     TIMESTAMPTZ
);

-- 3. Сообщения внутри чата
CREATE TABLE message (
  id SERIAL PRIMARY KEY,
  chat_id INT NOT NULL REFERENCES chat(id) ON DELETE CASCADE,
  match_id INT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  sender_id INT NOT NULL REFERENCES user_account(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. Настройки пользователя (ключ-значение)
-- CREATE TABLE user_settings (
--   user_id INT REFERENCES user_account(id) ON DELETE CASCADE,
--   setting_key VARCHAR(50) NOT NULL,
--   setting_value VARCHAR(100) NOT NULL,
--   PRIMARY KEY(user_id, setting_key)
-- );

-- 12. Подписки и суперлайки
-- CREATE TABLE subscriptions (
--   user_id INT PRIMARY KEY REFERENCES user_account(id) ON DELETE CASCADE,
--   plan_type VARCHAR(50) NOT NULL,
--   superlikes_limit INT NOT NULL DEFAULT 0,
--   expires_at DATE
-- );

-- 13. Refresh-токены
CREATE TABLE refresh_tokens (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES user_account(id) ON DELETE CASCADE,
  token VARCHAR(255) NOT NULL UNIQUE,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked BOOLEAN NOT NULL DEFAULT FALSE
);

-- 14. Индексы для ускорения выборок
CREATE INDEX idx_likes_from_user ON likes(from_user);
CREATE INDEX idx_likes_to_user ON likes(to_user);
CREATE INDEX idx_likes_type ON likes(type);
CREATE INDEX idx_views_viewer ON views(viewer_id);
CREATE INDEX idx_views_viewed ON views(viewed_id);
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
-- 4. Индексы для ускорения выборок сообщений по чату и по отправителю

CREATE INDEX idx_message_chat ON message(chat_id);
CREATE INDEX idx_message_match_id ON message(match_id);
CREATE INDEX idx_message_sender ON message(sender_id);