const axios = require('axios').default;
const { Telegraf } = require("telegraf");
const NodeID3 = require('node-id3');

require('dotenv').config();

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

bot.on('message', (ctx) => {
  ctx.telegram
    .getFileLink(ctx.update.message.audio.file_id)
    .then(res => {
      axios
        .get(res.href, {
          responseType: "arraybuffer",
        })
        .then((file) => NodeID3.read(file.data))
        .then(fileInfo => {
          const remixLabel = fileInfo.title.toLowerCase().includes('remix')
            ? '\n🎛 #REMIX'
            : '';

          const bestLabel = ctx.update.message.caption?.includes('/best')
            ? '\n🔥#BEST'
            : '';

          const matchRemixerArtist = fileInfo.title.match(/\((.*?)\)/gi);

          const remixerArtist = matchRemixerArtist
            ? matchRemixerArtist[0]
              .replaceAll(/\(|\)/gi, '')
              .split(/\s|, |\&|feat|feat./)
              .filter(word => word.toLowerCase() !== 'remix')
            : [];

          const artists = fileInfo.artist
            .split(/\&|feat|feat.|, /)
            .concat(remixerArtist)
            .map(artist => `#${artist.trim().replaceAll(/\W|\s/gi, '')}`)
            .join(' ');

          const genre = fileInfo.genre
            ? `\nСтиль: #${getGenre(fileInfo.genre)}`
            : '';

          ctx.telegram.sendAudio(ctx.chat.id, ctx.update.message.audio.file_id, {
            caption: `${bestLabel}${remixLabel}\nИсполнитель: ${artists}${genre}`,
          });
        });
    });
});

bot.launch();
