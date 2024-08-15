const express = require('express');
const axios = require('axios');
const { Client, GatewayIntentBits } = require('discord.js');

const app = express();
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

// Load environment variables (make sure these are set in Render)
const robloxToken = process.env.ROBLOX_TOKEN;
const groupId = process.env.GROUP_ID;
const discordToken = process.env.DISCORD_TOKEN;

// Log to confirm server start
console.log('Starting server and Discord bot...');

// Function to get the X-CSRF-TOKEN
async function getCsrfToken() {
    try {
        const response = await axios.post('https://auth.roblox.com/v2/logout', {}, {
            headers: {
                'Cookie': `.ROBLOSECURITY=${robloxToken}`
            }
        });
        console.log('CSRF Token Retrieved:', response.headers['x-csrf-token']);
        return response.headers['x-csrf-token'];
    } catch (error) {
        console.error('Failed to retrieve CSRF token:', error.response ? error.response.data : error.message);
        throw new Error('Failed to retrieve CSRF token');
    }
}

// Function to check if a player is in the group
async function isPlayerInGroup(userId) {
    try {
        const response = await axios.get(`https://groups.roblox.com/v1/groups/${groupId}/users/${userId}`);
        console.log(`Player ${userId} group membership check response:`, response.data);
        return response.data && response.data.userId === userId;
    } catch (error) {
        console.error('Error checking player group membership:', error.response ? error.response.data : error.message);
        return false;
    }
}

// Function to handle role changes
async function updateRole(playerName, newRole, retryCount = 0) {
    try {
        // Retrieve the player's user ID from their username
        const userIdResponse = await axios.get(`https://users.roblox.com/v1/users/search?keyword=${encodeURIComponent(playerName)}`);
        console.log('User ID Response:', userIdResponse.data);
        
        if (userIdResponse.data.data.length === 0) {
            throw new Error('Player not found');
        }
        const userId = userIdResponse.data.data[0].id;

        // Check if the player is in the group
        const isInGroup = await isPlayerInGroup(userId);
        if (!isInGroup) {
            throw new Error('Player is not in the group');
        }

        // Get the roles available in the group
        const rolesResponse = await axios.get(`https://groups.roblox.com/v1/groups/${groupId}/roles`);
        console.log('Roles Response:', rolesResponse.data);

        const role = rolesResponse.data.roles.find(r => r.name.toLowerCase().includes(newRole.trim().toLowerCase()));
        if (!role) {
            throw new Error('Role not found');
        }

        // Get the CSRF token
        const csrfToken = await getCsrfToken();

        // Update the player's role
        const updateResponse = await axios({
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

        console.log('Role Update Response:', updateResponse.data);
        return { success: true, message: `Player's role updated to ${newRole}` };
    } catch (error) {
        console.error('Error updating role:', error.response ? error.response.data : error.message);

        if (error.response && error.response.status === 401) {
            console.error('Authorization error. Please check your tokens and permissions.');
        } else if (error.response && error.response.status === 429) {
            const retryAfter = error.response.headers['retry-after'] || Math.pow(2, retryCount) * 1000;
            console.log(`Rate limit hit. Retrying after ${retryAfter}ms.`);
            await new Promise(resolve => setTimeout(resolve, retryAfter));
            return updateRole(playerName, newRole, retryCount + 1);
        } else {
            console.error('Unexpected error:', error.message);
        }

        return { success: false, message: error.message };
    }
}

// Log when the Discord bot is ready
client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

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

// Start the Discord bot
client.login(discordToken);

// Root route to handle GET requests to "/"
app.get('/', (req, res) => {
    res.send('Welcome to the Discord Rank Project API!');
});

// Start the express server
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
