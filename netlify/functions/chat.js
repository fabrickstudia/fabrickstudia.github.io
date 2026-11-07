const https = require('https');
const fs = require('fs');
const path = require('path');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8842149950:AAFxrxtn_GUJUiEbQWknumqn12CptthRswI';
const DEFAULT_ADMIN_ID = process.env.TELEGRAM_ADMIN_CHAT_ID || '8941327288';
const ADMIN_PASSWORD = process.env.TELEGRAM_ADMIN_PASSWORD || 'fabrik2026';

global.Sessions = global.Sessions || {};
global.AuthorizedAdmins = global.AuthorizedAdmins || new Set([DEFAULT_ADMIN_ID]);
global.LastSessionId = global.LastSessionId || null;

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function getAdmins() {
  const admins = new Set(global.AuthorizedAdmins);
  admins.add(DEFAULT_ADMIN_ID);
  try {
    const p = path.join('/tmp', 'authorized_admins.json');
    if (fs.existsSync(p)) {
      const arr = JSON.parse(fs.readFileSync(p, 'utf8'));
      if (Array.isArray(arr)) {
        arr.forEach(id => admins.add(String(id)));
      }
    }
  } catch {}
  return Array.from(admins);
}

function saveAdmin(chatId) {
  const idStr = String(chatId);
  global.AuthorizedAdmins.add(idStr);
  try {
    const admins = getAdmins();
    if (!admins.includes(idStr)) admins.push(idStr);
    fs.writeFileSync(path.join('/tmp', 'authorized_admins.json'), JSON.stringify(admins), 'utf8');
  } catch {}
}

function setLastSessionId(sid) {
  global.LastSessionId = sid;
  try {
    fs.writeFileSync(path.join('/tmp', 'last_session.txt'), sid, 'utf8');
  } catch {}
}

function getLastSessionId() {
  if (global.LastSessionId) return global.LastSessionId;
  try {
    const p = path.join('/tmp', 'last_session.txt');
    if (fs.existsSync(p)) {
      const sid = fs.readFileSync(p, 'utf8').trim();
      if (sid) {
        global.LastSessionId = sid;
        return sid;
      }
    }
  } catch {}
  return null;
}

function getSessionMessages(sid) {
  try {
    const p = path.join('/tmp', `session_${sid}.json`);
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, 'utf8'));
    }
  } catch {}
  return global.Sessions[sid] || [];
}

function addSessionMessage(sid, msg) {
  global.Sessions[sid] = global.Sessions[sid] || [];
  global.Sessions[sid].push(msg);
  try {
    const p = path.join('/tmp', `session_${sid}.json`);
    fs.writeFileSync(p, JSON.stringify(global.Sessions[sid]), 'utf8');
  } catch {}
}

function sendTelegram(chatId, text, parseMode = 'HTML') {
  return new Promise((resolve) => {
    const postData = JSON.stringify({
      chat_id: chatId,
      text: text,
      ...(parseMode ? { parse_mode: parseMode } : {})
    });

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
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          if (!json.ok && parseMode) {
            const plainText = text.replace(/<[^>]+>/g, '');
            sendTelegram(chatId, plainText, null).then(resolve);
            return;
          }
          resolve(json);
        } catch {
          resolve({ ok: false });
        }
      });
    });

    req.on('error', () => resolve({ ok: false }));
    req.write(postData);
    req.end();
  });
}

function ensureWebhook(host) {
  const currentHost = host || 'fabrik-ukhta.netlify.app';
  const targetUrl = `https://${currentHost}/api/telegram-webhook`;
  https.get(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${encodeURIComponent(targetUrl)}`, () => {});
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json; charset=utf-8'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const urlPath = event.path || '';
  const query = event.queryStringParameters || {};
  const host = event.headers.host || 'fabrik-ukhta.netlify.app';

  // Auto-setup webhook if requested
  if (query.setup_webhook || query.set_webhook) {
    const webhookUrl = `https://${host}/api/telegram-webhook`;
    const res = await new Promise((resolve) => {
      https.get(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${encodeURIComponent(webhookUrl)}`, (r) => {
        let b = '';
        r.on('data', c => b += c);
        r.on('end', () => resolve(b));
      }).on('error', (e) => resolve(e.message));
    });
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ status: 'ok', webhookUrl, telegramResponse: res })
    };
  }

  // 1. TELEGRAM WEBHOOK: Incoming messages from Telegram (@fabrik_salon_bot)
  if (urlPath.includes('telegram-webhook') || event.headers['x-telegram-bot-api-secret-token']) {
    try {
      const update = JSON.parse(event.body || '{}');
      if (update.message) {
        const msg = update.message;
        const chatId = String(msg.chat.id);
        const text = (msg.text || '').trim();

        const allAdmins = getAdmins();
        const isAdmin = allAdmins.includes(chatId) || chatId === DEFAULT_ADMIN_ID;

        // Command: /login <password>
        if (text.startsWith('/login')) {
          const pass = text.split(/\s+/)[1];
          if (pass === ADMIN_PASSWORD) {
            saveAdmin(chatId);
            await sendTelegram(chatId, 
              '✅ <b>Авторизация успешна!</b>\n\n' +
              'Вы подключены как мастер студии FABRI’K.\n' +
              'Все заявки и сообщения с сайта приходят сюда.\n\n' +
              '👉 <b>Как отвечать клиентам:</b>\n' +
              'Просто напишите сюда любой текст — бот сам передаст его последнему клиенту на сайт! (Или смахните сообщение свайпом).'
            );
          } else {
            await sendTelegram(chatId, '❌ <b>Неверный пароль.</b> Введите: <code>/login fabrik2026</code>');
          }
          return { statusCode: 200, headers, body: '{"ok":true}' };
        }

        // Command: /start or /help
        if (text === '/start' || text === '/help') {
          saveAdmin(chatId);
          await sendTelegram(chatId,
            '👑 <b>Панель мастера FABRI’K</b>\n\n' +
            `Ваш Telegram ID: <code>${chatId}</code>\n` +
            'Статус: <b>Мастер активен ✅</b>\n\n' +
            '👉 <b>Чтобы ответить клиенту на сайт:</b>\n' +
            'Вам больше НЕ НУЖНО вводить ID запроса! Просто напишите сюда ответ обычным сообщением, и клиент на сайте сразу его увидит.'
          );
          return { statusCode: 200, headers, body: '{"ok":true}' };
        }

        // --- MASTER REPLYING TO CLIENT (NO ID NEEDED, JUST TYPE ANSWER) ---
        let targetSid = null;

        // A) If swiping / replying to a specific message with #sessionId
        if (msg.reply_to_message && msg.reply_to_message.text) {
          const m = msg.reply_to_message.text.match(/#([a-zA-Z0-9_]{4,20})/);
          if (m) targetSid = m[1];
        }

        // B) If typed /reply <sessionId> <text>
        let replyText = text;
        if (!targetSid && (text.startsWith('/reply') || text.startsWith('/r'))) {
          const m = text.match(/^\/(?:reply|r)\s+([a-zA-Z0-9_]{4,20})\s+(.+)$/s);
          if (m) {
            targetSid = m[1];
            replyText = m[2];
          }
        }

        // C) DEFAULT: Master simply typed a plain message! Reply to the LAST ACTIVE CLIENT!
        if (!targetSid) {
          targetSid = getLastSessionId();
        }

        if (targetSid) {
          const nowStr = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
          const adminMsg = {
            id: String(Date.now()),
            sender: 'admin',
            text: replyText,
            time: nowStr
          };
          addSessionMessage(targetSid, adminMsg);

          // Confirmation to master
          await sendTelegram(chatId, `✅ <b>Ответ отправлен клиенту на сайт:</b>\n«${escapeHtml(replyText)}»`);
          return { statusCode: 200, headers, body: '{"ok":true}' };
        } else {
          await sendTelegram(chatId,
            'ℹ️ <b>Пока нет активных диалогов с сайта.</b>\n' +
            'Как только посетитель сайта напишет вопрос или оставит заявку — вы сможете просто отвечать сюда текстом.'
          );
          return { statusCode: 200, headers, body: '{"ok":true}' };
        }
      }
      return { statusCode: 200, headers, body: '{"ok":true}' };
    } catch (err) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
    }
  }

  // 2. WEBSITE CLIENT: Poll messages (GET /api/chat/messages?sessionId=...)
  if (event.httpMethod === 'GET') {
    const sid = query.sessionId;
    const msgs = sid ? getSessionMessages(sid) : [];
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ status: 'ok', messages: msgs })
    };
  }

  // 3. WEBSITE CLIENT: Send message or booking request (POST /api/chat/send)
  if (event.httpMethod === 'POST') {
    try {
      const data = JSON.parse(event.body || '{}');
      const text = data.text || '';
      const sid = data.sessionId || ('client_' + Math.random().toString(36).substring(2, 8));

      // Remember as last active session
      setLastSessionId(sid);

      // Save user message
      const nowStr = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
      const userMsg = {
        id: String(Date.now()),
        sender: 'user',
        text: text,
        time: nowStr
      };
      addSessionMessage(sid, userMsg);

      // Prepare Telegram notification
      let tgText = `💬 <b>Новое обращение с сайта FABRI'K</b>\n#${sid}\n`;
      if (data.name) tgText += `👤 <b>Имя:</b> ${escapeHtml(data.name)}\n`;
      if (data.phone) tgText += `📞 <b>Телефон:</b> ${escapeHtml(data.phone)}\n`;
      if (data.service) tgText += `✂️ <b>Услуга:</b> ${escapeHtml(data.service)}\n`;
      if (data.date) tgText += `📅 <b>Желаемая дата:</b> ${escapeHtml(data.date)}\n`;
      if (text) tgText += `\n💬 <b>Сообщение:</b>\n«${escapeHtml(text)}»\n\n`;
      tgText += `<i>👉 Чтобы ответить клиенту — просто напишите ответ в этот чат!</i>`;

      // Deliver to all authorized master chats
      const admins = getAdmins();
      let anySuccess = false;
      for (const adminChatId of admins) {
        const tgRes = await sendTelegram(adminChatId, tgText, 'HTML');
        if (tgRes && tgRes.ok) anySuccess = true;
      }

      // Auto-ensure webhook is active
      ensureWebhook(host);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ status: 'ok', sentToTelegram: anySuccess, sessionId: sid })
      };
    } catch (err) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ status: 'error', error: err.message })
      };
    }
  }

  return { statusCode: 405, headers, body: 'Method Not Allowed' };
};
