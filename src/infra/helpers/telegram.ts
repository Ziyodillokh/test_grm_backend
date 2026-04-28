import { Telegraf } from 'telegraf';

const token = process.env.BOT_TOKEN;
const app = new Telegraf(token, {});

const telegram = async ({
                          imgUrl,
                          model,
                          color,
                          size,
                          shape,
                          style,
                          price
                        }) => {
  const chatId = process.env.CHATID;
  const shapes = {
    rectangle: 'Прямоугольный',
    rulo: 'Metrli',
    oval: 'Овальный',
    daire: 'Круглый',
  };
  const text = `
✨ Самые красивые и уютные ковры ✨

📐 Размер: ${size.title}
💎 Коллекция: ${model.collection.title}
🎨 Цвет: ${color.title}
🏷️ Модель: ${model.title}
🔲 Форма: ${shapes[shape?.toLowerCase()]}
🖼️ Стиль: ${style.title}

💰 Цена: ${price}-сум  

🛒 Широкий ассортимент ковров в онлайн магазине Gilamshop.uz

📞 Телефон: +998 (99) 761-11-11
🌐 Сайт: www.gilamshop.uz
📷 Instagram: <a href="www.instagram.com/gilamshop/">Gilam Shop</a>`;

  const urlRegex = /^https?:\/\//;

  urlRegex.test(imgUrl) &&
  (await app.telegram.sendPhoto(
    Number(chatId),
    {
      url: imgUrl,
    },
    {
      caption: text,
      parse_mode: 'HTML',
    },
  ));

  if (!imgUrl) await app.telegram.sendMessage(Number(chatId), text, { parse_mode: 'HTML' });
  console.log("sent telegram!");
};

export default telegram;
