const axios = require('axios').default;
const { Telegraf } = require("telegraf");
const NodeID3 = require('node-id3');

require('dotenv').config();

const bot = new Telegraf(process.env.TG_BOT_TOKEN);

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
          const artists = fileInfo.artist
            .split(/\&|feat|feat./)
            .map(artist => `#${artist.trim().replaceAll(/\W|\s/gi, '')}`)
            .join(' ');

          const genre = fileInfo.genre
            ? `\nСтиль: #${fileInfo.genre.split(' ').join('')}`
            : '';

          ctx.telegram.sendAudio(ctx.chat.id, ctx.update.message.audio.file_id, {
            caption: `Исполнитель: ${artists}${genre}`,
          });
        });
    });
});

bot.launch();
