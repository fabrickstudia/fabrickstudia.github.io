const https = require('https');

// Default pre-authorized master ID from environment
const defaultAdminId = process.env.TELEGRAM_ADMIN_CHAT_ID || '8941327288';
const ADMIN_PASSWORD = process.env.TELEGRAM_ADMIN_PASSWORD || 'fabrik2026';
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8842149950:AAFxrxtn_GUJUiEbQWknumqn12CptthRswI';

// In-memory authorized admins set
global.AuthorizedAdmins = global.AuthorizedAdmins || new Set([defaultAdminId]);

function sendTelegramMessage(chatId, text, extra = {}) {
  const postData = JSON.stringify({
    chat_id: chatId,
    text: text,
    parse_mode: 'HTML',
    ...extra
  });

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.telegram.org',
      path: `/bot${BOT_TOKEN}/sendMessage`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve(body));
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

exports.handler = async (event) => {
  if (event.httpMethod === 'GET') {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'ok', service: 'FABRI\'K Telegram Webhook' })
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const update = JSON.parse(event.body || '{}');
    if (!update.message) return { statusCode: 200, body: 'No message in update' };

    const msg = update.message;
    const chatId = String(msg.chat.id);
    const text = (msg.text || '').trim();

    const isAdmin = global.AuthorizedAdmins.has(chatId);

    // Command: /start
    if (text === '/start') {
      if (isAdmin) {
        await sendTelegramMessage(chatId, 
          `👑 <b>Панель мастера студии FABRI’K</b>\n\n` +
          `Статус: <b>Авторизован ✅</b>\n` +
          `Все новые заявки и вопросы клиентов с сайта приходят в этот чат.\n\n` +
          `<b>Как ответить клиенту на сайт:</b>\n` +
          `<code>/reply &lt;id_сессии&gt; &lt;текст ответа&gt;</code>\n\n` +
          `<b>Команды:</b>\n` +
          `/status — проверить статус подключения\n` +
          `/logout — выйти из панели мастера`
        );
      } else {
        await sendTelegramMessage(chatId,
          `✨ <b>Студия красоты FABRI’K (Ухта)</b>\n` +
          `Юлия Фролова · Просп. Мира, д. 2, офис 5\n\n` +
          `📅 Онлайн-запись: https://dikidi.ru/56245\n` +
          `📞 Телефон: +7 (904) 274-73-63\n\n` +
          `🔒 <b>Вход для мастера:</b>\n` +
          `Чтобы просматривать заявки и отвечать клиентам с сайта, авторизуйтесь:\n` +
          `<code>/login ваш_пароль</code>`
        );
      }
      return { statusCode: 200, body: 'ok' };
    }

    // Command: /login <password>
    if (text.startsWith('/login')) {
      const parts = text.split(/\s+/);
      const pass = parts[1];

      if (!pass) {
        await sendTelegramMessage(chatId, `⚠️ <b>Укажите пароль:</b>\n<code>/login ваш_пароль</code>`);
        return { statusCode: 200, body: 'ok' };
      }

      if (pass === ADMIN_PASSWORD) {
        global.AuthorizedAdmins.add(chatId);
        await sendTelegramMessage(chatId,
          `✅ <b>Авторизация успешна!</b>\n\n` +
          `Добро пожаловать в панель мастера FABRI’K.\n` +
          `Теперь вы будете получать все новые заявки и вопросы клиентов с сайта.\n\n` +
          `Чтобы выйти в будущем, введите /logout`
        );
      } else {
        await sendTelegramMessage(chatId, `❌ <b>Неверный пароль.</b> Доступ к заявкам клиентов запрещен.`);
      }
      return { statusCode: 200, body: 'ok' };
    }

    // Command: /logout
    if (text === '/logout') {
      if (isAdmin) {
        global.AuthorizedAdmins.delete(chatId);
        await sendTelegramMessage(chatId, `🔒 <b>Вы вышли из системы.</b> Заявки клиентов больше не будут поступать в этот чат.`);
      } else {
        await sendTelegramMessage(chatId, `Вы не были авторизованы.`);
      }
      return { statusCode: 200, body: 'ok' };
    }

    // Command: /status
    if (text === '/status') {
      if (!isAdmin) {
        await sendTelegramMessage(chatId, `⛔ <b>Доступ запрещен.</b> Сначала авторизуйтесь: <code>/login &lt;пароль&gt;</code>`);
        return { statusCode: 200, body: 'ok' };
      }
      await sendTelegramMessage(chatId, 
        `🟢 <b>Система FABRI’K активна</b>\n` +
        `Ваш Telegram ID: <code>${chatId}</code>\n` +
        `Статус: Авторизован как мастер ✅`
      );
      return { statusCode: 200, body: 'ok' };
    }

    // Command: /reply <sessionId> <replyText>
    if (text.startsWith('/reply') || text.startsWith('/r')) {
      if (!isAdmin) {
        await sendTelegramMessage(chatId, `⛔ <b>Доступ запрещен.</b> Только авторизованный мастер может отвечать клиентам: <code>/login &lt;пароль&gt;</code>`);
        return { statusCode: 200, body: 'ok' };
      }

      const match = text.match(/^\/(?:reply|r)\s+([a-zA-Z0-9_-]+)\s+(.+)$/s);
      if (!match) {
        await sendTelegramMessage(chatId, `⚠️ <b>Формат ответа:</b>\n<code>/reply &lt;id_сессии&gt; &lt;текст ответа&gt;</code>`);
        return { statusCode: 200, body: 'ok' };
      }

      const sid = match[1];
      const replyMsg = match[2];

      global.ChatSessions = global.ChatSessions || {};
      if (!global.ChatSessions[sid]) {
        global.ChatSessions[sid] = [];
      }
      global.ChatSessions[sid].push({
        id: Date.now().toString(),
        sender: 'admin',
        text: replyMsg,
        time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
      });

      await sendTelegramMessage(chatId, `✅ <b>Ответ успешно передан на сайт клиенту (#${sid}):</b>\n«${replyMsg}»`);
      return { statusCode: 200, body: 'ok' };
    }

    // Any other text message from unauthorized users
    if (!isAdmin) {
      await sendTelegramMessage(chatId,
        `Здравствуйте! Студия красоты FABRI’K (г. Ухта).\n\n` +
        `Для онлайн-записи к мастеру Юлии перейдите в DIKIDI:\nhttps://dikidi.ru/56245\n\n` +
        `<i>Если вы мастер студии, авторизуйтесь:</i>\n<code>/login ваш_пароль</code>`
      );
    } else {
      await sendTelegramMessage(chatId,
        `ℹ️ Чтобы ответить клиенту на сайт, используйте команду:\n<code>/reply &lt;id_сессии&gt; &lt;текст ответа&gt;</code>`
      );
    }

    return { statusCode: 200, body: 'ok' };
  } catch (err) {
    return { statusCode: 500, body: err.message };
  }
};
