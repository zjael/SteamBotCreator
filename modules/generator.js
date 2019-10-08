var Moniker = require('moniker');
String.prototype.replaceAll = function(search, replacement) {
	var target = this;
	return target.split(search).join(replacement);
};
var randomInt = function() {
	let max = 99;
	let min = 2;
	return Math.floor(Math.random() * (max - min) + min);
}


var usernames = Moniker.generator([Moniker.adjective, Moniker.verb, "./dicts/insults.txt"], {
	encoding: 'utf-8',
	glue: "+"
});
var nameCache = [];
var emails = ["babamail.club","nobot.club",/*"phook.pro",*/ "gilde-v.com"]




module.exports = {
	username: () => {
		let name = usernames.choose().replaceAll("+", "").replaceAll("-", "").replaceAll(" ", "") + randomInt();
		while (nameCache[name]) {
			name = usernames.choose().replaceAll("+", ""),replaceAll("-", "").replaceAll(" ", "") + randomInt();
		}
		return name;
	},
	password: (security = 1) => {
		let pass = "";
		for (var i = 0; i <= security; i++) {
			pass += Math.random().toString(36).slice(-4);
		}
		return pass;
	},
	mail: ()  => {
		let mail_start = usernames.choose().replaceAll("+", "") + randomInt();
		let mail_end = emails[Math.floor(Math.random() * emails.length)];
		return mail_start+"@"+mail_end;
	}
}