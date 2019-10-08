var relay = require("./modules/relay.js");
var request = require("request");
relay = new relay("proxyTester");

let proxy_url = "" // api.proxyscrape.com
var proxies = [];

var rotatingProxies = [];

relay.on("onRelayConnected", function() {
	console.log("Proxy conncted to bus");
});
relay.on("getproxy", function(data) {
	console.log("data",data);
	let proxy = "";
	if (data == "fixed") {
		proxy = validProxies.shift();
		validProxies.push(proxy);
	} else 	if (data == "rotating") {
		proxy = rotatingProxies.shift();
		rotatingProxies.push(proxy);
	}
	relay.send({
		event: "receiveproxy",
		data: proxy
	})
});



function checkAllProxies() {
	rotatingProxies = [];
	proxies.forEach((proxy, index) => {
		setTimeout(() => {
			checkProxy(proxy)
		}, 1000 * index);
	})
}

function fetchProxies() {
	let options = {};
	var agent = undefined;
	options.url = proxy_url;
	options.timeout = 3000;
	options.headers = {
		'User-Agent': "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:69.0) Gecko/20100101 Firefox/69.0"
	};
	new Promise(async function(resolve, reject) {
		request(options, function(error, response, body) {
			if (error || (response.statusCode != 200)) {
				console.log(response.statusCode);
				console.log(error);
				return reject(error);
			} else {
				console.log("status", response.statusCode);
				proxies = [];
				body.split("\r\n").forEach(proxy => {
					if (proxy != "") {
						proxies.push("http://" + proxy);
					}
				})
				checkAllProxies();
				//proxies
			}
		});
	})
}

function checkProxy(proxyAddr) {
	console.log("checking proxy", proxyAddr);
	let toTest = "https://store.steampowered.com/join/?l=english";
	let request_proxy = request.defaults({
		'proxy': proxyAddr
	});
	let options = {};
	var agent = undefined;
	options.url = toTest;
	options.timeout = 10 * 1000;
	options.headers = {
		'User-Agent': "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:69.0) Gecko/20100101 Firefox/69.0"
	};
	new Promise(async function(resolve, reject) {
		request_proxy(options, function(error, response, body) {
			if (!response) response = {
				statusCode: 9000
			};
			if (error || (response.statusCode != 200)) {
				console.log(proxyAddr, error);
				console.log(response.statusCode);
				return reject(error);
			} else {
				let regex = /Your email address is used to confirm purchases and help you manage access to your Steam account./g;
				var found = body.match(regex);
				if (found) {
					return resolve({
						valid: true
					});
				} else {
					return resolve({
						valid: false
					});
				}
			}
		});
	}).then(response => {
		if (response.valid == true) {
			rotatingProxies.push(proxyAddr)
			console.log("Proxy valid");
		}
	}).catch(err => {
		console.error(err);
	})
}

fetchProxies();
setInterval(() => {
	fetchProxies();
}, 15 * 1000 * 60)