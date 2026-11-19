// شكل رسالة الاقتراح: إمبد + أزرار التصويت + أزرار الإدارة
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const STATUS = {
  pending:  { name: '⏳ قيد المراجعة', color: 0xF1C40F },
  accepted: { name: '✅ مقبول', color: 0x2ECC71 },
  rejected: { name: '❌ مرفوض', color: 0xE74C3C },
};

function view(s, avatar) {
  const st = STATUS[s.status];
  const up = s.up.length, down = s.down.length, total = up + down;
  const pct = total ? Math.round((up / total) * 100) : 0;

  const e = new EmbedBuilder().setColor(st.color).setTitle(`💡 اقتراح #${s.id}`).setTimestamp(s.at)
    .setThumbnail(avatar || null)
    .addFields(
      { name: '👤 العضو', value: `<@${s.userId}>`, inline: true },
      { name: '📌 الحالة', value: st.name, inline: true },
      { name: '📊 التصويت', value: `👍 ${up} ・ 👎 ${down} ・ ${pct}%`, inline: true },
      { name: '📝 الاقتراح', value: '```' + s.text.replace(/```/g, "'''").slice(0, 1000) + '```' },
    )
    .setFooter({ text: 'Codeon ・ بوت اقتراحات مجاني' });
  if (s.reason) e.addFields({ name: s.status === 'accepted' ? '💬 رد الإدارة' : '💬 سبب الرفض', value: s.reason.slice(0, 1000) });
  if (s.by) e.addFields({ name: '👮 بواسطة', value: `<@${s.by}>`, inline: true });

  const done = s.status !== 'pending';
  const votes = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`sg:up:${s.id}`).setEmoji('✅').setStyle(ButtonStyle.Success).setDisabled(done),
    new ButtonBuilder().setCustomId(`sg:count:${s.id}`).setLabel(`${up - down >= 0 ? '+' : ''}${up - down}`).setEmoji('📊').setStyle(ButtonStyle.Secondary).setDisabled(true),
    new ButtonBuilder().setCustomId(`sg:down:${s.id}`).setEmoji('✖️').setStyle(ButtonStyle.Danger).setDisabled(done),
  );
  if (done) return { embeds: [e], components: [votes] };
  const staff = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`sg:ok:${s.id}`).setLabel('قبول').setEmoji('✅').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`sg:no:${s.id}`).setLabel('رفض').setEmoji('✖️').setStyle(ButtonStyle.Danger),
  );
  return { embeds: [e], components: [votes, staff] };
}

module.exports = { view };
