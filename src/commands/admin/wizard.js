// src/commands/admin/wizard.js
class SetupWizard {
  constructor(client, configService) {
    this.client = client;
    this.configService = configService;
    this.steps = [
      'welcome',
      'tickets_category',
      'tickets_support_role',
      'tickets_log_channel',
      'shop_channel',
      'shop_customer_role',
      'complete'
    ];
  }
  
  async start(interaction) {
    const sessionId = `wizard_${interaction.user.id}_${Date.now()}`;
    
    // Store wizard state in memory (or Redis for production)
    this.wizardSessions = this.wizardSessions || new Map();
    this.wizardSessions.set(sessionId, {
      step: 0,
      data: {},
      guildId: interaction.guild.id,
      userId: interaction.user.id,
      startTime: Date.now()
    });
    
    // Show welcome screen
    const embed = new EmbedBuilder()
      .setColor(COLORS.PRIMARY)
      .setTitle('🧊 Welcome to Igloo Setup Wizard')
      .setDescription('This wizard will guide you through setting up Igloo for your server.')
      .setThumbnail(this.client.user.displayAvatarURL())
      .addFields(
        {
          name: 'What we\'ll configure:',
          value: [
            '📁 Ticket system settings',
            '🛒 Shop system settings',
            '⚙️ General bot settings'
          ].join('\n'),
          inline: false,
        },
        {
          name: 'Time required:',
          value: 'This will take approximately 2-3 minutes.',
          inline: false,
        }
      );
    
    const actionRow = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`wizard_next_${sessionId}`)
          .setLabel('Start Setup')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🚀'),
        new ButtonBuilder()
          .setCustomId(`wizard_cancel_${sessionId}`)
          .setLabel('Cancel')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('❌')
      );
    
    await interaction.reply({
      embeds: [embed],
      components: [actionRow],
      ephemeral: true,
    });
    
    // Set up collector for button interactions
    const message = await interaction.fetchReply();
    const collector = message.createMessageComponentCollector({
      filter: i => i.user.id === interaction.user.id,
      time: 15 * 60 * 1000 // 15 minutes
    });
    
    collector.on('collect', async i => {
      const [action, command, id] = i.customId.split('_');
      
      if (id !== sessionId) return;
      
      if (command === 'cancel') {
        this.wizardSessions.delete(sessionId);
        collector.stop();
        return await i.update({
          content: '❌ Setup wizard cancelled.',
          embeds: [],
          components: [],
        });
      }
      
      await i.deferUpdate();
      
      const session = this.wizardSessions.get(sessionId);
      if (!session) {
        return await i.editReply({
          content: '❌ Setup session expired. Please start again.',
          embeds: [],
          components: [],
        });
      }
      
      if (command === 'next') {
        session.step++;
        if (session.step >= this.steps.length) {
          // Complete setup
          await this.completeSetup(i, session);
          collector.stop();
          return;
        }
      } else if (command === 'prev') {
        session.step = Math.max(0, session.step - 1);
      } else if (command === 'select' || command === 'input') {
        // Process input/selection
        const currentStep = this.steps[session.step];
        await this.processInput(i, session, currentStep, command);
        return;
      }
      
      // Show current step
      await this.showStep(i, session);
    });
    
    collector.on('end', () => {
      this.wizardSessions.delete(sessionId);
    });
  }
  
  async showStep(interaction, session) {
    const currentStep = this.steps[session.step];
    const stepHandler = this.getStepHandler(currentStep);
    
    await stepHandler.showStep(interaction, session);
  }
  
  getStepHandler(step) {
    // Return appropriate step handler based on step name
    if (step.startsWith('tickets_')) {
      return new TicketSetupStepHandler(this.client, this.configService);
    } else if (step.startsWith('shop_')) {
      return new ShopSetupStepHandler(this.client, this.configService);
    } else if (step === 'welcome' || step === 'complete') {
      return new GeneralSetupStepHandler(this.client, this.configService);
    }
    
    throw new Error(`Unknown step: ${step}`);
  }
  
  async processInput(interaction, session, step, inputType) {
    const stepHandler = this.getStepHandler(step);
    
    const success = await stepHandler.processInput(interaction, session, step, inputType);
    
    if (success) {
      session.step++;
      await this.showStep(interaction, session);
    }
  }
  
  async completeSetup(interaction, session) {
    // Save all configuration
    try {
      await this.configService.bulkUpdateConfig(session.guildId, session.data);
      
      const embed = new EmbedBuilder()
        .setColor(COLORS.SUCCESS)
        .setTitle('✅ Setup Complete!')
        .setDescription('Igloo has been successfully configured for your server.')
        .setThumbnail(this.client.user.displayAvatarURL())
        .addFields(
          {
            name: 'What\'s Next?',
            value: [
              '1. Use `/ticket panel create` to create a ticket panel',
              '2. Use `/shop panel create` to create a shop panel',
              '3. Use `/setup view` to review your configuration'
            ].join('\n'),
            inline: false,
          }
        );
      
      await interaction.editReply({
        embeds: [embed],
        components: [],
      });
    } catch (error) {
      logger.error('Error completing setup:', error);
      await interaction.editReply({
        content: '❌ An error occurred while saving your configuration. Please try again.',
        embeds: [],
        components: [],
      });
    }
  }
}