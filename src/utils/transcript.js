const { AttachmentBuilder } = require('discord.js');

async function createTranscript(channel) {
  const messages = await channel.messages.fetch({ limit: 100 });
  const transcript = [];
  
  // Sort messages oldest first
  const sortedMessages = Array.from(messages.values()).reverse();
  
  for (const msg of sortedMessages) {
    const timestamp = msg.createdAt.toLocaleString();
    const author = `${msg.author.tag} (${msg.author.id})`;
    const content = msg.content || '[No content]';
    const attachments = msg.attachments.map(a => a.url).join('\n');
    
    let entry = `[${timestamp}] ${author}: ${content}`;
    if (attachments) entry += `\nAttachments: ${attachments}`;
    
    transcript.push(entry);
  }
  
  const transcriptText = transcript.join('\n\n');
  const buffer = Buffer.from(transcriptText, 'utf-8');
  const attachment = new AttachmentBuilder(buffer, { name: `transcript-${channel.name}.txt` });
  
  return attachment;
}

module.exports = { createTranscript };