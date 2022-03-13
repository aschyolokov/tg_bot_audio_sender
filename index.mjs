import axios from 'axios';
import { Telegraf } from 'telegraf';
import NodeID3 from 'node-id3';
import dotenv from 'dotenv';

dotenv.config();

const bot = new Telegraf(process.env.TG_BOT_TOKEN);

const getGenre = (genre) => {
  let result = '';

  switch (genre) {
    case '(18)':
      result = 'Techno';
      break;
    case '(127)':
      result = 'DrumBass';
      break;
    default:
      result = genre;
  }

  return result.split(/\s|\&/).join('');
};

const launchBot = () => {
  bot
    .launch()
    .then(() => console.log('Бот запущен!'))
    .catch((e) => console.log(`Бот не запущен. Произошла ошибка: ${e.message}`));
};

const getRemixLabel = (fileInfo) => fileInfo.title.toLowerCase().includes('remix')
  ? '\n🎛 #REMIX'
  : '';

const getBestLabel = (ctx) => ctx.update.message.caption?.includes('/best')
  ? '\n🔥#BEST'
  : '';

const getRemixerArtist = (matchRemixerArtist) => matchRemixerArtist
  ? matchRemixerArtist[0]
    .replaceAll(/\(|\)/gi, '')
    .split(/\s|, |\&|feat|feat./)
    .filter(word => word.toLowerCase() !== 'remix')
  : [];

const getArtists = (fileInfo, remixerArtist) => fileInfo.artist
  .split(/\&|feat|feat.|, /)
  .concat(remixerArtist)
  .map(artist => `#${artist.trim().replaceAll(/\W|\s/gi, '')}`)
  .join(' ');

bot.on('message', (ctx) => {
  if (ctx.update.message.text === '/start') {
    ctx.telegram.sendMessage(ctx.chat.id, 'Добавьте аудио файлы.');
    return;
  }

  if (!ctx.update.message.audio) {
    ctx.telegram.sendMessage(ctx.chat.id, 'Неверная команда');
    return;
  }

    ctx.telegram
      .getFileLink(ctx.update.message.audio.file_id)
      .then(res => {
        axios
          .get(res.href, {
            responseType: "arraybuffer",
          })
          .then((file) => NodeID3.read(file.data))
          .then(fileInfo => {
            const remixLabel = getRemixLabel(fileInfo);
            const bestLabel = getBestLabel(ctx);
            const matchRemixerArtist = fileInfo.title.match(/\((.*?)\)/gi);
            const remixerArtist = getRemixerArtist(matchRemixerArtist);
            const artists = getArtists(fileInfo, remixerArtist);
            const genre = fileInfo.genre ? `\nСтиль: #${getGenre(fileInfo.genre)}` : '';

            ctx.telegram.sendAudio(
              ctx.chat.id,
              ctx.update.message.audio.file_id,
              {
                caption: `${bestLabel}${remixLabel}\nИсполнитель: ${artists}${genre}`,
              },
            );
          });
      })
      .catch((e) => {
        ctx.telegram.sendMessage(ctx.chat.id, 'Что-то пошло не так. Попробуйте ещё раз или повторите позже.');
        console.log(`Произошла ошибка: ${e.message}`);
      });
});

launchBot();
