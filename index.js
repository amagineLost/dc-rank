const express = require('express');
const axios = require('axios');
const { Client, Intents } = require('discord.js');
require('dotenv').config();

const app = express();
const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES] });

const robloxToken = process.env.ROBLOX_TOKEN;
const groupId = process.env.GROUP_ID;
const discordToken = process.env.DISCORD_TOKEN;

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

// Function to set Roblox role
async function setRole(playerName, newRole) {
    try {
        // Retrieve the player's user ID from their username
        const userIdResponse = await axios.get(`https://users.roblox.com/v1/users/search?keyword=${playerName}`);
        if (userIdResponse.data.data.length === 0) {
            throw new Error('Player not found');
        }
        const userId = userIdResponse.data.data[0].id;

        // Get the roles available in the group
        const rolesResponse = await axios.get(`https://groups.roblox.com/v1/groups/${groupId}/roles`);
        const role = rolesResponse.data.roles.find(r => r.name.toLowerCase() === newRole.toLowerCase());
        if (!role) {
            throw new Error('Role not found');
        }

        // Get the CSRF token
        const csrfToken = await getCsrfToken();

        // Set the player's role
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

        return `Successfully updated ${playerName}'s role to ${newRole}`;
    } catch (error) {
        return `Failed to update the role: ${error.message}`;
    }
}

// Discord bot setup
client.once('ready', () => {
    console.log('Discord bot is ready!');
});

client.on('messageCreate', async (message) => {
    if (message.content.startsWith('-rank')) {
        const args = message.content.slice(6).split(' ');
        const playerName = args[0];
        const newRole = args[1];

        if (!playerName || !newRole) {
            message.reply('Invalid command format. Use: -rank {playername} {rolename}');
            return;
        }

        const result = await setRole(playerName, newRole);
        message.reply(result);
    }
});

// Start the bot
client.login(discordToken);

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
