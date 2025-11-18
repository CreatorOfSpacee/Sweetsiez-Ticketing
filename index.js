const express = require('express');
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits } = require('discord.js');

// Configuration
const config = {
  DISCORD_TOKEN: process.env.DISCORD_TOKEN,
  TICKET_CHANNEL_ID: process.env.TICKET_CHANNEL_ID, // Channel where the ticket panel will be
  LOG_CHANNEL_ID: process.env.LOG_CHANNEL_ID, // Channel for ticket logs and transcripts
  OVERSEER_ROLE_ID: process.env.OVERSEER_ROLE_ID, // Role that can see all tickets (e.g., HR Team)
  PORT: process.env.PORT || 3000
};

// Ticket Categories Configuration
const TICKET_CATEGORIES = {
  general: {
    name: 'General Support',
    description: 'Any questions or concerns generally related to Sweetsiez.',
    emoji: '💬',
    roleId: process.env.GENERAL_SUPPORT_ROLE_ID,
    color: 0x3498db
  },
  discord: {
    name: 'Discord Support',
    description: 'Discord-related problems such as Community Guidelines violations.',
    emoji: '🛡️',
    roleId: process.env.DISCORD_SUPPORT_ROLE_ID,
    color: 0x5865f2
  },
  staff_report: {
    name: 'Staff Report',
    description: 'Submit a report against a Low Rank (Trainee - Staff Assistant).',
    emoji: '📝',
    roleId: process.env.STAFF_REPORT_ROLE_ID,
    color: 0xe67e22
  },
  mr_report: {
    name: 'MR Report',
    description: 'Submit a report against a MR Team Member (AS - GM). HR only.',
    emoji: '⚠️',
    roleId: process.env.HR_ROLE_ID,
    color: 0xe74c3c
  },
  alliance: {
    name: 'Alliance Support',
    description: 'Any general alliance inquiries.',
    emoji: '🤝',
    roleId: process.env.ALLIANCE_SUPPORT_ROLE_ID,
    color: 0x9b59b6
  },
  executive: {
    name: 'Executive Support',
    description: 'Contact our Executive Team for top serious matters.',
    emoji: '👔',
    roleId: process.env.EXECUTIVE_ROLE_ID,
    color: 0x1abc9c
  },
  development: {
    name: 'Development Support',
    description: 'Any development related issues (not suggestions).',
    emoji: '💻',
    roleId: process.env.DEVELOPER_ROLE_ID,
    color: 0x34495e
  },
  appeals: {
    name: 'Appeals',
    description: 'Appeal your ban or consequence issued by our team.',
    emoji: '⚖️',
    roleId: process.env.HR_ROLE_ID,
    color: 0xc0392b
  }
};

// Store active tickets (threadId -> {userId, category, claimedBy})
const activeTickets = new Map();

// Express server
const app = express();
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Sweetsiez Ticketing Bot is running!');
});

app.listen(config.PORT, () => {
  console.log(`Server running on port ${config.PORT}`);
});

// Discord Bot Setup
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

// Generate ticket transcript
async function generateTranscript(thread) {
  try {
    const messages = await thread.messages.fetch({ limit: 100 });
    const sortedMessages = Array.from(messages.values()).reverse();
    
    let transcript = `Ticket Transcript: ${thread.name}\n`;
    transcript += `Created: ${thread.createdAt.toLocaleString()}\n`;
    transcript += `━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    
    for (const msg of sortedMessages) {
      const timestamp = msg.createdAt.toLocaleTimeString();
      const author = `${msg.author.tag}`;
      transcript += `[${timestamp}] ${author}: ${msg.content}\n`;
      
      if (msg.embeds.length > 0) {
        transcript += `  └─ [Embed: ${msg.embeds[0].title || 'No title'}]\n`;
      }
      
      if (msg.attachments.size > 0) {
        msg.attachments.forEach(att => {
          transcript += `  └─ [Attachment: ${att.url}]\n`;
        });
      }
    }
    
    return transcript;
  } catch (error) {
    console.error('Error generating transcript:', error);
    return 'Error generating transcript.';
  }
}

// Send ticket panel
async function sendTicketPanel(channel) {
  const embed = new EmbedBuilder()
    .setTitle('Sweetsiez Support')
    .setDescription(
      "Welcome to the **Sweetsiez Support System!** We're here to assist with your needs, so please remain respectful when using our support system. Sweetsiez Support Representatives have every right to close and/or blacklist you from using support entirely.\n\n" +
      "We have a multitude of support categories, so please review below and select the one that best tailors your needs!\n\n" +
      "━━━━━━━━━━━━━━━━━━━━━━━━\n\n" +
      "**💬 General Support**\nThe General Support category is used for any questions or concerns generally related to Sweetsiez.\n\n" +
      "**🛡️ Discord Support**\nThe Discord Support category is used for Discord-related problems such as someone violating our Community Guidelines.\n\n" +
      "**📝 Staff Report**\nThe Staff Report category is used to submit a report against a Low Rank (Trainee - Staff Assistant).\n\n" +
      "**⚠️ MR Report**\nThe MR report category is used to submit a report against a MR Team Member (Assistant Supervisor - General Manager). MR Reports can only be viewed by the Human Resources Department.\n\n" +
      "**🤝 Alliance Support**\nThe Alliance Support category is used for any general alliance inquires.\n\n" +
      "**👔 Executive Support**\nThe Executive Support category is used to get in contact with our Executive Team for top serious matters.\n\n" +
      "**💻 Development Support**\nThe Development Support category is used for any development related issues, except suggestions, please use the suggestions ticket option for these.\n\n" +
      "**⚖️ Appeals**\nThe Appeals category is used to appeal your ban or consequence issued by our team. Please answer all questions when prompted, any arguing with the Human Resources Department will result in the appeal being declined."
    )
    .setColor(0xffc0cb)
    .setFooter({ text: 'Select a category below to create a ticket' });

  const row1 = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('ticket_general')
        .setLabel('General Support')
        .setEmoji('💬')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('ticket_discord')
        .setLabel('Discord Support')
        .setEmoji('🛡️')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('ticket_staff_report')
        .setLabel('Staff Report')
        .setEmoji('📝')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('ticket_mr_report')
        .setLabel('MR Report')
        .setEmoji('⚠️')
        .setStyle(ButtonStyle.Danger)
    );

  const row2 = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('ticket_alliance')
        .setLabel('Alliance Support')
        .setEmoji('🤝')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('ticket_executive')
        .setLabel('Executive Support')
        .setEmoji('👔')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('ticket_development')
        .setLabel('Development Support')
        .setEmoji('💻')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('ticket_appeals')
        .setLabel('Appeals')
        .setEmoji('⚖️')
        .setStyle(ButtonStyle.Danger)
    );

  await channel.send({ embeds: [embed], components: [row1, row2] });
}

// Create ticket thread
async function createTicket(interaction, categoryKey) {
  const category = TICKET_CATEGORIES[categoryKey];
  const member = interaction.member;
  const channel = interaction.channel;

  // Check if user already has an open ticket
  for (const [threadId, data] of activeTickets.entries()) {
    if (data.userId === member.id) {
      return interaction.reply({ 
        content: '❌ You already have an open ticket! Please close your existing ticket before opening a new one.', 
        ephemeral: true 
      });
    }
  }

  try {
    // Create thread
    const thread = await channel.threads.create({
      name: `${category.emoji} ${category.name} - ${member.user.username}`,
      autoArchiveDuration: 60,
      type: ChannelType.PrivateThread,
      reason: `Ticket created by ${member.user.tag}`
    });

    // Add user to thread
    await thread.members.add(member.id);

    // Add support role to thread
    if (category.roleId) {
      const role = await interaction.guild.roles.fetch(category.roleId);
      if (role && role.members) {
        for (const [memberId, roleMember] of role.members) {
          await thread.members.add(memberId).catch(() => {});
        }
      }
    }

    // Add overseer role to thread
    if (config.OVERSEER_ROLE_ID) {
      const overseerRole = await interaction.guild.roles.fetch(config.OVERSEER_ROLE_ID);
      if (overseerRole && overseerRole.members) {
        for (const [memberId, roleMember] of overseerRole.members) {
          await thread.members.add(memberId).catch(() => {});
        }
      }
    }

    // Store ticket data
    activeTickets.set(thread.id, {
      userId: member.id,
      category: categoryKey,
      claimedBy: null,
      createdAt: new Date()
    });

    // Create ticket embed
    const ticketEmbed = new EmbedBuilder()
      .setTitle(`${category.emoji} ${category.name}`)
      .setDescription(
        `Welcome <@${member.id}>!\n\n` +
        `${category.description}\n\n` +
        `A support representative will be with you shortly. Please describe your issue in detail.`
      )
      .setColor(category.color)
      .addFields(
        { name: 'Ticket Creator', value: `<@${member.id}>`, inline: true },
        { name: 'Category', value: category.name, inline: true },
        { name: 'Status', value: '🟢 Open', inline: true }
      )
      .setTimestamp();

    // Create buttons
    const buttonRow = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`claim_${thread.id}`)
          .setLabel('Claim')
          .setEmoji('✋')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`close_${thread.id}`)
          .setLabel('Close')
          .setEmoji('🔒')
          .setStyle(ButtonStyle.Danger)
      );

    // Send ticket message with ping
    let pingMessage = `<@${member.id}>`;
    if (category.roleId) {
      pingMessage += ` <@&${category.roleId}>`;
    }

    await thread.send({ content: pingMessage, embeds: [ticketEmbed], components: [buttonRow] });

    await interaction.reply({ 
      content: `✅ Ticket created! Please check <#${thread.id}>`, 
      ephemeral: true 
    });

  } catch (error) {
    console.error('Error creating ticket:', error);
    await interaction.reply({ 
      content: '❌ Failed to create ticket. Please contact an administrator.', 
      ephemeral: true 
    });
  }
}

// Handle claim/unclaim
async function handleClaim(interaction, threadId) {
  const ticketData = activeTickets.get(threadId);
  if (!ticketData) {
    return interaction.reply({ content: '❌ Ticket data not found!', ephemeral: true });
  }

  const category = TICKET_CATEGORIES[ticketData.category];
  const member = interaction.member;

  // Check if user has the support role
  if (!member.roles.cache.has(category.roleId) && !member.roles.cache.has(config.OVERSEER_ROLE_ID)) {
    return interaction.reply({ 
      content: '❌ You do not have permission to claim this ticket!', 
      ephemeral: true 
    });
  }

  const thread = await interaction.channel.fetch();

  if (ticketData.claimedBy === null) {
    // Claim the ticket
    ticketData.claimedBy = member.id;
    
    const buttonRow = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`claim_${threadId}`)
          .setLabel('Unclaim')
          .setEmoji('🚫')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`close_${threadId}`)
          .setLabel('Close')
          .setEmoji('🔒')
          .setStyle(ButtonStyle.Danger)
      );

    await interaction.update({ components: [buttonRow] });
    await thread.send(`✅ Ticket claimed by <@${member.id}>`);
  } else {
    // Unclaim the ticket
    ticketData.claimedBy = null;
    
    const buttonRow = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`claim_${threadId}`)
          .setLabel('Claim')
          .setEmoji('✋')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`close_${threadId}`)
          .setLabel('Close')
          .setEmoji('🔒')
          .setStyle(ButtonStyle.Danger)
      );

    await interaction.update({ components: [buttonRow] });
    await thread.send(`🔓 Ticket unclaimed by <@${member.id}>`);
  }
}

// Handle close
async function handleClose(interaction, threadId) {
  const ticketData = activeTickets.get(threadId);
  if (!ticketData) {
    return interaction.reply({ content: '❌ Ticket data not found!', ephemeral: true });
  }

  const thread = interaction.channel;
  
  await interaction.reply({ content: '🔒 Closing ticket and generating transcript...', ephemeral: true });

  try {
    // Generate transcript
    const transcript = await generateTranscript(thread);
    
    // Send to log channel
    if (config.LOG_CHANNEL_ID) {
      const logChannel = await interaction.guild.channels.fetch(config.LOG_CHANNEL_ID);
      const category = TICKET_CATEGORIES[ticketData.category];
      
      const logEmbed = new EmbedBuilder()
        .setTitle('🔒 Ticket Closed')
        .setColor(0x95a5a6)
        .addFields(
          { name: 'Ticket Name', value: thread.name, inline: true },
          { name: 'Category', value: category.name, inline: true },
          { name: 'Creator', value: `<@${ticketData.userId}>`, inline: true },
          { name: 'Closed By', value: `<@${interaction.user.id}>`, inline: true },
          { name: 'Claimed By', value: ticketData.claimedBy ? `<@${ticketData.claimedBy}>` : 'Unclaimed', inline: true },
          { name: 'Created At', value: ticketData.createdAt.toLocaleString(), inline: true }
        )
        .setTimestamp();

      await logChannel.send({ embeds: [logEmbed] });
      
      // Send transcript as text file
      const buffer = Buffer.from(transcript, 'utf-8');
      await logChannel.send({
        content: '📄 **Ticket Transcript**',
        files: [{
          attachment: buffer,
          name: `transcript-${thread.id}.txt`
        }]
      });
    }

    // Remove from active tickets
    activeTickets.delete(threadId);

    // Delete thread
    await thread.delete();

  } catch (error) {
    console.error('Error closing ticket:', error);
    await interaction.followUp({ 
      content: '❌ Error occurred while closing ticket.', 
      ephemeral: true 
    });
  }
}

// Bot ready event
client.once('ready', () => {
  console.log(`✅ Bot logged in as ${client.user.tag}`);
  client.user.setActivity('Sweetsiez Tickets', { type: 'WATCHING' });
});

// Handle interactions
client.on('interactionCreate', async interaction => {
  if (!interaction.isButton()) return;

  const customId = interaction.customId;

  // Handle ticket creation
  if (customId.startsWith('ticket_')) {
    const categoryKey = customId.replace('ticket_', '');
    await createTicket(interaction, categoryKey);
  }
  
  // Handle claim/unclaim
  else if (customId.startsWith('claim_')) {
    const threadId = customId.replace('claim_', '');
    await handleClaim(interaction, threadId);
  }
  
  // Handle close
  else if (customId.startsWith('close_')) {
    const threadId = customId.replace('close_', '');
    await handleClose(interaction, threadId);
  }
});

// Command to setup ticket panel (run once)
client.on('messageCreate', async message => {
  if (message.content === '!setuptickets' && message.member.permissions.has(PermissionFlagsBits.Administrator)) {
    await sendTicketPanel(message.channel);
    await message.delete();
  }
});

// Login to Discord
client.login(config.DISCORD_TOKEN);
