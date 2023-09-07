import axios from 'axios';
import { Telegraf } from 'telegraf';
import NodeID3 from 'node-id3';
import dotenv from 'dotenv';

dotenv.config();

const bot = new Telegraf(process.env.TG_BOT_TOKEN);

const getGenre = (genre) => {
  let result = '';

  switch (genre) {
    case '(7)':
      result = 'HipHop';
      break;
    case '(18)':
      result = 'Techno';
      break;
    case '(26)':
      result = 'Ambient';
      break;
    case '(31)':
      result = 'Trance';
      break;
    case '(35)':
      result = 'House';
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
  try {
    console.log('Бот запущен!');

    bot.launch();
  } catch (error) {
    if (error instanceof Error) {
      console.log(`Бот не запущен. Произошла ошибка: ${error.message}`);
      return;
    }
  }
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
    .split(/,\s|\&|ft[.]|feat[.]|vs[.]|\s[R|r]emix/)
    .filter(word => word !== '')
  : [];

const getArtists = (fileInfo, remixerArtist) => fileInfo.artist
  .split(/\&|ft[.]|feat[.]|vs[.]|, /)
  .concat(remixerArtist)
  .map(artist => `#${artist.trim().replaceAll(/[^\wа-я]|\s/giu, '')}`)
  .join(' ');

bot.on('message', (ctx) => {
  const {
    telegram,
    chat: {
      id: chatId
    },
    update: {
      message: {
        audio,
        text: messageText
      }
    }
  } = ctx;

  if (messageText === '/start') {
    telegram.sendMessage(chatId, 'Добавьте аудио файлы.');
    return;
  }

  if (!audio) {
    telegram.sendMessage(chatId, 'Неверная команда');
    return;
  }

  ctx.telegram
    .getFileLink(audio.file_id)
    .then(res => {
      axios
        .get(res.href, {
          responseType: "arraybuffer",
        })
        .then(
          (file) => NodeID3.read(file.data),
        )
        .then(fileInfo => {
          const {
            title,
            artist,
            genre: fileInfoGenre
          } = fileInfo;

          const remixLabel = getRemixLabel(fileInfo);
          const bestLabel = getBestLabel(ctx);
          const matchRemixerArtist = title.match(/\((.*?)\)/gi);
          const remixerArtist = getRemixerArtist(matchRemixerArtist);
          const artists = getArtists(fileInfo, remixerArtist);
          const normalizedGenre = `Стиль: #${getGenre(fileInfoGenre)}`;
          const genre = fileInfoGenre ? `\n${normalizedGenre}` : '';

          telegram.sendAudio(
            chatId,
            audio.file_id,
            {
              caption: `${bestLabel}${remixLabel}\nИсполнитель: ${artists}${genre}`,
            },
          )
          .then(
            () => console.log(`"${artist} - ${title} (${normalizedGenre})" для публикации готов.`),
          )
          .catch((e) => {
            const msgError = `Произошла ошибка при обработке: ${e.message}`;

            console.error(msgError);
            telegram.sendMessage(chatId, msgError);
          });
        });
    })
    .catch((e) => {
      telegram.sendMessage(chatId, 'Что-то пошло не так. Попробуйте ещё раз или повторите позже.');
      console.error(`Произошла ошибка: ${e.message}`);
    });
});

launchBot();
