var Imap = require('imap');
var xoauth2 = require("xoauth2");
var EventEmitter = require('events').EventEmitter;
var OAuth_client_id = "" // OAuth CLIENT ID
var OAuth_client_key = "" // OAuth Client KEY
var OAuth_refresh_token = "" // OAuth refresh token
var EventManager = new EventEmitter();

function Deferred() {
	var self = this;
	this.promise = new Promise(function(resolve, reject) {
		self.reject = reject
		self.resolve = resolve
	})
}
var xoauth2gen = xoauth2.createXOAuth2Generator({
	user: "USERNAME EMAIL",
	clientId: OAuth_client_id,
	clientSecret: OAuth_client_key,
	refreshToken: OAuth_refresh_token,
	scope: "https://mail.google.com/"
});
var Mailbox = class extends EventEmitter {
	constructor(options) {
		super();
		this.init = false;
		this.Imap = new Imap(options);
		this.Imap.on('ready', () => {
			this.openInbox();
			this.init = true;
		});
		this.Imap.on('error', (err) => {
			console.log(err);
		});
		this.Imap.on('mail', (numMails) => {
			this.newMails(numMails);
		});
		this.Imap.on('end', () => {
			console.log("Connection ended.");
			restartImap();
		});
		this.Imap.connect();
	}
	openInbox() {
		this.Imap.openBox('INBOX', true, (err, box) => {
			if (err) throw err;
			this.emit('init');
			this.ready = true;
			EventManager.emit('Mail:Init');
		});
		console.log("init");
	}
	newMail(msg) {
		console.log(msg);
		let from_email = new Deferred();
		let to_email = new Deferred();
		let body_link = new Deferred();
		console.log('new Message');
		msg.on('body', function(stream, info) {
			var body = '';
			var count = 0;
			stream.on('data', function(chunk) {
				count += chunk.length;
				body += chunk.toString('utf8');
			});
			stream.once('end', function() {
				if (info.which == "TEXT") {
					let regex = /(https:\/\/store.steampowered.com\/account\/newaccountverification\?stoken=.{10,}\&creationid=.{10,})/g;
					var found = body.match(regex);
					if (found) {
						found = found[0];
						body_link.resolve(found.toString());
					} else {
						body_link.reject("NO LINK IN EMAIL");
					}
				} else if (info.which == 'HEADER.FIELDS (FROM)') {
					let mail = Imap.parseHeader(body).from[0].replace(`"Steam" <`, '').replace(">", "");
					from_email.resolve(mail);
				} else if (info.which == 'HEADER.FIELDS (TO)') {
					let mail = Imap.parseHeader(body).to[0];
					to_email.resolve(mail);
				}
			});
		});
		Promise.all([body_link.promise, to_email.promise, from_email.promise]).then((data) => {
			let email = {
				link: data[0],
				to: data[1],
				from: data[2]
			}
			this.emit('mail', email);
			EventManager.emit('Mail:New', email);
		}).catch((...err) => {
			console.log(err);
		});
	}
	newMails(numMails) {
		let self = this;
		console.log(numMails);
		self.Imap.search(['!NEW', ['FROM', "noreply@steampowered.com"]], function(err, results) {
			if (err) throw err;
			console.log(results);
			if (!results.length) return console.log("Not enough results");
			var f = self.Imap.fetch(results, {
				bodies: ['HEADER.FIELDS (FROM)', 'HEADER.FIELDS (TO)', 'TEXT']
			});
			f.on('message', function(msg, seqno) {
				self.newMail(msg);
			});
			f.once('error', function(err) {
				console.log('Fetch error: ' + err);
			});
			f.once('end', function() {
				console.log('Done fetching all messages!');
				self.Imap.move(results, "done", function(err) {
					if (err) return console.error(err);
				});
				//self.Imap.end();
			});
		});
	}
}
var MailReceiver = {};
xoauth2gen.generateToken(function(err, token) {
	if (err) {
		return console.log(err);
	}
	console.log("AUTH XOAUTH2 " + token);
	MailReceiver = new Mailbox({
		user: "USERNAME EMAIL",
		xoauth2: token,
		host: 'imap.gmail.com',
		servername: 'imap.gmail.com',
		port: 993,
		tls: true,
		servername: 'imap.gmail.com'
	})
});

function restartImap() {
	MailReceiver = {};
	xoauth2gen.generateToken(function(err, token) {
		if (err) {
			return console.log(err);
		}
		console.log("AUTH XOAUTH2 " + token);
		MailReceiver = new Mailbox({
			user: "USERNAME EMAIL",
			xoauth2: token,
			host: 'imap.gmail.com',
			servername: 'imap.gmail.com',
			port: 993,
			tls: true,
			servername: 'imap.gmail.com'
		})
	});
}
module.exports = {
	events: EventManager,
	mail: MailReceiver
}