import axios from 'axios';
import NodeID3 from 'node-id3';
import dotenvx from '@dotenvx/dotenvx';

import { Telegraf } from 'telegraf';
import { message } from 'telegraf/filters';

dotenvx.config();

const bot = new Telegraf(process.env.TG_BOT_TOKEN);

const GENRE_MAP = new Map([
  ['(7)', 'HipHop'],
  ['(18)', 'Techno'],
  ['(26)', 'Ambient'],
  ['(31)', 'Trance'],
  ['(35)', 'House'],
  ['(127)', 'DrumBass'],
]);

const ARTIST_SPLIT_REGEX = /&|ft\.?|feat\.?|vs\.?|,\s*/i;
const REMIXER_SPLIT_REGEX = /,\s*|&|ft\.?|feat\.?|vs\.?|\s*[Rr]emix/i;
const HASHTAG_CLEANUP_REGEX = /[^\p{L}\p{N}_]/gu; // Удаляет все, кроме букв, цифр и _ (с поддержкой Unicode)

/**
 * Получает название жанра по его коду.
 * @param {string} genreCode - Код жанра, например, '(7)'.
 * @returns {string} Очищенное название жанра, например, 'HipHop'.
 */
const getGenre = (genreCode) => {
  const genre = GENRE_MAP.get(genreCode) || genreCode;
  return genre.replace(/\s|&/g, '');
};

/**
 * Извлекает имена ремиксеров из названия трека.
 * @param {string} title - Название трека.
 * @returns {string[]} Массив имен ремиксеров.
 */
const getRemixerArtists = (title) => {
  const remixerMatch = title.match(/\((.*?)\)/);

  if (!remixerMatch || !remixerMatch[1]) {
    return [];
  }

  return remixerMatch[1]
    .split(REMIXER_SPLIT_REGEX)
    .map(artist => artist.trim())
    .filter(Boolean);
};

/**
 * Создает строку с хэштегами для всех исполнителей.
 * @param {string} mainArtists - Строка с основными исполнителями.
 * @param {string[]} remixerArtists - Массив ремиксеров.
 * @returns {string} Строка с хэштегами, например, '#Artist1 #Artist2 #Remixer1'.
 */
const getArtistsHashtags = (mainArtists, remixerArtists) => {
  const allArtists = [
    ...mainArtists.split(ARTIST_SPLIT_REGEX),
    ...remixerArtists
  ];

  return allArtists
    .map(artist => `#${artist.trim().replace(HASHTAG_CLEANUP_REGEX, '')}`)
    .join(' ');
};

bot.start((ctx) => {
  ctx.reply('Привет! Отправь мне аудиофайл, и я отформатирую его описание.');
});

bot.on(message('audio'), async (ctx) => {
  const { audio, caption: originalCaption } = ctx.message;

  try {
    const link = await ctx.telegram.getFileLink(audio.file_id);
    const response = await axios.get(link.href, { responseType: 'arraybuffer' });
    const tags = NodeID3.read(response.data);

    if (!tags || !tags.artist || !tags.title) {
      await ctx.reply('Не удалось прочитать метаданные (ID3 теги) из этого файла.');

      return;
    }

    const { title, artist, genre: genreCode } = tags;

    const bestLabel = originalCaption?.toLowerCase().includes('/best') ? '🔥 #BEST\n' : '';
    const remixLabel = title.toLowerCase().includes('remix') ? '🎛 #REMIX\n' : '';

    const remixerArtists = getRemixerArtists(title);
    const artistsHashtags = getArtistsHashtags(artist, remixerArtists);
    const genreHashtag = genreCode ? `Стиль: #${getGenre(genreCode)}` : '';

    const finalCaption = `${bestLabel}${remixLabel}Исполнитель: ${artistsHashtags}\nНазвание: ${title}\n${genreHashtag}`;

    await ctx.replyWithAudio(audio.file_id, { caption: finalCaption });

    console.log(`Трек "${artist} - ${title} (${genreHashtag})" успешно обработан.`);
  } catch (error) {
    console.error(`Ошибка при обработке файла: ${error.message}`);
    await ctx.reply('Произошла ошибка при обработке вашего файла. Пожалуйста, попробуйте еще раз.');
  }
});

bot.on('message', (ctx) => {
  ctx.reply('Пожалуйста, отправьте аудиофайл.');
});

const launchBot = () => {
  try {
    bot.launch(() => console.log('Бот успешно запущен!'));
  } catch (error) {
    console.error(`Не удалось запустить бота: ${error.message}`);
    process.exit(1);
  }
};

launchBot();

// Глобальный обработчик ошибок для бота
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
