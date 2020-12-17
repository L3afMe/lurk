const fetch  = require('node-fetch');
const tmi    = require('tmi.js');
const config = require('./config');

const getID = (username) => {
	return new Promise((resolve, reject) => {
		fetch(`https://api.twitch.tv/kraken/users?login=${username}`, {
			headers: {
				'Accept'   : 'application/vnd.twitchtv.v5+json',
				'Client-ID': 'cclk5hafv1i7lksfauerry4w7ythu2'
			}
		}).then((response) => response.json()).then((result) => {
			if (result.users[0]) {
				resolve(result.users[0]._id);
			} else {
				reject();
			}
		});
	});
};

const getFollowing = (id, page = 0) => {
	return new Promise((resolve, reject) => {
		fetch(`https://api.twitch.tv/kraken/users/${id}/follows/channels?limit=100&offset=${page * 100}`, {
			headers: {'Accept': 'application/vnd.twitchtv.v5+json', 'Client-ID': 'cclk5hafv1i7lksfauerry4w7ythu2'}
		}).then(response => response.json()).then(result => {
			if (result._total > 0) {
				const followings = result.follows.map(follow => follow.channel.display_name);
				if ((page + 1) * 100 < result._total) {
					getFollowing(id, page + 1).then(_followings => {
						resolve(followings + _followings);
					}).catch(reject);
				} else {
					resolve(followings);
				}
			} else {
				reject();
			}
		}).catch(reject);
	});
};

const lurk = () => {
	getID(config.username).then(id => {
		getFollowing(id).then(followings => {
			console.log(`Got ${followings.length} followings.`);
			const channels = followings.sort().map(follow => `#${follow}`);
			const options = {
				connection: {
					reconnect: true,
					secure   : true
				},
				identity  : {
					username: config.username,
					password: config.token
				},
				channels  : channels
			};
			
			const getCurrentTime = () => {
				const currentDate = new Date();
				return '[' + currentDate.getFullYear() + '-' +
					(('0' + (currentDate.getMonth() + 1)).slice(-2)) + '-' +
					(('0' + currentDate.getDate()).slice(-2)) + ' ' +
					(('0' + currentDate.getHours()).slice(-2)) + ':' +
					(('0' + currentDate.getMinutes()).slice(-2)) + ':' +
					(('0' + currentDate.getSeconds()).slice(-2)) + '] ';
			};
			
			const client = new tmi.client(options);
			client.connect().then(() => {
				client.on('logon', () =>
					console.log(getCurrentTime() + 'Connected to the Twitch server as ' + config.username + '.'));
				
				client.on('join', (channel, username) => {
					if (username === config.username) {
						console.log(getCurrentTime() + 'Joined ' + channel + '.');
					}
				});
				
				client.on('subgift', (channel, username, streakMonths, recipient) => {
					if (recipient === config.username) {
						console.log(getCurrentTime() + 'Received a subscription gift from user ' + username + ' in ' + channel + '!');
					}
				});
				
				client.on('reconnect', () =>
					console.log(getCurrentTime() + 'Trying to reconnect to the Twitch server...'));
				
				client.on('part', (channel, username) => {
					if (username === config.username) {
						console.log(getCurrentTime() + 'Disconnected from ' + channel + '.');
					}
				});
				
				client.on('disconnected', (reason) => {
					console.log(getCurrentTime() + 'Disconnected from the Twitch server. Reason: ' + reason + '. Reconnecting.');
					lurk();
				});
			});
		}).catch(() => {
			console.log(`Could not get ${config.username}'s following list.`);
		});
	}).catch(() => {
		console.log(`Could not get ${config.username}'s user ID.`);
	});
};

//lurk();