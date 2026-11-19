// =============================================
//  💡 بوت الاقتراحات ・ Suggestions Bot
//  مجاني من Codeon
// =============================================
require('dotenv').config();
const {
  Client, GatewayIntentBits: G, REST, Routes, SlashCommandBuilder, PermissionFlagsBits: P, ChannelType,
  ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, version,
} = require('discord.js');
const db = require('./src/db');
const { view } = require('./src/view');

const TOKEN = process.env.TOKEN;
if (!TOKEN) { console.error('❌ حط التوكن في ملف .env (TOKEN=...)'); process.exit(1); }

const client = new Client({ intents: [G.Guilds, G.GuildMessages, G.MessageContent] });

/* ---------- الأوامر ---------- */
const commands = [
  new SlashCommandBuilder().setName('suggestions').setDescription('إعدادات الاقتراحات')
    .setDefaultMemberPermissions(P.ManageGuild)
    .addSubcommand(s => s.setName('channel').setDescription('تحديد روم الاقتراحات')
      .addChannelOption(o => o.setName('room').setDescription('الروم').setRequired(true).addChannelTypes(ChannelType.GuildText)))
    .addSubcommand(s => s.setName('staff').setDescription('الرتبة اللي تقبل وترفض (فاضي = اللي عنده Manage Server)')
      .addRoleOption(o => o.setName('role').setDescription('الرتبة')))
    .toJSON(),
];

async function register(guild) {
  try {
    await new REST().setToken(TOKEN).put(Routes.applicationGuildCommands(client.user.id, guild.id), { body: commands });
    console.log(`✅ الأوامر سُجلت في ${guild.name}`);
  } catch (e) { console.error(`❌ ${guild.name}:`, e.message); }
}

const [a, b] = version.split('.').map(Number);
client.once(a > 14 || b >= 22 ? 'clientReady' : 'ready', async () => {
  console.log(`💡 بوت الاقتراحات جاهز: ${client.user.tag}`);
  client.user.setActivity('💡 اكتب اقتراحك');
  for (const g of client.guilds.cache.values()) await register(g);
});
client.on('guildCreate', register);

const isStaff = (m, g) => m.permissions.has(P.ManageGuild) || (g.staffRole && m.roles.cache.has(g.staffRole));
const say = (i, content) => (i.replied || i.deferred ? i.followUp({ content, flags: 64 }) : i.reply({ content, flags: 64 }));

/* ---------- رسالة في روم الاقتراحات ---------- */
client.on('messageCreate', async msg => {
  if (msg.author.bot || !msg.guild) return;
  const g = db.guild(msg.guild.id);
  if (msg.channel.id !== g.channel) return;

  const text = msg.content.trim();
  await msg.delete().catch(() => {});
  if (text.length < 5) {
    const w = await msg.channel.send(`${msg.author} ❌ اكتب اقتراحك بوضوح (5 أحرف على الأقل).`).catch(() => null);
    return setTimeout(() => w?.delete().catch(() => {}), 5000);
  }

  const id = ++g.n;
  const s = g.sugs[id] = { id, userId: msg.author.id, text, status: 'pending', up: [], down: [], at: Date.now() };
  const sent = await msg.channel.send(view(s, msg.author.displayAvatarURL({ size: 256 })));
  s.msgId = sent.id;
  db.save();
  sent.startThread({ name: `💬 نقاش اقتراح #${id}`, autoArchiveDuration: 1440 }).catch(() => {});
});

/* ---------- الأوامر والأزرار ---------- */
client.on('interactionCreate', async i => {
  if (!i.guild) return;
  const g = db.guild(i.guild.id);
  try {
    if (i.isChatInputCommand() && i.commandName === 'suggestions') {
      if (i.options.getSubcommand() === 'channel') {
        const room = i.options.getChannel('room');
        g.channel = room.id; db.save();
        return say(i, `✅ روم الاقتراحات: ${room}\nتأكد إن البوت عنده صلاحية **Manage Messages** و **Create Public Threads** فيه.`);
      }
      const role = i.options.getRole('role');
      g.staffRole = role?.id || null; db.save();
      return say(i, role ? `✅ رتبة الإدارة: ${role}` : '✅ اللي عندهم Manage Server بس يقدرون يقبلون ويرفضون.');
    }

    if (!(i.isButton() || i.isModalSubmit()) || !i.customId.startsWith('sg:')) return;
    const [, act, id] = i.customId.split(':');
    const s = g.sugs[id];
    if (!s) return say(i, '❌ هذا الاقتراح ما عاد موجود.');
    const avatar = i.message?.embeds[0]?.thumbnail?.url;

    // تصويت
    if (act === 'up' || act === 'down') {
      if (s.status !== 'pending') return say(i, '🔒 التصويت مقفل.');
      if (s.userId === i.user.id) return say(i, '❌ ما تقدر تصوّت على اقتراحك.');
      const mine = act === 'up' ? s.up : s.down, other = act === 'up' ? s.down : s.up;
      let note;
      if (mine.includes(i.user.id)) { mine.splice(mine.indexOf(i.user.id), 1); note = '↩️ شلت صوتك.'; }
      else {
        if (other.includes(i.user.id)) other.splice(other.indexOf(i.user.id), 1);
        mine.push(i.user.id);
        note = act === 'up' ? '✅ صوّت مع الاقتراح.' : '✖️ صوّت ضد الاقتراح.';
      }
      db.save();
      await i.update(view(s, avatar));
      return i.followUp({ content: note, flags: 64 });
    }

    if (!isStaff(i.member, g)) return say(i, '❌ للإدارة فقط.');
    if (s.status !== 'pending') return say(i, '❌ الاقتراح انحسم من قبل.');

    // نموذج السبب
    if (act === 'ok' || act === 'no') {
      return i.showModal(new ModalBuilder().setCustomId(`sg:${act}m:${id}`).setTitle(act === 'ok' ? 'قبول الاقتراح' : 'رفض الاقتراح')
        .addComponents(new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('reason').setLabel(act === 'ok' ? 'رد الإدارة (اختياري)' : 'سبب الرفض (اختياري)')
            .setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(500))));
    }

    if (act === 'okm' || act === 'nom') {
      s.status = act === 'okm' ? 'accepted' : 'rejected';
      s.reason = i.fields.getTextInputValue('reason').trim() || null;
      s.by = i.user.id;
      db.save();
      await i.update(view(s, avatar));
      const th = i.message.thread;
      if (th) th.setLocked(true).then(() => th.setArchived(true)).catch(() => {});
      const ok = s.status === 'accepted';
      const user = await client.users.fetch(s.userId).catch(() => null);
      user?.send(`${ok ? '✅ انقبل' : '❌ انرفض'} اقتراحك #${s.id} في **${i.guild.name}**${s.reason ? `\n💬 ${s.reason}` : ''}`).catch(() => {});
    }
  } catch (e) {
    console.error('interaction', e);
    try { await say(i, '❌ صار خطأ، حاول مرة ثانية.'); } catch {}
  }
});

process.on('unhandledRejection', e => console.error('unhandled', e));
client.login(TOKEN);
