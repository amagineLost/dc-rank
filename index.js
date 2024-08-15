require('dotenv').config();
const express = require('express');
const axios = require('axios');
const { Client, GatewayIntentBits } = require('discord.js');

const app = express();
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

const robloxToken = process.env.ROBLOX_TOKEN;
const groupId = process.env.GROUP_ID;
const discordToken = process.env.DISCORD_TOKEN;

// Log when the Discord bot is ready
client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

// Function to get the X-CSRF-TOKEN
async function getCsrfToken() {
    try {
        const response = await axios.post('https://auth.roblox.com/v2/logout', {}, {
            headers: {
                'Cookie': `.ROBLOSECURITY=${robloxToken}`
            }
        });
        return response.headers['x-csrf-token'];
    } catch (error) {
        if (error.response && error.response.status === 403) {
            return error.response.headers['x-csrf-token'];
        } else {
            throw error;
        }
    }
}

// Function to handle role changes
async function updateRole(playerName, newRole) {
    try {
        const userIdResponse = await axios.get(`https://users.roblox.com/v1/users/search?keyword=${playerName}`);
        if (userIdResponse.data.data.length === 0) {
            throw new Error('Player not found');
        }
        const userId = userIdResponse.data.data[0].id;

        const rolesResponse = await axios.get(`https://groups.roblox.com/v1/groups/${groupId}/roles`);
        const role = rolesResponse.data.roles.find(r => r.name.toLowerCase() === newRole.toLowerCase());
        if (!role) {
            throw new Error('Role not found');
        }

        const csrfToken = await getCsrfToken();

        await axios({
            method: 'PATCH',
            url: `https://groups.roblox.com/v1/groups/${groupId}/users/${userId}`,
            headers: {
                'Cookie': `.ROBLOSECURITY=${robloxToken}`,
                'X-CSRF-TOKEN': csrfToken
            },
            data: {
                roleId: role.id,
            }
        });

        return { success: true, message: `Player's role updated to ${newRole}` };
    } catch (error) {
        console.error('Error updating role:', error.message);
        return { success: false, message: error.message };
    }
}

// Discord command handler
client.on('messageCreate', async message => {
    if (message.content.startsWith('-rank')) {
        const args = message.content.split(' ');
        const playerName = args[1];
        const newRole = args[2];

        if (!playerName || !newRole) {
            message.reply('Invalid command format. Use: -rank {playername} {rolename}');
            return;
        }

        const result = await updateRole(playerName, newRole);
        if (result.success) {
            message.reply(`Successfully updated the role for ${playerName} to ${newRole}`);
        } else {
            message.reply(`Failed to update the role: ${result.message}`);
        }
    }
});

client.login(discordToken);

// Start the express server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
