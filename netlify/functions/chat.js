const https = require('https');
const fs = require('fs');
const path = require('path');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8842149950:AAFxrxtn_GUJUiEbQWknumqn12CptthRswI';
const DEFAULT_ADMIN_ID = process.env.TELEGRAM_ADMIN_CHAT_ID || '8941327288';
const ADMIN_PASSWORD = process.env.TELEGRAM_ADMIN_PASSWORD || 'fabrik2026';

global.Sessions = global.Sessions || {};
global.AuthorizedAdmins = global.AuthorizedAdmins || new Set([DEFAULT_ADMIN_ID]);

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
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

// Resilient Telegram delivery: tries HTML first, falls back to plain text if Telegram rejects
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
            // Fallback: strip HTML and send plain text so it never drops
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

  // Auto-setup webhook from cloud if requested
  if (query.setup_webhook || query.set_webhook) {
    const host = event.headers.host || 'fabrik-ukhta.netlify.app';
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

  // 1. TELEGRAM WEBHOOK: Incoming updates from Telegram (@fabrik_salon_bot)
  if (urlPath.includes('telegram-webhook') || event.headers['x-telegram-bot-api-secret-token']) {
    try {
      const update = JSON.parse(event.body || '{}');
      if (update.message) {
        const msg = update.message;
        const chatId = String(msg.chat.id);
        const text = (msg.text || '').trim();

        const isAdmin = global.AuthorizedAdmins.has(chatId) || chatId === DEFAULT_ADMIN_ID;

        // Command /login <password>
        if (text.startsWith('/login')) {
          const pass = text.split(/\s+/)[1];
          if (pass === ADMIN_PASSWORD) {
            global.AuthorizedAdmins.add(chatId);
            await sendTelegram(chatId, '✅ <b>Авторизация успешна!</b>\nТеперь вы получаете все заявки и можете отвечать клиентам свайпом.');
          } else {
            await sendTelegram(chatId, '❌ <b>Неверный пароль.</b> Попробуйте еще раз: /login пароль');
          }
          return { statusCode: 200, headers, body: '{"ok":true}' };
        }

        // If not admin and not /login
        if (!isAdmin) {
          await sendTelegram(chatId, '✨ Студия красоты FABRI’K (Ухта)\nОнлайн-запись: https://dikidi.ru/56245\n\n🔒 Вход для мастера: /login пароль');
          return { statusCode: 200, headers, body: '{"ok":true}' };
        }

        // --- MASTER REPLYING TO CLIENT (SWIPE/REPLY WITHOUT SESSION ID) ---
        let targetSid = null;
        if (msg.reply_to_message && msg.reply_to_message.text) {
          const m = msg.reply_to_message.text.match(/#([a-zA-Z0-9_]{4,16})/);
          if (m) targetSid = m[1];
        }

        let replyText = text;
        if (!targetSid && (text.startsWith('/reply') || text.startsWith('/r'))) {
          const m = text.match(/^\/(?:reply|r)\s+([a-zA-Z0-9_]{4,16})\s+(.+)$/s);
          if (m) {
            targetSid = m[1];
            replyText = m[2];
          }
        }

        if (targetSid) {
          // Save reply into client session
          const adminMsg = {
            id: String(Date.now()),
            sender: 'admin',
            text: replyText,
            time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
          };
          addSessionMessage(targetSid, adminMsg);

          // Confirmation to master
          await sendTelegram(chatId, `✅ <b>Ответ доставлен клиенту (#${targetSid}) на сайт:</b>\n«${escapeHtml(replyText)}»`);
          return { statusCode: 200, headers, body: '{"ok":true}' };
        }

        // Help info for master if message wasn't a reply
        if (text === '/start' || text === '/help') {
          await sendTelegram(chatId, 
            '👑 <b>Панель мастера FABRI’K</b>\n\n' +
            'Вы авторизованы. Все заявки с сайта приходят сюда.\n\n' +
            '👉 <b>Чтобы ответить клиенту на сайт:</b>\n' +
            'Просто смахните сообщение клиента (Reply / Ответить) и напишите свой ответ!'
          );
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

  // 3. WEBSITE CLIENT: Send message / booking lead (POST /api/chat/send)
  if (event.httpMethod === 'POST') {
    try {
      const data = JSON.parse(event.body || '{}');
      const text = data.text || '';
      const sid = (data.sessionId || 'site_' + Math.random().toString(36).substring(2, 6));

      // Save user message to session
      const userMsg = {
        id: String(Date.now()),
        sender: 'user',
        text: text,
        time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
      };
      addSessionMessage(sid, userMsg);

      // Prepare Telegram notification in HTML
      let tgText = `💬 <b>Новое обращение с сайта FABRI'K</b>\n#${sid}\n`;
      if (data.name) tgText += `👤 <b>Имя:</b> ${escapeHtml(data.name)}\n`;
      if (data.phone) tgText += `📞 <b>Телефон:</b> ${escapeHtml(data.phone)}\n`;
      if (data.service) tgText += `✂️ <b>Услуга:</b> ${escapeHtml(data.service)}\n`;
      if (data.date) tgText += `📅 <b>Желаемая дата:</b> ${escapeHtml(data.date)}\n`;
      tgText += `\n💬 <b>Сообщение:</b>\n«${escapeHtml(text)}»\n\n`;
      tgText += `<i>👉 Смахните это сообщение (Reply/Ответить), чтобы ответить клиенту на сайт.</i>`;

      // Deliver to admin(s)
      const admins = Array.from(global.AuthorizedAdmins);
      if (!admins.includes(DEFAULT_ADMIN_ID)) admins.push(DEFAULT_ADMIN_ID);

      let anySuccess = false;
      for (const adminChatId of admins) {
        const tgRes = await sendTelegram(adminChatId, tgText, 'HTML');
        if (tgRes && tgRes.ok) anySuccess = true;
      }

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
